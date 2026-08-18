// Open "vote for your favorite video" -- any catalog entry is eligible.
// firestore.rules blocks every client write to videoVotes/{rowNum} (the
// public per-video count), so this Function -- via the Admin SDK, which
// always bypasses Security Rules -- is the only thing allowed to touch it.
// Reacts to every write under votes/{uid} (create = first vote, update =
// changed vote, delete = not normally reachable since the rules block it,
// but handled defensively) and keeps each affected video's count in sync
// using atomic increments, not a transaction on one shared document --
// unlike the earlier admin-picks-5 design this replaced, a vote here can
// land on any of ~13k videos, so spreading the counters across one
// document per video avoids turning a single hot doc into a write
// bottleneck under concurrent voting.
//
// Deploy: firebase deploy --only functions (after `npm install` inside
// this functions/ directory once).

"use strict";

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

exports.onVoteWritten = onDocumentWritten("votes/{uid}", async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  const oldVote = before ? before : null;
  const newVote = after ? after : null;
  if (oldVote && newVote && oldVote.rowNum === newVote.rowNum) return;

  const writes = [];
  if (oldVote && oldVote.rowNum) {
    writes.push(
      db.collection("videoVotes").doc(oldVote.rowNum).set(
        { count: FieldValue.increment(-1) },
        { merge: true }
      )
    );
  }
  if (newVote && newVote.rowNum) {
    writes.push(
      db.collection("videoVotes").doc(newVote.rowNum).set(
        {
          count: FieldValue.increment(1),
          artist: newVote.artist || "",
          song: newVote.song || "",
          thumb: newVote.thumb || ""
        },
        { merge: true }
      )
    );
  }
  await Promise.all(writes);
});
