# Vote Retirement / Hall of Fame — Plan & Status

Local-only planning doc, not committed to git (matches VOTING_FEATURE_EXPLAINER.md's precedent). Purpose: don't lose track of what's built, what's dormant, and what "turning it on" actually requires.

## Why

Inspired by how MTV's TRL (and VH1's Top 20 Video Countdown, BET's 106 & Park) kept their weekly/daily top-video charts from going stale: a video that camps at the top long enough gets **permanently retired** from active competition and enshrined in a **Hall of Fame** instead of just sitting at #1 forever. TRL's own threshold shrank over the years (65 days → 50 → 40) as it turned out even 65 days of pure fan-vote domination was too stagnant for a daily show.

Applied here: Viewer's Choice has only 5 slots (vs. TRL's 10), so the threshold should probably be *shorter* than TRL's, not longer — but the real number should come from watching actual traffic, not a guess. That's exactly why this ships dormant.

## Current status: BUILT, DORMANT

Everything below exists in the codebase (commit history has the details) but **changes nothing a visitor sees**. Confirmed dormant two ways:

1. `checkVoteRetirements` is an `onCall` Function, not `onSchedule` — nothing runs automatically. It only fires when an admin clicks **"Run retirement check now"** in the admin Vote Rounds view.
2. Even when manually run, nothing on the live site reads or filters on the fields it writes (`retired`, `daysInTop`) yet — Viewer's Choice and the Vote modal's leaderboard still query `videoVotes` exactly as before, no `retired` filter. So a manual test run is 100% safe to try.

### What's built

**Backend** (`functions/index.js`):
- `RETIREMENT_TOP_N = 5`, `RETIREMENT_DAYS = 14` — both easy to retune later, mirrored for display in `app.js`'s `ADMIN_RETIREMENT_TOP_N`/`ADMIN_RETIREMENT_DAYS` (keep those two places in sync if changed).
- `checkVoteRetirements` (admin-only onCall) — fetches the current top `RETIREMENT_TOP_N * 5` videos by count, filters out already-retired ones in memory (deliberately not a Firestore `where("retired","==",false)` clause — every existing `videoVotes` doc predates this feature and has no `retired` field at all, and Firestore equality filters silently exclude docs missing the field, so that query would've matched nothing), takes the top `RETIREMENT_TOP_N` non-retired ones, and increments each one's `daysInTop`. Anything crossing `RETIREMENT_DAYS` gets `retired: true` + a snapshot written to `voteHallOfFame/{rowNum}` (artist/song/thumb/finalCount/topVoter/retiredAt).
- `unretireVideo` (admin-only onCall) — correction tool: `retired: false`, `daysInTop: 0`, deletes the Hall of Fame entry. Doesn't touch count/topVoter, which retirement never alters (it freezes/snapshots, not erases — unlike `resetVideoVotes`, which is destructive by design for moderation).
- Cumulative, not consecutive: a video that drops out of the top N and re-enters later just resumes accumulating `daysInTop` where it left off (matches TRL's own "cumulative days" rule, not "consecutive days").

**Rules** (`firestore.rules`):
- `voteHallOfFame/{rowNum}`: world-readable, Function-only write (Admin SDK bypass, same pattern as `videoVotes`/`flaggedUsernames`).

**Admin UI** (Vote Rounds view):
- "Retirement / Hall of Fame" section, labeled **Dormant**.
- "Run retirement check now" button → calls `checkVoteRetirements`, shows a result summary (checked count, newly-retired count).
- Live Hall of Fame list (currently always empty in practice, since the Function has never auto-run against real traffic) with an "Un-retire" button per entry.

## Activation checklist (when ready to go live)

None of this is done yet — this is the actual "turn it on" work, deliberately deferred:

1. **Pick real numbers.** Watch how Viewer's Choice churns over a few weeks of real traffic before trusting `RETIREMENT_TOP_N`/`RETIREMENT_DAYS`. TRL revised its own threshold downward multiple times after launch — expect to do the same here at least once.
2. **Switch `checkVoteRetirements` to `onSchedule`** (Cloud Scheduler, e.g. once daily) instead of admin-triggered `onCall` — or keep both: an `onSchedule` function that does the real daily work, calling the same shared logic the `onCall` wraps for manual testing/admin override.
3. **Add the live query filters**: Viewer's Choice (`startViewersChoice()`) and the Vote modal's leaderboard (`openVoteModal()`) both need to start excluding retired videos. Since `retired` won't be `false` on every doc even after step 2 starts running (only docs that actually enter the top N get touched), the safest filter is the same in-memory approach `checkVoteRetirements` uses (fetch a bit more than needed, filter out `retired` client-side) rather than a Firestore `where("retired","==",false)` — same missing-field gotcha applies to a live query as it did server-side.
4. **Build the public Hall of Fame section** — a new homepage section (or its own page) rendering from `voteHallOfFame`, same card treatment as Viewer's Choice/Maui's Picks. Decide whether retired videos keep their Vote button active (no reason not to, unlike TRL's off-air segments — voting for a retired video just never lets it re-enter Viewer's Choice).
5. **Re-test the whole pipeline** with the schedule live before removing the admin manual-trigger button (or just leave the manual button in as a permanent admin override/testing tool — cheap to keep).

## Open questions for later

- Should `RETIREMENT_TOP_N` for the retirement check match the 5 slots Viewer's Choice actually shows, or should it watch a wider band (e.g. top 10) so a video can't just hover at #6 forever untouched? Current implementation watches exactly the top 5 shown.
- Should Hall of Fame entries be able to accumulate multiple "eras" (re-retire after an un-retire and a fresh climb back to the top)? Current `unretireVideo` resets `daysInTop` to 0, so this already works naturally if it comes up — no extra design needed.
