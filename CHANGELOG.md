# Changelog

Informal version history for MVG Library, reconstructed from git log. No strict semver enforcement — major bumps mark genuine breaking/architectural changes, minor bumps mark additive features.

## v6.34.5 — current
- Mobile TV Mode's country filter/Clear filters/Create Playlist row now fills the full width edge-to-edge instead of hugging the left, with more breathing room above it (separating it from the ON/OFF + Vote row) and less below (reading as a lead-in to Genre/Era/Custom/Channel). Also fixed Clear filters sitting visibly off-center from its row siblings -- an inherited `margin-top` meant for its normal stacked position wasn't reset in this new spot.

## v6.34.4 — current
- Swapped the order of mobile TV Mode's two rows below the playback controls: the on/off power switch + Vote row now comes first, with the country filter/Clear filters/Create Playlist row right below it.

## v6.34.3 — current
- The Favorite-through-Info row (whatever's left of the toggle row after Vote/4:3/CC move elsewhere on mobile) was reading as a small, right-justified cluster. It now spreads edge-to-edge across the full row with bigger buttons, matching the playback controls row above it.

## v6.34.2 — current
- Further mobile TV Mode cleanup: Favorite/Add to playlist/4:3/Fullscreen/CC/Copy link/Info now stay together on one line instead of wrapping into two. The Widen ("enlarge") button is hidden on mobile -- it only made sense next to the desktop-sized player. Vote moved up to sit beside the on/off power switch.

## v6.34.1 — current
- Decluttered TV Mode's mobile layout further: playback controls (prev/play/next/mute/volume) are now bigger and stretch the full row, with a small gap before the next row. Add to Playlist and Favorite now share their own row right after that. Create Playlist joined Clear filters next to the country filter. The power switch dropped to its own centered row below that. Report issue and the desktop side panel from the last two releases are unaffected.

## v6.34.0 — current
- Rearranged TV Mode's mobile layout so playback controls sit right after the timecode/progress bar, matching how it already read on desktop: Add to Playlist now joins the playback row right after the volume slider (putting it directly before Favorite too), Clear filters moved next to the country filter, and Report issue dropped to the very end, after the Genre/Era/Custom/Channel section. Desktop's own side-panel layout (shipped last version) is unaffected -- this is a separate, mobile-only rearrangement (`TV_RELOCATE` in app.js) that puts everything back exactly where it started the moment the window crosses back to desktop width or TV Mode closes.

## v6.33.1 — current
- Reworked the desktop TV Mode side panel's relocated controls into three rows instead of one long stack: country filter + Clear filters; 4:3 + CC grouped together, then Vote; power switch + Report issue. Also fixed the Vote button's text sitting off-center once it got bigger -- its inherited fixed height was too short for the new padding, pushing "Vote" up instead of centering it.

## v6.33.0 — current
- Fixed TV Mode's CC button showing the wrong state -- captions could be visibly playing while the button read "off," or vice versa. The enable path wasn't passing an explicit language to YouTube's captions API (an empty track selection doesn't reliably show anything), and the disable path relied on `unloadModule` alone, which doesn't reliably stop captions a fresh player started with on its own. Both paths now explicitly set/clear the caption track.
- Desktop-only TV Mode layout: the power switch (bigger), Clear filters, country filter, Report issue, Vote (bigger), 4:3 (bigger), and CC controls now live in the side panel itself, below the Genre/Era/Custom/Channel tabs -- real relocated space, not a duplicate. Genre and Custom now scroll internally (capped to a fixed height) instead of stretching the whole panel taller, so there's room for the new section without disturbing Era's own full-height dial. Mobile is untouched -- everything stays exactly where it's always been.

## v6.32.1 — current
- TV Mode now remembers once you've unmuted it. A genuinely fresh browser still has to start muted (the first play() call happens inside YouTube/Vimeo's async onReady, outside any user gesture, so browsers can silently block it unmuted) -- but after your first real click on Mute, every later TV Mode session on that browser starts unmuted automatically, instead of making you re-click Mute every single time.

## v6.32.0 — current
- My Queue is now its own homepage section, above Maui's Picks, hidden until you've actually added something to it.
- Added a quick "+" add-to-playlist button to every video thumbnail site-wide (media strips, Maui's Picks, Discover, Viewer's Choice, the main grid/search results) -- barely visible at rest, full opacity on hover/focus, opens the same add-to-playlist popover the lightbox's own + button does. Fixed a bug this surfaced in the popover's own "click outside to close" handler, which didn't recognize the new button as part of the popover and was closing it in the same click that opened it.

## v6.31.0 — current
- Added "My Queue" -- YouTube's Watch Later, copied: a special playlist that always exists, always sorts first in the add-to-playlist popover/Playlists page/TV Mode's Custom pane, and can't be renamed or deleted. Also added one-click per-video removal to the Playlists detail view (a small ✕ on each card) so clearing out My Queue -- or any playlist -- doesn't require reopening each video's own + menu to uncheck it.

## v6.30.0 — current
- Reordered the homepage: Viewer's Choice, Maui's Picks, Latest Submissions, News, Featured, Discover (Latest Submissions moved up from below Featured; News moved down from above Latest).
- Added site-wide admin switches (Admin panel landing screen) to hide/show the Viewer's Choice and Featured sections for every visitor, not just this device -- a new `siteConfig/homepage` Firestore doc (public read, admin write, same shape as `channel/{id}`), listened to live so a toggle takes effect on already-open tabs too.

## v6.29.0 — current
- Added optional genre preferences: a new onboarding step (right after Sign in/Continue as Guest) and a "Genres you like" row in Settings let you check off the genres you're into. Purely optional and editable anytime -- it only weights the homepage Discover section toward those genres (70% of picks lean preferred, still mixing in everything else, backfilled from the rest of the catalog if a narrow preference runs short), it never filters or drives search, browse, or TV Mode. No preference set means Discover behaves exactly as it always has.

## v6.28.2 — current
- Fixed: opening a video via a deep link (e.g. "Open in the MVG Library" from an SEO hub/video page) and then closing it with a backdrop click could leave the whole page permanently unscrollable. Root cause: `fetchData()` races a cached-snapshot render against the network fetch, and both paths call the same deep-link-opening code -- with a cache already warm (any return visit), it ran twice, calling the lightbox's scroll-lock twice for one close. `applyDeepLinkFromHash()` now skips re-opening a row that's already the open lightbox.
- Fixed: the admin Edit Entry form could open scrolled to the middle of the modal instead of the top -- it was resetting scrollTop on the form element itself, but the form doesn't scroll, its `.lightbox-panel` ancestor does (same pattern every other modal already uses correctly).
- Fixed: clicking "Search YouTube for this video" on Edit Entry could search for just "music video" instead of the actual title -- editing an entry opens an empty form first while the real data loads from Firestore, and clicking the button in that window read blank Artist/Song fields. The button is now disabled until the entry's data has actually loaded.

## v6.28.1 — current
- Reverted the v6.28.0 upper third entirely. Live testing found it didn't actually solve the problem it was built for -- YouTube's own title/channel overlay still peeked through at the start of playback (the upper third only ever showed on pause, not on load), and separately it was judged too visually intrusive on its own merits. Rather than iterate further, removed the whole feature (markup, JS staging/population logic, CSS) and let YouTube's native title overlay show unmodified, same as before any of this session's title-overlay work.

## v6.28.0 — current
- Replaced TV Mode's old lower third (song/artist/director card that briefly flashed at track start/end) with a new upper third that shows instead exactly while paused. Purpose: YouTube's own embed shows its title/channel overlay whenever paused -- `controls:0` suppresses the scrubber/buttons but not that, and there's no player param that does -- so rather than fight it, the new upper third is a solid purple-on-black bar that covers it, appearing at precisely the moment YouTube's own overlay would otherwise peek through underneath. Removed the old lower third entirely (its timers, end-of-track trigger, and CSS) rather than keeping both.

## v6.27.3 — current
- Fixed two real bugs behind "switching fullscreen/windowed feels unpredictable," both reproduced live (via the Claude in Chrome extension controlling a real browser, since this environment's own sandboxed browser can't enter real fullscreen at all):
  1. Closing TV Mode while genuinely fullscreen (Escape, the X button, anything) never actually called `document.exitFullscreen()` -- the browser stayed in real fullscreen with its target element hidden/torn out from under it, rendering a blank/static view, and reopening TV Mode afterward inherited that orphaned state instead of starting clean. `closeTVModal()` now exits fullscreen first when it's active.
  2. A single Escape press while fullscreen exited fullscreen AND closed the whole TV modal in the same keystroke (the global Escape handler didn't know the browser was already handling this keypress natively, so it independently ran `dismissTopModal()` too, navigating all the way back to the homepage). The handler now no-ops when `document.fullscreenElement` is set, leaving a normal second Escape press to close the modal, same as before this feature existed.
- Fixed: entering fullscreen while the separate windowed "Crop to 4:3" toggle was also on left its leftover `transform: translateX(-50%)` active (fullscreen's own CSS never reset it), shifting the video half its own width off-screen -- half video, half blank black. The windowed crop is now suspended for the duration of fullscreen and restored on exit.

## v6.27.2 — current
- Fixed: fullscreen 16:9 was showing a blank reserved sidebar strip instead of going truly full-width. Cause was a CSS specificity bug -- the rule reserving the 280px side-panel column used `:has(#tvSidePanelSlot:not(:empty))`, and an id selector inside `:has()` pulls in id-level specificity, which beat the plain-class `.tv-fs-root:fullscreen` override regardless of source order. Switched to the element's class instead and gave the "no panel in plain fullscreen" rule its own higher-specificity selector so it wins unconditionally.
- The side panel's content (dial/genre list/custom list/channel pane) is now vertically centered in its column instead of stuck at the top with dead space below -- most noticeable in fullscreen 4:3, where the column is much taller than the Era dial itself.

## v6.27.1 — current
- TV Mode's Eras dial: the Years/Eras/Decades lever moved from beside the ring to a horizontal bar below it, so the ring itself can use the dial's full column width instead of sharing it with a 54px-wide lever -- noticeably bigger, easier to read/tap.
- TV Mode's Genre tab is now a single column instead of two -- full genre names (e.g. "Electronic/Dance") no longer truncate to fit a cramped half-width tile.
- Toggling 4:3<->16:9 (windowed crop) or big<->small (widen/shrink) now scrolls TV Mode's panel back to the top -- previously, if you'd scrolled down (e.g. browsing a long Genre list in the side panel), the video could end up out of view after either toggle instead of front and center.

## v6.27.0 — current
- TV Mode's static/tuning flash (previously only shown on Channel Mode track changes) now flashes briefly on every track change -- Skip, Previous, first play, and era/genre/custom filter changes all funnel through the same `loadTVTrack()`, so one added call covers all of them.
- On desktop, Genre/Era/Custom/Channel now live in a panel on the right side of the player (like a CRT TV's channel-changer) instead of stacked below it -- applies to small mode, big mode, and the new fullscreen 4:3 mode. Fullscreen's default 16:9 mode stays minimal (no side panel), per explicit request. The modal itself widens to make room rather than shrinking the video to fit. Mobile is untouched -- the side panel is desktop-only (`min-width: 641px`), same footprint as before below that. Required moving what `requestFullscreen()` targets from just the video frame to a new wrapper (`#tvFsRoot`) that also contains the side panel slot, since a fullscreen element's siblings aren't rendered while it's active -- the panel has to actually be inside what goes fullscreen to show up there at all.

## v6.26.0 — current
- TV Mode gained three classic-TV-remote touches: a persistent red "MUTE" overlay while audio is muted, a green "VOLUME" bar overlay (with the current level) that flashes on every volume change and fades a beat later, and a real fullscreen mode. Fullscreen targets our own video frame (not the raw YouTube/Vimeo iframe, which is what double-clicking the player itself would trigger) so our own controls come along -- a minimal, YouTube-style auto-hiding control bar (play/pause, prev/next, mute, volume, exit) that shows on entry/mouse-move and fades after 3s of inactivity. Defaults to filling the screen edge-to-edge (16:9-ish); a "4:3" toggle in that bar instead shrinks the video to a real 4:3 box and fills the pillarbox bars on the sides with the same purple-on-black brand gradient land.html/the top bar already use, resetting back to 16:9 next time fullscreen opens. Deliberately a separate effect from the existing windowed "Crop to 4:3" button, which zooms in and clips edges rather than pillarboxing.

## v6.25.0 — current
- Admin can now reset votes site-wide, not just one video at a time. New "Reset ALL votes" button in the Vote Leaderboard admin view (`resetAllVotes` Cloud Function, admin-only) -- same operation as the existing per-video "Reset to 0", applied to every video: zeroes count/topVoter/latestVoter and clears every voterTallies record, leaves voteEvents (the audit trail) and retirement/Hall of Fame status untouched.
- Fixed: the homepage's Viewer's Choice section could stay visible showing 5 entries all reading "0 votes" after a reset, since the reset zeroes videoVotes docs rather than deleting them -- the section's hide check only ever looked at whether any docs existed, not whether any of them actually had votes. Now hides itself whenever every visible entry is at 0, same as if there were no docs at all.

## v6.24.1 — current
- Light theme's top bar was a flat pale lavender that read as washed-out. It's now a fixed dark purple gradient (with the same accent-purple glow dark theme's own bar already uses) regardless of the light/dark toggle, so it reads as a deliberate brand element instead of a theme-following one -- title/icons/search recolored to match. Dark theme's top bar is untouched.

## v6.24.0 — current
- Fixed: the admin panel modal had no click handler on its own close button or backdrop at all -- every other modal on the site wires that (see `els.settingsModal`'s identical listener), this one was just missing it, so only Escape ever closed it.
- Settings and Admin now work from every page that shares the lightweight `site-nav.js` header (news.html, support.html, the static `/blog/`, `/videos/`, `/artists/`, `/directors/` pages, ...), not just index.html. Settings deep-links to `index.html?settings=1`, which now opens the modal automatically on arrival; a new Admin menu item does the same via `index.html?admin=menu`, though it stays hidden by default since `site-nav.js` itself has no Firebase/auth of its own -- a host page that already does its own admin check (currently news.html) reveals it via a small exposed hook (`window.mvgSiteNav.showAdmin()`) once that check resolves true.
- Every static SEO page generated by `scripts/generate-seo-pages.js` (blog posts, and their director/artist/video siblings, since they share one template) now loads the real site header/sidebar/footer instead of just a bare "back to MVG Library" link -- consistent navigation everywhere, not just the interactive pages. Required making every internal link inside `site-nav.js` root-absolute (`/index.html` instead of `index.html`, etc.) -- it was written assuming it only ever loads from the site root, which silently 404'd on nested pages like `/blog/<slug>/` (two directories deep) until this fix.

## v6.23.2 — current
- The remaining two spots that still linked to `news.html?post=<slug>` (homepage's blog sidebar, and the single-post view's own "Previous Articles" sidebar) now point at the static `/blog/<slug>/` page too, matching the listing page fixed in v6.23.1 -- every on-site link to a post is unified on the one shareable, social-unfurling-friendly URL format now.

## v6.23.1 — current
- News.html's own listing page (both the big cards and the compact list below them) now links each post straight to its static `/blog/<slug>/` page instead of `news.html?post=<slug>` -- copy-pasting a link from the listing page (e.g. to share on Facebook/X) now gets a URL that actually unfurls with the real title/image, instead of the client-rendered shell that always showed blank. Homepage sidebar and the single-post view's "Previous Articles" sidebar are intentionally left on the old format for now (narrower ask). Trade-off: a post shared from the listing within the first few hours of publishing (before the next SEO build runs) will 404 until that build lands -- worth keeping in mind when publishing something you plan to share immediately, same as any other freshly-added catalog entry's hub page today.

## v6.23.0 — current
- Blog posts now get a real static, crawlable page at `/blog/<slug>/` (generated by scripts/generate-seo-pages.js, same daily/on-demand build that already makes the director/artist/video hub pages) -- proper title, meta description, canonical link, `og:image`/`article:*`/Twitter Card tags using the post's own cover image, and `BlogPosting` JSON-LD, plus the real post body baked in as plain HTML so it reads fine with JS off. Previously every post only ever existed at `news.html?post=<slug>`, which is 100% client-rendered from Firestore -- social unfurlers (Facebook, X, Discord, Slack) and non-JS crawlers only ever saw the generic "News — MVG Library" shell, never the actual title/image/excerpt. `news.html` now points its `<link rel="canonical">` at the matching static page when viewing a post, and sitemap.xml/blog-rss.xml link to the static URLs instead. On-site links (homepage sidebar, news.html's own listing) still go to `news.html?post=<slug>` unchanged, since that always works instantly -- the static page only exists after the next SEO build runs, same lag every other hub page already has. Also gave the shared `page()` helper baseline Twitter Card tags and an `og:site_name`, so the existing director/artist/video pages picked up better social packaging too, for free.
- The `build-seo-pages.yml` GitHub Action now commits the new `blog/` directory alongside `directors`/`artists`/`videos` (it was missing from the `git add` list, which would've silently dropped the generated blog pages from every automated run).

## v6.22.1 — current
- Fixed: the blog editor's new "Insert a video" picker (v6.22.0) opened but rendered invisibly behind the still-open blog editor page -- `.blog-editor-page` sits at z-index 1100, above the generic `.lightbox` class's 1000 the picker was using. Gave the picker its own z-index (1150) so it actually shows up on top.

## v6.22.0 — current
- Blog editor's "+ Video" button now searches the catalog instead of taking a raw YouTube/Vimeo URL -- picking a result inserts a cover-art card (thumbnail + play icon + caption) linking to that video's own lightbox, instead of embedding a bare iframe. Clicking the card on a published post opens the site's real lightbox on top of the post itself (via news.html's own lightweight lightbox) rather than navigating away, so readers stay on the blog entry; the card's href is still a real deep link (`/#song-slug-rowNum`) for anyone opening it in a new tab or with JS off. Provider/video ID/title/artist/director are baked into the card's own data attributes at insert time, since a live per-video lookup isn't an option for a signed-out reader (the `videos` collection is admin-read-only, and the alternative -- the public site's full catalog snapshot -- is a ~24MB JSON).

## v6.21.0 — current
- Added an admin-only "Download cover art" action to all three video-viewing surfaces (public lightbox, TV Mode, Manage Entries' row-preview modal) -- pulls the video's own YouTube thumbnail (tries maxresdefault down through sddefault/hqdefault, since not every video has the largest size) or its cached/oEmbed-resolved Vimeo thumbnail, and downloads it as a JPG. Same fetch-as-blob approach admin-intake.js and Manage Entries' Fill Missing Links preview already use, since a plain cross-origin `<a download>` doesn't actually force a save.

## v6.20.0 — current
- Renamed "Weekly Intake" to just "Intake" throughout (page title was already this; page heading and admin landing menu link now match).
- Intake's Review grid now pulls each video's real YouTube description into a Description field (same expand-on-click textarea as Description/Flavor Text on Manage Entries' Grid) -- previously blank, left for manual entry. Fetched via the same videos.list call already used for duration/Shorts detection (added `part=snippet`, no extra request). Multi-line descriptions are TSV-quoted when copied so they don't get misread as extra rows on the Bulk Import side.
- Intake's "Copy N rows" is now "Send N rows to Bulk Import" -- instead of copying to the clipboard and telling you to go paste it, it opens Admin → Bulk Import with the rows already pasted in and Previewed, ready to Commit. Still copies to clipboard too as a fallback.
- Fixed: clicking "Load 50 more" (or toggling Show already-added/Show Shorts) in Intake was silently unchecking every already-selected result, since selection only ever lived as checkbox .checked state in DOM that gets fully rebuilt on every re-render. Selection now lives in its own tracked set, so it survives any re-render.
- Latest Submissions gained a "Load 50 more" button next to "See all", styled as a neutral/gray secondary action -- pulls the next batch of most-recent eligible submissions into the strip/grid.
- Fixed a handful of remaining stale `mauimauricio83.github.io/MVG-Library` URLs in index.html/news.html (canonical link, og:url, JSON-LD, RSS feed links) missed by the manifest.json/SEO-generator fixes earlier -- same leftover-subpath issue, different files.

## v6.19.3 — current
- Weekly Intake's Review grid gained a "Search" button per row -- opens a Google search for Artist + Song Title + "country of origin" in a new tab, for a quick lookup while filling in the Country field before copying to Bulk Import.

## v6.19.2 — current
- Fixed video titles/channel names showing literal HTML entities (e.g. "Sonny Fodera &amp;amp; Becky Hill", "Ain&amp;#39;t It Fun") in Weekly Intake's search results and Manage Entries' Fill Missing Links auto-fill. The YouTube Data API returns `snippet.title`/`channelTitle` HTML-entity-encoded -- our own escaping (or in Fill Links' case, plain `.textContent`, which doesn't decode entities either) was then displaying that encoding literally instead of the real character. Decoded once at ingestion in both places now, so downstream escaping/display only ever runs on the real plain-text title.

## v6.19.1 — current
- Fixed the installed Android app (TWA) showing browser chrome (URL bar/share/overflow menu) instead of running full-screen. Root cause: `manifest.json`'s `start_url`/`id`/`scope`/icon paths all still pointed at `/MVG-Library/`, a stale path from before the site moved to its own domain -- the site actually serves from `/`, so every real page load was technically outside the manifest's declared scope, which is what makes Chrome fall back to showing browser UI instead of trusting the page as the installed app.

## v6.19.0 — current
- Data Health and Fill Missing Links moved out of the admin popup entirely and now live exclusively on Manage Entries -- "Data Health" is gone from the admin landing menu. Duplicate Videos / Missing Video Link / Broken Links are now clickable stat buttons: clicking one filters List/Grid down to just those rows (combined with the search box) instead of Data Health rendering its own separate read-only lists, so you get full sorting/inline-editing on the flagged entries themselves. Broken Links still requires an explicit "Scan for Broken Links" (stoppable, same throttled concurrent check as before); Duplicates/Missing Link are computed instantly the moment entries load.
- Fill Missing Links is now a modal on Manage Entries (its own "Fill Missing Links" button, shown whenever there are missing-link entries) -- same one-at-a-time queue, Skip/Save & Next/Delete/Search/Auto-Fill behavior as before, with a lighter plain-iframe preview instead of the full player used elsewhere on the site.

## v6.18.1 — current
- Manage Entries' Grid view: YouTube Link moved to the second column (right after Row). Description and Flavor Text are now expandable textareas -- collapsed to a truncated single line by default, expand into a proper multi-line box on click/focus so long text is actually readable and editable, then collapse back on blur. Added a horizontal scrollbar fixed to the bottom of the viewport, scroll-synced with the table -- with 24 columns the native scrollbar sat at the table's own bottom edge, often well below the fold.

## v6.18.0 — current
- Manage Entries' Grid view: click any column header to sort by it (click again to reverse) -- applies to List view's ordering too, they share one sort. Pager gained page-number buttons (windowed around the current page, since the full catalog is ~180 pages) plus First/Last, not just Prev/Next. Grid now shows every field, not just the dozen that fit before -- Studio, Producer, DP, Choreographer, Release Date, Submitter Email, Description, Flavor Text, Vimeo, and MVG links joined Artist/Song/Director/Category/Year/Feature/Spotlight/Sponsored/Backdoor/Editor/Country/Genres/YouTube. The YouTube column's link now opens in a new tab instead of being plain text inside the edit box. Clicking a row number (List or Grid) opens a lightweight in-page video preview -- embed, title, credits, description -- without leaving Manage Entries.

## v6.17.0 — current
- Manage Entries moved out of the admin popup into its own standalone page (`manage-entries.html`), same treatment Weekly Intake got -- full List/Grid browsing, search, and inline Grid editing, reached via a plain link from the admin landing menu instead of loading inside `#adminModal`. The Add/Edit form and Bulk Import stayed in the popup (they're shared with the public lightbox's admin Edit button and TV Mode, not exclusive to Manage Entries) -- the new page's Edit/Add/Bulk Import actions jump back into index.html via `?admin=edit&row=<n>` / `?admin=add` / `?admin=bulk` instead of duplicating that form's country/genre widgets, Vimeo thumbnail resolution, and row-reservation logic a second time.
- Added a "Weekly Intake" link to the admin landing menu -- it existed as a page but had no way to reach it from inside the site.
- Removed the now-dead in-modal List/Grid code this left behind (`showAdminList`, `renderAdminEntries`, the Grid view block, `.admin-panel.is-grid-full`) -- kept everything Data Health and the Add/Edit form still share (`adminRowHtml`, the delegated edit/delete handler, etc.).

## v6.16.0 — current
- Weekly Intake gained a review step: clicking "Review N selected" now opens an editable grid (same .admin-grid pattern as Manage Entries' Grid view) with Artist, Song Title, Director, Category, Year, Country, and YouTube Link per selected candidate, plus a Remove button per row -- fix the title auto-split or fill in missing details before copying, instead of only catching mistakes after pasting into Bulk Import.
- Fixed a pre-existing bug in `.admin-fill-links-card[hidden]` (shared by this and the existing Fill Missing Links admin tool) -- the class's own `display: flex` was silently overriding the browser's `[hidden] { display: none }` default, so toggling `.hidden = true` on either card did nothing.

## v6.15.3 — current
- Weekly Intake: search now sorts by relevance instead of upload date. "Music video" is generic enough that new matching uploads (a lot of them noise) land every few minutes, so a strict date sort buried real candidates from a few days back under the last several hours -- confirmed this against a real report of videos showing up on youtube.com's own search but not here. Relevance still respects the days-back window as a hard cutoff, it just ranks within it instead of by recency, matching how youtube.com's own search behaves by default. This can't fully close the gap though -- the public API's ranking is a cruder text/tag index than the signals (personalization, channel authority, etc.) the actual youtube.com search box uses, so some videos it surfaces still won't show up here.

## v6.15.2 — current
- Weekly Intake: the status line now says exactly how many results were fetched vs. shown vs. hidden (already-in-catalog / Shorts) -- "50 found, only 10 shown" wasn't a bug, it was heavy default filtering with no explanation. Added a "Load 50 more" button (paginates via the API's nextPageToken) for when the visible pile is thin, since a generic term like "music video" is dominated by Shorts/dupes and order=date + a 50-per-page cap means widening the day range alone often doesn't surface more. Also added a "Cover art" button per result that downloads the video's hi-res (maxresdefault, falling back to lower sizes when unavailable) thumbnail.

## v6.15.1 — current
- Weekly Intake: Shorts (under 90s) are now hidden by default, same as already-catalogued videos, behind a "Show Shorts" toggle -- they were showing up badged but still cluttering the list. Each result's thumbnail and title now link straight to the video on YouTube (opens in a new tab) so you can actually watch it before deciding, without that click also toggling its selection checkbox.

## v6.15.0 — current
- Added `admin-intake.html`, a standalone admin-only page for weekly video intake: searches YouTube for recent "music video" uploads (default last 7 days, adjustable 1-30), cross-checks results against the catalog to gray out anything already added, flags likely Shorts by duration, and lets you copy selected picks as a ready-to-paste Bulk Import block (Artist/Song split off the title, YouTube link, Category, Year). Reuses the existing YouTube Data API key and the existing Bulk Import pipeline as-is -- this only speeds up finding and triaging candidates, not the judgment call of what's worth covering.

## v6.14.2 — current
- Fixed the trading card's blank-box MVG watermark rendering as a square -- it now gets the same circular clip as the small logo badge in the footer.

## v6.14.1 — current
- Trading card facts box no longer shows country as a lone text line -- it's redundant with the flag badge already shown in the "Directed by" bar. An entry with a country but no description, flavor text override, or other credits now falls through to the blank-box state (faint desaturated MVG watermark) instead of a sparse single line.

## v6.14.0 — current
- Manage Entries search broadened way beyond artist/song/director -- now also matches row number, category, editor, country (both the raw stored value like "SE" and its resolved full name like "Sweden", so either one finds the entry), genres, studio, producer, DP, choreographer, YouTube/Vimeo/MVG links, description, and flavor text override. Applies to both List and Grid view since they share the same filter.

## v6.13.2 — current
- Fixed 6 country values across 6 entries that weren't resolving to a name/flag anywhere (lightbox credits, trading cards, the country filter): added Hong Kong (HK), Faroe Islands (FO), Martinique (MQ), and British Virgin Islands (VG) to the code→name table, and aliased the literal typo "United Ki" to "United Kingdom" (one entry, #13426, has that exact truncated value stored). Verified against the full live catalog: 11,475 of 11,476 country values now resolve; the one holdout ("XE", entry #8228) isn't a real country code and needs a manual fix in Grid View since it's not clear what it was meant to be. The two-letter-code convention itself (US, GB, PH, etc. -- the vast majority of entries) was already working correctly.

## v6.13.1 — current
- Trading card blurred panel background brightened across the board -- standard cards from `brightness(55%) saturate(35%)` to `brightness(70%) saturate(45%)`, OPM cards from `brightness(40%)` to `brightness(60%)` (still fully desaturated). It was reading consistently too dark, muddy on some thumbnails.

## v6.13.0 — current
- OPM trading card polish round two: the border's white triangle is now steeper (apex at 42% down instead of 16%), reading much closer to the real flag's proportions; and after a couple of rounds trying to keep the blurred cover art faintly visible behind the facts box (translucent scrim, then a brighter re-rendered "window" under a light wash), both read as murky/dirty rather than clean -- settled back on a plain solid white box with black text, which is what actually reads well against the rest of the card.

## v6.12.2 — current
- Reverted v6.12.1's flat-white OPM panel background -- OPM cards get the same blurred/darkened/tinted cover-art panel every other card gets (washed blue instead of the usual hashed genre color, tying into OPM's own red/blue/white border), not a plain white fill. The yellow title/director bars and white facts box stay as designed.

## v6.12.1 — current
- OPM cards' panel background is now flat white instead of the usual blurred/tinted cover art -- left as blurred art it was showing a blue-tinted photo through the gaps around the flag theme's yellow bars and white box, undercutting the clean look. The bottom meta text (category/year) also switched to dark, since it sits directly on that now-white background.

## v6.12.0 — current
- Added "OPM" as a selectable genre (submission form, admin form's quick-fill dropdown). Trading cards tagged with it get their own Philippine-flag-inspired theme instead of the usual hashed genre color: red left / blue right / white triangle up top on the outer border, solid yellow title and "Directed by" bars, and a white facts/description box with black text -- the one place cards use dark text on a light fill instead of the usual light-on-dark.

## v6.11.0 — current
- Trading card country flag switched from a Unicode flag emoji to an actual flag image (via flagcdn, cached per country code) -- Windows' default emoji font doesn't include flags at all, so the emoji version was rendering as plain two-letter text ("PH") for the large majority of visitors instead of a flag.
- Grid view (Admin → Manage Entries) gained three more editable columns -- Country, Genres, and YouTube Link -- reachable via the horizontal scroll added a few versions back, which had nothing to actually scroll to until now.

## v6.10.2 — current
- Trading cards now show the entry's country as a flag emoji, middle-right in the "Directed by" bar (built from the two-letter ISO code via the existing country name/code data, no image asset needed). Canvas rendering of flag emoji is font-dependent and can fall back to plain letters on systems without full color-emoji support -- unaffected on a normal Windows/Mac browser.

## v6.10.1 — current
- Rebuilt the lightbox mini player (PIP, shipped in v6.10.0) around a different architecture after confirming a hard constraint: reparenting a cross-origin YouTube/Vimeo iframe to a new DOM parent reloads it (verified directly against the YouTube IFrame API -- currentTime resets to 0 even with the exact same iframe node and an unchanged src), so the original "move the frame into a floating host on backdrop click" approach was always going to restart playback despite testing clean beforehand. The video frame is now a single permanent document.body-level element, created once per video and never reparented -- while docked it's synced via JS to an inert placeholder's on-screen position instead, so it looks embedded without ever being a real descendant of anything that could hide/rebuild/move it. This also fixes the mini player rendering at the wrong (viewport-derived) height, caused by an unrelated CSS class name collision with the profile lightbox's differently-designed video frame.
- Added a mute/unmute button to the mini player -- YouTube's own volume control is a hover-flyout that's unusable once the mouse isn't over the speaker icon anymore, which is most of the time at mini-player size.
- Opening a different video (clicking another thumbnail) now always stops a video that's floating as a mini player instead of leaving two playing at once -- immediately if autoplay is on (the new one is about to start right away), or once the new video actually starts playing if autoplay is off (so the old one doesn't go silent while the new lightbox just sits there unplayed).

## v6.10.0 — current
- Video lightbox now has a YouTube-style mini player (PIP), two ways in: scrolling the video out of view within the lightbox (inevitable on long descriptions/comments) pins it to the bottom-right corner while the rest of the lightbox stays open, un-pinning automatically on scrolling back up; clicking the backdrop (a common misclick) now softens into the same floating mini player instead of stopping playback outright -- the lightbox itself closes back to normal browsing, but the video keeps playing on top of the page with its own explicit close (X), and clicking the mini player reopens the full lightbox. The deliberate close (X) button on the lightbox itself is unchanged -- still a real, full close.
- Trading card flavor text now honors manual line and paragraph breaks, but only when it's coming from Flavor Text Override -- regular Description still flows as continuous prose regardless of any stray Enter in it.

## v6.9.3 — current
- Renamed the "Flavor Text Override (FTO)" option in Suggest an edit's field dropdown to "Card Text Override" -- clearer for visitors who don't know the FTO shorthand. The underlying field name (flavorTextOverride) and every other label for it are unchanged.

## v6.9.2 — current
- Fixed "Suggest an edit" doing nothing on click: the Report an issue popover menu is appended to `document.body` (so it can float above the lightbox), not inside the lightbox itself, so the lightbox's own delegated click listener never saw clicks on it -- only a separate document-level listener did, and that one only closed the menu. Moved the actual "open the Suggest an edit modal" handling into that document-level listener, where the click can actually be seen. Also added Flavor Text Override (FTO) to the list of fields Suggest an edit can propose changes to.

## v6.9.1 — current
- Added a "Flavor Text Override" (FTO) field, empty by default -- when filled, it replaces Description as the trading card's flavor text, everywhere else on the site still shows the real Description untouched. Visible in the public submission form, the admin single-entry form, and the admin Bulk Import (matches an "FTO" column header, among a few other spellings).

## v6.9.0 — current
- Trading card panel background is now the video's own cover art -- cropped to fill, blurred, darkened, desaturated, and washed with the genre color -- instead of a flat cream fill. The title bar, type-line bar, and description/facts box are now a mostly see-through dark scrim (20% opaque) over that background instead of solid panels, and all card text switched from dark-on-cream to light-on-dark to match.

## v6.8.3 — current
- Trading cards are now 1080x1350 (4:5) instead of 750x1050 (5:7, the original MTG card proportions) -- 5:7 falls outside Instagram's allowed portrait range, so a downloaded card would get auto-cropped when posted to a feed. Every hand-tuned pixel size in the card layout (borders, bar heights, padding, font sizes, the logo badge) scales proportionally with the new width, so the design itself is unchanged, just wider.

## v6.8.2 — current
- Fixed Grid view sometimes rendering underneath/alongside the regular Manage Entries list instead of replacing it. Root cause: `.admin-entries-list`'s own `display: flex` and the browser's built-in `[hidden] { display: none }` rule have equal CSS specificity, so as the later-loaded rule in the stylesheet, `display: flex` was winning the tie -- meaning `adminEntriesList.hidden = true` was silently doing nothing, and the ~13k-row list kept rendering (very slow) with Grid view drawn wherever it landed relative to it. Added the standard `[hidden]` override this codebase already uses elsewhere for the same reason.

## v6.8.1 — current
- Grid view column tightening: text/select cells now size to a fixed comfortable width instead of stretching evenly to fill the panel, which was leaving a lot of empty space in narrow columns like Category and Year. The table itself no longer forces its width to match the panel, so once there are more columns than fit, the grid now scrolls horizontally instead of squeezing every column down to fit -- also added an Editor column past the checkboxes as the first thing reachable by that scroll.

## v6.8.0 — current
- Video lightbox cleanup: removed the Mirror and Interlace admin debug toggles and the 4:3 crop button (the video-detail lightbox only -- TV Mode and the profile lightbox keep their own separate crop features, untouched); merged the separate "Report an issue" link and "Suggest an edit" button into one "Report an issue" button that opens a small popover with both choices; reordered the remaining lightbox buttons to Edit/Delete (admin only), Add to playlist, Vote, Favorite, Share, Widen, Report an issue.
- Grid view (Admin → Manage Entries) is now paginated (75 rows per page, with Prev/Next) instead of rendering all ~13k filtered rows as live inputs at once -- this is what was making it slow to open and laggy to click into a field. The grid also now expands to a near-full-viewport takeover while active instead of being squeezed into the regular 560px-wide admin modal, so far more columns are visible at once (previously only Row through Year fit).

## v6.7.1 — current
- `app.js`, `styles.css`, `hub.css`, and `site-nav.js` are now loaded with a `?v=` cache-busting query param on every page that references them -- without it, a push could go live server-side while browsers (and GitHub Pages' own CDN) kept serving an already-cached copy of the old file, so a just-shipped change (like v6.7.0's Grid view) wouldn't actually show up for a visitor, including a signed-in admin testing right after the push. The query param now gets bumped alongside every version bump going forward (see CLAUDE.md).

## v6.7.0 — current
- Added a Grid view to Admin → Manage Entries: a spreadsheet-style table (Artist/Song/Director/Category/Year, plus checkboxes for Feature/Spotlight/Sponsored/Backdoor) for skimming and editing many entries in one view instead of opening the full form per row. Text fields save on leaving the cell, checkboxes save immediately -- one small Firestore write per actual edit, same cost as editing a single entry today. Deliberately does NOT auto-publish per edit the way the single-entry form does, since publishSnapshot() re-reads the entire ~13k-doc collection every time it runs -- doing that after every keystroke across a bulk editing session would multiply an already-not-cheap operation by however many cells get touched. Publish stays a manual, one-time step at the end of a grid-editing session.

## v6.6.0 — current
- Viewer's Choice now hides on every view Featured/Discover already hid on (Connect/Profiles, Favorites, Playlists, the Search view) -- it's a separate top-level section, not nested inside the sidebar those two live in, so it had been missed from all of those view-switch CSS rules and stuck around a full screen tall wherever it wasn't wanted.
- Renamed `blog.html` to `news.html` (nav link, internal links, sitemap/RSS entries) to match the "Blog" nav item's earlier rename to "News" -- the page itself said News everywhere already, just not its URL.

## v6.5.1 — current
- Fixed a stuck-hash bug: refreshing the page while a lightbox was open, then opening a second lightbox/profile/TV without closing the first one first, then closing that second one would land back on the FIRST lightbox's stale hash instead of a clean browsing state -- and since hashchange fires on the way back, it would silently reopen that first lightbox too. Root cause: pushModalHistory() anchors the "closed" state to whatever entry was current when a modal first opened, and a cold page load already sitting on a deep-link hash bakes that hash into that entry permanently. Now strips the hash from that anchor entry before pushing, so every modal always closes back down to a clean URL regardless of how the page was loaded.

## v6.5.0 — current
- Hovering "Download trading card" now shows the actual rendered card in a small floating preview instead of downloading blind. Reuses the exact same renderTradingCard() the real download uses (guaranteed pixel-for-pixel match) and caches the result per video, so re-hovering the same entry -- or hovering right before clicking -- is instant instead of re-running the thumbnail/logo image loads every time.

## v6.4.4 — current
- "Download trading card" moved from an icon button in the lightbox's action row to a plain, smaller-than-body-text hyperlink right below the description, instead of sitting alongside Favorite/Share/Vote/etc.

## v6.4.3 — current
- Fixed trading cards showing a blank/gray art box for videos without a real high-res thumbnail: requesting YouTube's maxresdefault thumbnail for a video that doesn't have one doesn't 404, it silently returns a tiny 120x90 gray placeholder with a 200 OK, which loaded "successfully" and skipped the intended hqdefault fallback entirely. Now checks the loaded image's actual width and falls through to hqdefault when it's just that placeholder.

## v6.4.2 — current
- Viewer's Choice (a full screen tall on its own) now hides while actively searching, same as Featured/Discover already did -- previously it sat above the search results, pushing them a full page down.

## v6.4.1 — current
- Replaced the trading card frame texture attempt (fractal marble, added in v6.4.0) with a simple top-to-bottom gradient on the outer border instead -- the marble texture wasn't reading as intended at normal card size. The border now uses its own genre color, darkening slightly toward the bottom.

## v6.4.0 — current
- Replaced the trading card frame elements' flat per-pixel noise with an actual fractal marble texture -- several octaves of smoothly-interpolated value noise (fBm) fed through a sine wave for the classic swirled marble/wood-grain look, rendered once at card scale and reused as one continuous "slab" behind the title bar, type-line bar, and tag pills rather than a small repeating tile (no visible seams), at a much stronger blend strength than the old noise had.

## v6.3.1 — current
- Genre pill(s) in the trading card's flavor box now stay pinned to the top-left instead of floating as part of the vertically-centered content block -- only the description/facts below them (which vary a lot in length, unlike the pill row) center within whatever space is left underneath.

## v6.3.0 — current
- Trading card polish round two: removed the outer border's bevel stroke (it didn't need one); added a subtle grain/noise texture to the title bar, type-line bar, and genre pills (not the outer border or the flavor/fact box, which stay flat for legibility); reverted the flavor box's content from center-aligned back to left-aligned, while keeping it vertically centered as a block so a near-empty box (most videos have no description) doesn't read as pinned to the top; and bumped the description/fact text size up a notch as a further hedge against empty-looking cards.

## v6.2.0 — current
- Trading card refinements after the first pass, since most videos have no description: the flavor-text box now falls back to whatever credits are actually available (country, studio, producer, DP, editor, choreographer) when there's no description, and falls back further to a big faint centered MVG watermark (MTG-basic-land style) when there's truly nothing to show. All of a box's content -- tags, description, or facts -- is now centered as a single block instead of pinned top-left, which read badly once boxes were this often near-empty. The art crop moved from 4:3 (which both lost part of the frame and upscaled a smaller crop of it) to the thumbnail's native 16:9, and card generation now tries YouTube's maxresdefault thumbnail before falling back to hqdefault, instead of always requesting the small mqdefault size built for tiny in-list thumbnails elsewhere on the site. Every element (bars, boxes, pills, the outer border, the logo) now has a thin beveled stroke in a darker shade of its own color.

## v6.1.0 — current
- Added downloadable trading cards, one per music video: a "Download card" button in the lightbox renders an MTG/Top-Trumps-style card client-side (title, artist, thumbnail as the art, director as the type line, genre tags and description as flavor text, category/year and an MVG watermark in the corners) and saves it as a PNG. Purely detail-based, no invented stats or pretend game mechanics. Border color comes from a deterministic hash of the video's genre(s) into a fixed palette (so it never needs a hand-maintained genre->color table, and stays consistent for the same genre across every card) -- two genres split the border diagonally, MTG-multicolor-style. Reuses the Social Graphics section's existing canvas helpers (cross-origin thumbnail loading, cover-fit cropping, the MVG logo watermark) instead of duplicating them. Director names entered surname-first ("Fagin, Josh") display in natural reading order on the card, and a too-long description truncates at the last complete sentence that fits rather than cutting off mid-sentence.

## v6.0.0 — current
- Major version bump marking the site's move off Squarespace: themusicvideoguy.com now serves this app directly (see the CNAME addition) instead of iframing it inside a Squarespace wrapper page. Everything since -- the YouTube autoplay/hover fixes only possible once the iframe's native controls weren't needed as a fallback, the News section pointing at real content instead of a frozen Squarespace scrape, real shareable links for videos/profiles/TV Mode, and the broken Squarespace-page nav links removed -- was cleanup and follow-through from that one architectural change.

## v5.69.0 — current
- Extended shareable links beyond the video lightbox: profile lightboxes get `#profile-<slug>-<uid>` (members-only, same as browsing the directory itself), TV Mode gets `#tv`, and Channel Mode -- the one TV state that's actually the same experience for everyone who opens it -- gets `#tv-channel`. All three get the same "Copy link" button (native share sheet on mobile, clipboard elsewhere) the video lightbox already had, now generalized into one shared button/handler instead of one-off copies.
- Removed the sidebar's "The Music Video Guy" link -- it pointed at `themusicvideoguy.com/mvg`, a Squarespace page slug that no longer exists now that this domain serves this site directly.
- Found and fixed the same stale "News" link (and "Blog" label) inside `site-nav.js` -- the shared header/sidebar injected into every page outside the main app (support.html, blog.html, privacy.html), which hadn't gotten the fix already applied to index.html's own copy of that markup.

## v5.68.0 — current
- Video lightbox links now read as the song title (e.g. `#spirit-jumper-13435` instead of `#row-13435`), reusing the blog editor's existing slugify(). The slug is purely cosmetic -- only the trailing number is ever actually looked up -- so every already-shared or indexed `#row-<n>` link (including the ~13k SEO hub pages) keeps working unchanged, and a stale slug in an old copied link still resolves correctly even after a song's title is edited.

## v5.67.0 — current
- The lightbox's Copy link button now uses the phone's native share sheet (navigator.share -- Messages, WhatsApp, etc.) wherever it's available, which today is effectively mobile only, falling back to the existing clipboard-copy behavior everywhere else (including if the share sheet itself fails for a reason other than the user just cancelling it).

## v5.66.0 — current
- Video lightboxes now get real shareable links: opening one updates the address bar to `#row-<id>` (the deep-link format an existing but one-way `#row-` reader already supported, originally built for the SEO hub pages), so the URL can just be copied straight out of the address bar and reopens the right video on a fresh load. Added an explicit "Copy link" button next to Favorite for the same thing in one click, with a clipboard-API-unavailable fallback.

## v5.65.0 — current
- The homepage's News sidebar was still showing stale articles pulled from the old Squarespace feed (`themusicvideoguy.com/news?format=json-pretty`, fetched hourly by a GitHub Action into `blog-latest.json`) -- that endpoint stopped being Squarespace's the moment DNS moved to point the domain at this site, so the feed was frozen on whatever it last fetched successfully. It now reads live from the same self-hosted `blogPosts` Firestore collection blog.html already serves, and links navigate to it in place instead of opening a new tab. Retired the now-dead fetch script, its hourly workflow, and the stale JSON file it wrote.

## v5.64.0 — current
- First post-migration cleanup now that themusicvideoguy.com serves this site directly (see the CNAME addition) instead of through a Squarespace iframe wrapper: the header nav's separate external "News" link (which pointed at the old Squarespace-hosted news page) is gone, and the in-app "Blog" link -- already a self-hosted replacement for that same Squarespace news feed -- has been renamed to "News" and moved into that nav slot, page title included. Also dropped the `window.top.location` iframe-breakout workaround in wallet checkout (plain `location.href` now that there's never a frame to break out of) and updated a couple of comments that referenced iframe-embedding reasoning no longer accurate to how the site is served.

## v5.63.0 — current
- Fixed TV Mode playback silently failing to start: the first `playVideo()`/`play()` call always happens inside YouTube/Vimeo's own async `onReady`, not inside the click that armed TV Mode, so it never carries a user-gesture flag and browsers block unmuted autoplay without one. Previously this was masked by clicking YouTube's own native play icon (a real in-frame gesture) as a fallback -- once that iframe became unclickable (`pointer-events: none`, see v5.62.0), there was no fallback left and playback just silently never started. TV Mode now starts muted by default so that first play call is always within policy; the Mute button un-mutes with a real click same as before.
- Tuned lower-third timing: it now waits 5 seconds after a track starts before fading in (so it doesn't compete with the viewer's first glance at the video), and the end-of-track showing now triggers earlier so it's fully faded out again before the last 5 seconds of the track, instead of running right up to the cut.
- Added a "View as normal visitor" toggle in Settings (admins only) that hides admin-only buttons and controls -- edit/delete, mirror/interlace, comment and message-board moderation, the Admin panel entry point -- on the current device, so an admin can see the site the way a regular visitor does without actually losing admin rights.

## v5.62.0 — current
- Fixed YouTube's hover title/channel overlay still appearing in TV Mode despite `controls: false` -- YouTube's forced that overlay on hover/pause regardless of any playerVars since deprecating showinfo/modestbranding, so the fix is `pointer-events: none` on the TV Mode iframe specifically (scoped to `#tvModal`, the video-detail lightbox keeps native clickable controls): with nothing to hover, YouTube's own JS never has a reason to show it. Custom controls already replace everything a viewer needs to interact with, so this costs nothing.
- Added a Previous button (mirrors the existing Next), a custom seek bar with a time readout right below the player (both hidden in Channel Mode, same reasoning as Next -- would desync a shared viewer), and a CC captions toggle alongside Crop/Widen. Fixed a real latent bug surfaced while building this: `createVideoPlayer()`'s YouTube branch fired `opts.onReady()` synchronously right after `new YT.Player(...)` returned instead of from YouTube's own `onReady` event, so the player wasn't actually API-ready yet -- harmless until code started calling player methods from inside that callback (`applyTVPlaybackState()`), which surfaced it as `player.unMute is not a function`.
- Added an MTV-style lower third (artist / "song" / director, bold white text with a drop shadow, no background box) shown for a few seconds at the start of a track and again in its last few seconds, plus a small persistent MVG logo watermark in the upper right -- both inset within title-safe margins rather than flush to the edge, sized/positioned as siblings of the video iframe so 4:3 crop mode's frame-only scaling can't affect them.

## v5.61.0 — current
- TV Mode's YouTube/Vimeo embeds no longer show their own native control chrome at all (`controls: false` in every `createVideoPlayer()` call in `loadTVTrack()`/`loadChannelTrackAt()`, not just when cropped) -- in keeping with the "curated channel, not on-demand seeking" feel. Replaced with custom controls: Play/Pause and a proper "Next" icon (a filled triangle+bar, not the old "Skip ▶" text) sit together in standard media-player order, plus a Mute toggle and volume slider alongside the other TV Mode controls. No seek bar, by design. Volume/mute choices carry over across track changes (including Skip and Channel Mode's own auto-advance) instead of resetting each time. Icons are either plain-text glyphs already precedented on the site (▶) or plain filled/outline SVG shapes built for this -- deliberately not Unicode media-control glyphs (⏸/⏭/🔊), which render as full-color emoji on enough platforms to violate the no-emoji rule.

## v5.60.3 — current
- Fix: TV Mode's widen button did nothing -- `#tvModal .lightbox-panel` (an ID selector, `max-width: 780px`) always outranked the plain `.lightbox-panel.size-large` class selector (`max-width: 1080px`) on specificity alone, regardless of which class was actually toggled. Added a `#tvModal .lightbox-panel.size-large` override so the widen toggle wins back the specificity fight. Confirmed the panel now actually resizes (780px ↔ 1080px) when the button is clicked.

## v5.60.2 — current
- Rebuilt TV Mode's "channel ready" static/noise effect from scratch -- it used to be one fixed SVG feTurbulence noise tile sliding around via a CSS transform animation, which read as "a single texture shaking" rather than real static once you looked for more than a second (and was too dim/low-contrast besides). Now a small `<canvas>` redrawn with genuinely random black/white pixels ~15 times a second (`startStaticNoise()`/`renderStaticNoiseFrame()` in app.js), scaled up with `image-rendering: pixelated` for authentic chunky analog grain. Same canvas-based renderer now backs both the armed "tap to play" screen and Channel Mode's brief tuning flash between tracks. Verified the noise loop stops cleanly (no leaked interval) whenever the static screen is torn down, re-armed, or replaced by the real player.

## v5.60.1 — current
- Housekeeping pass (code audit + doc review, no user-visible behavior change): fixed a stale `firestore.rules` comment still naming the removed `stripeWebhook` (now `lemonSqueezyWebhook`); deleted a dead unused function (`resolveDurationForRow`, superseded by `resolveDurationForRef`); removed two unreachable CSS rules (`.result-card-more-note`, `.submit-form-status.is-success` -- nothing ever applied either class); factored the 7-line TV-control-visibility block duplicated identically across `tuneChannelMode()`/`playArmedTV()`/`startTVMode()` into a shared `showTVControls()`. Also refreshed `README.md` (was still describing the pre-Firestore CSV/localStorage architecture -- now matches `CLAUDE.md`'s accurate data-model writeup), added a "Voting system (current state)" section to `CLAUDE.md` summarizing this session's additions (wallet, TV changes, default playlists, dormant vote retirement) so a future session doesn't have to re-derive it from git log, and fixed a stale Mirror/Interlace mention in `docs/live-stream-plan.md`.

## v5.60.0 — current
- Built (but dormant) a TRL-style vote retirement / Hall of Fame system -- see VOTE_RETIREMENT_PLAN.md (local-only) for the full design and activation checklist. `checkVoteRetirements` (admin-only, manually triggered -- deliberately not on a schedule yet) increments `daysInTop` for whatever's currently in the top 5, and permanently retires (freezes + snapshots into `voteHallOfFame`) anything that's spent 14 cumulative days there, same idea as TRL's own day-count retirement rule. `unretireVideo` is the admin correction tool. Nothing on the live site reads/filters on the new fields yet, so this genuinely changes nothing a visitor sees until the activation steps in the plan doc happen. Admin's Vote Rounds view gained a "Retirement / Hall of Fame" section (labeled Dormant) with a manual "Run retirement check now" button and an Un-retire action per entry.

## v5.59.0 — current
- Admin's Vote Rounds view gained a "Reset to 0" button per video, with a confirm() warning before it fires. New `resetVideoVotes` Cloud Function (admin-gated) zeroes `videoVotes/{rowNum}`'s count/topVoter/latestVoter AND deletes every recorded `voterTallies` doc for that video -- not just the visible count, so a future vote's topVoter comparison starts clean instead of comparing against a stale pre-reset tally. Doesn't touch `voteEvents` history (stays as an audit trail, just never replayed). Needs `firebase deploy --only functions` before it works live.

## v5.58.0 — current
- Viewer's Choice cards: removed the "(count)" next to the top voter's name, and moved that line up onto the same line as the vote count -- count on the left, "Top voter: NAME" right-justified. The Vote modal's own Top Videos leaderboard (which still shows both Top voter and Latest vote, with counts) is untouched -- separate rendering path, scoped CSS so the shared `.viewers-choice-voter` class's spacing there wasn't affected.

## v5.57.1 — current
- Fix: the Username field in Settings clipped its Save button off the right edge of the screen on mobile, since the input+button group stayed on the same line as the (often 3-4 line, on mobile) label/hint instead of wrapping. `.settings-row` now wraps under 640px, with the username input flexing to fill the full-width line it drops to instead of staying a fixed 140px.

## v5.57.0 — current
- New default playlists, seeded once for every browser/account the first time the catalog loads: Michel Gondry, Chris Cunningham, Spike Jonze, Mark Romanek, Jonathan Glazer, Anton Corbijn, Stephane Sednaoui, Hype Williams, Joseph Kahn, Mark Pellington, Marc Webb, Floria Sigismondi, David Fincher, Jonas Akerlund, Hammer and Tongs, Marty Callner. Built from real catalog matches (reuses the same director-name normalizer `findCatalogCreditsForProfile()` already used for Connect-mode profile matching, so "Gondry, Michel" and "Michel Gondry" both match) -- a director with zero catalog entries just doesn't get a playlist rather than seeding an empty one. Fully regular playlists once created: same rowNums-array shape as anything a visitor builds themselves, freely renamable/deletable, and gone for good if deleted since the one-time seed flag (`mvg-default-playlists-seeded`) never re-fires.

## v5.56.0 — current
- TV Mode gained a Vote button (light-blue/black, same as everywhere else) and its own widen/shrink player toggle (⤢, same idea as the video-detail lightbox's -- both share the same `.lightbox-panel.size-large` CSS rule since TV Mode's panel is that same shape).
- Removed TV Mode's Mirror and Interlace debug buttons entirely (not just hidden) -- retired `applyTVMirror()`/`applyTVInterlace()`/`state.tv.mirror`/`state.tv.interlaceHz` and the "tv" key from the shared interlace-overlay infrastructure. The video-detail lightbox's own admin-only Mirror/Interlace debug tools are untouched -- separate, still-working feature.
- TV Mode now opens on the **Era** dial by default instead of the Genre grid (`state.tvActiveTab` default changed from `"genre"` to `"era"`).

## v5.55.0 — current
- Top-bar Vote button is text ("Vote", light-blue/black pill) instead of a trophy icon -- same treatment as every other Vote button on the site now.
- Added the same bottom-right overlay Vote button to Maui's Picks cards.
- Lightbox Vote button made noticeably bigger and bolder (34px tall, 0.9rem/800-weight text, up from 26px/0.68rem/700) so it reads as the one action in that row with a real consequence.
- New scaffold for additional admin-curated picks sections beyond Maui's Picks: a "Picks By" sheet column (`parsePicksBy()`, comma/pipe-separated curator ids) plus an `EXTRA_PICK_CURATORS` config array in app.js (starts empty) and a `renderExtraPicksSections()` that builds a "{name}'s Picks" section per curator with actual picks. Fully wired but a complete no-op today since the array is empty -- adding one entry there (plus matching "Picks By" values in the sheet) is the only step needed to make a section appear, no other code change.

## v5.54.2 — current
- Refined the Vote button placements: Latest Submissions goes back to a bottom-right overlay on the thumbnail; Viewer's Choice sits inline on the same line as the title, right-aligned (`mediaVoteBtnHtml()` now takes an optional modifier class so the two placements share one base style -- `.media-vote-btn--overlay` for the overlay case).
- Lightbox Vote button recolored to the same light-blue/black as every other Vote button on the site (was the neutral pill look shared with Crop/Widen).
- Top-bar Vote icon recolored to a light-blue circle with a black icon, matching the same treatment.
- Moved the Vote Credits buy-buttons row to the top of the Vote modal, above the search bar (was at the bottom, after the Top Videos leaderboard).

## v5.54.1 — current
- Moved the new thumbnail Vote button off the thumbnail image itself and into the title/description area below it, on both Viewer's Choice and Latest Submissions cards.
- Viewer's Choice cards no longer show "Latest vote" -- Top voter only.

## v5.54.0 — current
- Added a one-click **Vote** button directly on Viewer's Choice and Latest Submissions thumbnails (bottom-right, light-blue/black/bold to echo the MVG logo's "G" -- new `--brand-lightblue` CSS variable). Featured/Favorites intentionally don't get one -- `createMediaStrip()` gained an opt-in `showVoteButton` flag, only passed for Latest Submissions. Shares the same sign-in-then-vote flow the lightbox's Vote button already had (new `voteForRowNum()` helper factors that logic out so all three call sites -- lightbox, Viewer's Choice, Latest Submissions -- stay in sync instead of duplicating it).
- Moved the **Vote** nav link from the left sidebar into a new icon-only button in the top bar, to the left of Settings (`topBarVoteBtn`) -- matches the icon-only pattern Settings/Admin/Sign-in already use there. No longer in the sidebar at all.
- Moved the **Vote Credits** buy-buttons row from the Settings modal into the Vote modal, at the bottom (after the Top Videos leaderboard) -- makes more sense living next to voting itself. All the wallet-balance live-listener/status-message logic moved from `openSettingsModal()`/`closeSettingsModal()` to `openVoteModal()`/`closeVoteModal()` accordingly; no id/behavior changes otherwise.

## v5.53.0 — current
- Swapped the vote-credit wallet's payment backend from Stripe to **Lemon Squeezy** -- Stripe doesn't support Philippines-registered merchant accounts, so onboarding was a dead end. Lemon Squeezy is a Merchant of Record (no US entity needed, settles to a PH bank/Wise/Payoneer) with broader international card support (including Amex) than the PH-specific gateways (PayMongo/Xendit), which matters since most of the audience is non-Filipino.
  - `functions/index.js`: `createWalletCheckout` now calls the Lemon Squeezy Checkout API (bound to a pre-created Product Variant per bundle, not a dynamic price the way Stripe's price_data was) instead of Stripe; `stripeWebhook` is replaced by `lemonSqueezyWebhook`, verifying Lemon Squeezy's HMAC-SHA256 `X-Signature` instead of Stripe's signature scheme, crediting `voteCredits` on a paid `order_created` event.
  - Dropped the `stripe` npm dependency entirely -- Lemon Squeezy's API is plain REST/JSON, no SDK needed (uses Node 20's built-in `fetch`).
  - `WALLET_BUNDLES` in `functions/index.js` still has placeholder variant IDs (`REPLACE_WITH_...`) -- each bundle needs its own Product+Variant created in the Lemon Squeezy Dashboard first, then the real IDs filled in before this works.
  - `app.js`'s buy-button flow no longer sends a `cancelUrl` -- Lemon Squeezy Checkout has no cancel-redirect concept the way Stripe did (closing without paying just does nothing).
  - Needs new secrets (`LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_WEBHOOK_SECRET`) in place of the old Stripe ones, then `firebase deploy --only functions` -- the deploy will also prompt to delete the now-unused `stripeWebhook` function, which is expected.

## v5.52.1 — current
- Fix: buying vote credits redirected nowhere -- Stripe Checkout refuses to render inside an iframe (an anti-clickjacking measure on Stripe's own end), and themusicvideoguy.com embeds this app in one. `window.location.href = ...` was only ever navigating the iframe; switched to `window.top.location.href`, the one target browsers always allow setting cross-origin even though they block reading it, so it breaks out to the real tab regardless of whether the page is framed or standalone.

## v5.52.0 — current
- New backend scaffolding for a future **prepaid vote-credit wallet** ($1 = 1 vote credit, bought in bundles so a Stripe charge doesn't fire on every single vote). Voting stays completely free right now -- nothing here is wired into the live voting flow yet.
  - `functions/index.js`: `createWalletCheckout` (Stripe Checkout session for a bundle), `stripeWebhook` (credits `users/{uid}.voteCredits` on `checkout.session.completed`, idempotent via a `walletTransactions` doc keyed by Stripe session ID), `castVoteWithCredit` (the future paid-vote path -- checks balance, decrements it, writes the same `voteEvents` shape `castVote()` does today, all in one transaction).
  - `firestore.rules`: `users/{uid}.voteCredits` is now blocked from client writes (admin/Admin-SDK only); new `walletTransactions/{id}` collection, owner-or-admin read, no client write.
  - Settings gained a "Vote Credits" row (balance + three buy buttons) that opens Stripe Checkout via `createWalletCheckout` and live-updates once the webhook credits the purchase. Hidden's not needed here since it's harmless to show a $0 balance while nothing spends it yet -- but it IS non-functional until Stripe secrets are configured (see below).
  - Needs `npm install` in `functions/` (added the `stripe` dependency), two Functions secrets set once (`firebase functions:secrets:set STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` -- the latter from a Stripe Dashboard webhook pointed at the deployed `stripeWebhook` URL, subscribed to `checkout.session.completed`), then `firebase deploy --only functions,firestore:rules`.

## v5.51.1 — current
- Viewer's Choice homepage section: its own title is now visibly bigger (1.5rem) without touching Maui's Picks/News, which share the same base title class -- added a section-scoped size-only modifier instead of changing the shared one. Rank badges now scale progressively from #1 (biggest) down to #5 (smallest), same idea as the Top 5 This Week graphic's sizing. #1's title text is yellow, matching the graphic. Removed the badges' outer ring (a `box-shadow` meant to separate the badge from the thumbnail underneath it) after it read as an unwanted black/dark stroke against the thumbnail.

## v5.51.0 — current
- Case-insensitive username collisions ("maui" vs "MAUI") were already blocked as of v5.50.1's uniqueness enforcement -- confirmed, no change needed there.
- Username max length now explicitly matches Instagram's (30 characters) -- was already the limit in practice, now documented as a deliberate match rather than a coincidence.
- New: **flagged usernames**. `functions/index.js` gained a second trigger, `onUsernameWritten`, checking every claimed username against a short (deliberately non-exhaustive, easily extended) wordlist; a match lands in a new admin-only "Username Moderation" view for review -- a flag never blocks or auto-removes anything, an admin always makes the actual call (Reset clears it from that account and frees the name; Dismiss just clears the flag). A landing-page badge shows the current flagged count, same pattern as the existing Suggestions/Verifications badges.
- New: **reserved usernames**. Admin-managed list (same Username Moderation view) blocking self-service claiming of specific names -- for names Maui's holding for himself/friends "down the line." An admin can still assign a reserved name to a specific account by signing in as an admin and setting it in Settings; the pre-check that blocks everyone else is skipped for admins.
- Needs both a rules AND a functions redeploy this time (`firebase deploy --only firestore:rules` and `--only functions`) -- new collections (`reservedUsernames`, `flaggedUsernames`) and a second Cloud Function trigger.

## v5.50.1 — current
- Usernames are now enforced unique (case-insensitive) -- the trade-off flagged in v5.50.0 turned out not to be worth carrying. New `usernames/{lowercasedName}` claim-registry collection; claiming or renaming one runs inside a client-side transaction (same pattern as `reserveRowNums()`'s rowNum reservation) so two people racing to grab the same name can't both succeed -- whichever commits first wins, the other cleanly gets "That username's taken." Also now validated to 3-30 characters, letters/numbers/underscore only. A rename releases the old claim in the same transaction, so it's immediately available to someone else rather than staying orphaned.

## v5.50.0 — current
- Top 5 This Week graphic: #1 now gets a visibly bigger thumbnail than #2, which is bigger than #3, and so on down to #5 (was 5 equal-sized rows before). #1's title text is now yellow, and shows a "Top voter: [name]" line beneath it when that video has an opted-in top voter.
- All three Social Graphics now carry a small MVG logo watermark in the lower-right corner (`icons/icon-512.png`, same-origin so no CORS concerns there).
- New: **Username**. First sign-in that doesn't have one yet prompts for it (skippable, one-time), and it's editable anytime after in Settings. Preferred over the raw Google account name when attaching a name to a vote (still gated by the existing "Show my name on videos I vote for" opt-in, off by default) -- so "Top voter"/"Latest vote"/the graphic's top-voter line show something the person actually chose, not whatever their Google account happens to be named. No uniqueness enforcement between accounts yet -- two people can pick the same username; flagged as a known trade-off, not an oversight, since it's just a display label right now, not a login handle.

## v5.49.1 — current
- The Top 5 This Week graphic's footer now reads "Vote! Visit themusicvideoguy.com (link in bio!)" instead of the plain site URL the other two graphics still use -- a real call-to-action on the one graphic that's actually about voting. Verified it fits the 1080px canvas width with room to spare (renders at ~479px, centered).

## v5.49.0 — current
- Renamed "Spotlight" to "Maui's Picks" everywhere a visitor or admin actually sees it (section title, the admin form's checkbox, the Manage Entries badge). Internal class names/field names (`spotlight`, `.spotlight-card`, etc.) deliberately left alone -- purely a display-label change, not a data model one.
- New admin "Social Graphics" section: auto-generates 1080x1350 (Instagram portrait) images for **Top 5 This Week** (Viewer's Choice), **10 Latest Submissions** (2-column grid), and **Maui's Picks** -- same black/purple gradient as the landing page's title card. Pure client-side `<canvas>` rendering, no backend involved; verified in-browser that both YouTube's and Vimeo's thumbnail CDNs send the CORS headers needed to draw them onto a canvas and still export it (a thumbnail that fails to load for any reason is skipped with a plain placeholder block rather than failing the whole graphic). Pick one, wait for it to render, then download the PNG straight from the admin panel.

## v5.48.1 — current
- **Fixed a real bug in the previous Spotlight resize**: matched it against `.media-strip-card`'s 140px *base* rule, which turns out to be essentially a dead fallback on real desktop -- `#latestStrip`/`#featuredStrip`/`#favoritesStrip` all get overridden to a much bigger `minmax(290px, 1fr)` grid at `@media (min-width: 641px)` (see the "gallery-style sections on desktop" comment in styles.css), which is what Latest Submissions actually renders at. Spotlight now uses that exact same grid formula instead, so its cards are pixel-identical to Latest's, not the smaller 140px strip size.

## v5.48.0 — current
- Voting reworked (again, still never deployed) to be repeatable -- the same person can now vote for the same video more than once, ties into the original "vote by giving a dollar" idea where more dollars later means more votes for that pick. Replaced the single overwritten `votes/{uid}` doc with an append-only `voteEvents` log, so the Cloud Function can maintain a real per-video **Top voter** (whoever's voted most for that specific video) and **Latest vote** (most recent voter), shown on both Viewer's Choice cards and the Vote modal's leaderboard.
- New Settings toggle, "Show my name on videos I vote for" -- **off by default**. A vote always counts either way; only whether your name can appear as a video's top/latest voter is affected. Decided client-side at the moment you vote (not retroactive), so switching it doesn't change who's already been credited on past votes.
- Same deploy status as every vote-related change so far -- still needs `firebase deploy --only firestore:rules` and the Cloud Function deploy (`cd functions && npm install && firebase deploy --only functions`) before any of this is live. `functions/index.js` changed enough (new trigger name, new collections) that a prior partial/failed deploy attempt won't just pick this up automatically -- redeploy functions after pulling this.

## v5.47.0 — current
- New "Viewer's Choice" section at the top of Home, above Spotlight -- the top 5 videos by vote count, #1/#2 side by side, #3-5 in a row below. Reads live from `videoVotes` (public, no auth needed); stays hidden until there's at least one real vote, and fails quiet rather than showing an error if the vote backend isn't deployed yet. Ranked strictly by all-time vote count for now -- see the CHANGELOG-adjacent discussion on ranking decay for the plan there.
- Spotlight reduced from 6 videos to 5, and its thumbnails now match Latest Submissions' size (140px fixed width) instead of stretching to fill a 3-column grid -- was noticeably larger than every other strip on the page for no real reason.

## v5.46.0 — current
- Every video's lightbox now has its own one-click Vote button (next to Favorite), instead of needing to open the Vote modal and search for the video by name. Signed out, clicking it triggers Google sign-in first, then casts the vote automatically once that succeeds. Both this button and the Vote modal's search results write to the exact same single vote per person, so whichever was used last is simply the current pick -- nothing to reconcile between the two entry points, and the button's state (plain "Vote" vs. active "Voted ✓") now stays live-updated everywhere via one global subscription started at sign-in, not just while the Vote modal happens to be open. Same deploy status as before -- still needs `firebase deploy --only firestore:rules` and the Cloud Function deploy before any of this actually writes anywhere.

## v5.45.0 — current
- Reworked voting (shipped in v5.44.0, never deployed) from an admin-curated "pick 5 videos per round" format to open voting across the whole catalog -- search for any video and vote for it, changeable anytime, no admin curation step. Dropped the round/tally-map data model in favor of one doc per video (`videoVotes/{rowNum}`), updated via atomic increments from the Cloud Function instead of a transaction on one shared doc -- spreads write load across many documents instead of funneling every vote through a single hot doc, which matters once a vote can land on any of ~13k videos instead of 5 fixed ones. The admin panel's Vote Rounds section is now a read-only live leaderboard (nothing left to curate) for picking what's worth featuring on Instagram. Still free, still not deployed -- same two manual steps as before (`firebase deploy --only firestore:rules` and `cd functions && npm install && firebase deploy --only functions`).

## v5.44.0 — current
- New: "Video of the Week" vote rounds -- a new Vote button opens a modal showing 5 admin-picked videos; visitors sign in and pick a favorite. Free for now (no payment), with the payment step planned as a later addition once this has run for a while, per plan. Tallies stay hidden from everyone -- including the voter -- while a round is open, only revealed (with a winner badge) once the admin closes it, to keep it an honest "pick your favorite" instead of a bandwagon. New admin "Vote Rounds" section: search-and-pick 5 videos the same way Channel Mode's queue picker works, start/close a round, see live counts (admin-only) while it's open, and browse past rounds' final results for picking what to feature on Instagram.
- **New infrastructure, not yet live**: this needed two things that don't exist anywhere else in this project yet, and neither is deployed -- (1) `firestore.rules` gained a `voteRounds`/`votes` section (public read, admin-only round management, one-vote-per-user via doc ID = uid), needs `firebase deploy --only firestore:rules`; (2) a brand-new `functions/` directory holds the project's first-ever Cloud Function (`onVoteWritten`), which is the only thing allowed to touch a round's vote tally -- maintains it transactionally so concurrent votes can't race each other into an undercount, and is exactly the seam a future Stripe payment gate would plug into without touching the public read model. Needs `cd functions && npm install`, then `firebase deploy --only functions` (Blaze plan required, already enabled). The Vote button/admin section render and behave correctly in the meantime, but any real read/write against `voteRounds` will fail with a permission error until both are deployed.

## v5.43.0 — current
- **Fixed a real mobile layout bug**: the video lightbox's title-actions row (up to ~9 buttons for an admin -- Edit/Delete/Favorite/Playlist/Widen/4:3/Mirror/Interlace/Report issue/Suggest an edit) had no `flex-wrap`, so on narrow screens it forced the whole panel wider than the viewport instead of wrapping, pushing the modal into horizontal scroll and cutting off the video and description text. Added `flex-wrap` to the actions row, `overflow-x: hidden` on the panel as a backstop, and a mobile-only override stacking the title above the (now-wrapping) actions row instead of forcing them onto one cramped line.
- Admin Add/Edit Entry now has a Submitter Email field, populated from the submission form's existing (previously invisible in the admin UI) "Your email" field. Deliberately admin-only -- excluded from both `publishSnapshot()` paths (client and `scripts/publish-snapshot.js`) so it never lands in the public catalog snapshot; Firestore's own `videos` collection is already admin-only read/write per `firestore.rules`, so it's never exposed even via a direct Firestore query. Bulk Import will also pick it up from a pasted column matching a few likely header spellings (`email`, `email address`, `your email`, `submitter email`) -- the exact header the Submissions-intake Google Apps Script actually writes lives outside this repo, so verify it matches on the next real import and adjust the alias list if not.

## v5.42.1 — current
- Settings now has an Account row with a Sign out button, shown only while signed in. The only sign-out control before this lived in the desktop sidebar's account area; Settings is reachable the same way from every viewport via the top bar's gear icon, so this covers the gap for anyone who couldn't find it there. **Fixed a real `[hidden]`-cascade bug caught while building it**: `.settings-row` sets `display:flex` unconditionally, which silently beats the browser's default `[hidden]{display:none}` rule -- without an explicit `.settings-row[hidden]{display:none}` override, the new row would have rendered as an empty flex row before sign-in instead of actually disappearing.

## v5.42.0 — current
- Save & Next in the Fill Missing Links queue now auto-triggers "Auto-Fill Top Result" for whatever entry comes up next (when the API key is configured), instead of requiring a click every single time. Still just drops a suggestion into the field/preview -- nothing saves without a human hitting Save & Next again, same as clicking the button manually. A stale in-flight search (if the queue moves on again before the previous lookup returns) is discarded rather than filling in the wrong entry.

## v5.41.1 — current
- `YOUTUBE_SEARCH_API_KEY` is now set, turning on the Fill Missing Links queue's "Auto-Fill Top Result" button (shipped hidden-until-configured in v5.41.0). Referrer-restricted in Google Cloud Console the same way as recommended when the feature was built.

## v5.41.0 — current
- Fill Missing Links now shows a live preview player -- paste any YouTube/Vimeo link into the field and a small embedded player (the same free `createVideoPlayer()` wrapper used everywhere else on the site) renders below it after a short pause in typing, so you can confirm it's the right video before hitting Save & Next. No cost, no API key, since it's just embedding whatever's already in the field.
- Added an optional "Auto-Fill Top Result" button that calls the real YouTube Data API v3 search endpoint and drops its top hit straight into the field (plus the preview above, and a note showing the result's title/channel to sanity-check against). Off by default -- stays hidden until `YOUTUBE_SEARCH_API_KEY` is set in `app.js`, since it needs a real Google Cloud API key (same "safe to expose once referrer-restricted" model as the existing Firebase key) and draws down a free 10,000-unit/day quota at 100 units per search (~100 lookups/day before it needs to wait for the next day, not a paid overage). Still requires a human Save & Next either way -- YouTube's top result for an artist+song query is often a lyric video or fan upload, not the official one.

## v5.40.0 — current
- New: a "Fill In Missing Links" queue in Data Health, for working through the ~1,000 entries with no recognized YouTube/Vimeo link. Deliberately not automated matching -- there's no free bulk YouTube search API, and auto-attaching a best-guess result risked silently pairing the wrong video with an entry. Instead it's a fast one-at-a-time review: shows Artist/Song/Director/Year/Category, one click opens a YouTube search pre-filled with Artist + Song, paste the correct link back in and hit Save & Next to auto-advance (or Skip to rotate the entry to the back of the queue, or Delete Entry if nothing findable exists). Saves write straight to Firestore but don't auto-publish per entry like the regular Add/Edit form does -- re-publishing the full ~13k-doc catalog snapshot after every single paste would be wasteful over a queue this size -- there's a Publish Now button to go live whenever, and a reminder in the queue's hint text about the different behavior.

## v5.39.1 — current
- The admin Add/Edit Entry form now has a "Search YouTube for this video" button right below the YouTube Link field, opening a new tab pre-searched with the form's current Artist + Song (plus "music video"). Meant to pair with the Data Health broken-link scan -- re-finding a video that's since moved or been re-uploaded no longer means leaving the entry to search manually.

## v5.39.0 — current
- New: a "Data Health" section in the admin panel, giving admins visibility into catalog data quality that there was previously no way to check. Three reports: **Duplicate Videos** (entries sharing the exact same YouTube/Vimeo video ID -- computed instantly from the loaded catalog, no false positives from legitimate covers/remixes since it's an exact ID match, not fuzzy artist/song matching), **Missing Video Link** (entries with no recognized YouTube/Vimeo URL at all -- also instant), and **Broken Links** (a manual, stoppable scan that checks every entry's video ID against YouTube's/Vimeo's own public oEmbed endpoint -- the same lightweight technique already used for Vimeo thumbnails -- to catch videos that have since been removed, made private, or had embedding disabled). Every flagged entry gets the same Edit/Delete buttons as Manage Entries, so an admin can act on a finding immediately without leaving the view.

## v5.38.0 — current
- **Fixed a real bug**: the Country dropdown on the submission form was derived only from countries already tagged on existing catalog entries, so a legitimate country with zero entries so far (Myanmar was the reported case) had no way to be selected by the very first person submitting one. Switched it (and the admin form's matching fast-fill dropdown) to the full 197-country reference list already used elsewhere for normalizing free-text country input, instead of a catalog-derived subset. Also added the one country actually missing from that reference list (Côte d'Ivoire), disambiguated "Congo" into "Congo-Brazzaville" / "Congo-Kinshasa" (both DRC and Republic of the Congo were previously showing as an indistinguishable duplicate "Congo" option), and added a few more free-text aliases (Burma, Ivory Coast, DRC, etc.) so submissions using those names still normalize correctly.

## v5.37.1 — current
- Welcome gate polish, per feedback on the first pass: the three feature boxes (Customize/Build/Connect) are now larger with a visible card background/border instead of bare text, and the ad banner got `position:relative; z-index:1` so it always paints above the drifting thumbnail field -- the thumbfield is a positioned (`position:absolute`) element, which per CSS stacking rules paints above later non-positioned siblings regardless of DOM order, so without an explicit stacking context of its own the ad could end up visually underneath it.

## v5.37.0 — current
- New: a first-visit welcome gate for signed-out visitors, styled after land.html's title-card look (same purple radial-glow background, Archivo Black yellow title) but with a real Google sign-in button (prominent, primary) and a much quieter "Continue as Guest" link next to it, three short feature boxes (Customize/Build/Connect) explaining what signing in actually unlocks, and the site's usual promo ad pinned below all of it. Video thumbnails from the catalog drift outward from center behind the content at 50% opacity once it's loaded, DVD-screensaver-adjacent, each with its own randomized trajectory/timing. Shows once per browser -- waits for the first `onAuthStateChanged` callback to confirm there's no existing session before deciding whether to show it (avoids flashing it at someone who's actually already signed in), and is dismissed permanently (via `localStorage`) by either signing in or choosing Guest.
- **Fixed two real bugs caught during verification**: the thumbnail field silently never populated because its container element was never registered in `els` (a guard clause was checking `els.welcomeGateThumbfield`, which was always `undefined`); and the gate's ad banner briefly showed the wrong ad content on reload because it shared the `.ad-placeholder` class with the homepage's own ad slot -- `document.querySelector(".ad-placeholder")` (used by the site's rotating-ad-slideshow code) matches the *first* element in the DOM, and the gate now sits earlier in the page than the real homepage slot, so the slideshow code was silently targeting and overwriting the gate's ad instead. Renamed the gate's ad wrapper to its own class.

## v5.36.3 — current
- **Fixed a real bug**: the PWA "any"-purpose icons (`icon-192.png`, `icon-512.png` -- used for the browser favicon, apple-touch-icon, in-app header logo, and the PWA install/splash icon) had an alpha channel with a transparent margin around the circular logo instead of filling the canvas edge-to-edge. Platforms/launchers that don't composite transparent PNG regions properly (common on Android install flows) render that as a mismatched black border -- exactly what showed up as "the old blue one with a black border" on an already-installed copy. Regenerated both from the maskable icon's already-correct art (solid opaque purple square, zero alpha, wordmark centered) instead of the old circle-on-transparency version, so there's no ambiguous region left for any platform to get wrong. `icon-512-maskable.png` itself was already correct and is unchanged.

## v5.36.2 — current
- Light theme's top bar is now a flat lavender (`var(--accent-soft)`, the same tint light theme already uses for hover states) instead of the purple gradient -- the glow read fine against dark theme's near-black background but looked more like an uneven smudge against light theme's near-white one. Dark theme keeps the gradient from v5.36.1 unchanged.

## v5.36.1 — current
- The top bar now carries the same purple radial-glow language as land.html's title card, rescaled for a thin persistent bar instead of a full page -- a single glow centered on the search bar, fading to plain background at both the logo and the icons. Built with `color-mix(in srgb, var(--accent) …%, transparent)` rather than land.html's hardcoded purple, so it stays theme-correct in both light and dark mode and follows `--accent` automatically if that's ever changed. Applies everywhere `.top-bar` is used (index.html, and blog/support/privacy via site-nav.js) since it's one shared class. Verified in both themes.

## v5.36.0 — current
- Channel Mode: a brief static/tuning flash now plays over the video every time the channel switches tracks (reuses the same noise texture as the "channel ready" armed screen), instead of a hard cut. **Fixed a real bug while building it**: the flash was appended into `.video-embed-frame` right before that same function sometimes rebuilds the frame's innerHTML (provider switch/first load), wiping the flash out instantly -- deferred the flash to the next tick so it always survives.
- Channel Mode now has a live comments panel for whatever's currently airing, reusing the exact same per-video `comments` collection/rules the regular video lightbox uses. Comments posted since the current airing began show "🔴 Xm Ys into this airing" instead of a plain relative time. Ad-hoc inserted links (no catalog rowNum) show a note instead, since there's nothing to thread comments off of.
- Live favicon + tab title while tuned into the Channel: the actual browser-tab favicon pulses a small "on air" dot (canvas-composited over the real site icon) and the title gets a blinking 🔴/⚫ "LIVE" prefix, so a backgrounded tab still signals something's playing. Both revert the instant Channel Mode is left.
- A pass of empty/error-state copy across TV Mode's no-matches screen, Favorites, Playlist details, Search's no-results states, and Channel Mode's empty-queue status -- same information, a bit more personality, matching the tone already used elsewhere on the site (the cloud-link/land-link footer easter eggs, bounce.html).

## v5.35.3 — current
- **Fixed a real bug** in v5.35.2's prune-on-refresh fix: removal was entirely anchor/duration-math-based (re-deriving "is this item's slot over yet" from the clock), but a real onEnded event can fire several seconds before that math agrees, since actual playback timing doesn't perfectly match the resolved `duration` estimate. That made the Live View feel stuck on a finished video until the 20s periodic tick eventually caught up (or, on a background/inactive tab, took much longer than 20s due to browser timer throttling) -- which read as "only clears after a manual refresh." `onEnded` is now ground truth: `removeJustFinishedChannelItem()` removes exactly the item that just reported finishing and restarts the clock from right now for whatever's left, instead of asking the clock whether it agrees. The periodic/on-load anchor-based prune stays as the fallback for items that finish while nobody's watching.

## v5.35.2 — current
- **Fixed a real bug** in v5.35.1's "clear finished videos": it only removed an item when the admin's own Live View player happened to reach the natural end of a video, which meant closing the panel (very likely usage) left already-aired items sitting in the queue forever, and the currently-playing item never actually rose to the top of the list. Replaced with `pruneFinishedChannelItems()`, which drops everything before the current position in play order and resets the schedule anchor to compensate (so the item that was already playing keeps its exact playback position, no jump) -- runs on every panel load and every 20s refresh, not just on a lucky onEnded, so it self-corrects whenever the admin next looks regardless of what happened while nobody was watching. Verified the anchor-preserving math against synthetic data: pruning correctly drops the finished item, promotes the live one to index 0, and keeps it at the identical offset.

## v5.35.1 — current
- Channel Mode admin panel: Live View now starts muted (it autoplays on open with no fresh user gesture behind it, so audible autoplay would likely just get blocked anyway -- native controls are visible to unmute with one click) and moved to sit directly above the Queue list on both mobile and desktop, replacing the two-column layout that read as misplaced/cramped on desktop.
- The queue now clears finished videos: when the admin's own Live View plays a queue item through to the end, that item is removed from the queue (regular viewers can't do this -- no Firestore write access -- so it only happens while an admin has Live View open and playing). Turns the queue into a draining one-shot playlist rather than a forever-loop, for admins who want that.
- "Plays at" times (queue rows and the scheduled-insert banner) now include the date, not just the time of day -- a long queue easily pushes times a day or more out, where a bare time was ambiguous about which day it meant.

## v5.35.0 — current
- Channel Mode admin panel now has a live view to the side -- a real, second synchronized player (reusing the exact same scheduling math the viewer side uses) so the admin can watch/hear what's actually airing while editing the queue, without needing TV Mode open separately.
- New: "Insert a YouTube or Vimeo link" -- paste a raw video URL (doesn't need to already be in the catalog) and choose to add it **at the end** of the queue, **play immediately**, or **at a specific time**. The latter two use a new one-slot `scheduledInsert` overlay on the `channel/current` doc: while active it preempts the regular rotation entirely (no touching the queue's own order/anchor), and once its duration elapses playback falls straight back to wherever the regular rotation's own clock says "now" is -- same as a real DJ cutting to something live and returning to the rotation, not pausing it. Title looked up via YouTube/Vimeo's public oEmbed; duration resolved the same probe-player way as catalog adds.
- Underlying refactor to support the above: queue items can now be either catalog-sourced (`rowNum`) or ad-hoc (`provider`+`videoId`+`title`, no catalog entry at all) -- `channelItemRef()`/`channelItemTitle()`/`channelItemKey()` are the one place that distinction is handled, so scheduling/playback/rendering treat both uniformly. Verified the refactor against the real live 96-item queue (still tunes in correctly) and the new interrupt logic against synthetic not-yet/active/expired cases.

## v5.34.0 — current
- Admin Channel Mode panel: "Shuffle add from catalog" buttons (+10/+100/+1000) bulk-populate the queue with that many random, not-already-queued catalog videos in one click, instead of hand-picking each one. Duration resolution (see v5.33.0) now runs as a 5-way concurrent worker pool with a progress readout ("Resolving durations: 42/1000…") instead of one-at-a-time, and saves are debounced to one write ~1s after the last resolution lands rather than one per video -- makes a +1000 add practical instead of taking forever and hammering Firestore. Also fixed a real bug this surfaced: the YouTube duration probe used a single fixed hidden-player element id, which was fine one-at-a-time but would have had concurrent probes stomp on each other's setup/teardown; each probe now gets its own id.

## v5.33.1 — current
- Admin Channel Mode panel now shows an estimated schedule for each queue item -- "Now playing" for whatever's live, "Plays at HH:MM" for everything else, computed by reusing the exact same play-order/position math the viewer side uses (so it's never a separate, potentially-inconsistent estimate) and walking forward one loop from right now. Items excluded from playback (duration not yet resolved, or the video's since been removed from the catalog) show "Not scheduled (skipped)" instead of a bogus time. Refreshes every 20s while the panel is open. Verified against the live `channel/current` doc (96 real queued items) -- correctly identified the currently-playing item and the wrap-around back to the top of the queue.

## v5.33.0 — current
- New: **Channel Mode**, TV Mode's 4th tab -- a single shared, synchronized "channel" every visitor watching it sees the same position in, purely from client-side time math (no server pushing anything): `elapsed = (now - anchorAt) mod totalDuration` against a Firestore doc (`channel/current`) holding an ordered queue with per-item cached durations. Playback chains forward via the player's own `onEnded`, with a periodic wall-clock resync (every 20s, plus on any live queue edit) correcting drift. "Shuffled" mode uses a seeded deterministic shuffle so every client gets the identical order.
- New admin "Channel Mode" panel (DJ-deck style): search-and-add individual videos, add a whole existing Playlist to the queue, reorder/remove with up/down/remove buttons, toggle Ordered/Shuffled, reshuffle, and "Restart Channel Now" to reset everyone to the top of the queue -- every edit auto-saves and takes effect live for anyone already tuned in. Since no video in the catalog has stored duration data, it's resolved once per video the first time it's added: Vimeo's oEmbed returns duration directly, YouTube's doesn't so a brief hidden/silent player reads `getDuration()` off it.
- Deployed the new `channel/current` Firestore rule (public read, admin-only write).

## v5.32.0 — current
- `scripts/generate-seo-pages.js` now also covers the blog: published posts (fetched from Firestore via a plain REST `runQuery` with an explicit `status=="published"` filter -- a filter-less `documents.list` gets a flat 403, since Firestore won't allow an unauthenticated list unless the query itself provably can't return a document the rules would reject) get added to `sitemap.xml` and a new `blog-rss.xml` feed, kept separate from the video-drops `rss.xml` since they're different content types/audiences. `blog.html` now links `blog-rss.xml` via `<link rel="alternate">` for feed-reader discovery. The daily SEO-pages GitHub Action now commits `blog-rss.xml` too.
- blog.html: replaced the plain "Loading…" text states (listing, individual post, comments, "Previous Articles" sidebar) with shimmering skeleton placeholders sized to match the real content, so nothing jumps into place when it arrives.

## v5.31.2 — current
- `bounce.html`: the logo now shifts hue (`filter: hue-rotate()`) on every wall bounce, not just perfect corner hits, so its color visibly cycles as it ricochets around.

## v5.31.1 — current
- Widened the hit target on the Support page's heart easter-egg link -- it was just the bare emoji glyph with zero padding (confirmed the link itself worked fine both locally and on the live site; the miss was almost certainly the tiny hitbox, easy to click just next to). Added 10px of padding with matching negative margin so the clickable area is meaningfully bigger without shifting anything visually.

## v5.31.0 — current
- Blog posts now have a comments section, same shape/rules as the per-video comments (`blogComments` Firestore collection, public read, signed-in + not-banned create, admin-only delete, reuses the `.lightbox-comments`/`.comment-*` styling verbatim). Deployed the new rules + composite (postSlug, createdAt) index live.
- New easter egg: the heart on the Support page now links to `bounce.html`, a fullscreen black page where the (deliberately pixelated, square) MVG logo bounces around DVD-screensaver style. Landing a perfect corner hit -- both walls in the same instant, made achievable (not astronomically rare) by keeping the logo's x/y speed equal so it always travels at 45 degrees -- triggers a multicolor particle burst and a synthesized bright major chord.
- All pages linked from the homepage (blog, support, privacy -- not the land/cloud easter eggs) now consistently get the same footer as index.html (version, copyright, land/cloud links). `site-nav.js` now renders it directly so it doesn't have to be hand-duplicated per page; `privacy.html` was migrated onto the shared `.shell`/site-nav chrome (sidebar + footer) to match blog.html/support.html, replacing its old standalone back-link.

## v5.30.1 — current
- Fixed a real gap in the previous version's blog listing redesign: the big cards and list-view items were built with page-local `.post-card`/`.post-list-item` CSS that only approximated the homepage's News-card look, and the page was still capped at `max-width:860px` (centered), while the homepage's News section fills `.app`'s full width. Now the listing reuses styles.css's actual `.spotlight-card`/`.blog-latest-card`/`.spotlight-card-thumb`/`.blog-latest-extra-item` classes directly (pixel-identical to the homepage cards), and `main` has no width cap on the listing view so it spans the same full width `.app` gives the homepage's News section.

## v5.30.0 — current
- `blog.html` listing page redesigned to match the homepage's News section sizing: the first 6 posts render as big 16:9 thumbnail cards (`.post-card`, reusing the same aspect ratio as the homepage's `.blog-latest-card`), the next 14 render as a compact thumbnailed list (`.post-list-item`), and pagination kicks in every 20 posts (`blog.html?page=2`, etc.).

## v5.29.0 — current
- **Fixed a real bug**: images and text could render visually outside the blog editor's Body field during editing. Root cause: `.blog-editor-body` was `flex: 1 1 auto` nested inside `.blog-editor-form`, itself a `flex: 1 1 auto; overflow-y: auto` flex column -- per the flex spec, an `overflow:auto` flex item's automatic minimum size collapses to 0 (not content-based), which let the browser size the body field down to exactly its `min-height` regardless of actual content, silently spilling the rest past its own border. Fixed with `flex: none`, opting the field out of the flex distribution algorithm entirely so it sizes purely by its own content, like a normal block box. Verified: a box with ~1000px of content now measures ~1000px, not clamped to the 420px min-height.
- Blog editor: added a video embed button (YouTube or Vimeo URL -> responsive embed, inserted at the cursor same as images).
- `blog.html`: added the site's promo ad banner at the bottom of every page, plus a "Previous Articles" sidebar on individual post pages (thumbnail + title for up to 6 other published posts, excluding the one you're reading).

## v5.28.0 — current
- `blog.html` and `support.html` now get the same header + sidebar as the main app, via a new shared `site-nav.js` (not the whole `app.js` -- these stay lightweight static pages, internal nav items just link back to `index.html` since there's no app state here to drive them; Submit still deep-links to `index.html#submit`, which already opens the modal). Caught and fixed a real layout bug while building it: the sidebar has to sit *inside* `.shell` alongside `.app`, not before it -- getting that nesting wrong silently pushed all page content ~950px down the page instead of beside the sidebar.
- Blog editor: added paragraph alignment (left/center/right).
- Blog editor: the Link button now actually works on a selected image, not just text -- `execCommand("createLink")` was silently no-oping on images (returns success, changes nothing), so an image link is now wrapped/unwrapped by hand. Added a matching Unlink button. Drag-to-reposition images within the body already worked natively (`contenteditable` images are draggable by default) -- nothing to build there.

## v5.27.0 — current
- Blog editor: rounded out the formatting toolbar -- Undo/Redo, Underline, Strikethrough, H1/H3 (H2 already existed), Numbered list, and Blockquote, alongside the existing Bold/Italic/H2/bulleted-list/Link/Image. Grouped into clusters with subtle dividers now that it's 15 buttons instead of 7. Public post pages (`blog.html`) got matching styles for all of it.
- Blog editor: Author and Date are now real editable fields (next to Slug/Cover), not just whatever the signed-in admin's account name happens to be and whenever Save was clicked -- lets a post be credited to someone else or backdated/postdated (e.g. importing older writeups). Date defaults to today for a new post, or the post's existing date when editing.

## v5.26.1 — current
- Blog post editor was cramped into a 560px lightbox with the whole form squeezed into a two-column grid -- rebuilt as its own full-viewport editor page (sticky top bar with Save Draft/Publish/Cancel, single wide column, a much larger body editor) instead.
- Fixed inline image insertion so it actually lands where the cursor was, not just at the end -- was capturing the selection only at the moment the toolbar's Image button was clicked, which is already too late (clicking anything outside the contenteditable body moves the DOM selection first). Now tracks the last valid cursor position in the body continuously via `selectionchange`, so an image inserts exactly where you clicked before opening the file picker.

## v5.26.0 — current
Self-hosted blog -- the first step toward dropping the Squarespace News feed entirely:
- New `blogPosts` Firestore collection + Storage bucket for post images, same admin-write/public-read shape as the rest of the site.
- Admin panel gets a "Blog Posts" section: a list view (draft/published badges) and an editor with title/slug (auto-generated, editable)/excerpt/cover image, and a WYSIWYG body (Bold/Italic/Heading/Link/bulleted list/inline image upload) built on `contenteditable` + `execCommand` -- no editor library, matching the no-build-step site.
- New `blog.html`: a public listing page and individual post pages at `blog.html?post=<slug>` -- real, bookmarkable, shareable per-post URLs, which is the actual fix for "can't link to individual posts." Static pre-rendering (mirroring the existing SEO hub-page generator) is a planned fast-follow for crawlability, not required for the editor/publish flow to work.
- New "Blog" link in the header nav, separate from the existing (Squarespace-sourced) "News" link -- nothing about the homepage News sidebar or the News link changes yet; this runs in parallel until there's enough content to cut over.

**Needs the same manual step as v5.24.0**: `blogPosts` rules + `blog-images` Storage rules are written but not deployed (`firebase deploy --only firestore:rules,storage:rules`). Until then, the admin editor and public blog pages both fail closed with a handled `permission-denied`.

## v5.25.1 — current
- `land.html` now has an "Enter Here →" button linking to the real site -- it's a thumbnail-source page first, but no reason it can't also work if someone actually clicks through it.

## v5.25.0 — current
- Added `land.html`: a standalone, stylized title-card page (logo, "MUSIC VIDEO LIBRARY" in the header's own Archivo Black/yellow treatment, tagline, purple glow background) sized for a 16:9 screenshot -- not a real navigation entry point, just a personal-use thumbnail source. `noindex, follow`, no site chrome/nav.
- Footer now has a "land" link on the far left mirroring the existing "cloud" easter-egg link on the far right (same rainbow letter-hop hover style) -- `.app-footer` restructured from centered text to a 3-column grid (land / version text / cloud) to fit both symmetrically.

## v5.24.1 — current
- Related videos (in the video lightbox) now show a small thumbnail on each pill instead of plain text -- reuses the existing `.related-btn` pill shared with Profiles' "Credits in the library" list, which stays exactly as it was (no thumbnails there, unaffected by this change).

## v5.24.0 — current
Four community/data-quality features, built off the existing message-board/collab-request/credit-matching patterns:
- **Per-video comments**: a real comment thread on every video lightbox (new `comments` collection), same public-read/signed-in-to-post/admin-delete shape as the message board, just scoped to one rowNum instead of a single global feed.
- **Suggest an edit**: any signed-in visitor can propose a single-field correction from the lightbox ("Suggest an edit", next to Report issue) -- picks a field, sees the current value, types a replacement. Lands in a new admin "Edit Suggestions" review queue (badge-counted on the Admin landing screen); Accept applies it straight to the entry and republishes, Decline just dismisses it.
- **Verified profiles**: a profile owner with at least one matched catalog credit (the existing auto credit-matching) can request a verified badge. Reviewed in a new admin "Verification Requests" queue; approving adds a small checkmark badge next to their name on cards and in the lightbox everywhere. Verified status lives in its own public `verifiedProfiles` collection rather than a field on the profile doc, so approving someone doesn't need write access to their profile.
- **Notification badge**: the sidebar's Profiles link now carries a combined unread count (pending incoming collab requests + DM threads waiting on a reply) visible from the hamburger menu regardless of what page you're on, instead of only being visible once already inside Connect > Requests. Refreshed on sign-in and whenever the menu opens.

**Still needs a manual step**: this batch adds five new Firestore collections (`comments`, `editSuggestions`, `verificationRequests`, `verifiedProfiles`) plus one composite index (`comments`: rowNum + createdAt) -- none of it goes live until `firestore.rules`/`firestore.indexes.json` are deployed by hand (`firebase deploy --only firestore:rules,firestore:indexes`). Until then these features fail closed (permission-denied, handled gracefully in the UI) rather than doing anything unsafe.

## v5.23.1 — current
- Removed the last remaining purple glow: the Watch/Connect toggle's active pill (`.nav-mode-btn.is-active`) still had the `box-shadow` glow from v5.20.2, missed by the later glow-dialing-down/removal passes (v5.20.3, v5.21.1).

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
