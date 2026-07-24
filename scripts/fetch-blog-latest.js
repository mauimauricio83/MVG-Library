// Fetches the latest posts from the Squarespace blog (themusicvideoguy.com/news)
// and writes them to blog-latest.json at the repo root, which the site reads
// same-origin at runtime. Done server-side because Squarespace's JSON feed
// endpoint doesn't send CORS headers -- a browser on mauimauricio83.github.io
// can't fetch it directly, but a build script has no such restriction.
//
// Zero npm dependencies on purpose -- run directly with
// `node scripts/fetch-blog-latest.js`. Re-run by the same daily GitHub
// Action that regenerates the SEO hub pages (.github/workflows/build-seo-pages.yml).

"use strict";

const fs = require("fs");
const path = require("path");

const BLOG_JSON_URL = "https://themusicvideoguy.com/news?format=json-pretty";
const BLOG_BASE_URL = "https://themusicvideoguy.com";
const OUTPUT_PATH = path.join(__dirname, "..", "blog-latest.json");
const COUNT = 3;

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  console.log("Fetching blog feed...");
  const res = await fetch(BLOG_JSON_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MVGLibraryBot/1.0)" }
  });
  if (!res.ok) throw new Error("Blog fetch failed: " + res.status);
  const data = await res.json();
  const items = (data.items || []).slice(0, COUNT);

  const posts = items.map((item) => ({
    title: item.title || "",
    excerpt: stripHtml(item.excerpt).slice(0, 200),
    url: BLOG_BASE_URL + item.fullUrl,
    image: item.assetUrl || "",
    publishOn: item.publishOn || 0
  }));

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(posts, null, 2) + "\n");
  console.log("Wrote " + posts.length + " post(s) to blog-latest.json");
}

main().catch((err) => {
  console.error("Blog fetch failed:", err);
  process.exit(1);
});
