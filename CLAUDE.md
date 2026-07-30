# MVG Library — operating manual

Vanilla JS/HTML/CSS static site, no build step. Firestore-backed catalog, hosted on GitHub Pages at `mauimauricio83.github.io/MVG-Library/`. Companion repo `E:\Local Apps\mauimauricio83.github.io` hosts the actual domain root (`mauimauricio83.github.io/`) — needed for anything that must live at the true domain root (e.g. `ads.txt`), since this repo is a GitHub Pages *project* site served from a subpath.

## Housekeeping rules (do these every meaningful commit)

- **Bump `APP_VERSION`** in `app.js` (near the top, has an inline reminder comment) **and add a `CHANGELOG.md` entry** for any user-visible change — feature, fix, or redesign. This was neglected for ~7 commits before v5.3.0; don't let it drift again. Regenerated-content commits (`Regenerate SEO hub pages [automated]`, `Update latest blog posts [automated]`) don't need a version bump — bump once per batch of hand-written changes, not per commit.
- **Never push without the user's explicit go-ahead.** Commit locally freely; ask before `git push`.
- **Before every push**, check for divergence first: `git fetch origin && git log --oneline main..origin/main`. A GitHub Action cron lands automated commits (`Regenerate SEO hub pages`, `Update latest blog posts`) regularly — rebase onto them if they've landed.
- **Keep `app.js`'s client `publishSnapshot()` and `scripts/publish-snapshot.js` (the CLI counterpart) in sync.** Any field added to one needs the identical line in the other.
- **Firestore `firestore.rules` changes need a manual `firebase deploy`** — editing the file alone doesn't take effect.

## Local dev server

Use `preview_start({name: "mvg-wiki"})` — reads `.claude/launch.json`, runs `node serve.js` on port 8420. **Do not** use `preview_start({url: "http://localhost:8880"})` or any raw URL — that only opens a tab against whatever's already listening there, it does not start/restart a server, and a stale process squatting on an old port will silently serve outdated files while looking like a working preview. If output looks stale despite correct source, check for an orphaned process first: `netstat -ano | findstr :8420` (or whatever port), `taskkill //PID <pid> //F`.

## Data model

- Catalog lives in Firestore, `videos/{rowNum}` collection (rowNum = doc ID, preserved from the old spreadsheet so favorites/recently-viewed/deep-links keep working).
- The **public site never reads Firestore directly** — it fetches a static JSON snapshot (`SNAPSHOT_URL`, Cloud Storage, ~22MB) via `fetchData()` in `app.js`. Admin edits are staged in Firestore and only go live after a "Publish" step regenerates that snapshot.
- Client-side cache of the snapshot: IndexedDB (`openCacheDb()`, db `mvg-cache`, store `kv`, key `CACHE_KEY`). Not localStorage — the snapshot is too large for localStorage's ~5-10MB quota (this was a real bug: `QuotaExceededError` was being silently swallowed).
- `fetchData()` races the IndexedDB cache read against the network fetch in parallel (`networkDone` flag prevents a slow cache read from clobbering a faster network response).

## Admin-controlled boolean flags (Feature / Spotlight / Sponsored)

All three follow one pattern — when adding a new one, touch every step:
1. Admin add/edit form checkbox in `index.html`
2. `showAdminForm()` (populate) + `state.adminFormOriginal` in `app.js`
3. `BULK_FIELD_ALIASES` (bulk-import column recognition)
4. `buildBulkDoc()` (bulk-import read path)
5. Single add/edit submit handler (read path)
6. `upsertAdminRowLocal()` (local admin-list cache)
7. `renderAdminEntries()` (admin-list badge)
8. `cleanRows()` (initial data load, regex-matches the raw spreadsheet-style column)
9. Client `publishSnapshot()` in `app.js` **and** `scripts/publish-snapshot.js` (both must carry the field)
10. Public card templates: `renderSpotlightSidebar` (`.spotlight-card`) and `createMediaStrip` (`.media-strip-card`, shared by Latest/Featured/Favorites)
11. CSS for any public-facing badge

Feature and Spotlight have **cap-eviction** (`enforceCap(kind, timestampField, cap)`, oldest-by-checked-at evicted first — caps are `30` for Feature, `SPOTLIGHT_COUNT` for Spotlight, currently `6`). When bumping a cap constant, grep for every hardcoded call site — a stale hardcoded cap number in `enforceCap()` calls silently re-evicts entries back down and was a real production bug (Spotlight bumped to 6 but eviction still hardcoded to 3).

Sponsored has **no** cap-eviction — manually admin-controlled, no capacity limit, by design (it's a paid/manual placement, not an algorithmic rotation).

## `[hidden]`-attribute cascade gotcha

A component's own unconditional `display` CSS rule can silently beat the browser's default `[hidden]{display:none}` UA rule, regardless of specificity or source order — author styles always win that fight over user-agent styles. If a `hidden`-attribute toggle isn't working, check for a same-selector `display` declaration first. Hit multiple times this project (message board panel, top-bar Admin/Sign-in icons).

## Modal-stack conventions

`.lightbox` wrapper + `.lightbox-backdrop` + `.lightbox-panel`, paired `openX()`/`closeX()` functions. New modals must be registered in **both** `closeAllModalsHard()` and the Escape-key `anyOpen` check, or they won't be dismissible via those paths. For one popup handing off to another (not a real back-navigation), just call `closeX(); openY();` directly rather than routing through modal history.

## AdSense

Auto ads only (single script tag, `client=ca-pub-8223299314215910`, no manual ad-unit slot IDs — Google auto-places). The script tag needs to be on every page that should carry ads — currently `index.html`, `support.html`, and the shared `page()` template in `scripts/generate-seo-pages.js` (covers all generated director/artist/video hub pages). `privacy.html`/`delete-account.html` deliberately excluded (pure utility pages). `ads.txt` lives in the separate `mauimauricio83.github.io` root repo, not here — a GitHub Pages project site can't serve a file at the true domain root.

## Cron jobs (`.github/workflows/`)

- `build-seo-pages.yml` — daily, heavy (~13,700 files), regenerates SEO hub pages + sitemap + RSS. Only affects crawlability, not the live homepage.
- `fetch-blog-latest.yml` — hourly at :15 past, lightweight, regenerates `blog-latest.json` (actually feeds the homepage News section). Split out from the daily job so new blog posts show up within the hour.

Repo is public, so GitHub Actions minutes are free/unlimited — no cost tradeoff to running crons more often.
