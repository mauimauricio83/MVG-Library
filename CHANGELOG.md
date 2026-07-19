# Changelog

Informal version history for MVG Library, reconstructed from git log. No strict semver enforcement — major bumps mark genuine breaking/architectural changes, minor bumps mark additive features.

## v3.0.0 — current — Spotlight sidebar
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
