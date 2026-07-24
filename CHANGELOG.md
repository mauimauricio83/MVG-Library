# Changelog

Informal version history for MVG Library, reconstructed from git log. No strict semver enforcement — major bumps mark genuine breaking/architectural changes, minor bumps mark additive features.

## v4.18.1 — current
- Moved Spotlight from a sticky sidebar next to results to a proper section right below the about strip, above Latest Submissions -- one row of up to 3 cards instead of a vertical stack. Also hides on the dedicated Search/TV pages, like the other Home-only sections
- Moved the ad banner to right below the new Spotlight section (above Latest Submissions), instead of between Latest Submissions and TV Mode. Applies on both desktop and mobile since nothing in the request scoped it to desktop-only
- Fixed a real bug hit while moving the banner: `moveVideoPairHome()`, a defensive layout function that re-anchors elements on every render, was moving the ad banner back to its old spot (after Latest Submissions) regardless of where the HTML placed it. Removed the banner from that function's scope -- it now has one fixed position and nothing moves it dynamically anymore

## v4.18.0
- Fixed sidebar icon misalignment: `.header-account-btn`'s `padding: 0` was overriding `.submit-link`'s padding for `<button>` items (but not `<a>` items, which don't have that class), so button icons sat 8px left of link icons
- Simplified the "about" strip: removed the blurb paragraph, kept the subtitle + stats line, centered
- Featured and Latest Submissions are now capped to ~2 rows on desktop by default, with a "See more" toggle to expand -- previously required several scrolls just to get past them
- Added a top-bar search icon (upper right, in line with the title) that pops out a search bar on top of the hamburger/logo/title. Typing in it opens a dedicated search-results page (hiding Latest/TV Mode/Featured/about strip) -- the existing inline search between Latest and TV Mode is unchanged and still filters in place on the home page; the two stay in sync
- Added Home and TV Mode links to the top of the left sidebar (desktop only -- mobile already has both via the bottom nav) so users can get back to the main gallery or reach a dedicated TV Mode page (banner, player, filters only) from anywhere
- Fixed a second sidebar icon bug found along the way: Discord's icon was an accidental copy of the Home icon's house-shaped path from the original sidebar build -- now a proper chat-bubble icon

## v4.17.0
- Redesigned the desktop layout to a YouTube-style shell: a full-width top bar (hamburger leftmost, then logo, then title), a persistent left sidebar (icon rail collapsed, icons + plain-text labels when expanded via the hamburger -- no more blue/underlined links), and a maximized (not centered) main content area
- The old centered subtitle/stats block is now a compact "about" strip under the top bar, with a short blurb (loosely adapted from the Support page) added alongside it
- Featured and Latest Submissions are now dominant, gallery-style grids on desktop with much bigger thumbnails, instead of a small horizontal scroll strip. Favorites keeps the compact strip. Mobile is unaffected -- still the horizontal scroll strips and fullscreen hamburger menu built over the last several updates
- Desktop's sidebar toggle is a simple, non-modal expand/collapse (no history entry, no scroll lock, doesn't auto-close when something inside it is clicked) since it's a persistent nav element, not a transient overlay like the mobile version of the same menu

## v4.16.4
- TV view (mobile, via the bottom nav's TV Mode button) now also hides Latest Submissions, so the ad banner and TV Mode section sit right after the header instead of further down the page

## v4.16.3
- Stripped the border/background box off the mobile hamburger button, leaving just the three lines -- smaller footprint gives the title more breathing room so it's not at risk of touching the button

## v4.16.2
- Fixed mobile header centering: the last commit's `padding-right` on `.app-header` (reserved for the hamburger button) was shifting the subtitle and stats line off true screen-center along with the title row. Removed it -- the shrunk title/logo row is short enough not to reach the button anyway, and the subtitle/stats now measure dead-center regardless

## v4.16.1
- Added the MVG logo to the left of the "MUSIC VIDEO LIBRARY" title and shrunk the title text to balance it. The subtitle and stats line are separate elements centered independently to the screen, not to the title/logo row, so they stay aligned the same way regardless of the row's own width

## v4.16.0
- Added an Autoplay setting (Settings modal) -- when off, opening a video no longer starts it playing automatically. Scoped to the lightbox only; TV Mode always autoplays since that's the point of it
- Added a "Clear favorites" action (Settings modal), matching the existing "Clear Recently Viewed history" one
- The last-used browse tab (By Director/Artist/Song Title) is now remembered across visits instead of always resetting to By Director. Fixed a bug in this while building it: the preference-reading function was declared after `state` initialized (which calls it), so the `var`-hoisted-but-not-yet-assigned lookup table it depended on was `undefined` at that point, silently breaking on every load and always falling back to the default -- moved the declarations above `state`
- Pressing Enter in the search box now blurs it (dismissing the on-screen keyboard on mobile) and scrolls down toward the results
- Repositioned the mobile hamburger button to sit beside the title/subtitle block (top-right corner) instead of on its own row further down the page

## v4.15.2
- Fixed the lightbox's ad banner sometimes not appearing at all (video shown at the very top of the lightbox with no banner above it) -- most noticeable on a cold app launch, where the banner's own data fetch competes with the much larger main data fetch and can lose the race if a video gets opened quickly. The lightbox previously just read whatever was in the shared ad cache at that exact instant and gave up permanently if it was empty; it now waits for the data to actually arrive. Fixed a second bug introduced while fixing the first: the "did the lightbox close while we were waiting" bail-out check ran before the lightbox was actually marked open, so it incorrectly bailed out every time the data was already cached (the common case after the first ad loads in a session) -- reordered so the check happens after the lightbox is marked open

## v4.15.1
- Disabled the category filter pills (Music Video, Dance, Short, etc.) for now -- getting cumbersome; the other filters (genre, year, country, MVG Reels only) are unaffected. Both desktop and mobile
- Removed the bottom A-Z/0-9 jump nav on mobile (the top one already covers the same job); desktop keeps both
- Added a third mobile view, TV, entered via the bottom nav's TV Mode button: hides Featured (irrelevant there) and reveals the Filters toggle (TV Mode shuffles through whatever the filters currently match, so being able to narrow them down first is useful)
- Fixed a bug from the last commit: the Filters panel was being force-expanded whenever Search view was entered, ignoring whether the user had collapsed it via the Filters button

## v4.15.0
- Mobile now has two distinct views instead of one long page: Home (default -- Latest Submissions, ad banner, TV Mode, Featured) and Search (tabs, search box, filters, jump nav, results), switched via the bottom nav's Search/Home buttons. Supersedes the previous "hide Featured while typing" patch -- Featured now only ever appears in Home view, full stop
- Favorites is now a vertical popup (matching Recently Viewed) instead of an inline horizontal strip on mobile; desktop keeps the inline strip
- Bottom nav reordered to Home / Favorites / Search / TV Mode / Settings; Settings moved here from the mobile hamburger menu (desktop keeps it in the header)

## v4.14.2
- On mobile, hide the Featured strip while actively typing a search query. It sits between the search box and the results list, so it was pushing results further down the page right when screen space is already tight from the on-screen keyboard. Reappears once the search box is cleared; desktop is unaffected

## v4.14.1
- Moved Search out of the bottom nav (it barely helped, since the search box was often already on screen right above it) and into a dedicated icon button next to the hamburger menu, reachable from anywhere via one scroll-to-and-focus tap. Bottom nav is now Home / Favorites / TV Mode
- Replaced all the emoji icons (bottom nav, hamburger, search) with consistent inline SVG icons -- emoji render inconsistently across platforms and read as visually mismatched next to each other

## v4.14.0
- Added a mobile-only bottom nav bar (Home, Search, Favorites, TV Mode) as a first step toward a more app-like mobile layout -- Search scrolls to and focuses the search box, Favorites/TV Mode scroll to their sections, Home scrolls to top. Hidden on desktop
- Fixed the browser/Android back button exiting the app entirely instead of dismissing whatever popup was open (video lightbox, Submit, Settings, Recently Viewed, the mobile header menu). Each popup now pushes one history entry on open; back triggers a proper close instead of leaving the page. X/backdrop/Escape dismissals now go through the same path (so back afterward doesn't leave a stale history entry), while switching between popups (e.g. Recently Viewed -> lightbox) reuses the same entry instead of stacking

## v4.13.2
- Fixed all four popups (video lightbox, Submit, Settings, Recently Viewed) opening pre-scrolled to wherever their panel was left scrolled to on a previous view, instead of the top. The panels reuse the same DOM node across opens and only their inner HTML was replaced, so a leftover `scrollTop` from a prior viewing (e.g. having scrolled down to read credits) persisted into the next one -- most visible on the video lightbox, where it could scroll the video itself out of view. Each panel's `scrollTop` now resets to 0 on open

## v4.13.1
- Fixed the mobile menu rendering blank/off-screen when this app is embedded via the auto-height iframe on themusicvideoguy.com (Squarespace): `position: fixed` is relative to the iframe's own render box in that setup, which can be far taller than the physical screen, so the fullscreen overlay was centering itself (a leftover `justify-content: center` from the desktop header rule) in the middle of that oversized box instead of at the top. Switched the panel to `position: absolute` anchored right at the header (a spot guaranteed visible, since the user just tapped the button there) with explicit top alignment
- Introduced a shared body-scroll-lock helper (`lockBodyScroll`/`unlockBodyScroll`, using the position:fixed+top-offset technique) used by all modals (lightbox, submit, settings, recent, header menu) instead of a plain `overflow: hidden`
- Note: the video lightbox, submit, and settings modals still use `position: fixed` and can exhibit the same off-screen rendering if opened while scrolled deep into the page inside that same iframe embed — from inside a cross-origin iframe there's no way to read the outer page's scroll position to correct for it. The durable fix is on the Squarespace side: give the iframe a fixed height with its own internal scrolling (`scrolling="yes"`/`overflow:auto`) instead of auto-resizing to match content height, so the iframe has a real, correctly-sized viewport of its own

## v4.13.0
- Redesigned the mobile hamburger menu: it's now a fullscreen panel (like the submit-form modal) instead of a small dropdown, with large plain-text items (no blue link styling/underlines), dividers, and a close (X) button; locks body scroll while open

## v4.12.2
- Right-align the mobile hamburger button and its dropdown panel (was centered under the title, which looked odd)

## v4.12.1
- Fixed the mobile hamburger menu: a leftover unconditional `.header-account-area` rule (further down the stylesheet, same specificity) was winning the cascade and right-aligning Settings/Sign in inside the dropdown. Moved the mobile overrides after the base rules and restyled the panel — centered items, a divider before Settings/Sign in — for a cleaner look

## v4.12.0
- Header links (Submit, Recently Viewed, Discord, Support, Settings, Sign in/account) now collapse into a hamburger menu below 640px, instead of wrapping onto multiple lines; the menu closes on item click, outside click, or Escape
- YouTube fullscreen (TV Mode and the lightbox) now requests landscape orientation lock while fullscreen, via the Screen Orientation API on `fullscreenchange`. Chrome/Android (including this app's installed TWA) honors it; iOS Safari has no such API and silently falls back to its normal rotate-to-fullscreen behavior

## v4.11.1
- Fixed header subtitle wording: "search below" (search bar is below the subtitle, not above)
- Removed the default browser-button bevel/border from Recently Viewed list items
- Added `.nojekyll` at the repo root — GitHub Pages runs Jekyll by default, which was silently excluding `/.well-known/`, so `assetlinks.json` 404'd and the installed Android app fell back to showing browser chrome (address bar, close/share/menu) instead of running fullscreen. Verified the signing cert fingerprint in `assetlinks.json` matches the release keystore, so this was the only blocker

## v4.11.0
- Header stats swap: the header subtitle now shows the short "N videos — search above..." message, while the full category breakdown ("N entries — N Music Videos, N Dances, ...") moved to the blank-results empty state
- Settings now sits directly beside (left of) Sign in/account in the header's right-aligned cluster
- Recently Viewed converted from a horizontal media strip to a vertical popup, opened via a new "Recently Viewed" link in the header (next to Submit music video); clicking an item closes the popup and opens that video's lightbox
- Favorites strip moved to directly below TV Mode/the ad banner, right after Latest Submissions

## v4.10.0
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
