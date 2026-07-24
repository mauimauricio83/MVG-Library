// One-time bucket config: allows browser fetch() calls to
// catalog/snapshot.json from any origin. Without this, the object is
// perfectly readable via curl/Node (CORS is a browser-only mechanism), but
// the public site's fetchData() fails with "TypeError: Failed to fetch" --
// Storage security rules (storage.rules) control WHO can read the object;
// this CORS config separately controls whether a BROWSER is allowed to hand
// the response back to page JS. Both are required for the live site to work.
//
// Only needs to be run once per bucket (or again if the bucket's CORS config
// is ever reset). Safe to re-run.
//
// Usage: node configure-storage-cors.js /path/to/service-account.json

"use strict";

const admin = require("firebase-admin");

async function main() {
  const serviceAccountPath = process.argv[2] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!serviceAccountPath) {
    console.error("Usage: node configure-storage-cors.js /path/to/service-account.json");
    process.exit(1);
  }

  const serviceAccount = require(require("path").resolve(serviceAccountPath));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: serviceAccount.project_id + ".firebasestorage.app"
  });

  const bucket = admin.storage().bucket();
  await bucket.setCorsConfiguration([
    { origin: ["*"], method: ["GET"], maxAgeSeconds: 3600 }
  ]);

  const [metadata] = await bucket.getMetadata();
  console.log("CORS configured:", JSON.stringify(metadata.cors, null, 2));
}

main().catch((err) => {
  console.error("CORS configuration failed:", err);
  process.exit(1);
});
