# MVG Library

A browsable database of music videos, directors, and artists for [The Music Video Guy](https://themusicvideoguy.com). Live at [mauimauricio83.github.io/MVG-Library](https://mauimauricio83.github.io/MVG-Library/), embedded on the main site under "MV Library".

## How it works

No build step, no framework — plain HTML/CSS/JS, deployed via GitHub Pages straight from `main`.

The database itself is a published Google Sheet. [app.js](app.js) fetches it as CSV ([PapaParse](https://www.papaparse.com/)) on page load, caches it in `localStorage` for instant repeat visits, and renders everything client-side: search, director/artist/song browsing, category/genre/year/country filters, a TV Mode shuffle player, a lightbox with full credits, and a Featured/Latest/Spotlight rail system driven by checkbox columns in the sheet.

Two more published sheets (`Seconds, Image, Link` columns) drive rotating ad slideshows — one in the results sidebar, one in the top banner — each crossfading through its own ads at its own per-ad duration.

### Files

| File | Purpose |
|---|---|
| `index.html` | Page structure/markup |
| `app.js` | All application logic (single IIFE, no modules) |
| `styles.css` | All styling, light/dark via `prefers-color-scheme` |
| `hub.css` | Styling for the static director/artist hub pages |
| `serve.js` | Zero-dependency local dev server (`node serve.js`) |
| `scripts/generate-seo-pages.js` | Generates `/directors/`, `/artists/`, and `sitemap.xml` |
| `robots.txt`, `sitemap.xml` | SEO — sitemap is regenerated, don't hand-edit |
| `CHANGELOG.md` | Version history, kept in sync with `APP_VERSION` in app.js |

### SEO hub pages

The site is a single client-rendered page, so individual videos have no crawlable URL of their own. To give search engines *something* real to index, `scripts/generate-seo-pages.js` generates static, server-delivered HTML pages at `/directors/<slug>/` and `/artists/<slug>/` for anyone with 3+ videos in the sheet — each with its own title, description, and `VideoObject` JSON-LD, linking back into the interactive app via `#row-<n>` deep links.

A scheduled GitHub Action ([.github/workflows/build-seo-pages.yml](.github/workflows/build-seo-pages.yml)) re-runs the generator daily and auto-commits any changes, so the hub pages stay in sync with the sheet without manual regeneration. Run it by hand with:

```
node scripts/generate-seo-pages.js
```

## Running locally

```
node serve.js
```

Then open `http://localhost:8420`. No install step — the only external dependency (PapaParse) loads from a CDN in `index.html`.

## Versioning

`APP_VERSION` in `app.js` and `CHANGELOG.md` are bumped together on every meaningful commit. Informal semver: major = breaking/structural change, minor = additive feature, patch = bug fix or small tweak. See `CHANGELOG.md` for the full history.

## Deploying

Push to `main` — GitHub Pages serves directly from it, no build step. Changes are typically live within a minute or two of the push.
