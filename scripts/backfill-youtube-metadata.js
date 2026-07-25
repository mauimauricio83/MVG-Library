// One-time (but safely re-runnable) backfill: fetches each video's own
// YouTube description + tags via the YouTube Data API v3, and stores them
// in Firestore as `youtubeSearchText` on that video's doc. This fills the
// search gap for entries with no curated Description of our own -- a lot of
// uploaders' own descriptions/tags mention exactly the kind of thing people
// search for ("blue," "dancing," a specific practical effect, etc.).
//
// Skips videos that already have youtubeSearchText unless --force is passed,
// so it's cheap to re-run any time new entries get added (only fetches what's
// missing). Batches 50 video IDs per API call -- ~13k videos costs only
// ~265 calls, well inside the free daily quota (10,000 units/day, 1 unit/call).
//
// Usage:
//   cd scripts
//   node backfill-youtube-metadata.js /path/to/service-account.json [--force]
//
// Requires scripts/.env with YOUTUBE_DATA_API_KEY=... (gitignored, never committed).

"use strict";

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const BATCH_SIZE = 50; // YouTube Data API's max IDs per videos.list call
const FIRESTORE_WRITE_BATCH_SIZE = 500;

function loadEnv(envPath) {
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  });
  return out;
}

function extractYouTubeId(url) {
  const m = String(url || "").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

async function fetchSnippets(apiKey, ids) {
  const url = "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" + ids.join(",") + "&key=" + apiKey;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error("YouTube API error " + res.status + ": " + body.slice(0, 300));
  }
  const data = await res.json();
  const byId = {};
  (data.items || []).forEach((item) => {
    const snippet = item.snippet || {};
    const text = [snippet.description || "", (snippet.tags || []).join(" ")].join(" ").toLowerCase();
    byId[item.id] = text;
  });
  return byId;
}

async function main() {
  const serviceAccountPath = process.argv[2] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const force = process.argv.includes("--force");
  if (!serviceAccountPath) {
    console.error("Usage: node backfill-youtube-metadata.js /path/to/service-account.json [--force]");
    process.exit(1);
  }

  const env = loadEnv(path.join(__dirname, ".env"));
  const apiKey = env.YOUTUBE_DATA_API_KEY;
  if (!apiKey) {
    console.error("Missing YOUTUBE_DATA_API_KEY in scripts/.env");
    process.exit(1);
  }

  const serviceAccount = require(path.resolve(serviceAccountPath));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  console.log("Reading videos collection...");
  const snap = await db.collection("videos").get();
  console.log("Found " + snap.size + " entries.");

  // rowNum -> { docRef, youtubeId }
  const candidates = [];
  snap.docs.forEach((doc) => {
    const data = doc.data();
    if (!force && data.youtubeSearchText) return; // already backfilled
    const ytId = extractYouTubeId(data.youtube);
    if (!ytId) return; // no video link, nothing to fetch
    candidates.push({ ref: doc.ref, rowNum: data.rowNum, ytId: ytId });
  });

  console.log(candidates.length + " entries need fetching" + (force ? " (forced re-fetch)" : "") + ".");
  if (!candidates.length) return;

  let updates = [];
  let fetched = 0;
  let notFound = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const chunk = candidates.slice(i, i + BATCH_SIZE);
    const ids = chunk.map((c) => c.ytId);
    let byId;
    try {
      byId = await fetchSnippets(apiKey, ids);
    } catch (err) {
      console.error("Batch failed (rows " + i + "-" + (i + chunk.length) + "):", err.message);
      continue;
    }

    chunk.forEach((c) => {
      const text = byId[c.ytId];
      if (text === undefined) { notFound++; return; }
      updates.push({ ref: c.ref, text: text });
      fetched++;
    });

    console.log("Fetched batch " + (Math.floor(i / BATCH_SIZE) + 1) + " of " + Math.ceil(candidates.length / BATCH_SIZE) + " (" + fetched + " so far, " + notFound + " not found on YouTube)");
  }

  console.log("Writing " + updates.length + " updates to Firestore...");
  for (let i = 0; i < updates.length; i += FIRESTORE_WRITE_BATCH_SIZE) {
    const chunk = updates.slice(i, i + FIRESTORE_WRITE_BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach((u) => batch.update(u.ref, { youtubeSearchText: u.text }));
    await batch.commit();
    console.log("Committed " + Math.min(i + FIRESTORE_WRITE_BATCH_SIZE, updates.length) + " / " + updates.length);
  }

  console.log("\nDone. " + fetched + " entries enriched, " + notFound + " video IDs not found on YouTube (deleted/private, left unchanged).");
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
