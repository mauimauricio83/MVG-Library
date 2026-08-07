# Changelog

Informal version history for MVG Library, reconstructed from git log. No strict semver enforcement — major bumps mark genuine breaking/architectural changes, minor bumps mark additive features.

## v5.23.0 — current
- New logo: replaced `icons/icon-192.png`/`icon-512.png` (favicon, header mark, apple-touch-icon) with the new MVG mark, generated from a 5000x5000 master. Regenerated `icon-512-maskable.png` too -- flattened onto a full-bleed square in the logo's own purple (`#4a0d8f`, matches the site's own `--accent`) instead of leaving transparent corners, so an aggressive OS icon mask can't reveal blank corners. Filenames unchanged, so no HTML/manifest references needed updating. A horizontal version is still pending for spots where a wide logo fits better than the circular mark.

## v5.22.1 — current
- Admin "Add/Edit Entry" form: Country and Genres were plain free-text fields with nothing to pick from (unlike the public Submit form, whose equivalents are dropdowns). Added a fast-fill dropdown above each, sourced from the same catalog-derived lists as the public form -- picking a value fills/appends into the text field below it, which stays fully editable so a brand-new country or genre not yet in the catalog can still just be typed.

## v5.22.0 — current
- Sunset Advanced Search: removed the separate full-page Genre/Era search UI and its top-bar open button entirely (was clunky and duplicated the regular Search view).
- Search view: removed the Filters collapse/expand toggle -- filters are now always visible, no hide/show state to manage.
- Search view: switched results from the old compact text-row/thumbnail-grid list to the reddit-style thumb-left/description-right card (the look Advanced Search introduced, now reused here as the site's one search results style; its CSS/JS were renamed from `adv-search-card`/`advSearchResultCardHtml` to `result-card`/`resultCardHtml` since "Advanced Search" no longer exists as a concept).
- "Save as Playlist" is now "Create Playlist" on desktop, and collapses to a small "+" icon button on mobile (same pattern as TV Mode's own "+" playlist button) -- same underlying snapshot-current-results-into-a-playlist behavior, just relabeled/responsive.

## v5.21.1 — current
- Removed the yellow text-shadow glow on titles (top-bar title, section headers, Spotlight/News) in both light and dark mode -- didn't read well, especially in light mode. Box-shadow glow (nav toggle, primary buttons, card hover) is unaffected, kept as-is.

## v5.21.0 — current
- Removed remaining emoji site-wide (🎬 Watch, 🤝 Connect, ❤ Favorites, 🎵 Playlists, 🕘 Recently Viewed titles; 🗑 delete buttons and 📍 location labels replaced with inline outline SVG icons matching the existing top-bar icon style). Codified as a standing rule in `CLAUDE.md`: no emoji, ever -- use an outline SVG icon if one's genuinely needed. Plain text symbols already used as compact icons (▾ ▴ ▶ ✓ ♥ ♡ ✎) are explicitly exempt, not touched.
- Added a soft purple glow on hover to video thumbnail cards (Latest/Featured/Favorites) and Spotlight/Discover cards (shared `.spotlight-card`) -- previously just a cursor change with no other hover feedback.

## v5.20.3 — current
- Dialed the glow down a notch across the board (both the purple box-shadows and yellow text-shadows).
- Added the yellow glow to Spotlight/News titles too (`.spotlight-sidebar-title`) -- they'd been missed when titles first went yellow.
- All four "See more"/"See all" buttons (Latest, Featured, Favorites, Discover) are now filled purple with white text instead of a plain bordered/gray button, matching the site's other primary CTAs.

## v5.20.2 — current
- Extended `--accent` purple into browser chrome that previously defaulted to generic blue: text selection highlight, the page scrollbar thumb (WebKit/Blink + Firefox), and keyboard focus rings (`:focus-visible`, doesn't show on mouse/touch clicks).
- Added a subtle glow to the two highest-visibility purple/yellow elements rather than all 35+ places `--accent` shows up as a fill (would've been overload): the Watch/Connect toggle's active pill and `.submit-form-btn` (the shared primary-CTA class across Submit/Save/Send buttons) get a soft purple `box-shadow`; the top-bar site title and section headers (Latest Submissions, Featured, Discover, etc.) get a soft yellow `text-shadow`.

## v5.20.1 — current
- Deeper, more vivid `--accent` purple (`#4a0d8f`/`#a855f7`), calibrated against the logo's own dominant color (sampled directly from `icons/icon-192.png`: a deep, highly-saturated indigo, `rgb(32,16,96)`) rather than picking a shade blind.
- Removed TV Mode's (and Advanced Search's, which shared the same tile look) per-genre color-coding -- genre tiles were each a different color (`TV_GENRE_GROUPS`' now-removed `color` field); all genre/era tiles now use the single unified `--accent` purple like everything else, no more rainbow.
- `--accent`/`--accent-soft` are now clearly documented as the single site-wide color control point (see the comment above `:root` in `styles.css`) -- as close to a "global color setting" as a no-build-step plain-CSS site can get. They're still defined in 4 places (2 conceptual values -- light/dark -- each written twice for the auto `prefers-color-scheme` detection and the explicit `[data-theme]` toggle override), which is inherent to having no preprocessor, not something left unfinished.

## v5.20.0 — current
- Site-wide recolor: `--accent` (buttons, links, active states) is now a dark purple instead of blue, in both light and dark theme (`#5b2e91`/`#a78bfa`). Section/page titles (Latest Submissions, Featured, Discover, Favorites, Playlists, Profiles, Advanced Search, Spotlight/News, video/profile lightbox titles, and the admin/settings/submit/recent-viewed modal titles) now use `--brand-yellow`, the same yellow the site's own top-bar title already used, instead of the default text color -- one consistent identity instead of two.
- Removed the emoji from the Discover/Profiles/Advanced Search section headers to match the rest of the site's plain-text titles (Favorites/Playlists keep theirs -- meaningful icons, not decoration).
- Constrained Advanced Search's filter area (search box, tabs, tile grid) to a max width on desktop -- it was stretching to match the full-width results list, making genre/era tiles awkwardly wide.
- Moved the Advanced Search icon to sit directly beside the top-bar search box instead of over by Settings/Admin -- the search pill's own `margin: 0 auto` was centering itself independently and pushing the icon away as a separate flex sibling. New `.top-bar-search-group` wrapper centers both together; collapses to `display: contents` on mobile so the icon (mobile's only entry point to Advanced Search) stays in normal flow when the search pill itself hides.

## v5.19.0 — current
- Added Advanced Search: a dedicated full page (not a lightbox), reached via a new search-plus icon next to the top-bar search box. Genre/Era tabs (reusing TV Mode's own coarse bucket data, but fully independent filter state so the two features can never interfere) narrow the catalog; the page's own search box (synced with the other two) doubles as a text filter. Starts blank until at least one of genre/era/query is set. Results render as a Reddit-style horizontal list -- thumbnail left, title/artist/description right, preferring the in-house description with YouTube's own uploader description as fallback (`youtubeSearchText`, now published as its own field, not just folded into the search index). No Vimeo-description fallback yet -- that data doesn't exist in the schema, a Vimeo-only entry with no in-house description just shows none.
- Fixed Discover leaking into Search/Favorites/Playlists views (both desktop and mobile) -- it was only ever added to the Connect/Profiles view's hide-list when it shipped, not the others.

## v5.18.0 — current
- Fixed Discover's mobile "See more" doing nothing visible -- a leftover Spotlight-only rule (`.spotlight-card:nth-child(n+4) { display: none }`, meant to cap Spotlight's own mobile stack at 3 cards) was unscoped and silently hiding every Discover card past the 3rd too, since Discover reuses the same `.spotlight-card` look. New cards WERE being added to the DOM, just invisible. Scoped the rule to Spotlight's own container.
- Doubled Discover's batch sizes: 30/24 on desktop (was 15/12), 10/8 on mobile (was 5/4).
- Fixed Discover (and Latest Submissions/Featured) staying visible in Connect mode -- `#discoverSection` was missing from the view-switch CSS added when Discover shipped.
- Added the ability to rescind a still-pending outgoing collab request (both from the Requests list and the "Request sent" state on a profile's own lightbox) -- deletes the request outright rather than marking it "withdrawn", so sending a new one later just works. Requires a firestore.rules change (sender can now delete their own request, but only while status is still "pending") -- **needs `firebase deploy --only firestore:rules`** to take effect.

## v5.17.0 — current
- Added a "Discover" section after Featured -- unbounded randomized browsing of the whole catalog, not curated like Spotlight/Featured. Desktop: 3-column grid (Spotlight's card style), 15 videos initially, "See more" appends 12 at a time. Mobile: 5 initially, "See more" appends 4. Avoids repeats within a session until the whole catalog's been shown once, then starts a fresh randomized lap rather than dead-ending.

## v5.16.0 — current
- Replaced the "accept collab request -> reveal email -> mailto" hand-off with real in-app 1:1 messaging. A new "Message" button (replacing the old mailto link, on both a connected profile's lightbox and the Requests list) opens a chat thread modal with live updates while it's open. New Firestore collections: `dmThreads/{sortedUidPair}` (deterministic per-pair ID, so there's at most one thread per pair) and its `messages` subcollection, plus `acceptedPairs/{sortedUidPair}` -- a small marker doc written when a request is accepted, purely so the thread-creation security rule can verify server-side that two people are actually connected (collabRequests' own doc IDs are auto-generated, not derivable from a pair, so rules can't check one directly). **Requires `firebase deploy --only firestore:rules`** to take effect -- committing the rules file alone doesn't deploy it.

## v5.15.0 — current
- Added search and role filtering to the Profiles browse grid -- previously just an unfiltered list of every profile. Search matches name/bio/location text; role filters to Musician/Director/Production. The "no profiles yet" empty state now distinguishes a genuinely empty directory from a filter/search that matched nothing.

## v5.14.0 — current
- A Profile's lightbox now surfaces "Credits in the library" -- videos whose director/artist/producer/DP/editor/choreographer/studio field exactly matches the profile's display name (after normalization, including reversing the catalog's "Last, First" director format). Deliberately exact-match only, no fuzzy matching -- a real credit that doesn't match due to spelling/formatting differences is a false negative, the safer failure mode vs. wrongly linking someone to a video that isn't theirs. Fixed a latent bug this surfaced: `openLightbox()` didn't clean up an open profile's Leaflet map instance, which only mattered once a profile lightbox could hand off into a video lightbox (via a credit link) for the first time.

## v5.13.0
- Added admin-only debug toggles to both the video-detail lightbox and TV Mode, next to the 4:3 crop button: Mirror (exact horizontal flip) and Interlace (cycles Off/60Hz/50Hz). Interlace is a scanline overlay flipped on a real-time-locked `requestAnimationFrame` timer, not a real interlaced signal -- there's no pixel access into a cross-origin YouTube/Vimeo iframe, so the actual source frames can't be read or resampled.
- Also seeded "Trip-Hop" into the public submission form's Genre dropdown ahead of any tagged entry (`SUBMIT_GENRE_EXTRAS` in `app.js`) -- the dropdown is normally live-derived from existing entries only.

## v5.12.0
- Added Vimeo embedding as an alternative to YouTube everywhere a catalog entry's video shows up (cards, TV Mode, the video-detail lightbox, admin form, bulk import, the public submission form): entries carry a `vimeo` field alongside `youtube`, a shared `getRowVideoRef()`/`createVideoPlayer()` picks the right provider and SDK (YT IFrame API vs. Vimeo Player.js) per row, and Vimeo thumbnails (no predictable URL like YouTube's `i.ytimg.com`) are resolved once via oEmbed at admin save-time and cached as `vimeoThumb`, not fetched per visitor. TV Mode reuses the live player across track skips only when the next track is the same provider; switching provider mid-queue rebuilds cleanly.
- Latest Submissions now draws by real submission age (weeks since `createdAt`, newly published in the public snapshot) instead of rowNum rank: 1 week old ~40% of slots, 2 weeks ~30%, 3 weeks ~20%, 4-6 weeks ~10%, shuffled within each tier, shortfalls backfilled from the rest of the pool. The top 3 slots stay a random draw from the truly newest entries, unchanged.
- Reversed Spotlight order (newest-flagged entry first).
- 4:3 crop mode now also strips the YouTube player's own bottom control bar (`controls: 0`) instead of just cropping it off -- the top title/channel overlay can't be suppressed the same way (YouTube deprecated `showinfo`/`modestbranding` and always forces it on hover/pause), so partial cropping there is a documented, accepted limitation of the CSS scale+clip technique.
- Revised the Latest Submissions / word cloud eligibility floor to rowNum 13179 ("Jill Blutt — Untitled", the earliest confirmed real submission), and added a `backdoor` flag (bulk-import checkbox, also settable on the single add/edit form) as the general per-entry way to exclude a future research/backfill import from both, replacing the old hardcoded-rowNum-range mechanism.
- Confirmed Country/Genre are already dropdowns on the public submission form (no change needed).

## v5.11.1
- Fixed the Watch/Connect switch showing "Connect" as active on a fresh page load while the page itself displayed Watch's Home content. It was a persisted preference (localStorage), but the page's own default view is always Home/Watch on a fresh load regardless -- so returning to the site after a past "Connect" click left the switch and the actual screen disagreeing. Nav mode is no longer persisted across page loads; it always starts on Watch, matching what's actually shown, and still toggles normally within a session.

## v5.11.0
- Applied the same real-submissions-only filter to the word cloud (`cloud.js`) that Latest Submissions just got -- it had the identical vulnerability and was in fact what surfaced the Michel Gondry backfill block in the first place. Verified: Gondry no longer appears at all; the new top word is a far more reasonable outlier (18 vs. his previous 50).
- Mobile Latest Submissions and Featured get a "See all" button that expands the horizontal scroll strip into a proper 2-column gallery grid, instead of only being reachable by endless swiping. Play All moves out of the header and into the expanded gallery view (hidden until expanded) rather than sitting there unused before you've even looked at anything. Reuses the existing desktop "See more" toggle mechanism, just relabeled ("See all") and with mobile-specific grid styling. Favorites' mobile behavior is unchanged (horizontal scroll only).

## v5.10.2
- Latest Submissions now only draws from rowNum 12462 onward -- everything before that is internal research/backfill data, not real user submissions. Also explicitly excludes rowNum 13129-13178, the 50-entry Michel Gondry backfill block identified via the word cloud investigation (consecutive rowNums, clearly one bulk import, not 50 people individually submitting his videos) -- confirmed zero Gondry entries remain in the eligible pool (817 real submissions, rowNum 12462-13335) after both filters.

## v5.10.1
- Fixed Latest Submissions being vulnerable to a single large bulk import dominating the whole strip (the same class of problem the word cloud already had -- see `cloud.js`'s `LATEST_POOL` comment): it was a strict top-50-by-rowNum cutoff, so a big batch could occupy every slot until enough newer individual submissions pushed it out. Now the top 3 slots are randomized among the truly newest ~20 entries (so a reload doesn't always show the same order), and the remaining 47 are a weighted random sample favoring recent entries but with older ones still getting a shrinking, non-zero chance -- verified over 500 simulated trials that a 500-entry bulk batch (out of ~13,800 rows) never took more than ~28% of the strip, averaging ~16%.

## v5.10.0
- Added "Request to collaborate" — the first real matchmaking action on Profiles beyond browsing. A "Request to collaborate" button on someone else's profile (with an optional message) sends a request; a new Requests view (with a pending-count badge) lets the recipient Accept or Decline. Accepting reveals both sides' emails to each other (no in-app messaging yet, so email is the actual hand-off) via a mailto link. New `collabRequests/{id}` Firestore collection -- readable only by its two parties, emails pinned to each user's own auth token so they can't be spoofed, deployed and verified server-side.

## v5.9.4
- Fixed the reel badge on profile cards being clipped by the photo's own `overflow: hidden` -- moved the image's own clipping onto the `<img>` itself so the overlapping badge can sit outside the circle like intended.
- Profiles is now a members-only directory: browsing requires sign-in, not just creating a profile (`firestore.rules` now requires `request.auth != null` to read `profiles/{uid}`, deployed and verified server-side). Signed-out visitors see a sign-in prompt instead of the grid.
- Added a one-time intro message in the profile editor, shown only the first time someone opens it with no existing profile, explaining what the directory is for before the blank form.

## v5.9.3
- Redesigned the Profiles browse grid on mobile as compact Facebook-friends-list-style rows instead of a grid of big square-photo cards (which read as oversized once the grid dropped to ~2 narrow columns on a phone): a small round avatar, name, one short subtitle line (role), and a small overlapping badge marking whether the profile has a reel. Desktop keeps the existing card-grid layout unchanged.

## v5.9.2
- Added a "Profile saved!" popup after saving a profile, mirroring the existing post-submission thank-you flow (including the same Ko-fi support ask) instead of the edit form just quietly swapping back to the browse grid.
- Fixed a real bug in the admin panel: the Add Entry form (`#adminForm`, `.submit-form`) never actually hid when switching to Bulk Import -- same `[hidden]`-vs-unconditional-`display` CSS gotcha already fixed elsewhere (`.header-icon-btn[hidden]`, `.profile-editor[hidden]`), just not yet applied to `.submit-form`. The two views were rendering stacked on top of each other.
- Admin saves now auto-publish: adding, editing, or deleting a single entry publishes the live snapshot automatically afterward (status shows "Publishing…" then the result), matching bulk import's existing behavior instead of requiring a separate manual Publish click every time. The Publish button remains for manual retries.

## v5.9.1
- Fixed a real bug (predates the nav-mode switch): the Profiles sidebar link had `.sidebar-page-link`, a class that a pre-existing mobile rule hides entirely on small screens since those items (Home/TV/Favorites/Playlists) already live in the bottom nav bar. Profiles has no bottom-nav icon, so this silently made it completely unreachable on mobile since it first shipped -- automated testing missed it because a JS `.click()` works on a hidden element even though a real tap can't reach it. Removed the class; Profiles now correctly shows/hides based on nav mode like intended.

## v5.9.0
- Added a Watch/Connect nav-mode switch to the sidebar, to keep the two audiences (casual viewers vs. industry members using Profiles) clearly separated without hard-gating accounts: a persisted toggle that filters the nav down to Home/TV/Favorites/Playlists/Submit/Recently Viewed ("Watch") or Profiles ("Connect"). Untagged items (Discord, Settings, sign-in, socials) stay visible in both. Flipping to Connect also navigates straight to Profiles.
- Fixed a real bug this surfaced: `LIGHTBOX_SIZE_KEY`/`LIGHTBOX_CROP_KEY`/`TV_CROP_KEY` (and now `NAV_MODE_KEY`) were all declared *after* `state = {...}`, which reads them at construction time to load each saved preference -- so on every fresh page load, all four prefs silently read `localStorage.getItem(undefined)` instead of their real key, always resetting to the default regardless of what was actually saved. Only masked until now because testing a toggle within the same page session (no reload) reads the already-correct in-memory `state` value instead of hitting this path. Moved all the key constants above `state`.

## v5.8.2
- Fixed the profile editor's Delete button rendering mangled/overlapping: it was reusing `.tv-admin-delete-btn`, a fixed 28px circular icon button meant for a single glyph, but had real "🗑 Delete" text crammed into it. Gave it its own `.profile-delete-btn` pill-button style instead.

## v5.8.1
- Fixed a real bug: the profile editor form never actually hid itself when navigating back to the Profiles browse grid (or when reopened) -- `.profile-editor`'s own unconditional `display:flex` was silently beating the `hidden` attribute (same class of bug `.header-icon-btn[hidden]` was already fixed for elsewhere), so both views stacked visibly at once. Added the matching `.profile-editor[hidden] { display: none; }` override.
- Removed the "Use my location" button (browser geolocation) from the profile editor -- pinning is manual-only now (click the map). Some privacy/location-spoofing browser extensions block `navigator.geolocation` outright, which made the button an unreliable, confusing dead end for a chunk of users; manual pin placement always works regardless.

## v5.8.0
- Added map-based location pinning to Profiles, laying groundwork for the matchmaking system planned later: an interactive Leaflet/OpenStreetMap picker (no API key/billing needed) in the profile editor -- click to drop a pin or use "Use my location" (browser geolocation), with a best-effort reverse-geocoded city/country label (Nominatim). Optional field. Shows as a text line on profile cards and a small static-feeling map + label in the profile lightbox. `firestore.rules` extended to validate the new optional `location`/`locationLabel` fields.

## v5.7.0
- Added Profiles: a first-pass public directory for musicians/directors/productions to be discoverable, reached via the sidebar/hamburger. Signed-in users can create one profile (name, role, short bio, one embedded YouTube reel, an optional photo -- resized client-side before upload). Everyone else can browse the grid and open a profile to watch its reel in the existing entry-lightbox player. New `profiles/{uid}` Firestore collection (public read, owner write, field-validated, banned-user gated) and `profile-photos/{uid}` Storage path -- deliberately scoped to browse-only for now, no matching or messaging yet.

## v5.6.1
- TV Mode's play/stop switch moved next to Clear filters (leftmost of the TV controls) and grown to fit an ON/OFF label inside the track, red when off / green when on.
- Mobile hamburger menu moved from top-right to top-left.
- Fixed the mobile sidebar menu being uninteractable past whatever the viewport could fit (body scroll is locked while it's open, and the menu itself had no scroll of its own) -- it's now a fixed, independently-scrollable panel with its own close button pinned in place.

## v5.6.0
- Added a 4:3 crop toggle to both video players (video-detail lightbox and TV Mode): scales the embed up and clips the left/right edges rather than re-encoding anything, so the source video is untouched and the toggle is instant (no reload). Preference persists per-player across sessions.

## v5.5.0
- Added Playlists: named, user-curated video lists, syncing across devices via Firestore for signed-in users (same localStorage-first pattern as Favorites).
  - Two ways to build one: a reusable "+" button (lightbox and TV Mode) adds/removes the current video from any playlist via a floating popover, or "Save as Playlist" on the Search page snapshots the current filtered results into a new playlist.
  - Playlists get their own page off the sidebar/hamburger menu — a chip row to switch between them, with rename/delete and a "Play All" that hands the playlist straight to TV Mode.
  - TV Mode's Custom tab now lists every playlist; picking one arms TV Mode with just that playlist's videos (picking a Genre tile or Era/Decade value switches back to the normal filtered pool).

## v5.4.0
- **TV Mode rebuilt end-to-end**, aimed at feeling more like actually surfing channels than picking from a form:
  - Opening TV Mode now immediately arms a random pick from the current filters and shows it as a "channel ready" static/noise screen with a play button — title and artist stay hidden until you actually press play. No more "Start TV Mode" button.
  - Changing a filter while TV Mode is open live-updates the pool instead of only affecting future picks — preserves play/pause state across the swap (paused stays paused, playing keeps playing) so it feels like changing the channel, not restarting a video.
  - Year and Genre got dedicated, more playful pickers in place of plain dropdowns: Genre is a grid of 10 colorful tappable tiles (Pop, Rock, Metal & Punk, Hip-Hop/Rap, R&B/Soul/Funk, Electronic/Dance, Country/Folk, Latin/World/Reggae, Jazz/Blues/Classical, Other) grouped from the ~190 raw genre tags; Year is a 15-bucket decade dial (2020s, 2010s, then 2000s/90s/80s/70s each split into Early/Mid/Late thirds, plus a single "Pre-Music Video" bucket) arranged as a spinnable-feeling ring with a center hub showing the count. Both live on separate Genre/Era tabs (instead of being stacked) right above the ad banner, so the panel fits without much scrolling. Both remember/translate whatever exact Search-page selection was active and restore it exactly when TV Mode closes.
  - MVG Reels only, both info tooltips, and the Filters collapse/expand toggle are hidden in TV Mode (no use there) — the filters panel is just always open instead.
  - Removed the redundant title bar over the player (YouTube already shows the title) — Skip, Report issue, and Exit now live in one row beside Clear filters, easier to reach on mobile than a bar overlaying the video.
  - Added an (i) info button (shows title/tags/credits/description in place, without opening a real lightbox that would've killed playback), a favorite heart button, and admin-only Edit/Delete buttons, all in that same row.
  - A video that's gone private/deleted or has embedding disabled now auto-skips to the next track instead of silently stalling.
  - Player, filters, and ad banner reordered so the video is the first thing visible instead of being scrolled below the ad; the ad is now pinned to the very bottom of the screen on mobile instead of sitting right below the filters.
- Fixed filters staying visible on mobile Home if the panel had ever been expanded (a real bug, not just a TV Mode side effect — Home has no query/result set to filter against).
- Sped up mobile loading: the snapshot is now gzip-compressed on publish (~4x smaller transfer), and phones get a bigger, harder-to-miss loading indicator with a live percentage instead of just a thin top bar.
- Added a 3D revolving word cloud (artist/song/director names from the latest submissions) at `cloud.html`, linked from a small rainbow "cloud" icon in the footer.
- Added `CLAUDE.md`, a project operating manual covering backend architecture and housekeeping rules (this version/changelog bump included).

## v5.3.0
- Added a "Sponsored" flag (Spotlight/Featured slots) for monetization: mirrors the existing Feature/Spotlight admin pattern (form checkbox, bulk import, single edit, publish) but with no cap-eviction — manually admin-controlled, no capacity limit. Shows a gold "Sponsored" badge on public Spotlight/media-strip cards and in the admin Manage Entries list
- Added Google AdSense (Auto ads) site-wide, plus `ads.txt` on the `mauimauricio83.github.io` root-page repo (required since the project-site repo can't host a file at the actual domain root)
- Post-submission flow now pops up a real "Thank you for your submission!" modal (replacing the submit modal outright, not an in-panel swap) with a Ko-fi support prompt, Go back, and Submit again
- News section redesigned: 2 thumbnail cards + up to 4 compact text entries (each with a small thumbnail), fixed link color showing through as default blue/underlined on visited links
- Split the blog-fetch step out of the daily SEO-hub-page cron into its own lightweight hourly workflow, so new blog posts show up within the hour instead of up to a day late
- Fixed a real bug: `enforceCap("spotlight", ...)` was still hardcoded to a cap of 3 in two places even after Spotlight slots were bumped to 6, silently evicting new Spotlight entries back down every time one was added
- Added an RSS feed (`rss.xml`, latest 30 submissions) with a visible footer link and `<link rel="alternate">` tag
- Six-item UX/performance batch: left sidebar now open by default on desktop, a "Share Favorites" button next to Play All on the Favorites page, Spotlight slots increased to 6 (desktop; mobile still caps visible cards at 3), Featured/Latest "See more" no longer crops the second row mid-caption (dynamic row-height measurement instead of a flat guess), and the browser cache for the ~22MB snapshot moved from localStorage (silently failing past its quota) to IndexedDB
- Added related videos (broadened matching) on the video lightbox and public favorites-list sharing
- Fixed the mobile message board composer being hidden behind the bottom nav bar

## v5.2.0
- Message board gained admin moderation: Delete/Mute/Ban controls on every message (except your own). Banning also bulk-deletes that user's existing messages. Enforced both client-side (composer swapped for an explanation) and server-side (`firestore.rules` checks `mutedUsers`/`bannedUsers` before allowing a post)
- Sidebar icon polish: Podcast now uses a Spotify-like mark, Discord a distinct blob-with-eyes mark, Submit an upload icon; the message board tab restyled to an icon-only button on a white/black surface that follows the theme
- Added a top-of-page loading bar tracking real download progress for the initial ~22MB snapshot fetch, for visitors on slower connections
- Fixed desktop search getting stuck: closing the search overlay didn't reset the page state, and the browse tabs/filters/A-Z jump nav were permanently wedged between Latest Submissions and Featured on Home instead of only showing during search
- Redesigned the desktop top bar: search is now an ever-present, centered bar (YouTube/Spotify-style) instead of an icon-triggered overlay -- focusing it reveals tabs/filters/results immediately (no need to type first), and an explicit clear button/Escape fully resets to Home
- Swapped the top-right/bottom-left icon clusters: Instagram/Instagram (PH)/Facebook moved into the sidebar (also gaining mobile visibility they never had); Settings/Admin/Sign-in moved to the top bar exclusively on desktop (the sidebar keeps them for mobile's hamburger menu, which has no other path to Admin/Sign-in)
- Fixed a recurring `[hidden]`-attribute bug hit twice this round: a few components' own unconditional `display` rules were silently beating the browser's default `[hidden]{display:none}` (author styles always win that fight over user-agent styles, regardless of specificity or source order) -- affected the message board panel and the top-bar Admin/Sign-in icons

## v5.1.0
- Smarter search: diacritic/accent-insensitive matching with a bounded-Levenshtein fuzzy fallback (e.g. "ackerlund" now matches "Jonas Åkerlund"), and YouTube's own description/tags backfilled into the search index for entries with no curated description of our own
- Fixed sidebar Settings/Admin/Sign-in visibility on 1080p screens (the sticky header/sidebar height math was off by the top bar's own height once scrolled)
- Featured/Latest thumbnails are now true 16:9 (`aspect-ratio` instead of a fixed pixel height)
- Header and search bar are now sticky on desktop
- The Featured section now actually hides while an inline search query is active (the JS toggle existed already; the CSS rule to act on it didn't)
- TV Mode is now a lightbox (matching the main video lightbox's sizing) instead of a separate page/view, reusing the existing ad-mirroring and filter-relocation patterns
- Desktop search results render as a thumbnail grid grouped under each director/artist/song heading, matching Featured/Latest's card look
- Submit form is now a full page (no collapsed "more details"), with Country/Category/Email/Director/Year of release required, bulk-submission instructions at the top, and a Gen-AI disclaimer at the bottom
- Added a "News" section below Spotlight showing the latest 3 posts from the Squarespace blog (server-side fetch script + daily cron, since Squarespace's JSON feed has no CORS headers for client-side fetching) and a matching sidebar link
- Added a message board: a hidden-by-default popout tab on the right edge, Firestore-backed, open to read for everyone, sign-in required to post. Admins get Delete/Mute/Ban controls on every message (except their own) -- banning also bulk-deletes that user's existing messages. Enforced both client-side (composer swapped for an explanation) and server-side (`firestore.rules`)
- Sidebar icon polish: Podcast now uses a Spotify-like mark, Discord a distinct blob-with-eyes mark, Submit an upload icon; the message board tab is icon-only on a white/black surface that follows the theme. Desktop hamburger nudged to line up with the sidebar icon rail below it; mobile hamburger given a bigger tap target
- Added a top-of-page loading bar for the initial snapshot download (a single ~22MB JSON file) -- tracks real bytes-received against `Content-Length` where available, falling back to an indeterminate sweep otherwise
- Added an account-deletion page (`delete-account.html`) for the Google Play Store Data Safety requirement, ahead of the Android app's closed testing rollout

## v5.0.0
- **Architecture change: the catalog now lives in Firestore, not the Google Sheet.** All ~13,239 entries were migrated to a `videos/{rowNum}` Firestore collection (rowNum preserved as the doc ID, so existing favorites/recently-viewed/deep-links keep working). The public site no longer reads the CSV export -- `fetchData()` now fetches a static JSON snapshot (`SNAPSHOT_URL`) from Cloud Storage instead, keeping per-visitor cost at one cheap cacheable GET regardless of admin write volume. `scripts/generate-seo-pages.js` (the daily hub-page generator) was cut over the same way.
- Added an admin mode: signed-in users listed in a Firestore `admins/{uid}` collection get an "Admin" sidebar link opening a Manage Entries panel to add, edit, and delete catalog entries directly from the site, with Firestore security rules restricting `videos`/`admins` access to admins only.
- Added a header-row-driven Bulk Import tool in the admin panel: paste a block of spreadsheet rows (any column order, header row matched by name with common alternate spellings recognized) to create/update entries in bulk -- built specifically to remove the manual cut-and-paste column realignment previously needed between the Submissions sheet and the master sheet's differing column layouts.
- Ported the Feature/Spotlight cap-eviction logic (max 30 / max 3, oldest-by-checked-at evicted first) from the old Apps Script `onEdit` trigger into the admin panel, running on every single-entry edit and once per bulk import.
- Added a "Publish" step (manual button for single edits, automatic after bulk imports) that regenerates the public snapshot from Firestore -- admin changes go live once published, not immediately on save.
- Fixed a bug caught during this migration: the Apps Script Feature/Spotlight "checked at" timestamps had been silently lost for a long time due to a column collision (AA was double-booked as both the timestamp column and a VLOOKUP scratch column) -- Feature had drifted to 50 checked entries against a 30 cap. Reconciled back to 30 by evicting the oldest-by-checked-at (pre-dating the timestamp fix) entries.

## v4.19.0
- Spotlight is now always visible, independent of search/filter state (was previously hidden unless there were search results)
- Removed the vertical Spotlight ad (and its CSV/ad-slideshow plumbing) -- the horizontal ad banner below Spotlight was already covering that slot
- Logo and title in the top bar now link back to Home (desktop and mobile)
- Removed the inline Favorites strip from the main content flow (both platforms); added a "Favorites" link to the desktop sidebar so desktop keeps a way to reach it (mobile already has it via the bottom nav)
- Added the requested MVG art image to the Support page
- Reduced Featured/Latest Submissions to one fewer column on desktop by bumping the grid's minimum card width
- Removed the emoji prefixes from the Latest Submissions/Featured section titles
- Added a Sign In button to the top bar (upper right, left of search; hides once signed in) and three social icon links -- Instagram, Instagram (PH), Facebook -- to its left, desktop only (mirrors how the top-bar search icon is already desktop-only)
- Added a "Podcast" link to the left sidebar (below Discord, also in the mobile menu) that opens a modal with the show's Spotify embed, caption, and a "Listen on Spotify" link

## v4.18.1
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
