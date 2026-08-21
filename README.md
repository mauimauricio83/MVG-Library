# MVG Library

A browsable database of music videos, directors, and artists for [The Music Video Guy](https://themusicvideoguy.com). Live at [mauimauricio83.github.io/MVG-Library](https://mauimauricio83.github.io/MVG-Library/), embedded on the main site under "MV Library".

## How it works

No build step, no framework — plain HTML/CSS/JS, deployed via GitHub Pages straight from `main`, backed by Firebase (Firestore + Cloud Functions + Cloud Storage) for anything that needs a real database, auth, or server-side logic.

The catalog itself lives in Firestore (`videos/{rowNum}` — `rowNum` preserved from the project's original spreadsheet). Admins edit it through the in-app Admin panel; the public site never talks to Firestore directly for catalog data — [app.js](app.js) fetches a static published JSON snapshot (Cloud Storage) on page load, caches it in IndexedDB for instant repeat visits, and renders everything client-side from that snapshot: search, director/artist/song browsing, category/genre/year/country filters, a TV Mode shuffle player, a lightbox with full credits, and Featured/Latest/Viewer's Choice/Maui's Picks rail systems driven by admin-controlled flags. See [CLAUDE.md](CLAUDE.md) for the full data-model writeup.

Voting, vote credits, user accounts/profiles, playlists, favorites, comments, and the message board are all Firestore-backed and live-synced for signed-in users; Cloud Functions (`functions/index.js`) handle anything that needs server-side trust — vote tallying, prepaid vote-credit checkout (Lemon Squeezy), username moderation, and admin-only actions like resetting a video's votes.

Two published Google Sheets (`Seconds, Image, Link` columns) still drive rotating ad slideshows via CSV ([PapaParse](https://www.papaparse.com/)) — one in the results sidebar, one in the top banner — each crossfading through its own ads at its own per-ad duration. This is the one place the site still reads a Google Sheet directly; the catalog itself moved off that model to Firestore.

### Files

| File | Purpose |
|---|---|
| `index.html` | Page structure/markup |
| `app.js` | All application logic (single IIFE, no modules) |
| `styles.css` | All styling, light/dark via `prefers-color-scheme` |
| `hub.css` | Styling for the static director/artist hub pages |
| `site-nav.js` | Shared header/nav markup + version constant, injected into every page |
| `cloud.js` / `cloud.html` | Word-cloud sphere visualization |
| `news.html`, `land.html`, `support.html`, `privacy.html`, `delete-account.html` | Standalone pages outside the main SPA |
| `firestore.rules`, `firestore.indexes.json`, `storage.rules` | Firebase security rules — need `firebase deploy` after editing, not just committing |
| `functions/index.js` | Cloud Functions — vote tallying, wallet/checkout, moderation, admin actions |
| `serve.js` | Zero-dependency local dev server (`node serve.js`) |
| `scripts/generate-seo-pages.js` | Generates `/directors/`, `/artists/`, and `sitemap.xml` |
| `scripts/publish-snapshot.js` | CLI counterpart to `app.js`'s `publishSnapshot()` — must stay field-for-field in sync with it |
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

Push to `main` — GitHub Pages serves the static site directly from it, no build step. Changes are typically live within a minute or two of the push.

**Firebase changes are a separate step**: editing `firestore.rules`, `firestore.indexes.json`, `storage.rules`, or anything in `functions/` only takes effect after `firebase deploy` (`--only firestore:rules`, `--only functions`, etc., from the repo root) — a git push alone does not deploy them.
