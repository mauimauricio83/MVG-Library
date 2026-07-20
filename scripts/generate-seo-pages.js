// Generates static, crawlable hub pages (one per director, one per artist) so
// search engines have real indexable URLs beyond the single client-rendered
// homepage. Each hub page lists that director/artist's videos as plain HTML
// (no JS required to see the content) and links back into the interactive
// library via #row-<n> deep links for the full experience.
//
// Zero npm dependencies on purpose — run directly with `node scripts/generate-seo-pages.js`.
// Re-run by the scheduled GitHub Action in .github/workflows/build-seo-pages.yml.

"use strict";

const fs = require("fs");
const path = require("path");

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRfeg4mWGWZgOc5ZC-84iBQP3XM4TBopECjBg8moFHmKj0pfOCID05iSC2Xfmf3Y4X8W5PP5r_GCY7a/pub?gid=1998671230&single=true&output=csv";
const SITE_URL = "https://mauimauricio83.github.io/MVG-Library";
const ROOT = path.join(__dirname, "..");
// Most directors/artists only have one entry in the sheet — a one-video hub
// page is exactly the thin-content problem hub pages were meant to avoid.
// Only generate a page once there's enough there to make it worth a visit.
const MIN_VIDEOS = 3;

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

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Some "Artist" cells are huge multi-artist collab credits (e.g. all-star
// charity singles) — cap the slug length so it stays a sane, filesystem-safe
// path segment. 80 chars comfortably fits any real name/short collab list.
function slugify(s) {
  const slug =
    String(s || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unknown";
  return slug.length > 80 ? slug.slice(0, 80).replace(/-+$/, "") : slug;
}

function extractYouTubeId(url) {
  const m = String(url || "").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

// Slugs collide sometimes (two directors with the same name-minus-punctuation).
// Give the second one a numeric suffix rather than silently overwriting it.
function uniqueSlug(base, used) {
  let slug = base;
  let n = 2;
  while (used.has(slug)) { slug = base + "-" + n; n++; }
  used.add(slug);
  return slug;
}

function buildGroups(rows, field) {
  const used = new Set();
  const groups = new Map(); // slug -> { name, rows: [] }
  const slugByName = new Map();
  rows.forEach((row) => {
    const name = row[field];
    if (!name) return;
    let slug = slugByName.get(name);
    if (!slug) {
      slug = uniqueSlug(slugify(name), used);
      slugByName.set(name, slug);
      groups.set(slug, { name, rows: [] });
    }
    groups.get(slug).rows.push(row);
  });
  return groups;
}

function videoListItem(row, otherField, depth) {
  const id = extractYouTubeId(row.youtube);
  const thumb = id
    ? '<img src="https://i.ytimg.com/vi/' + id + '/mqdefault.jpg" alt="" loading="lazy" width="160" height="90">'
    : "";
  const other = row[otherField] ? escapeHtml(row[otherField]) : "";
  const meta = [other, row.year, row.category].filter(Boolean).join(" · ");
  const rootPrefix = "../".repeat(depth);
  return (
    '<li class="hub-video">' +
      (thumb ? '<a href="' + rootPrefix + "index.html#row-" + escapeHtml(row.rowNum) + '" class="hub-video-thumb">' + thumb + "</a>" : "") +
      '<div class="hub-video-info">' +
        '<a href="' + rootPrefix + "index.html#row-" + escapeHtml(row.rowNum) + '"><strong>' + escapeHtml(row.song || "Untitled") + "</strong></a>" +
        (meta ? '<div class="hub-video-meta">' + meta + "</div>" : "") +
      "</div>" +
    "</li>"
  );
}

function page(title, description, canonical, bodyHtml, jsonLd, depth) {
  const rootPrefix = "../".repeat(depth);
  return (
    "<!DOCTYPE html>\n" +
    '<html lang="en">\n<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    "<title>" + escapeHtml(title) + "</title>\n" +
    '<meta name="description" content="' + escapeHtml(description) + '">\n' +
    '<meta name="robots" content="index, follow">\n' +
    '<link rel="canonical" href="' + canonical + '">\n' +
    '<meta property="og:title" content="' + escapeHtml(title) + '">\n' +
    '<meta property="og:description" content="' + escapeHtml(description) + '">\n' +
    '<meta property="og:type" content="website">\n' +
    '<meta property="og:url" content="' + canonical + '">\n' +
    '<link rel="stylesheet" href="' + rootPrefix + 'styles.css">\n' +
    '<link rel="stylesheet" href="' + rootPrefix + 'hub.css">\n' +
    (jsonLd ? '<script type="application/ld+json">\n' + JSON.stringify(jsonLd, null, 2) + "\n</script>\n" : "") +
    "</head>\n<body>\n" +
    '<div class="hub-page">\n' +
    bodyHtml +
    "\n</div>\n</body>\n</html>\n"
  );
}

function directorPage(name, rows, canonical, depth) {
  rows.sort((a, b) => a.song.localeCompare(b.song));
  const sampleArtists = [...new Set(rows.map((r) => r.artist).filter(Boolean))].slice(0, 5);
  const description =
    "Browse " + rows.length + " music video" + (rows.length === 1 ? "" : "s") + " directed by " + name +
    (sampleArtists.length ? ", including work for " + sampleArtists.join(", ") + "." : ".");
  const list = rows.map((r) => videoListItem(r, "artist", depth)).join("\n");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: name + " — Music Videos",
    description,
    url: canonical,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: rows.map((r, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "VideoObject",
          name: r.song,
          description: r.description || (r.song + " by " + r.artist + ", directed by " + name),
          thumbnailUrl: (() => { const id = extractYouTubeId(r.youtube); return id ? "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg" : undefined; })(),
          embedUrl: r.youtube || undefined
        }
      }))
    }
  };
  const rootPrefix = "../".repeat(depth);
  const body =
    '<a class="hub-back" href="' + rootPrefix + 'index.html">&larr; MVG Library</a>\n' +
    "<h1>" + escapeHtml(name) + "</h1>\n" +
    '<p class="hub-intro">' + escapeHtml(description) + "</p>\n" +
    '<ul class="hub-video-list">\n' + list + "\n</ul>\n";
  return page(name + " — Music Videos | MVG Library", description, canonical, body, jsonLd, depth);
}

function artistPage(name, rows, canonical, depth) {
  rows.sort((a, b) => a.song.localeCompare(b.song));
  const sampleDirectors = [...new Set(rows.map((r) => r.director).filter(Boolean))].slice(0, 5);
  const description =
    "Browse " + rows.length + " music video" + (rows.length === 1 ? "" : "s") + " by " + name +
    (sampleDirectors.length ? ", directed by " + sampleDirectors.join(", ") + "." : ".");
  const list = rows.map((r) => videoListItem(r, "director", depth)).join("\n");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: name + " — Music Videos",
    description,
    url: canonical,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: rows.map((r, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "VideoObject",
          name: r.song,
          description: r.description || (r.song + " by " + name + ", directed by " + r.director),
          thumbnailUrl: (() => { const id = extractYouTubeId(r.youtube); return id ? "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg" : undefined; })(),
          embedUrl: r.youtube || undefined
        }
      }))
    }
  };
  const rootPrefix = "../".repeat(depth);
  const body =
    '<a class="hub-back" href="' + rootPrefix + 'index.html">&larr; MVG Library</a>\n' +
    "<h1>" + escapeHtml(name) + "</h1>\n" +
    '<p class="hub-intro">' + escapeHtml(description) + "</p>\n" +
    '<ul class="hub-video-list">\n' + list + "\n</ul>\n";
  return page(name + " — Music Videos | MVG Library", description, canonical, body, jsonLd, depth);
}

function indexPage(kind, groups, depth) {
  const entries = [...groups.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  const list = entries
    .map(([slug, g]) => '<li><a href="' + slug + "/\">" + escapeHtml(g.name) + "</a> <span class=\"hub-count\">(" + g.rows.length + ")</span></li>")
    .join("\n");
  const title = kind === "director" ? "Directors" : "Artists";
  const description = "Every " + (kind === "director" ? "director" : "artist") + " in the MVG Library, A–Z (" + entries.length + " total).";
  const rootPrefix = "../".repeat(depth);
  const body =
    '<a class="hub-back" href="' + rootPrefix + 'index.html">&larr; MVG Library</a>\n' +
    "<h1>" + title + "</h1>\n" +
    '<p class="hub-intro">' + escapeHtml(description) + "</p>\n" +
    '<ul class="hub-index-list">\n' + list + "\n</ul>\n";
  return page(title + " | MVG Library", description, SITE_URL + "/" + kind + "s/", body, null, depth);
}

async function main() {
  console.log("Fetching CSV...");
  const res = await fetch(CSV_URL, { redirect: "follow" });
  if (!res.ok) throw new Error("CSV fetch failed: " + res.status);
  const csvText = await res.text();
  const rawRows = parseCsv(csvText);

  const rows = rawRows
    .map((r) => ({
      rowNum: get(r, "Row #"),
      artist: get(r, "Artist"),
      song: get(r, "Song Title"),
      director: get(r, "Director"),
      category: get(r, "Category"),
      youtube: get(r, "YouTube Link"),
      year: get(r, "Year"),
      country: get(r, "Country"),
      description: get(r, "Description")
    }))
    .filter((r) => r.rowNum && (r.artist || r.song || r.director));

  console.log("Parsed " + rows.length + " rows.");

  function pruneThin(groups) {
    for (const [slug, group] of groups) {
      if (group.rows.length < MIN_VIDEOS) groups.delete(slug);
    }
    return groups;
  }

  const directorGroups = pruneThin(buildGroups(rows, "director"));
  const artistGroups = pruneThin(buildGroups(rows, "artist"));

  const sitemapUrls = [SITE_URL + "/"];

  ["directors", "artists"].forEach((kind) => {
    const dir = path.join(ROOT, kind);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  });

  for (const [slug, group] of directorGroups) {
    const dir = path.join(ROOT, "directors", slug);
    fs.mkdirSync(dir, { recursive: true });
    const canonical = SITE_URL + "/directors/" + slug + "/";
    fs.writeFileSync(path.join(dir, "index.html"), directorPage(group.name, group.rows, canonical, 2));
    sitemapUrls.push(canonical);
  }
  fs.writeFileSync(path.join(ROOT, "directors", "index.html"), indexPage("director", directorGroups, 1));
  sitemapUrls.push(SITE_URL + "/directors/");

  for (const [slug, group] of artistGroups) {
    const dir = path.join(ROOT, "artists", slug);
    fs.mkdirSync(dir, { recursive: true });
    const canonical = SITE_URL + "/artists/" + slug + "/";
    fs.writeFileSync(path.join(dir, "index.html"), artistPage(group.name, group.rows, canonical, 2));
    sitemapUrls.push(canonical);
  }
  fs.writeFileSync(path.join(ROOT, "artists", "index.html"), indexPage("artist", artistGroups, 1));
  sitemapUrls.push(SITE_URL + "/artists/");

  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    sitemapUrls
      .map((u) => "  <url>\n    <loc>" + u + "</loc>\n  </url>")
      .join("\n") +
    "\n</urlset>\n";
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap);

  console.log(
    "Generated " + directorGroups.size + " director pages, " + artistGroups.size + " artist pages, and sitemap.xml with " + sitemapUrls.length + " URLs."
  );
}

main().catch((err) => { console.error(err); process.exit(1); });
