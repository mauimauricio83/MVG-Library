// One-time local migration: seeds the current CSV-published video catalog
// into Firestore (`videos/{rowNum}`), using each row's "Row #" as the
// Firestore document ID so existing favorites/recently-viewed/deep-links
// (which reference rowNum) keep working unchanged after the site cuts over
// from CSV to Firestore-backed data.
//
// NOT part of the site (no npm deps there by design) and NOT the ongoing
// bulk-import feature (that's client-side, in the admin panel, for future
// additions). This script runs once, from a terminal, with a Firebase
// service-account key you provide.
//
// Usage:
//   cd scripts
//   npm install
//   node migrate-to-firestore.js /path/to/service-account.json
// (or set GOOGLE_APPLICATION_CREDENTIALS to that path and omit the arg)
//
// Safe to re-run: writes use .set() (overwrite), not .create(), so a retry
// after a partial failure just re-writes the same docs rather than erroring.

"use strict";

const https = require("https");
const admin = require("firebase-admin");

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRfeg4mWGWZgOc5ZC-84iBQP3XM4TBopECjBg8moFHmKj0pfOCID05iSC2Xfmf3Y4X8W5PP5r_GCY7a/pub?gid=1998671230&single=true&output=csv";
const BATCH_SIZE = 500;

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchText(res.headers.location).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error("HTTP " + res.statusCode + " fetching " + url));
        return;
      }
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

// Same hand-rolled CSV parser as scripts/generate-seo-pages.js -- no
// papaparse dependency needed for a script that runs once.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  const header = rows.shift();
  return rows
    .filter((r) => r.length > 1)
    .map((r) => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = r[i] || ""; });
      return obj;
    });
}

function get(row, key) {
  return (row[key] || "").trim();
}

// Ported verbatim from app.js's readGenres().
function readGenres(row) {
  let out = [];
  ["Genre 1", "Genre 2", "Genre 3"].forEach((k) => {
    const v = get(row, k);
    if (v) out.push(v);
  });
  if (!out.length) {
    const legacy = get(row, "Genre");
    if (legacy) out = legacy.split(";").map((s) => s.trim()).filter(Boolean);
  }
  const seen = {};
  return out.filter((g) => {
    if (seen[g]) return false;
    seen[g] = true;
    return true;
  });
}

// Ported verbatim from app.js's fixReleaseDate() -- undoes the Sheets
// serial-date artifact on bare-year "Release date" cells.
const SHEET_MONTHS = { January: 0, February: 1, March: 2, April: 3, May: 4, June: 5, July: 6, August: 7, September: 8, October: 9, November: 10, December: 11 };
function fixReleaseDate(raw) {
  const m = String(raw || "").match(/^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (19[0-1]\d)$/);
  if (!m) return raw;
  const serial = Math.round((Date.UTC(+m[3], SHEET_MONTHS[m[1]], +m[2]) - Date.UTC(1899, 11, 30)) / 86400000);
  return serial >= 1900 && serial <= 2100 ? String(serial) : raw;
}

function isTruthyFlag(raw) {
  return /^(true|yes|y|1|x)$/i.test(get({ v: raw }, "v"));
}

// Parses the "Feature Checked At"/"Spotlight Checked At" columns (written by
// the Apps Script onEdit trigger as `new Date()`, published by Sheets as a
// bare date like "7/19/2026"). Many pre-existing Featured rows predate the
// AA-column-collision bug fix (see CHANGELOG/session notes) and simply have
// no value here -- returns null for those rather than guessing, since a
// blank really does mean "we don't know when this was checked."
function readCheckedAt(raw) {
  var s = String(raw || "").trim();
  if (!s) return null;
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : admin.firestore.Timestamp.fromDate(d);
}

// Ported from app.js's cleanRows() -- same field-for-field shape, plus the
// Firestore-only bookkeeping fields (featureAt/spotlightAt/createdAt/updatedAt)
// described in the migration plan.
function toFirestoreDoc(row, migrationTimestamp) {
  const artist = get(row, "Artist");
  const song = get(row, "Song Title");
  const director = get(row, "Director");
  const rowNum = get(row, "Row #");
  const feature = isTruthyFlag(get(row, "Feature"));
  const spotlight = isTruthyFlag(get(row, "Spotlight"));

  return {
    rowNum: rowNum,
    artist: artist,
    song: song,
    director: director,
    category: get(row, "Category"),
    youtube: get(row, "YouTube Link"),
    mvg: get(row, "MVG Link"),
    year: get(row, "Year"),
    releaseDate: fixReleaseDate(get(row, "Release date")),
    studio: get(row, "Studio"),
    producer: get(row, "Producer"),
    dp: get(row, "DP"),
    editor: get(row, "Editor"),
    choreographer: get(row, "Choreographer"),
    country: get(row, "Country"),
    genres: readGenres(row),
    description: get(row, "Description"),
    feature: feature,
    featureAt: feature ? readCheckedAt(get(row, "Feature Checked At")) : null,
    spotlight: spotlight,
    spotlightAt: spotlight ? readCheckedAt(get(row, "Spotlight Checked At")) : null,
    createdAt: migrationTimestamp,
    updatedAt: migrationTimestamp
  };
}

async function main() {
  const serviceAccountPath = process.argv[2] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!serviceAccountPath) {
    console.error("Usage: node migrate-to-firestore.js /path/to/service-account.json");
    console.error("(or set GOOGLE_APPLICATION_CREDENTIALS)");
    process.exit(1);
  }

  const serviceAccount = require(require("path").resolve(serviceAccountPath));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  console.log("Fetching current CSV export...");
  const csvText = await fetchText(CSV_URL);
  const rawRows = parseCsv(csvText);
  console.log("Parsed " + rawRows.length + " raw rows.");

  // Rows with no Row # can't become a Firestore doc ID, and cleanRows()
  // already drops rows with both Artist and Song Title blank -- mirror both.
  const migrationTimestamp = admin.firestore.Timestamp.now();
  const docs = rawRows
    .filter((row) => get(row, "Row #") !== "")
    .map((row) => toFirestoreDoc(row, migrationTimestamp))
    .filter((doc) => doc.artist !== "" || doc.song !== "");

  console.log("Migrating " + docs.length + " entries...");

  let committed = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach((doc) => {
      batch.set(db.collection("videos").doc(doc.rowNum), doc);
    });
    await batch.commit();
    committed += chunk.length;
    console.log("Committed " + committed + " / " + docs.length + " (batch " + (Math.floor(i / BATCH_SIZE) + 1) + " of " + Math.ceil(docs.length / BATCH_SIZE) + ")");
  }

  console.log("\nDone. Spot-check sample:");
  [docs[0], docs[Math.floor(docs.length / 2)], docs[docs.length - 1]].forEach((doc) => {
    if (doc) console.log("  rowNum " + doc.rowNum + " -- " + doc.artist + " / " + doc.song);
  });

  const featureCount = docs.filter((d) => d.feature).length;
  const spotlightCount = docs.filter((d) => d.spotlight).length;
  console.log("\nCap sanity check: Feature=" + featureCount + " (max 30), Spotlight=" + spotlightCount + " (max 3)");
  if (featureCount > 30) console.warn("WARNING: Feature count exceeds the cap -- investigate before relying on admin cap-eviction logic.");
  if (spotlightCount > 3) console.warn("WARNING: Spotlight count exceeds the cap -- investigate before relying on admin cap-eviction logic.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
