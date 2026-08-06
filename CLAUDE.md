# MVG Library — operating manual

Vanilla JS/HTML/CSS static site, no build step. Firestore-backed catalog, hosted on GitHub Pages at `mauimauricio83.github.io/MVG-Library/`. Companion repo `E:\Local Apps\mauimauricio83.github.io` hosts the actual domain root (`mauimauricio83.github.io/`) — needed for anything that must live at the true domain root (e.g. `ads.txt`), since this repo is a GitHub Pages *project* site served from a subpath.

## Housekeeping rules (do these every meaningful commit)

- **Bump `APP_VERSION`** in `app.js` (near the top, has an inline reminder comment) **and add a `CHANGELOG.md` entry** for any user-visible change — feature, fix, or redesign. This was neglected for ~7 commits before v5.3.0; don't let it drift again. Regenerated-content commits (`Regenerate SEO hub pages [automated]`, `Update latest blog posts [automated]`) don't need a version bump — bump once per batch of hand-written changes, not per commit.
- **Never push without the user's explicit go-ahead.** Commit locally freely; ask before `git push`.
- **Before every push**, check for divergence first: `git fetch origin && git log --oneline main..origin/main`. A GitHub Action cron lands automated commits (`Regenerate SEO hub pages`, `Update latest blog posts`) regularly — rebase onto them if they've landed.
- **Keep `app.js`'s client `publishSnapshot()` and `scripts/publish-snapshot.js` (the CLI counterpart) in sync.** Any field added to one needs the identical line in the other.
- **Firestore `firestore.rules` changes need a manual `firebase deploy`** — editing the file alone doesn't take effect.
- **Adding a new `hidden`-toggled element? Read the `[hidden]`-attribute cascade gotcha section below first.** Hit six times already — it's not an edge case, it's the default outcome unless checked for.

## Local dev server

Use `preview_start({name: "mvg-wiki"})` — reads `.claude/launch.json`, runs `node serve.js` on port 8420. **Do not** use `preview_start({url: "http://localhost:8880"})` or any raw URL — that only opens a tab against whatever's already listening there, it does not start/restart a server, and a stale process squatting on an old port will silently serve outdated files while looking like a working preview. If output looks stale despite correct source, check for an orphaned process first: `netstat -ano | findstr :8420` (or whatever port), `taskkill //PID <pid> //F`.

## Data model

- Catalog lives in Firestore, `videos/{rowNum}` collection (rowNum = doc ID, preserved from the old spreadsheet so favorites/recently-viewed/deep-links keep working).
- The **public site never reads Firestore directly** — it fetches a static JSON snapshot (`SNAPSHOT_URL`, Cloud Storage, ~22MB) via `fetchData()` in `app.js`. Admin edits are staged in Firestore and only go live after a "Publish" step regenerates that snapshot.
- Client-side cache of the snapshot: IndexedDB (`openCacheDb()`, db `mvg-cache`, store `kv`, key `CACHE_KEY`). Not localStorage — the snapshot is too large for localStorage's ~5-10MB quota (this was a real bug: `QuotaExceededError` was being silently swallowed).
- `fetchData()` races the IndexedDB cache read against the network fetch in parallel (`networkDone` flag prevents a slow cache read from clobbering a faster network response).
- **`cleanRows()` in `app.js` is dead code**, not part of the live pipeline — `state.rows` is set directly from the fetched snapshot JSON (see the comment at the `fetchData()` call site: "Snapshot is already in cleanRows()'s exact shape... no mapping needed"). Don't add new fields there; it doesn't affect what actually renders.
- `createdAt` (epoch millis, `Timestamp.toMillis()`) **is** published to the public snapshot as of v5.12.0 — set via `FieldValue.serverTimestamp()` on doc creation (both the single add/edit form and bulk import), so it's reliably populated for anything created through the admin UI going forward, but entries imported before this may not have it. Consumers that key off it (e.g. `ageBucketSample()`) must treat a missing value as "unknown age," not "very old."
- `LATEST_MIN_ROWNUM` (currently `13179`) is the floor below which rows are internal research/backfill, not real submissions — excluded from Latest Submissions and the word cloud (`isEligibleLatestSubmission()`/`isEligibleSubmission()` in `app.js`/`cloud.js`). The per-entry `backdoor` boolean flag is the general escape valve for anything *above* the floor that still isn't a real submission (e.g. a future bulk research import) — set via a checkbox on both the single add/edit form and the bulk-import batch (one checkbox applies to the whole pasted batch, not a per-row column).
- Catalog entries carry `youtube` and/or `vimeo` URL fields — `getRowVideoRef(row)` in `app.js` is the one place that decides which provider a row actually uses (youtube wins if both are somehow set). Vimeo has no predictable thumbnail URL like YouTube's `i.ytimg.com`, so it's resolved once via Vimeo's oEmbed endpoint at admin save-time (single add/edit and bulk-import preview) and cached on the row as `vimeoThumb` — never fetched per-visitor. Every player-creation call site (profile reels stay YouTube-only, catalog entries don't) goes through `createVideoPlayer()`, a common wrapper over `YT.Player` and `Vimeo.Player` so callers don't branch on provider themselves.

## Admin-controlled boolean flags (Feature / Spotlight / Sponsored / Backdoor)

All follow one pattern — when adding a new one, touch every step (step 8 below, `cleanRows()`, is **not** part of the live pipeline — see Data model above — skip it):
1. Admin add/edit form checkbox in `index.html`
2. `showAdminForm()` (populate) + `state.adminFormOriginal` in `app.js` (only needed if the flag has cap-eviction timing to track, like feature/spotlight — `sponsored`/`backdoor` don't)
3. `BULK_FIELD_ALIASES` (bulk-import column recognition) — unless it's meant to be a single whole-batch checkbox instead of a per-row column, like `backdoor`'s bulk-import checkbox
4. `buildBulkDoc()` (bulk-import read path)
5. Single add/edit submit handler (read path)
6. `upsertAdminRowLocal()` (local admin-list cache)
7. `renderAdminEntries()` (admin-list badge)
8. ~~`cleanRows()`~~ — dead code, skip (see Data model above)
9. Client `publishSnapshot()` in `app.js` **and** `scripts/publish-snapshot.js` (both must carry the field)
10. Public card templates: `renderSpotlightSidebar` (`.spotlight-card`) and `createMediaStrip` (`.media-strip-card`, shared by Latest/Featured/Favorites)
11. CSS for any public-facing badge

Feature and Spotlight have **cap-eviction** (`enforceCap(kind, timestampField, cap)`, oldest-by-checked-at evicted first — caps are `30` for Feature, `SPOTLIGHT_COUNT` for Spotlight, currently `6`). When bumping a cap constant, grep for every hardcoded call site — a stale hardcoded cap number in `enforceCap()` calls silently re-evicts entries back down and was a real production bug (Spotlight bumped to 6 but eviction still hardcoded to 3).

Sponsored and Backdoor have **no** cap-eviction — manually admin-controlled, no capacity limit, by design (Sponsored is a paid/manual placement; Backdoor is a permanent per-entry exclusion flag, not a rotation).

## Seeding a dropdown option before any entry uses it

The public submission form's Category/Country/Genre dropdowns (`buildSubmitDropdowns()` in `app.js`) are live-derived from whatever values already exist across `state.rows` — there's no static taxonomy to edit for the normal case; a value shows up automatically once some entry is tagged with it. To make an option selectable *before* any entry has it (e.g. someone requests a new genre tag that doesn't exist yet), add it to `SUBMIT_GENRE_EXTRAS` (or the equivalent for category/country if that need ever comes up) — merged into the submission dropdown only. Deliberately **not** merged into the public browse/filter dropdown (`buildGenreOptions()`) — that one shows match counts, so a zero-count option would just be a dead end for anyone browsing.

## ⚠️ `[hidden]`-attribute cascade gotcha — check this EVERY time, not just when something breaks

**Rule: any time you add or touch an element that gets toggled via the `hidden` attribute (`el.hidden = true/false` in JS), and that element's own CSS (or a class it carries) sets an unconditional `display` value, add a `.the-selector[hidden] { display: none; }` override in the SAME edit. Don't wait for a bug report.**

Why this keeps happening: a component's own unconditional `display` CSS rule silently beats the browser's default `[hidden]{display:none}` UA rule, regardless of specificity or source order — author styles always win that fight over user-agent styles, even a single low-specificity class selector against the UA stylesheet. There's no error, no warning, no console output — the element just never visually hides. It stays on screen, stacked on top of whatever was supposed to replace it, and looks like a completely different, more confusing bug (two views rendering at once) unless you already know to suspect this.

**Before shipping any new hideable component:**
1. Does its own CSS rule (or a shared class it carries, e.g. `.submit-form`) set `display` unconditionally?
2. If yes → add the `[hidden]` override right next to that rule, immediately, in the same commit.
3. Verify in the browser: toggle `hidden` and confirm `getComputedStyle(el).display` is actually `"none"` — don't just trust that it looks right, the two views can visually overlap in subtle ways.

**Hit six separate times in this project already**, each one initially misdiagnosed as something else: the message board panel, top-bar Admin/Sign-in icons, `.header-icon-btn`, `.profile-editor`, `.submit-form` (the admin Bulk Import/Add Entry overlap bug), `.profiles-grid`. Assume the next hideable element you add has this bug too, until you've checked.

## YouTube embed limitations (4:3 crop mode)

The 4:3 crop toggle (`is-crop-4-3` in `styles.css`) is a CSS-only scale+clip trick — it doesn't distort the iframe's own aspect (still real 16:9, just bigger), so YouTube's UI chrome renders correctly proportioned, but anything pinned to the iframe's actual edges (bottom control bar, top title/channel overlay) gets pushed past the visible clip region and cut off along with the picture. The bottom bar is suppressed via `controls: 0` in `playerVars` whenever crop mode is active (see the `createVideoPlayer()` call sites in `app.js`). The **top title/channel overlay can't be suppressed the same way** — YouTube deprecated `showinfo` (2018) and `modestbranding` (2023) and always forces that overlay on load/hover/pause now. Its partial cropping in 4:3 mode is an accepted, permanent limitation of this technique, not a bug to keep chasing — don't burn time trying to CSS/playerVars your way around it again.

## Modal-stack conventions

`.lightbox` wrapper + `.lightbox-backdrop` + `.lightbox-panel`, paired `openX()`/`closeX()` functions. New modals must be registered in **both** `closeAllModalsHard()` and the Escape-key `anyOpen` check, or they won't be dismissible via those paths. For one popup handing off to another (not a real back-navigation), just call `closeX(); openY();` directly rather than routing through modal history.

## AdSense

Auto ads only (single script tag, `client=ca-pub-8223299314215910`, no manual ad-unit slot IDs — Google auto-places). The script tag needs to be on every page that should carry ads — currently `index.html`, `support.html`, and the shared `page()` template in `scripts/generate-seo-pages.js` (covers all generated director/artist/video hub pages). `privacy.html`/`delete-account.html` deliberately excluded (pure utility pages). `ads.txt` lives in the separate `mauimauricio83.github.io` root repo, not here — a GitHub Pages project site can't serve a file at the true domain root.

## Cron jobs (`.github/workflows/`)

- `build-seo-pages.yml` — daily, heavy (~13,700 files), regenerates SEO hub pages + sitemap + RSS. Only affects crawlability, not the live homepage.
- `fetch-blog-latest.yml` — hourly at :15 past, lightweight, regenerates `blog-latest.json` (actually feeds the homepage News section). Split out from the daily job so new blog posts show up within the hour.

Repo is public, so GitHub Actions minutes are free/unlimited — no cost tradeoff to running crons more often.
