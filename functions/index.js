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
const Stripe = require("stripe");

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

// ---- Prepaid vote credits (Stripe) -----------------------------------
// Voting is free today (see onVoteEventCreated above -- the client writes
// voteEvents/{id} directly, no payment involved). This block is the
// backend half of a future pay-per-vote model: buy a bundle of $1 "vote
// credits" once via Stripe Checkout, then spend them one at a time with
// no repeated card charge/re-auth per vote. Nothing here is wired into
// the live site yet -- app.js's castVote() is untouched, and none of
// these Functions are called from anywhere in the client yet. Turning it
// on later is a client change (call castVoteWithCredit instead of
// writing voteEvents directly) plus deploying this file and the updated
// firestore.rules.
//
// Requires two Firebase Functions secrets, set once via:
//   firebase functions:secrets:set STRIPE_SECRET_KEY
//   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
// STRIPE_WEBHOOK_SECRET comes from the Stripe Dashboard once a webhook
// endpoint is created pointing at this deployed stripeWebhook's URL,
// subscribed to the checkout.session.completed event.

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

// Server-defined on purpose -- a client can only ever pick a bundle ID,
// never the price or credit count, so there's no way to tamper with a
// Checkout Session's amount from the browser. Tune freely; nothing else
// depends on these specific numbers.
const WALLET_BUNDLES = {
  starter: { credits: 5, amountCents: 500, label: "5 vote credits" },
  popular: { credits: 12, amountCents: 1000, label: "12 vote credits" },
  superfan: { credits: 30, amountCents: 2000, label: "30 vote credits" }
};

// Called from the client (e.g. an "Add vote credits" button) with
// { bundle: "starter" | "popular" | "superfan", successUrl, cancelUrl }.
// Returns { url } -- redirect the browser there to open Stripe Checkout.
// The purchasing uid and credit count travel in the session's metadata,
// not in anything the client controls past bundle selection, so
// stripeWebhook below can trust them once Stripe's signature checks out.
exports.createWalletCheckout = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");

  const bundleId = request.data && request.data.bundle;
  const bundle = WALLET_BUNDLES[bundleId];
  if (!bundle) throw new HttpsError("invalid-argument", "Unknown bundle.");

  const successUrl = request.data.successUrl;
  const cancelUrl = request.data.cancelUrl;
  if (typeof successUrl !== "string" || typeof cancelUrl !== "string") {
    throw new HttpsError("invalid-argument", "Missing successUrl/cancelUrl.");
  }

  const stripe = new Stripe(stripeSecretKey.value());
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: bundle.label },
        unit_amount: bundle.amountCents
      },
      quantity: 1
    }],
    metadata: {
      uid: request.auth.uid,
      bundleId: bundleId,
      credits: String(bundle.credits)
    },
    success_url: successUrl,
    cancel_url: cancelUrl
  });

  return { url: session.url };
});

// Stripe webhook target (plain HTTPS endpoint, not onCall -- Stripe
// itself is the caller, not a signed-in site user). Verifies the
// signature before trusting anything in the payload. On
// checkout.session.completed, credits the buyer's users/{uid}.voteCredits
// and logs a walletTransactions entry keyed by the Stripe session ID,
// which doubles as an idempotency guard -- Stripe can and does redeliver
// the same event, and re-running this must not double-credit.
exports.stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (req, res) => {
    const stripe = new Stripe(stripeSecretKey.value());
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        req.headers["stripe-signature"],
        stripeWebhookSecret.value()
      );
    } catch (err) {
      res.status(400).send("Webhook signature verification failed: " + err.message);
      return;
    }

    if (event.type !== "checkout.session.completed") {
      res.status(200).send("ignored");
      return;
    }

    const session = event.data.object;
    const uid = session.metadata && session.metadata.uid;
    const credits = parseInt(session.metadata && session.metadata.credits, 10);
    if (!uid || !credits) {
      res.status(200).send("missing metadata");
      return;
    }

    const txnRef = db.collection("walletTransactions").doc(session.id);
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(txnRef);
      if (existing.exists) return;

      tx.set(txnRef, {
        uid: uid,
        type: "purchase",
        credits: credits,
        amountCents: session.amount_total,
        stripeSessionId: session.id,
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
