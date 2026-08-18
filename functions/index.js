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

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

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
