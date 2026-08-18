// "Video of the Week" vote rounds -- the one thing that genuinely can't
// happen from the client alone: firestore.rules deliberately blocks any
// client write to voteRounds/{roundId}.tally (see the comment there), so
// this is the only thing allowed to touch it. Reacts to every write under
// voteRounds/{roundId}/votes/{uid} (create = first vote, update = changed
// vote while the round's still active, delete = not normally reachable
// since the rules block it, but handled defensively) and keeps the
// round's tally map in sync via a transaction, so concurrent votes never
// race each other into an undercount.
//
// Deploy: firebase deploy --only functions (after `npm install` inside
// this functions/ directory once).

"use strict";

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

exports.onVoteWritten = onDocumentWritten(
  "voteRounds/{roundId}/votes/{uid}",
  async (event) => {
    const roundId = event.params.roundId;
    const before = event.data.before.exists ? event.data.before.data() : null;
    const after = event.data.after.exists ? event.data.after.data() : null;
    const oldRowNum = before ? before.rowNum : null;
    const newRowNum = after ? after.rowNum : null;
    if (oldRowNum === newRowNum) return;

    const roundRef = db.collection("voteRounds").doc(roundId);
    await db.runTransaction(async (tx) => {
      const roundDoc = await tx.get(roundRef);
      if (!roundDoc.exists) return;
      const tally = Object.assign({}, roundDoc.data().tally || {});
      if (oldRowNum && tally[oldRowNum]) {
        tally[oldRowNum] = Math.max(0, tally[oldRowNum] - 1);
      }
      if (newRowNum) {
        tally[newRowNum] = (tally[newRowNum] || 0) + 1;
      }
      tx.update(roundRef, { tally: tally });
    });
  }
);
