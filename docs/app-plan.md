# App plan

Revised 3 Nov after two rounds of independent review by Codex and Opus. Both gave "greenlight with changes" each round, and every change they asked for is folded in below. This file is how to build it, and why.

## Goal

Maintainability comes first, then cost. Learning object storage is a bonus. In practice that means as few accounts and moving parts as possible, nothing to patch, no surprise bills, and something another organiser can pick up next year.

Poor UX is not an option. The app counts as done only when independent reviewers approve its UX from phone screenshots and written walkthroughs of each flow. See [UX acceptance gate](#ux-acceptance-gate).

## Stack

**Everything on one Cloudflare account.** Nuxt 4 as a single-page app, served by a Cloudflare Worker. Data in D1, Cloudflare's SQLite database, through Drizzle. Photos in R2, Cloudflare's object storage. UI built with shadcn-vue on Tailwind.

| Option | Accounts and parts | Cost | Maintenance |
| --- | --- | --- | --- |
| Cloudflare: Workers, D1, R2 | One account, one config file, one deploy command | Expected US$0, or US$5 for one month of Workers Paid as insurance | Nothing to patch. Wrangler runs the database and bucket on the laptop for development, so no cloud setup is needed to build it |
| Cloud Run, Turso, Google Cloud Storage | Three: a Google Cloud project, Turso and a bucket. Plus service accounts, IAM roles and bucket CORS | Free tiers, plus cents for a Singapore bucket | Most setup, and the most places for something to break or expire |
| A small VPS with SQLite and photos on disk | One server | About US$4 to 6 a month while it runs | You patch the server, renew TLS and back up the photos yourself |
| Supabase for data and storage, plus a host | Two accounts | Free | Free projects pause after a week idle, and storage is 1 GB |

### Why a platform is fine here, and not by default

Cloudflare is acceptable only because this is a small, mostly throwaway app for one morning. In today's terms, maintainability mostly means how well coding agents and LLMs can work on a codebase: read it, run it, test it and change it from a terminal. Heavy platform abstractions like Cloudflare's or Vercel's work against that. Behaviour hides in platform config, dashboards and runtime quirks that an agent can't see or reproduce locally, and the code bends around one vendor's bindings. Plain programmable pieces that we wire together ourselves, such as a Node server, SQLite or Postgres, and an S3-compatible bucket, give more freedom, are easier for an agent to reason about end to end, and move between hosts. For anything longer-lived, prefer that.

To keep this app from getting locked in:

- Cloudflare-specific code lives in a few small files: the bindings and database connection (`platform.ts`), photo storage (`storage.ts`, `viewLinks.ts`), and the visitor's IP on the committee sign-in. Everything else is ordinary Nuxt, Drizzle and SQL.
- The scoring and rotation rules are plain functions with unit tests that run without Cloudflare.
- Moving to a Node server with SQLite and an S3-compatible bucket would mean replacing those files and the deploy config.

Both reviewers agreed with Cloudflare. Firebase was also considered, but its Storage needs the paid Blaze plan. NuxtHub wraps D1 and R2 for Nuxt, but it saves only a few lines and its direction changed in 2025, so the app talks to the bindings directly.

### Limits and cost

Checked by both reviewers against Cloudflare's docs:

- Workers Free: 100,000 requests a day, 10 ms of CPU per request, 100 MB request bodies. Waiting on the database or bucket doesn't count as CPU. Requests for the app's own files are free and don't count, and page loads of the single-page app don't run the Worker at all ([limits](https://developers.cloudflare.com/workers/platform/limits/), [pricing](https://developers.cloudflare.com/workers/platform/pricing/), [SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)). Over the limit, requests fail until midnight UTC, which is 8 am in Singapore.
- D1 Free: 5 million rows read and 100,000 written a day. It counts rows scanned, not rows returned. Over the limit, queries fail ([D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)).
- R2: 10 GB, 1 million writes and 10 million reads a month free, with free downloads. Unlike Workers and D1, R2 bills past its free allowance instead of stopping. At about 1 GB that's still US$0 ([R2 pricing](https://developers.cloudflare.com/r2/pricing/)). Creating the first bucket goes through a checkout step, which may ask for a payment method.

Realistic worst case for the morning, from both reviews: 50 phones refreshing the scoreboard, everyone scrolling a 600 to 1,000 photo gallery, group pages refreshing and two upload requests per photo comes to roughly 60,000 to 90,000 Worker requests. That's too close to 100,000.

So:

- **Workers Paid was on for the event month (US$5, set not to renew).** It removes the daily request cap and the 10 ms CPU limit, and raises D1 to billions of reads. Measured on 4 Nov: a fresh Worker instance takes 30–60 ms of CPU per API request (Nuxt and Drizzle starting up), warm ones 3–10 ms, so the free plan's 10 ms limit only held thanks to Cloudflare's unstated leeway.
- The app is built to fit the free plan anyway. The scoreboard is stored in one database row and rebuilt once it's 10 seconds old, when someone asks for it (a few requests at the same moment may each rebuild it). Each refresh from a phone reads that one row, so 50 phones cost 50 rows, not 50 full calculations. Refreshing stops while a tab is hidden. The gallery loads thumbnails only as they scroll into view. Its list of photos is one answer for everyone, checked every 30 seconds with an ETag; on the free plan it would need the scoreboard's one-row cache too, since each check reads every photo row (`docs/caching.md`). Photos load straight from R2, not through the Worker, and each photo's link stays the same for a day, so phones cache it.
- Indexes on the photos table by group and by checked time, so group pages and the judge queue don't scan every photo.
- The load test (run by Codex, its scripts kept out of the repo) runs 50 simulated phones polling and uploading at once on staging, and logs requests, CPU time and D1 rows read.
- Spending guards: at most 400 photos per group (200 without a challenge), and a Cloudflare billing notification on R2 usage.

## How an upload works

The reviews found the first version could double-count photos on retries and leave half-finished uploads. This version can't.

1. The phone shrinks the photo: a 2048-pixel JPEG for the album, re-encoded at lower quality if it's over 3 MB, and a 400-pixel thumbnail. Re-encoding drops GPS data, which is good for privacy. The file picker asks for `image/*` and never lists HEIC, so iPhones convert to JPEG. If the phone still can't decode a photo, the app says so plainly and offers the camera instead. The page shows a preview and progress for each photo.
2. The phone gives the photo a random ID at that moment. The ID travels with every retry.
3. The phone asks the app to start. The app runs every check (uploads open, phone not blocked, challenge, duplicate) before any bytes move, then hands back two signed upload links, valid for 15 minutes, for the thumbnail and the album copy. The links fix the size and type, so R2 refuses anything else.
4. The phone sends both files straight to R2, then asks the app to finish. The app checks again, adds the group limits, checks what arrived (size and JPEG signature), copies it inside R2 to its lasting key, and creates the photo record. If the record already exists, nothing happens, so a retry can never create a second photo.
5. The phone uploads one photo at a time. A file is abandoned only after 30 seconds without progress, so a slow but steady signal gets through. It retries after a growing, slightly random delay, and straight away when the signal comes back or the page is reopened. Each try asks for fresh links. The page shows what's waiting, like "3 photos waiting, keep this page open".

Photo bytes never pass through the Worker, so its 128 MB memory, shared by every request in the same instance, isn't at risk with 40 or more uploads at once. The album copy is still capped at 3 MB and most are under 1 MB. Files that were sent but never finished sit under `u/` in the bucket, and a lifecycle rule deletes them after a day. `docs/architecture.md` has the full flow and why.

The bucket stays private. Phones load photos straight from R2 with signed view links that last a day or two, so a leaked link stops working and a deleted photo stops loading. Pages send `noindex`, so search engines skip the gallery.

The storage code is `server/utils/storage.ts` (signed upload and view links, checking an upload, keeping it, deleting it) with the view-link signer in `server/utils/viewLinks.ts`. Moving to S3 or Google Cloud Storage later means changing those file and the endpoint settings.

## Scoring rules

Both reviewers found the ranking rules ambiguous enough to change the winner. These are the proposed rules. The committee confirms them on Sun 8 Nov, and the tests are written from them.

- **Rank points.** With N groups, the best score at a station gets N places' worth and the worst gets 1, times a multiplier so the totals feel bigger. The organiser chose the bigger numbers on 3 Nov. On 12 Nov the outing went from six groups to five, and the organiser raised the multiplier from 50 to 60 so first still gets 300: 300 down to 60. The multiplier is `RANK_SCALE` in `data/event.ts`.
- **Ties** share the points of the places they take up. With five groups, two groups tied for first get 270 each.
- **Every station counts upward.** Each station has a "lower wins" switch in case a game ever needs it.
- **Zero is a score.** A blank isn't. On the live board, a station is ranked only among the groups that have played it, on the full scale, and the board says "provisional" until the last round ends. After round 1, each scored station has one score, so its group shows top points there for now. The committee confirms this on Sun 8 Nov.
- **Missed station.** The committee marks it as missed. The group then gets its own average rank points from the stations it did play. If it missed every station, it gets the middle of the scale.
- **Photo quest.** Each challenge scores once per group, however many photos pass, so four swans are still 20 points. Its real photo points go into the total as they are, not as a rank, so every photo a group sends shows in its total and anyone can see what each group found (the organiser's call, 5 Nov; the committee confirms it on Sun 8 Nov). Stations stay ranked, because each game scores on its own scale; `RANK_SCALE` sets how much they weigh against the photo points.
- **Photo points** are tiered by difficulty: 10 for station photos, 20 for easy finds, 30 for harder finds and group shots, 50 for the hornbill and every drama shot.
- **Awards** show their own leaderboards. The leader of each race gets a prize, counted in its photo points: Animals spotted 300, Flower colours 200, Most photos 100, Most liked photo 100 (`AWARD_BONUS` in `data/event.ts`). Tied leaders each get it.
- **Most liked photo** goes to the group whose single best photo has the most likes. Anyone can like any photo once per phone, their own group's included, so it works like a vote.
  - Removed after the outing (16 Nov 2026). Most people didn't know they could like photos. That was deliberate, since nobody should doomscroll during the walk, but it meant the award measured who found the heart, not the best photo. Next time the committee will invite everyone, after the event, to like their favourites so the best float to the top. Likes and the gallery's Most liked sort stay, and the other three races keep their prizes.
- **Most photos** counts every upload except ones the judge removes as duplicates. A photo rejected for its challenge still counts, because it's still a memory.
- **Overall winner.** The highest total wins. A tie goes to more photo points. If that's tied too, they share the place.

## Data

D1 tables, through Drizzle, each with a stable text ID so re-seeding never breaks anything:

- **groups**: number, name, link token, rotation start. Tokens are created once and never regenerated, because they're in the links we send out.
- **stations**: name, map pin, slot in the six-slot rotation, scored or not, and "lower wins". The photo walk is the unscored slot. Backup shelters and other pins in the planning notes are map points only, never stations.
- **challenges**: stable slug, type, title, flavour line, points, who must be in shot, award kind, order. The seed updates by slug, so editing the list on Sun 8 Nov keeps existing photos attached.
- **photos**: client ID, group, challenge or none, award label, file keys, size, verdict (pending, passed or rejected), reject reason, checked time, removed flag, files-deleted time, likes and upload time. No location: re-encoding strips it, and the phone never sends one.
- **station_scores**: group, station, raw score or missed, time saved. Saving overwrites. The form saves only the groups the IC changed. Each save says which version it's replacing, so if someone else changed that score in the meantime, the save stops and shows "Someone changed this at 11:02, check before saving".
- **settings**: round start times, uploads open or closed, and the frozen scoreboard.

Award labels: flower colour is a fixed picker of the nine colours. Animal names are free text, and the judge merges spellings like "swan" and "black swan". Following the outing rule, one photo counts for one challenge only, so an award entry is its own upload.

Points and ranks are worked out from live data, so a corrected score or a rejected photo changes the totals straight away. When the committee freezes the board, the app saves a copy of the public scoreboard at that moment and shows it publicly, while committee pages stay live.

## Pages

- `/g/[token]`: the group page. Now and next station with a countdown and map link, points and photo count, the challenge checklist, uploads and the waiting list.
- `/scoreboard`: public. Refreshes every 15 seconds while visible. Shows the saved copy once frozen.
- `/gallery`: filter by group and by challenge, newest first or most liked first (the organiser's call, 11 Nov: newest by default, so new photos are easy to find and paging can't skip photos as likes change); one group's photos are laid out by challenge. Photos open full screen and swipe.
- `/c`: committee passphrase, which sets a signed session cookie.
- `/c/judge`: unchecked photos oldest first, filterable by group so two judges can split the queue, one at a time or as a grid by challenge with "Mark N checked" for the rest. Pass, reject with a reason, change the challenge, remove duplicates. If two judges act on the same photo, the second one sees it was already checked. `/c/animals` merges animal names.
- `/c/station/[slug]`: one station's scores in visiting order: every group whose score is due is marked and the oldest focused, the group playing now is open, scored groups fold to one line and later ones show their time. Unsaved scores survive reloads and bad signal, retrying from any page.
- `/c/scores` ("Manage"): tabs for Scores (every score in one grid for checking against the paper sheets, standings, CSV), Controls (round times with a preview before moving them, the uploads and public-scoreboard switches, how photo times read, blocked phones) and Groups (links and group ICs).
- `/help`: the phone's group IC, where to go, 995, and the committee with their stations.

## Rotation

Six slots in a loop: Codenames, The Mind, Charades, Picture riddles, Poetry, then the unscored photo walk. Group 1 starts at slot 1, group 2 at slot 2 and so on, matching the table in the Participant guide. Each group moves one slot every 20 minutes, from rounds starting at 9:45, 10:05, 10:25, 10:45, 11:05 and 11:25. The group page works out "now" and "next" from the clock and the group's start slot. The map pins were checked on a walk-through the week before.

## Security, proportionate to one morning

- Each group link carries a long random token, and every group request is checked against it. The tokens aren't secret from participants: the home page lists every group so people can pick theirs (no QR codes). Anyone with the app link could upload to any group. That's accepted for a friendly one-morning event; the committee can block a phone.
- The committee uses a long passphrase, not a short code, because nothing else limits guesses. Failed attempts are slowed down. The session cookie is signed, HttpOnly, Secure and SameSite=Lax.
- Requests that change anything must come from the app's own address.
- Each group can upload at most 400 photos, and the committee can close uploads.
- Every upload names its phone with a random ID kept in the browser, and an upload without one is refused, so a blocked phone can't slip through by leaving it out. Clearing the browser's storage gives a new ID, which is accepted at this scale.

## UI

shadcn-vue components on Tailwind, through the shadcn-nuxt module. The components are copied into the repo, but they still import Reka UI, class-variance-authority, `cn` (for joining classes) and Lucide icons, so those versions are pinned. The copied Button and Input are raised to at least 44 px tall with 16 px text, and score fields use the decimal keypad.

Designed for one-handed use outdoors in bright sun: light theme, strong contrast, text at least 16 px, tap targets at least 44 px, the main action within thumb reach, and nothing that depends on hover. Each screen has one obvious next action.

## UX acceptance gate

**Passed on 3 Nov, in round 6.** Two fresh Opus reviewers and one Codex reviewer approved all five flows with no blocker or should-fix issues. The cap of three rounds was lifted because the deadline allowed it and the organiser's rule is approval. The final screenshots aren't in the public copy, because they show real names. Re-run the gate after any change to a flow (the `hillclimb-ui` skill).


The app is done only when this passes.

1. For each flow below, capture phone screenshots at 390 by 844, an iPhone, and 360 by 800, a common Android size. A Playwright script captures them from seeded data, so each round takes minutes. Include the empty, loading, error and offline states, not only the happy path.
2. Write a short walkthrough for each flow: who uses it, what they're trying to do, each step, and what they see.
3. Send both to at least two fresh Opus reviewers and one Codex reviewer. They haven't seen the build discussion, and they get the screenshots and walkthroughs, not my opinion of them.
4. Each reviewer rates every flow and lists issues by severity. The gate passes when every reviewer approves with no blocker or should-fix UX issues left.
5. Fix, re-capture and re-review, for at most three rounds, closing on Tue 10 Nov evening. Fresh reviewers tend to find something new each round, so the gate needs an end. Any should-fix issue still open then goes to the organiser to accept or fix. Any blocker still open goes to the Wed 11 Nov go/no-go. Then send the organiser the screenshots and the reviews.
6. A real-phone check during the Wed 11 Nov go/no-go confirms it on actual devices.

The flows:

- **Group, first visit:** open the link, pick the group, understand what to do now and where to go next.
- **Group, challenge photo:** pick a challenge, take or choose a photo, see it upload and count, see a rejection and its reason.
- **Group, award and memory photos:** log an animal or a flower colour, and upload a "just a photo".
- **Group, bad signal:** an upload waiting, retrying and finishing.
- **Station IC:** open the station link, enter the passphrase once, enter scores, correct one, mark a group missed.
- **Judge:** work through the queue, reject with a reason, change a challenge, merge labels, remove a duplicate.
- **Committee lead:** the 11:45 check of the score grid against the paper sheets, the CSV export, closing uploads and freezing the board.
- **Everyone:** the scoreboard, live and frozen, and the gallery with filters.

States to include across the flows: uploads closed, a group at its 400-photo cap, a wrong or broken group link, before 9:45, and after the last round.

## Development and tests

- Wrangler runs D1 and R2 on the laptop, so the full app works locally with no account.
- Unit tests for the scoring rules above: ties, a missed station, a group that missed everything, five groups instead of six, zero versus blank, and once-per-group challenges.
- A load test of 50 simulated phones polling and uploading at once on staging. It logs Worker requests, CPU time and D1 rows read.
- Recovery checks for uploads in `scripts/api-check.ts`: a retry after a lost response, finishing before the files arrive, and simultaneous finishes for one photo.
- Real-phone tests on Sat 7 and Wed 11 Nov: camera and gallery photos on an iPhone and an Android, an iPhone HEIC library photo, a portrait photo, a large original, checking the uploaded copy has no GPS data, a lost connection mid-upload, and locking and unlocking the phone.

## Timeline to the go/no-go

| When | Who | What |
| --- | --- | --- |
| Tue 3 to Thu 5 Nov | Claude | Build locally: scaffold, schema and seed, uploads, judging, station scores, scoreboard, gallery, rotation. First UX review round |
| By Thu 5 Nov | Organiser, about 30 minutes | Free Cloudflare account, the R2 checkout step, `wrangler login`, the committee passphrase as a secret, and the Workers Paid decision |
| Thu 5 to Fri 6 Nov | Claude | Deploy, create the database and seed it, and prove uploads through to judging and scores through to the scoreboard on the live app. Give the walk-through lead a test group link |
| Sat 7 Nov | A committee member | Test-upload at every station during the walk-through. It's the only real signal test before the go/no-go |
| Sun 8 Nov | Committee | Confirm the scoring rules, the challenge list and awards |
| Sun 8 to Tue 10 Nov | Claude, organiser | Seed the final challenge list, load test, UX gate until it passes, the paper score sheet PDF |
| Wed 11 Nov | Committee | Two separate go/no-gos, photos and station scores. One iPhone and one Android upload on mobile data, and one station IC enters scores |

If the work runs behind, the first cuts are the last-seen pin and uploads that survive closing the browser. The countdown, gallery filters and scoreboard freeze are requirements, so cutting them needs the organiser's OK first. Never cut uploads, judging, station scores, the scoreboard or the UX gate.

## After the outing

- The organiser owns the photo export, by Sun 22 Nov: download every album copy as a zip built in the browser, or with rclone against R2, check the album, then make the shared Google Photos album.
- The bucket's lifecycle rule deletes photos 120 days after upload, in mid-March 2027. Extend it if the export isn't checked by then.
- Workers Paid was set not to renew, and the R2 API tokens were made with an expiry date: make new ones for the next event.

## What only the organiser could do

1. By Thu 5 Nov, at the laptop: a free Cloudflare account, the R2 checkout step and `wrangler login`. Signing up, signing in and adding a payment method are things only the organiser can do.
2. Workers Paid: on for one month (decided 4 Nov).
3. The committee passphrase, typed in by the organiser as a Worker secret.
4. Optional: a custom domain. The free `workers.dev` address works fine in a WhatsApp link.

## Defaults I've assumed

- The album copy is 2048 pixels, not the original file, so uploads stay quick on mobile data. People still have their originals on their phones.
- Photos count as soon as they upload. Judges only reject.
- No accounts and no change history. One committee passphrase.
- Photos load with signed view links that last a day or two. Anyone holding a current link can see the photo, the same as the gallery; adding sign-in later means only signed-in people get links.
