# MVG Library — Video Voting Feature (Explainer for Writers)

## What it is, in one sentence

Any signed-in visitor can vote for their favorite video in the catalog — as many times as they want, for as many different videos as they want — and the site surfaces a live "Viewer's Choice" top-5 leaderboard on the homepage, plus weekly recap graphics for social media.

## Where visitors encounter it

- **"Vote" button** — opens a search modal where a visitor searches the catalog and clicks Vote next to any result.
- **One-click Vote button inside a video's own lightbox** — vote for whatever you're already watching without leaving it.
- **Homepage "Viewer's Choice" section** — a live top-5 leaderboard: biggest thumbnail and rank badge for #1, shrinking progressively down to #5, with #1's title highlighted in yellow. Each card shows vote count and (when available) who cast the top vote and who voted most recently.

## The voting model — open and repeatable

This went through two earlier designs before launch:
1. Admin hand-picks 5 videos each round, people vote among those.
2. One vote total, ever, per person.

Both were scrapped in favor of the current model: **any catalog video is eligible, and the same person can vote for the same video more than once.** This mirrors the site's original "vote by giving a dollar" concept, where someone contributing more later just means more votes for their pick. Voting is currently free — no payment is wired up yet, just a Firestore write — but the repeatable-vote design leaves room to attach a payment step to each vote later without changing the underlying model.

## Opt-in name display

By default, votes are anonymous — they count toward the tally but no name is attached. In **Settings**, a visitor can turn on "Show my name on videos I vote for." Once on, every vote after that point carries their username (or Google display name / email as a fallback) and can appear on the leaderboard as:
- **Top voter** — whoever has cast the most votes for that specific video.
- **Latest vote** — whoever voted for it most recently.

Turning the setting off only affects future votes; it doesn't retroactively hide a name already attached to a past vote.

## Usernames

Tied into this release: visitors can now set a **username** (prompted on first sign-in, editable anytime in Settings) instead of only showing their Google name. Usernames are unique (case-insensitive — "Maui" and "MAUI" collide), capped at 30 characters (Instagram's limit), and run through an offensive-word filter plus an admin-reserved-names list, both enforced server-side.

## How it works technically (for context, not for the post)

- Every click writes a new, permanent `voteEvents` record — votes are never edited or deleted client-side.
- A Cloud Function watches that stream and rolls it up into `videoVotes` (the public per-video totals used for the leaderboard) and a per-voter tally used to determine "top voter."
- All of the tally math happens server-side in a transaction, so simultaneous votes on the same video can't produce a wrong count.

## Weekly recap graphics (admin tool, not visitor-facing)

Behind the scenes, there's now an admin tool to generate a "Top 5 This Week" social graphic straight from the live vote data: progressively sized thumbnails (#1 biggest), #1's title in yellow with the top voter's name, small MVG logo watermark in the corner, and a "Vote! Visit themusicvideoguy.com (link in bio!)" call-to-action footer — meant to be posted to drive people back to the site to vote.

## Suggested angles for the post

- "Vote for your favorite video, as many times as you want" — the repeatability is the most novel/shareable part of the mechanic.
- The live homepage leaderboard as a way to see the community's taste in real time.
- Optional name recognition — vote anonymously, or opt in and get credited as "Top voter" or "Latest vote" on a video you love.
- Usernames as a companion feature — a real identity on the site beyond your Google name.
