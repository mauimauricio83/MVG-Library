# Changelog

Informal version history for MVG Library, reconstructed from git log. No strict semver enforcement — major bumps mark genuine breaking/architectural changes, minor bumps mark additive features.

## v4.1.1 — current
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
