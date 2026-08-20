// Open, repeatable "vote for your favorite video" -- any catalog entry is
// eligible, and the same person can vote for the same video more than once
// (ties into the original "vote by giving a dollar" idea, where more
// dollars later means more votes for that pick). firestore.rules blocks
// every client write to videoVotes/{rowNum} and voterTallies/{id} (the
// public tally and the per-voter running totals it's derived from), so
// this Function -- via the Admin SDK, which always bypasses Security Rules
// -- is the only thing allowed to touch either. Reacts to every new
// voteEvents/{id} doc (append-only, immutable -- see firestore.rules) and,
// in one transaction per event so concurrent votes on the same video can't
// race each other:
//   1. increments videoVotes/{rowNum}.count
//   2. increments voterTallies/{rowNum}_{uid}.count (this voter's running
//      total for this specific video)
//   3. if that now exceeds the stored topVoter, updates
//      videoVotes/{rowNum}.topVoter
//   4. always overwrites videoVotes/{rowNum}.latestVoter with this event
// displayName on the event is only present if the voter opted in (see
// users/{uid}.showVoterName) -- if it's missing, topVoter/latestVoter
// simply isn't set/updated for that event's contribution, so an opted-out
// voter still counts toward the number but never appears by name anywhere.
//
// Deploy: firebase deploy --only functions (after `npm install` inside
// this functions/ directory once).

"use strict";

const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const crypto = require("crypto");

initializeApp();
const db = getFirestore();

exports.onVoteEventCreated = onDocumentCreated("voteEvents/{id}", async (event) => {
  const vote = event.data.data();
  const rowNum = vote.rowNum;
  const uid = vote.uid;
  if (!rowNum || !uid) return;

  const videoVotesRef = db.collection("videoVotes").doc(rowNum);
  const tallyRef = db.collection("voterTallies").doc(rowNum + "_" + uid);

  await db.runTransaction(async (tx) => {
    const [videoVotesDoc, tallyDoc] = await Promise.all([tx.get(videoVotesRef), tx.get(tallyRef)]);
    const newTallyCount = (tallyDoc.exists ? tallyDoc.data().count : 0) + 1;

    tx.set(tallyRef, {
      rowNum: rowNum,
      uid: uid,
      displayName: vote.displayName || (tallyDoc.exists ? tallyDoc.data().displayName : null),
      count: newTallyCount
    }, { merge: true });

    const patch = {
      count: FieldValue.increment(1),
      artist: vote.artist || "",
      song: vote.song || "",
      thumb: vote.thumb || ""
    };

    if (vote.displayName) {
      patch.latestVoter = { displayName: vote.displayName, votedAt: vote.votedAt || null };
      const currentTopCount = videoVotesDoc.exists && videoVotesDoc.data().topVoter ? videoVotesDoc.data().topVoter.count : 0;
      if (newTallyCount > currentTopCount) {
        patch.topVoter = { displayName: vote.displayName, count: newTallyCount };
      }
    }

    tx.set(videoVotesRef, patch, { merge: true });
  });
});

// Admin-only: zeroes out a video's public vote standing (count, topVoter,
// latestVoter) AND deletes every voterTallies/{rowNum}_{uid} doc for it --
// not just the visible count, so a future vote's topVoter comparison
// (see onVoteEventCreated above, step 3) starts clean instead of
// comparing against a stale pre-reset tally that would let a new voter's
// very first vote look like it's "still behind" someone who's actually
// been wiped out. Doesn't touch voteEvents -- that history stays as an
// audit trail, it's just never replayed, so leaving it doesn't undo the
// reset. Callable directly by the client (via firebase.functions()),
// unlike onVoteEventCreated which only ever fires from a Firestore write
// -- this has to check admin status itself since it isn't gated by
// firestore.rules the way a direct client write would be.
exports.resetVideoVotes = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");

  const adminDoc = await db.collection("admins").doc(request.auth.uid).get();
  if (!adminDoc.exists) throw new HttpsError("permission-denied", "Admin only.");

  const rowNum = request.data && request.data.rowNum;
  if (typeof rowNum !== "string" || !rowNum) {
    throw new HttpsError("invalid-argument", "Missing rowNum.");
  }

  // A single batch caps out at 500 writes -- fine at today's vote
  // volumes (a handful of unique voters per video), but a video with
  // hundreds of distinct voters would need this chunked into multiple
  // batches to reset cleanly. Not attempted here since nothing in the
  // catalog is remotely close to that yet.
  const tallySnap = await db.collection("voterTallies").where("rowNum", "==", rowNum).get();
  const batch = db.batch();
  tallySnap.forEach((doc) => batch.delete(doc.ref));
  batch.set(db.collection("videoVotes").doc(rowNum), {
    count: 0,
    topVoter: FieldValue.delete(),
    latestVoter: FieldValue.delete()
  }, { merge: true });
  await batch.commit();

  return { ok: true, talliesCleared: tallySnap.size };
});

// ---- Vote retirement / Hall of Fame (dormant -- see VOTE_RETIREMENT_PLAN.md) ----
// Modeled on MTV TRL's retirement rule: a video that camps in the top N
// long enough gets permanently retired from active competition and
// enshrined in a Hall of Fame instead of just sitting at #1 forever.
// Cumulative, not consecutive -- a video that drops out of the top N and
// re-enters later just resumes accumulating where it left off, same as
// TRL's "cumulative days" (not "consecutive days") rule.
//
// DORMANT BY DESIGN while this is still in testing: this is an onCall
// Function, not an onSchedule one, so nothing runs automatically -- an
// admin has to manually trigger it (see the "Run retirement check now"
// button in the admin Vote Rounds view). It also only ever WRITES
// daysInTop/retired/voteHallOfFame; nothing on the live site reads or
// filters on those fields yet (see VOTE_RETIREMENT_PLAN.md's activation
// checklist), so even repeated manual runs can't change what any visitor
// currently sees. Retirement is additive/preserving, not destructive --
// unlike resetVideoVotes above, it freezes and snapshots the count/
// topVoter rather than erasing them.
const RETIREMENT_TOP_N = 5;
const RETIREMENT_DAYS = 14;

exports.checkVoteRetirements = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");

  const adminDoc = await db.collection("admins").doc(request.auth.uid).get();
  if (!adminDoc.exists) throw new HttpsError("permission-denied", "Admin only.");

  // Filtered in memory rather than via a Firestore where("retired","==",
  // false) clause: every videoVotes doc created before this feature
  // existed (i.e. every real one right now) has no `retired` field at
  // all, and Firestore equality filters exclude docs missing the field
  // entirely -- that query would silently match nothing until every doc
  // got backfilled. Fetching a wider slice by count and filtering here
  // sidesteps that AND avoids needing a new composite index.
  const topSnap = await db.collection("videoVotes")
    .orderBy("count", "desc")
    .limit(RETIREMENT_TOP_N * 5)
    .get();

  const batch = db.batch();
  const retiredNow = [];
  let consideredCount = 0;

  for (const doc of topSnap.docs) {
    if (consideredCount >= RETIREMENT_TOP_N) break;
    const data = doc.data();
    if (data.retired) continue; // already retired -- doesn't occupy a top-N slot or accumulate further
    consideredCount++;
    const newDaysInTop = (data.daysInTop || 0) + 1;
    if (newDaysInTop >= RETIREMENT_DAYS) {
      batch.update(doc.ref, {
        daysInTop: newDaysInTop,
        retired: true,
        retiredAt: FieldValue.serverTimestamp()
      });
      batch.set(db.collection("voteHallOfFame").doc(doc.id), {
        artist: data.artist || "",
        song: data.song || "",
        thumb: data.thumb || "",
        finalCount: data.count || 0,
        topVoter: data.topVoter || null,
        retiredAt: FieldValue.serverTimestamp()
      });
      retiredNow.push(doc.id);
    } else {
      batch.update(doc.ref, { daysInTop: newDaysInTop });
    }
  }

  await batch.commit();
  return { ok: true, checked: consideredCount, retiredNow: retiredNow };
});

// Admin correction for a mistaken retirement -- resets daysInTop back to
// 0 (a fresh runway, not immediately re-eligible for retirement on the
// next check) and clears the Hall of Fame entry. Doesn't touch count/
// topVoter, which retirement never altered in the first place.
exports.unretireVideo = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");

  const adminDoc = await db.collection("admins").doc(request.auth.uid).get();
  if (!adminDoc.exists) throw new HttpsError("permission-denied", "Admin only.");

  const rowNum = request.data && request.data.rowNum;
  if (typeof rowNum !== "string" || !rowNum) {
    throw new HttpsError("invalid-argument", "Missing rowNum.");
  }

  const batch = db.batch();
  batch.update(db.collection("videoVotes").doc(rowNum), {
    retired: false,
    daysInTop: 0
  });
  batch.delete(db.collection("voteHallOfFame").doc(rowNum));
  await batch.commit();

  return { ok: true };
});

// Deliberately short and NOT exhaustive -- catches the clearest, most
// common cases as a first pass for admin review, not a guarantee nothing
// slips through. Plain substring match (case-insensitive), so it has the
// usual false-positive risk of that approach (e.g. a name that happens to
// contain one of these as a sub-string of an innocuous word) -- acceptable
// here since a match only ever creates a review-queue entry, never blocks
// or auto-removes anything; an admin always makes the actual call. Extend
// this array directly if more terms need catching.
const FLAGGED_USERNAME_TERMS = [
  "fuck", "shit", "bitch", "asshole", "bastard", "cunt", "whore", "slut",
  "nigger", "nigga", "faggot", "retard", "rape"
];

function containsFlaggedTerm(name) {
  const lower = name.toLowerCase();
  return FLAGGED_USERNAME_TERMS.some(function (term) { return lower.indexOf(term) !== -1; });
}

// Reacts to every write under usernames/{key} (create on a fresh claim,
// update on a re-claim after a rename, delete on release) and keeps
// flaggedUsernames/{key} in sync -- present only while the underlying
// claim both still exists AND still matches the wordlist, so a renamed-
// or reset-away-from flagged name doesn't linger in the review queue.
exports.onUsernameWritten = onDocumentWritten("usernames/{usernameKey}", async (event) => {
  const key = event.params.usernameKey;
  const after = event.data.after.exists ? event.data.after.data() : null;
  const flagRef = db.collection("flaggedUsernames").doc(key);

  if (!after || !containsFlaggedTerm(after.display || key)) {
    await flagRef.delete().catch(() => {});
    return;
  }

  await flagRef.set({
    uid: after.uid,
    display: after.display || key,
    flaggedAt: FieldValue.serverTimestamp()
  });
});

// ---- Prepaid vote credits (Lemon Squeezy) -----------------------------
// Voting is free today (see onVoteEventCreated above -- the client writes
// voteEvents/{id} directly, no payment involved). This block is the
// backend half of a future pay-per-vote model: buy a bundle of $1 "vote
// credits" once via a hosted checkout, then spend them one at a time
// with no repeated card charge/re-auth per vote. Nothing here is wired
// into the live site yet -- app.js's castVote() is untouched, and none
// of these Functions are called from anywhere in the client yet.
//
// Uses Lemon Squeezy, not Stripe -- Stripe doesn't support Philippines-
// registered merchant accounts, so it was a dead end. Lemon Squeezy is a
// Merchant of Record (it legally resells on your behalf), which means no
// US entity is required and it settles payouts to a PH bank/Wise/
// Payoneer. Trade-off: since it's an MoR, it binds a checkout to one
// specific pre-created product Variant rather than a dynamic price the
// way Stripe's price_data did, so each bundle below needs its own
// Product+Variant created first in the Lemon Squeezy Dashboard.
//
// Requires two Firebase Functions secrets, set once via:
//   firebase functions:secrets:set LEMONSQUEEZY_API_KEY
//   firebase functions:secrets:set LEMONSQUEEZY_WEBHOOK_SECRET
// LEMONSQUEEZY_API_KEY: Dashboard -> Settings -> API -> create an API key.
// LEMONSQUEEZY_WEBHOOK_SECRET: the signing secret shown when creating a
// webhook (Dashboard -> Settings -> Webhooks) pointed at this deployed
// lemonSqueezyWebhook's URL, subscribed to the order_created event.

const lemonSqueezyApiKey = defineSecret("LEMONSQUEEZY_API_KEY");
const lemonSqueezyWebhookSecret = defineSecret("LEMONSQUEEZY_WEBHOOK_SECRET");

// Not secret (just Lemon Squeezy catalog IDs, not credentials), but each
// REPLACE_ placeholder below must be filled in with the real store ID
// and each bundle's real variant ID -- Dashboard -> Products -> a
// product's variant -- before this actually works. A checkout attempt
// against a placeholder ID will fail with a Lemon Squeezy API error, not
// silently misbehave.
const LEMONSQUEEZY_STORE_ID = "REPLACE_WITH_STORE_ID";

const WALLET_BUNDLES = {
  starter: { credits: 5, variantId: "REPLACE_WITH_STARTER_VARIANT_ID", label: "5 vote credits" },
  popular: { credits: 12, variantId: "REPLACE_WITH_POPULAR_VARIANT_ID", label: "12 vote credits" },
  superfan: { credits: 30, variantId: "REPLACE_WITH_SUPERFAN_VARIANT_ID", label: "30 vote credits" }
};

// Called from the client (e.g. an "Add vote credits" button) with
// { bundle: "starter" | "popular" | "superfan", successUrl }. Returns
// { url } -- redirect the browser there to open the hosted checkout.
// The purchasing uid and credit count travel in the checkout's custom
// data, not in anything the client controls past bundle selection, so
// lemonSqueezyWebhook below can trust them once its signature checks out.
// Unlike Stripe Checkout, Lemon Squeezy has no separate cancel_url --
// closing the checkout without paying just does nothing, no redirect.
exports.createWalletCheckout = onCall({ secrets: [lemonSqueezyApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");

  const bundleId = request.data && request.data.bundle;
  const bundle = WALLET_BUNDLES[bundleId];
  if (!bundle) throw new HttpsError("invalid-argument", "Unknown bundle.");

  const successUrl = request.data.successUrl;
  if (typeof successUrl !== "string") {
    throw new HttpsError("invalid-argument", "Missing successUrl.");
  }

  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      "Accept": "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      "Authorization": "Bearer " + lemonSqueezyApiKey.value()
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: request.auth.token.email || undefined,
            custom: {
              uid: request.auth.uid,
              bundleId: bundleId,
              credits: String(bundle.credits)
            }
          },
          product_options: { redirect_url: successUrl }
        },
        relationships: {
          store: { data: { type: "stores", id: LEMONSQUEEZY_STORE_ID } },
          variant: { data: { type: "variants", id: bundle.variantId } }
        }
      }
    })
  });

  const json = await res.json();
  if (!res.ok) {
    throw new HttpsError("internal", "Lemon Squeezy checkout failed: " + JSON.stringify(json.errors || json));
  }

  return { url: json.data.attributes.url };
});

// Lemon Squeezy webhook target (plain HTTPS endpoint, not onCall --
// Lemon Squeezy itself is the caller, not a signed-in site user).
// Verifies the HMAC-SHA256 signature against the raw request body before
// trusting anything in the payload. On a paid order_created event,
// credits the buyer's users/{uid}.voteCredits and logs a
// walletTransactions entry keyed by the Lemon Squeezy order ID, which
// doubles as an idempotency guard -- webhooks can and do get redelivered,
// and re-running this must not double-credit.
exports.lemonSqueezyWebhook = onRequest(
  { secrets: [lemonSqueezyWebhookSecret] },
  async (req, res) => {
    const signature = req.get("X-Signature");
    if (!signature) {
      res.status(400).send("Missing X-Signature header");
      return;
    }

    const hmac = crypto.createHmac("sha256", lemonSqueezyWebhookSecret.value());
    const digest = Buffer.from(hmac.update(req.rawBody).digest("hex"), "utf8");
    const signatureBuffer = Buffer.from(signature, "utf8");
    if (digest.length !== signatureBuffer.length || !crypto.timingSafeEqual(digest, signatureBuffer)) {
      res.status(401).send("Invalid signature");
      return;
    }

    const payload = JSON.parse(req.rawBody.toString("utf8"));
    const eventName = req.get("X-Event-Name") || (payload.meta && payload.meta.event_name);
    if (eventName !== "order_created") {
      res.status(200).send("ignored");
      return;
    }

    const order = payload.data.attributes;
    const customData = payload.meta.custom_data || {};
    const uid = customData.uid;
    const credits = parseInt(customData.credits, 10);
    const orderId = payload.data.id;

    if (order.status !== "paid" || !uid || !credits) {
      res.status(200).send("skipped");
      return;
    }

    const txnRef = db.collection("walletTransactions").doc("ls_" + orderId);
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(txnRef);
      if (existing.exists) return;

      tx.set(txnRef, {
        uid: uid,
        type: "purchase",
        credits: credits,
        amountCents: order.total,
        lemonSqueezyOrderId: orderId,
        createdAt: FieldValue.serverTimestamp()
      });
      tx.set(db.collection("users").doc(uid), {
        voteCredits: FieldValue.increment(credits)
      }, { merge: true });
    });

    res.status(200).send("ok");
  }
);

// The paid-vote counterpart to castVote() in app.js -- callable, not a
// direct client Firestore write, because spending a credit has to be
// checked-and-decremented atomically server-side (a client can't be
// trusted to enforce its own balance). Same voteEvents shape castVote()
// writes today, plus paid: true, so onVoteEventCreated above rolls it
// into videoVotes/topVoter exactly the same way regardless of whether
// the vote was free or paid.
exports.castVoteWithCredit = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");

  const data = request.data || {};
  const rowNum = data.rowNum;
  if (typeof rowNum !== "string" || !rowNum) {
    throw new HttpsError("invalid-argument", "Missing rowNum.");
  }

  const uid = request.auth.uid;
  const userRef = db.collection("users").doc(uid);
  const voteEventRef = db.collection("voteEvents").doc();

  await db.runTransaction(async (tx) => {
    const userDoc = await tx.get(userRef);
    const credits = (userDoc.exists && userDoc.data().voteCredits) || 0;
    if (credits < 1) {
      throw new HttpsError("failed-precondition", "Not enough vote credits.");
    }

    tx.set(userRef, { voteCredits: FieldValue.increment(-1) }, { merge: true });

    const voteDoc = {
      uid: uid,
      rowNum: rowNum,
      artist: data.artist || "",
      song: data.song || "",
      thumb: data.thumb || "",
      votedAt: FieldValue.serverTimestamp(),
      paid: true
    };
    if (data.displayName) voteDoc.displayName = data.displayName;
    tx.set(voteEventRef, voteDoc);

    tx.set(db.collection("walletTransactions").doc(), {
      uid: uid,
      type: "spend",
      credits: 1,
      rowNum: rowNum,
      createdAt: FieldValue.serverTimestamp()
    });
  });

  return { ok: true };
});
