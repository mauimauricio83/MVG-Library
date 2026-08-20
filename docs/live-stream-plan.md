# Live Stream Feature — Planning Doc

Status: **not started, planning only**. No code has been written against this doc.
Reason for deferral: no current audience size to justify the build. Revisit when
there's a concrete reason to stream (an event, a launch, a collab).

---

## 1. What this is

A "Live" viewing experience for MVG Library, fed by a broadcaster (initially just
Maui, via OBS) and watched by visitors on the site, with a real-time chat/comments
pane alongside the video — visually and structurally modeled on **TV Mode**, the
existing fullscreen immersive video experience.

This is *not* a browser-to-browser P2P mesh (that doesn't scale past a handful of
viewers for one-to-many broadcast — see §2). It's OBS → a hosted relay → many
viewers, with "peer" in the name referring to the relay's own transport, not a
serverless architecture on our end.

## 2. Transport: Meshcast

[Meshcast](https://meshcast.io) (built by the VDO.Ninja creator) is a free, hosted
WebRTC/SRT/RTMP relay (SFU — selective forwarding unit). OBS pushes **one** stream
to Meshcast; Meshcast fans it out to every viewer at sub-second latency over
WebRTC (WHEP). No server for us to run, no hosting cost, no MediaMTX/VPS to
maintain — which matters a lot given MVG Library is otherwise 100% static
(GitHub Pages) + serverless (Firebase). This was chosen over self-hosting
MediaMTX specifically to avoid introducing the site's first-ever persistent
server dependency.

**OBS side** (already proficient, just needs the destination):
- Add a custom output: RTMP or WHIP pointed at the Meshcast ingest URL + stream
  key generated per-session (or a stable key we reuse — TBD, see §7).
- For WebRTC/WHEP playback on the viewer side, Meshcast requires specific encoder
  settings: keyframe interval 1–2s, CBR rate control, B-frames off. Worth a short
  "how to start a stream" checklist for future-us, not just a one-time setup.

**Site side**: embed Meshcast's WHEP/WebRTC watch link (an `<iframe>` or a small
WebRTC player snippet Meshcast provides) inside the Live view described in §3.
No ingest credentials are ever needed client-side — only the public watch URL.

## 3. Viewer UI — modeled on TV Mode

TV Mode (app.js, `openTVModalFresh()` / `openTVModal()` ~line 3958) is the closest
existing pattern: a fullscreen lightbox (`#tvModal`, reusing the shared
`.lightbox`/`.lightbox-backdrop`/`.lightbox-panel` shell) with a player area and a
control strip, entered/exited via the standard lightbox open/close + history-back
convention (`pushModalHistory()` on open, `.lightbox-close` / back-button on exit).

Live Mode reuses that shell almost directly:

- **New lightbox**: `#liveModal`, same `.lightbox` structure as `#tvModal`.
- **Player area**: replaces TV's `#tvPlayerTarget` video-embed-frame with the
  Meshcast WHEP embed. No shuffle/queue logic needed (there's exactly one
  "channel"), so `armTV()`/`advanceTV()`/`state.tv.queue` have no equivalent here
  — Live Mode is much simpler than TV Mode in that respect.
- **"Channel not broadcasting" state**: TV Mode's `tvStaticMarkup()` (static-noise
  screen shown between "armed" and "playing") has a direct analog: an "offline"
  screen shown whenever `liveSettings.isLive` is `false` — reuse the same
  static-noise visual treatment (`.tv-static`-style CSS) for continuity, with a
  "Not currently live — check back soon" message instead of a play button.
- **Controls strip**: analogous to TV's control row (`#tvPowerSwitch`,
  `#tvSkipBtn`, `#tvFavBtn`, `#tvInfoBtn`, etc.) but much shorter — realistically
  just a close/exit control, maybe a mute toggle if Meshcast's embed doesn't
  supply its own, and a "Watching now" indicator if Meshcast exposes viewer count.
  No skip/favorite/playlist controls (nothing to skip to, nothing to favorite).
- **Entry point**: a new sidebar/nav item ("Live") alongside Watch/Connect-mode
  items in `site-nav.js`'s `HEADER_LINKS_HTML` and the equivalent in `index.html`'s
  own header-links markup, opening `#liveModal` the same way `#tvModal` opens.
  Only shown / only prominent when a stream is actually live (see §5's badge).

## 4. Live chat — modeled on the comments infrastructure

The codebase already has two working instances of the same pattern: per-video
`comments` (app.js) and blog-post `blogComments` (blog.html) — flat Firestore
collections, public read, signed-in-and-not-banned create, admin-only delete, a
composite `(keyField ASC, createdAt ASC)` index, and a matching
`*CommentsHtml()` / `renderCommentList()` / `startCommentsListener()` trio.

Live chat follows the same template, with one real difference: comments are
transient/session-scoped rather than permanent content, so the collection should
be keyed by a **stream session id** (not a fixed constant), and old sessions'
messages don't need to stay queryable forever.

Proposed shape:

```
liveComments/{id}
  sessionId: string       // set by admin when starting a stream (see §5)
  text: string (≤500 chars, shorter cap than blog/video comments — chat, not essays)
  authorUid: string
  authorName: string
  createdAt: serverTimestamp
```

Firestore rules: same shape as `blogComments` — public read, signed-in +
`authorUid == request.auth.uid` + non-empty/≤500-char text + not muted/banned to
create, no update, admin-only delete. Composite index `(sessionId ASC,
createdAt ASC)`.

`startCommentsListener()`'s existing pattern (`.limit(200)`, ascending, one-shot
`onSnapshot`) is fine as a starting point; if chat volume ever gets high enough to
matter, revisit with a tailing/windowed query — not worth over-engineering before
there's an audience.

Cleanup: since chat is disposable, a simple approach is good enough — don't
bother deleting old sessions' messages automatically at first; if storage ever
becomes a real concern, a manual "clear old sessions" admin action or a scheduled
Cloud Function can be added later. Not worth building before it's needed.

## 5. Admin: Live Settings panel

New admin sub-section, following the exact `show*()`/`go*()` pattern already used
for Blog/Suggestions/Verifications (`showAdminBlogList()`/`goAdminBlog()` etc.,
app.js ~5839/6079):

- `#adminGoLiveBtn` added to `.admin-landing-actions` on the admin landing view.
- `#adminLiveView` (new sibling div in `.admin-body`, `hidden` by default, own
  `.admin-toolbar` with a back button wired to `showAdminLiveView()` /
  `showAdminLanding()` the same way every other sub-section is).
- `goAdminLive()`: shows the view, loads the current `liveSettings` doc.

**What the panel needs to let the admin do** (the actual ask — "quick changing of
livestream links and keys"):

- Edit the **public watch embed URL** (Meshcast WHEP link) — this is what the
  viewer-facing Live Mode actually renders, so it needs to be trivially editable
  per-session without a code deploy.
- Edit a **stream title/description** (optional, shown in Live Mode's chrome).
- Toggle **`isLive`** on/off — this is the single source of truth the nav badge
  (§6) and the viewer "offline" screen (§3) both read.
- A field for the **OBS-side ingest URL + stream key**, purely as a convenience
  so the admin doesn't have to dig through Meshcast's own dashboard every time —
  **not** something the site itself ever needs to read to render anything.

**Security note — this is the one place this feature needs real care.** The
public watch URL and `isLive`/title fields must be public-readable (every visitor
loads them to render Live Mode / the offline screen / the nav badge). The ingest
URL + stream key must **never** be — that's a credential, not display data.
Firestore rules should split this into two documents (or, simplest: one document
with public fields plus a `secrets/{sessionId}` sub-document restricted to
admin-only read), so a single overly-broad rule can't accidentally expose the key
to `view-source`. This is a straightforward variant of the existing
public-read-if-published pattern used elsewhere (e.g. `blogPosts`'s
`status=="published"` gate) — just gating on "is this the admin-only half of the
doc" instead of a status field.

Proposed shape:

```
liveSettings/current            (public read; admin-only write)
  isLive: boolean
  watchEmbedUrl: string
  title: string
  sessionId: string             // regenerated each time a stream starts, ties to liveComments

liveSettings/current/private/ingest   (admin-only read+write)
  ingestUrl: string
  streamKey: string
```

## 6. "Live now" nav indicator

Modeled on the existing admin badge pattern (`updateAdminBadge()` /
`refreshAdminLandingBadges()`, app.js ~7152) rather than the site-wide
notification badge (`renderCombinedNotifyBadge()`, ~2870) — the codebase already
has a stated preference for *not* running an always-on Firestore listener for a
lightweight UI signal, and "is a stream live" is exactly that kind of boolean
state, not a live-updating count. A one-off read of `liveSettings/current`
(`isLive` field) on page load (and maybe when the hamburger/sidebar menu opens,
matching the notification badge's existing refresh points) is enough — checking
every single page load is cheap since it's one tiny doc read.

Visually: same `.profile-requests-badge`-style pill already used elsewhere,
attached to the new "Live" nav item, showing/hiding based on `isLive` rather than
a count.

## 7. Open questions / decisions still needed before building

- **Stream key rotation**: reuse one stable Meshcast key indefinitely, or
  regenerate per session? Regenerating is more secure (old links stop working
  automatically) but means updating the admin panel's ingest field every time.
  Given how infrequently this will be used, regenerating manually each time is
  probably fine and simpler than building key-rotation UX.
- **Chat moderation**: comments/blogComments both rely on the existing
  `mutedUsers`/`bannedUsers` collections for abuse handling. Live chat during an
  actual live event has much less time to react to bad actors than async
  comments — worth deciding whether the existing admin-delete-after-the-fact
  model is sufficient, or whether live chat needs a "slow mode" / rate limit
  before this ships. Lean toward: ship the simple model first, add friction only
  if it's ever actually a problem.
- **Viewer count**: nice-to-have if Meshcast's embed exposes it cheaply; not
  worth custom-building presence tracking for.
- **Mobile**: TV Mode has real mobile affordances (crop toggle works everywhere;
  Mirror/Interlace were admin debug tools and have since been removed from TV
  Mode entirely — core playback works on mobile). Live Mode's embed needs the
  same baseline — should be checked once there's something to check, not
  designed for in the abstract.
- **VOD / replay**: out of scope entirely for v1. Meshcast is a live relay, not
  storage — if past streams ever need to be watchable afterward, that's a
  separate feature (record locally in OBS, upload to YouTube/the catalog like
  any other video) rather than something this system provides natively.

## 8. Non-goals (explicitly out of scope for this doc)

- True serverless peer-to-peer distribution to every viewer (doesn't scale for
  one-to-many; see §2).
- Multi-broadcaster / guest co-hosting (Meshcast supports this via VDO.Ninja
  integration, but there's no current use case for it here).
- VOD/replay hosting (see §7).
- Any of this being built before there's an actual audience/occasion to stream
  to — this doc exists so the shape of the feature is settled *in advance*, not
  so it gets built now.
