// One-time reconciliation: brings the Feature/Spotlight flags in Firestore
// back under their caps (30 / 3), evicting the oldest-by-checked-at first.
// Entries with no real "checked at" value (most pre-existing Featured rows --
// they predate the Apps Script AA-column-collision fix, see CHANGELOG) are
// treated as the OLDEST, since a blank genuinely means "checked before we
// started tracking it." Among those, rowNum ascending (added to the library
// earliest) is the tiebreaker.
//
// This mirrors the enforceCap() logic that will later live in the admin
// panel (app.js), just run once here directly against Firestore via the
// Admin SDK. Safe to re-run -- it's a no-op once each collection is at cap.
//
// Usage: node reconcile-caps.js /path/to/service-account.json

"use strict";

const admin = require("firebase-admin");

const CONFIGS = [
  { field: "feature", timestampField: "featureAt", cap: 30 },
  { field: "spotlight", timestampField: "spotlightAt", cap: 3 }
];

async function enforceCap(db, config) {
  const snap = await db.collection("videos").where(config.field, "==", true).get();
  console.log(config.field + ": " + snap.size + " checked (cap " + config.cap + ")");
  if (snap.size <= config.cap) {
    console.log("  already within cap, nothing to do");
    return;
  }

  const docs = snap.docs.slice().sort((a, b) => {
    const ta = a.data()[config.timestampField];
    const tb = b.data()[config.timestampField];
    // No timestamp sorts as oldest (millis 0), not most recent -- see file header.
    const ma = ta ? ta.toMillis() : 0;
    const mb = tb ? tb.toMillis() : 0;
    if (ma !== mb) return ma - mb;
    // Tiebreaker: lower rowNum (added earlier) sorts first/oldest.
    return parseInt(a.data().rowNum, 10) - parseInt(b.data().rowNum, 10);
  });

  const toEvict = docs.slice(0, docs.length - config.cap);
  console.log("  evicting " + toEvict.length + " oldest entries:");
  toEvict.forEach((d) => {
    const data = d.data();
    console.log("    rowNum " + data.rowNum + " -- " + data.artist + " / " + data.song + " (checked at: " + (data[config.timestampField] ? data[config.timestampField].toDate().toISOString() : "unknown") + ")");
  });

  const batch = db.batch();
  toEvict.forEach((d) => {
    const patch = {};
    patch[config.field] = false;
    patch[config.timestampField] = null;
    patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    batch.update(d.ref, patch);
  });
  await batch.commit();
  console.log("  done -- " + config.field + " now at " + config.cap);
}

async function main() {
  const serviceAccountPath = process.argv[2] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!serviceAccountPath) {
    console.error("Usage: node reconcile-caps.js /path/to/service-account.json");
    process.exit(1);
  }

  const serviceAccount = require(require("path").resolve(serviceAccountPath));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  for (const config of CONFIGS) {
    await enforceCap(db, config);
  }
}

main().catch((err) => {
  console.error("Reconciliation failed:", err);
  process.exit(1);
});
