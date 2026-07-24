// Publishes the current Firestore `videos` collection as a single static
// JSON file in Cloud Storage (catalog/snapshot.json) -- the public site
// fetches this instead of talking to Firestore directly, keeping the
// per-visitor cost at one cheap HTTP GET regardless of admin write volume.
// Same shape as cleanRows() in app.js (rows are consumed as-is, no mapping
// needed client-side).
//
// This Admin-SDK version exists for the initial publish (bootstraps
// SNAPSHOT_URL before the in-browser "Publish" button exists/is wired up)
// and as a CLI fallback -- the normal ongoing path is the admin panel's
// Publish button (publishSnapshot() in app.js), which does the same thing
// via the client SDK.
//
// Usage: node publish-snapshot.js /path/to/service-account.json

"use strict";

const admin = require("firebase-admin");

function buildSearchHaystack(d) {
  return [d.artist, d.song, d.director, d.producer, d.dp, d.editor, d.choreographer, d.studio]
    .join(" ")
    .toLowerCase();
}

async function main() {
  const serviceAccountPath = process.argv[2] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!serviceAccountPath) {
    console.error("Usage: node publish-snapshot.js /path/to/service-account.json");
    process.exit(1);
  }

  const serviceAccount = require(require("path").resolve(serviceAccountPath));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: serviceAccount.project_id + ".firebasestorage.app"
  });
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  console.log("Reading videos collection...");
  const snap = await db.collection("videos").get();
  const rows = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      rowNum: d.rowNum || "",
      artist: d.artist || "",
      song: d.song || "",
      director: d.director || "",
      category: d.category || "",
      youtube: d.youtube || "",
      mvg: d.mvg || "",
      year: d.year || "",
      releaseDate: d.releaseDate || "",
      studio: d.studio || "",
      producer: d.producer || "",
      dp: d.dp || "",
      editor: d.editor || "",
      choreographer: d.choreographer || "",
      country: d.country || "",
      genres: d.genres || [],
      description: d.description || "",
      feature: !!d.feature,
      spotlight: !!d.spotlight,
      searchHaystack: buildSearchHaystack(d)
    };
  });

  // Firestore's collection get() doesn't guarantee row order -- sort by
  // rowNum ascending (matching the original CSV) so consumers relying on a
  // deterministic order (generate-seo-pages.js's slug numbering) stay stable.
  rows.sort((a, b) => parseInt(a.rowNum, 10) - parseInt(b.rowNum, 10));

  console.log("Uploading snapshot of " + rows.length + " entries...");
  const file = bucket.file("catalog/snapshot.json");
  await file.save(Buffer.from(JSON.stringify(rows)), {
    contentType: "application/json",
    metadata: { cacheControl: "public, max-age=300" }
  });

  const encodedPath = encodeURIComponent("catalog/snapshot.json");
  const url = "https://firebasestorage.googleapis.com/v0/b/" + bucket.name + "/o/" + encodedPath + "?alt=media";
  console.log("\nDone. Snapshot URL (requires Storage rules to allow public read on this path):");
  console.log(url);
}

main().catch((err) => {
  console.error("Publish failed:", err);
  process.exit(1);
});
