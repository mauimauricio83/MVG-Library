# Changelog

Informal version history for MVG Library, reconstructed from git log. No strict semver enforcement — major bumps mark genuine breaking/architectural changes, minor bumps mark additive features.

## v4.10.0 — current
- Header cleanup: Sign in/account area moved to the far right, separated from the main link cluster; fixed a bug where "Sign in" stayed visible even while signed in (same `[hidden]`-vs-explicit-`display` class of bug as a few other elements this project has hit)
- Jump-nav letter/number bar now omits letters with zero matches entirely, instead of showing them grayed out
- TV Mode's video player and the ad banner now sit right below Latest Submissions instead of near the bottom of the filters area — verified TV Mode itself (start, skip, and staying stable through a search-triggered re-render) is unaffected by the reshuffle

## v4.9.0
- Added a "Support! ❤️" link in the header (right before Settings), pointing to a new thank-you page with a Ko-fi link
- Moved "Feedback" out of the header and into the footer, alongside Browse by Director/Artist and Privacy Policy

## v4.8.0
- Fixed: `html, body` used `background: transparent`, which relied on a parent page behind it to show anything other than white — broke in the installed Android app, which has no parent page. Now uses the themed `--bg` color directly
- New Settings toggle for Dark/Light appearance, defaulting to Dark, applied before first paint (no flash of the wrong theme) and persisted across visits
- Added `/.well-known/assetlinks.json` (Digital Asset Links) so the Android app opens as a real trusted app instead of a browser tab with a URL bar
- Added a Privacy Policy page, linked from the footer — required for the Play Store listing
- Android app: generated the TWA project, app icons, signing key, and a signed release bundle (`app-release.aab`) — ready for Play Console upload

## v4.7.0
- Added a web app manifest + generated icons (192, 512, and a padded maskable variant from the real MVG badge) — first step toward wrapping the site as an installable Android app via Trusted Web Activity

## v4.6.1
- Country filter dropdown is now alphabetized instead of sorted by frequency — much easier to scan for a specific country

## v4.6.0
- Per-video SEO landing pages: `/videos/<artist-song>/` for every entry with a YouTube link (12,197 pages) — each with an embedded player, full credits, description, VideoObject JSON-LD, and links to the director/artist hub pages plus a deep link into the app
- Hub pages' video listings now link to those video pages (internal linking) instead of straight to the app deep link
- Fixed a systemic sheet artifact: "Release date" cells holding a bare year published as dates like "June 18, 1905" (Sheets date-serial rendering, ~4,400 rows affected). Both the generator and the app's lightbox now decode the serial back to the intended year
- Video pages expand 2-letter country codes ("GB" → "United Kingdom"), matching the app
- Sitemap now carries all 13,649 URLs; the daily Action regenerates and commits video pages too

## v4.5.0
- New ⚙ Settings modal (header link): first action is "Clear history" for Recently Viewed — clears this device, and the signed-in account's copy too when logged in
- Audited playback paths: confirmed only TV Mode's own entry points (Start TV Mode + the four Play All buttons) trigger TV playback; every individual-video interaction opens the lightbox. No fix needed

## v4.4.0
- Collapsed Recently Viewed/Favorites are now a compact, left-aligned row with no Play All button (only shown when expanded), instead of a full-width bar
- Latest Submissions and Featured are now collapsible too, same chevron toggle — but default to expanded, unlike Recently Viewed/Favorites

## v4.3.2
- Fixed: ad banners always opened links in a new tab, even same-site ones like `#submit` — which broke out of the embedded iframe on the main site into a bare new tab on the raw GitHub Pages URL. Same-origin ad links now navigate in place instead; genuinely external links (hisong.io, forms.gle, etc.) still open in a new tab as before

## v4.3.1
- The submit modal can now be opened via a link ending in `#submit` (e.g. `https://mauimauricio83.github.io/MVG-Library/#submit`) — for pointing ad banners at the in-page form instead of the old external Google Form

## v4.3.0
- Recently Viewed and Favorites are now collapsible (chevron in the strip header), and collapsed by default — they're secondary/personalized content, unlike Featured/Latest which stay always-expanded. Your expand/collapse choice is remembered per strip

## v4.2.0
- Search now also matches Producer, DP, Editor, Choreographer, and Studio — not just artist/song/director. Genre/Country/Description stay out since those already have dedicated filters
- Bumped the local cache key so returning visitors get the wider search immediately instead of waiting on a stale cached copy

## v4.1.2
- Shortened header link text: "Submit music video", "Discord", "Sign in" (Feedback was already short)

## v4.1.1
- Submission form is live: wired up the deployed Apps Script Web App URL and confirmed real submissions land in the "Submissions" tab
- Simplified the submit fetch to a normal request instead of `no-cors` — turns out the Web App does respond with proper CORS, so failures now show a real error instead of always assuming success

## v4.1.0
- Replaced the external Google Form with an in-page "Submit your music video" modal. Core fields (Artist, Song Title, YouTube Link, Director, Category, Email) are always visible; everything else (Description, Genre, Country, Year, Release date, Producer, DP, Editor, Choreographer, Studio) is behind a "More details (optional)" disclosure
- Category/Genre/Country dropdowns are populated live from the same derived lists the filter panel uses — no separate static list to keep in sync
- Submissions post to a Google Apps Script Web App bound to a new "Submissions" review tab (separate from the master list), so nothing lands in the live database unreviewed
- Simple honeypot field to silently drop bot submissions
- Pending: `SUBMIT_WEBAPP_URL` needs the deployed Apps Script URL before this goes live — the form is otherwise fully wired and tested

## v4.0.1
- Fixed: the lightbox's ad banner was a frozen clone of whatever the top banner happened to show at the moment it opened, since it copied static HTML instead of running its own slideshow — it now gets a live, independently-rotating instance seeded from the same cached ad list (no extra fetch), correctly torn down on close so it doesn't leak a background timer

## v4.0.0
- Google sign-in (Firebase Auth): a "Sign in with Google" link in the header, showing your avatar/name + a Sign out link once signed in
- Favorites and Recently Viewed now sync to Firestore per-account when signed in, merging with whatever's already saved for that account rather than overwriting it — while staying fully functional signed-out via localStorage only, same as before
- First real external service dependency and the foundation for any future account-gated features — hence the major bump

## v3.9.0
- Favorites: a heart toggle in the lightbox saves videos to a "❤ Favorites" strip (right after Featured), with its own Play All
- Recently Viewed: automatically tracks the last 12 videos you've opened, shown in a "🕘 Recently Viewed" strip (right after Latest Submissions), with its own Play All
- Both live in this browser's `localStorage` only for now — no accounts yet, so nothing syncs across devices. First step toward the account/sync system discussed for later

## v3.8.0
- Added Google Analytics (GA4) — first real visibility into traffic and usage on the site

## v3.7.5
- Header title now uses Archivo Black (loaded from Google Fonts) instead of the system font stack, for a wider/heavier look closer to the "THE MUSIC VIDEO GUY" wordmark above it

## v3.7.4
- Clicking a jump-nav letter/number no longer auto-scrolls the page — stays put at your current scroll position

## v3.7.3
- Header title now picks up the MVG brand yellow (bolder weight too), tying it to "THE MUSIC VIDEO GUY" wordmark above it on the Squarespace page instead of sitting there as plain white text. Uses a mode-aware `--brand-yellow` (bright yellow in dark mode, a deeper gold in light mode for contrast)

## v3.7.2
- New subtitle: "Every music video, every credit, all in one place." (dropped the corrections-email line)
- Added a "Feedback" mailto link beside Discord in the header

## v3.7.1
- Added a "Join our Discord" link in the header, next to the submission link

## v3.7.0
- Latest Submissions strip now has a Play All button, same as Featured
- Spotlight cards open the lightbox instead of jumping into TV Mode
- Clear filters button moved outside the collapsible filters panel (next to the Filters toggle) so it's always reachable, and now also clears the search box
- Lightbox opens at large size by default (still remembers your last choice if you've switched it before)
- Latest Submissions and Featured strips lose their card frame/background on mobile
- Page header changed to "MUSIC VIDEO LIBRARY"

## v3.6.1
- Fixed: the two ad sheets were swapped (sidebar was reading the top banner's sheet and vice versa) — corrected to their actual intended placements

## v3.6.0
- Top horizontal ad banner can now also run as a rotating slideshow, sourced from its own separate sheet (same Seconds/Image/Link format as the sidebar's)
- Refactored both ad placements (sidebar + top) onto one shared slideshow implementation, each with its own independent rotation

## v3.5.0
- Spotlight sidebar's vertical ad slot is now a slideshow: sourced from its own published Google Sheet (`Seconds`, `Image`, `Link` columns), crossfading through as many ads as the sheet has, each with its own on-screen duration, pausing on hover

## v3.4.0
- Static, crawlable director/artist hub pages: `/directors/<slug>/` and `/artists/<slug>/`, generated for anyone with 3+ videos in the sheet (1,383 pages total). Each is real server-delivered HTML — no JS required to see the content — with its own title, description, and VideoObject JSON-LD, and links back into the interactive library via `#row-<n>` deep links
- `/directors/` and `/artists/` A–Z index pages, linked from the homepage footer, so crawlers can discover the hub pages without relying solely on the sitemap
- `sitemap.xml` now lists every hub page (regenerated by the same script)
- Scheduled GitHub Action (`.github/workflows/build-seo-pages.yml`) regenerates the hub pages and sitemap daily as the sheet changes, committing automatically
- This is the structural SEO fix flagged in v3.3.0 — first genuinely crawlable per-entity pages beyond the single homepage

## v3.3.0
- SEO pass: unique/keyword-rich title and meta description, canonical link, robots meta, `robots.txt`, `sitemap.xml`, sitewide JSON-LD (`WebSite`) schema, favicon
- Thumbnail images (Latest/Featured/Spotlight cards) now have descriptive alt text instead of empty strings
- Tab title updates to the video's song/artist while the lightbox is open, reverting on close

## v3.2.0
- Spotlight sidebar's vertical ad slot is live: adaptive image (any width/height, scales to the sidebar's width, no cropping) linking to the video submission form

## v3.1.2
- Fixed: Spotlight sidebar stayed visible in the blank default-results state, sitting awkwardly next to the one-line search prompt with nothing to pair it with — now hidden until there's an actual results list (search, filter, or letter-jump), matching the jump-nav's existing hide-when-blank behavior

## v3.1.1
- Fixed: switching tracks while TV Mode was already active (e.g. clicking a second/third Spotlight card) silently kept playing the original video — moving the video section in the DOM was force-reloading the iframe out from under loadVideoById()
- Fixed: blank default-results state left a large dead gap before the bottom jump-nav; now hidden when there's nothing to jump around in
- Added a small footer with version + credit

## v3.1.0
- Results list starts blank instead of rendering all ~12,500 rows on load — populates on search, filter, or letter-jump. TV Mode's "shuffle everything" default is unaffected, since it reads the data directly rather than the rendered list.

## v3.0.0 — Spotlight sidebar
- New sticky sidebar next to the results list: up to 3 curated videos (sheet row order, not shuffled), via a "Spotlight" checkbox column
- Clicking a Spotlight card plays it directly in TV Mode, reusing the existing single-video-queue path
- Fades out while the lightbox is open; hidden entirely on mobile (no room for a second column)
- Stubbed an empty vertical-ad slot below the cards for future use
- First structural/breaking change since v2.0 (new results-layout wrapper, cross-cutting lightbox behavior) — hence the major bump

## v2.9.0
- Search: tokenized, order-independent, cross-field matching ("romanek hurt" finds Johnny Cash's "Hurt")
- Country field: MusicBrainz-backed data pipeline, lightbox display, filter dropdown, collapsible filters panel with Clear filters
- Report Issue: per-entry flag in the lightbox and TV Mode, pre-filled Google Form
- Featured/Latest Submissions strips, Play All, TV Mode relocated into the player itself
- Choreographer credits, runtime broken-embed detection with fallback, lightbox resizing, contextual tooltips
- Visible loading feedback for the initial ~12k-row fetch

## v2.0.0 — Lightbox rewrite
- Replaced inline-expand entry interaction with a full lightbox: video player, complete credits, description, related videos
- Breaking change to the core browsing interaction model

## v1.0.0 — Real dataset
- Pointed the site at the full, live database (12,000+ rows) instead of a starter set — first version treated as the actual product rather than a prototype

## Pre-1.0 — Foundation
- Initial build, collapsible list view with jump navigation, category filters, deep links, caching, TV mode, Year/Genre filters, inline video playback, ad placeholder
