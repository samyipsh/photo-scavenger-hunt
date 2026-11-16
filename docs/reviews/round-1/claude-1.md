## Scores

| Category | Score | Reason |
| --- | --- | --- |
| Scope fit | 6 | Every core feature was used on the day. Crop and rotate, three kinds of draft, a share-sheet saver and a dead retarget path go well past the plan. |
| Phone UX and accessibility | 8 | Text is 16 px, targets are 44 px and the dialogs are labelled Reka dialogs, but I found no sign of a real screen-reader test. |
| Reliability and tests | 7 | The upload protocol is idempotent and race-safe, but CI never runs the real R2 code or the phone's queue logic. |
| Security and privacy | 8 | It holds to its own threat model, but nothing says how long names, phone IDs and IPs are kept outside the photo bucket. |
| Performance and cost | 7 | It cost US$5 and caches well, but the group page signs links its docs say it doesn't, and the committee overview doesn't batch its reads. |
| Running it on the day | 8 | Controls covered everything that was used, but trouble on a phone only shows on a laptop running `wrangler tail`. |
| Maintainability | 6 | A station change stays in `data/`, but the engine hard-codes Singapore's time zone and 995, and one naming rule lives in six files. |
| Docs and honesty | 7 | The docs are candid and mostly accurate, with one false performance claim and an overstated "engine doesn't know about our outing". |
| AI slop | 5 | One helper is copied ten times, dead queue code is still saved and drawn in a diagram, and four screens run 870 to 1,020 lines for 30 people. |

## Evidence

**1. Scope fit**
- Every page in the plan (app-plan.md:101-108) exists and was used: 280 photos, all 25 scores, 350 likes, the freeze and closing uploads (usage-on-the-day.md:4-11).
- Several features aren't in the plan: crop and rotate (PhotoCrop.vue 267 lines, crop.ts 119, tests 157), share-sheet saving (usePhotoSave.ts 456 lines) and three draft kinds (useUploadQueue.ts:442-471).
- `retarget` (useUploadQueue.ts:431) has no caller, and architecture.md:53 admits "no screen offers it".
- Showing the Types of Christ isn't among the settings used on the day (usage-on-the-day.md:11), yet it has its own route, setting, refusal code and page.

**2. Phone UX and accessibility**
- Nothing outside `components/ui` uses text-xs, text-sm or text under 16 px, and the body is 16 px (main.css:143).
- The like button is 44 px with `aria-pressed` and a full label (Tile.vue:117-118).
- The photo viewer is a Reka Dialog with a hidden title, Previous and Next buttons for screen-reader users who can't swipe, and a live region (PhotoViewer.vue:705-729, 808).
- At 390 px the main action sits at the bottom, in thumb reach (docs/screens/judge.jpg, group.jpg).

**3. Reliability and tests**
- The phone picks each photo's UUID, and start and finish answer "saved" for an ID they already have (uploads.ts:30-34). A partial unique index stops two active copies of one file (0000_initial.sql:76), and the copy only happens if the file is unchanged (storage.ts:209). Log lines 653-654, 662 and 667 pass.
- Pass, reject and station scores refuse stale writes (committee/photos/[id].patch.ts:36-42, stations/[id].post.ts:26-36). Undo and move have no such guard (patch.ts:44-50).
- CI's API check runs against `nuxt dev`, which swaps in `devStore` (storage.ts:159). The real `r2Store` signing and copy code only gets checked by a manual staging run.
- Only the queue's pure rules have tests (uploadRules.test.ts, 6 tests). `step()` and `run()` have none.

**4. Security and privacy**
- Committee sign-in locks an IP out after 8 misses in 15 minutes and compares in constant time (login.post.ts:5-8, 26). The session lasts a day (nuxt.config.ts:43). `NUXT_APP_SECRET` is the right variable for nuxt-auth-utils 0.6.0: I checked that library's module.mjs:79.
- Upload links sign the type and size and only point at `u/` (storage.ts:183-200). `/img` and dev-upload are shut in built apps (storage.ts:123, dev-upload put.ts:5).
- The canvas re-encode drops GPS data (image.ts:81-93).
- The origin check lets through any request with no Origin header (origin.ts:8). D1 keeps uploader names and phone IDs and the logs keep IPs, but the after-outing plan only covers photos (app-plan.md:179-181).

**5. Performance and cost**
- A cached scoreboard costs one query and a rebuild costs one batch, with the save made after the answer goes out (scoreboard.ts:16-30, 61-86). This fixes the 2.4 s loads seen on the day (README.md:56).
- The group page signs album links as well as thumbnails (g/[token]/index.get.ts:60), and every phone polls that page.
- The committee overview makes 13 separate queries plus an uncached scoreboard rebuild (overview.get.ts:8-23). Each committee phone asks every 20 s (c/scores.vue:21).
- The Inter font loads from Google Fonts (main.css:2), an extra blocking request on 4G.

**6. Running it on the day**
- Controls covers closing uploads, the freeze, round times, how photo times read and blocked phones. All but blocking show up in the day's usage notes.
- Every refusal logs its code, message, route and group (refusal-log.ts). watch-live.ts prints a summary each minute.
- Failures on a participant's phone reach nobody on a committee phone. The docs say "there's no automatic alert" (architecture.md:104), and watch-live needs a laptop (watch-live.ts:1-7).
- The only way to block a phone is to mark one of its photos inappropriate (patch.ts:79).

**7. Maintainability**
- I traced adding a station. It touches data/event.ts (stations, SLOT_COUNT, ROUND_COUNT, HELP_CONTACTS), the prose at data/guide.ts:20 ("six rounds of 20 minutes", which no test checks), and a reseed. The engine doesn't change. Good.
- Replacing a station in a database that already has one fails. The seed upserts by id (seed.ts:46), the slot column is unique (migration:106), and nothing removes old stations.
- UTC+8 is hard-coded in rotation.ts:9 and :83, photoTime.ts:16, storage.ts:117, shared/utils/demo.ts:20 and useClock.ts:11. The 995 emergency number is hard-coded in help.vue:63. The reuse skill says the engine "shouldn't need changes" (SKILL.md:31) and never mentions time zones.

**8. Docs and honesty**

I checked these claims:
1. The group page "only gets thumbnail links" (architecture.md:31, caching.md:104). **False**: index.get.ts:60 signs the album link too.
2. "The engine doesn't know about our outing" (README.md:52). **Overstated**: see the time zone and 995 above.
3. About 16,000 lines, 1,800 of them server (README.md:20). I count about 17,200, with 2,155 in the server.
4. Changes "must come from the app's own address" (app-plan.md:118). **Overstated**: origin.ts:8 lets requests without an Origin header through.
5. 116 unit tests. True (log line 10).
6. A unique index on active hashes. True (migration:76).
7. Indexes by group and by checked time. True (migration:72-73).
8. A 30 s stall before an upload gives up. True (useUploadQueue.ts:84).
9. The Types of Christ answers never ship to phones. True, and a test checks it (data.test.ts:96-101).

Also, how-it-was-built.md:147-152 is unfinished notes with typos, and the sequence diagram still draws the dead retarget step (architecture.md:92-94).

**9. AI slop**
- `const cap =` is defined 10 times across pages and components.
- The rule for what a photo is called is written 6 times. Two copies skip `normaliseLabel` (g/[token].vue:61, PhotoReview.vue:46), so the same photo can get different names on the group page and in the gallery.
- The dead retarget code is still saved to IndexedDB (useUploadQueue.ts:184-187 and 262-277, queueStore.ts:19).
- gallery.vue is 1,021 lines, PhotoViewer.vue 936, judge.vue 889 and g/[token].vue 867. how-it-was-built.md:118 records the unattended review loop that doubled the code. I spot-checked 20 exports and all were in use.

## Biggest problems

1. **Singapore is baked into the engine.** Round times, countdowns, "provisional", photo times and link periods all assume UTC+8, and Help dials 995. Someone running it in London gets every time 8 hours off and the wrong emergency number. Fix: put the time zone, UTC offset and emergency number in data/event.ts, use them in those six files, and add a line to the reuse skill.
2. **CI misses the two riskiest pieces of code.** It never runs `r2Store`, and nothing tests the queue's step and run logic. Fix: run `check:api` in CI against `wrangler dev` with local S3 (architecture.md:233 already explains how), and add a vitest for `step()` with a fake fetch and XHR.
3. **The photo-naming rule is copied six times, and the copies disagree.** Fix: one shared helper for the name, and one `cap()`, in app/utils.
4. **A false doc claim about group-page signing.** Fix: drop `largeUrl` from that answer, or correct both docs.
5. **Dead retarget code in the upload queue**, the app's most important file, still documented and drawn in the diagram. Fix: delete it, its stored field and the diagram's `opt` block.

## Low-hanging fruit

1. data/event.ts and the six engine files: a time zone constant (Maintainability).
2. help.vue:63: read the emergency number from data/event.ts, and add it to the reuse skill's "Ask the organiser first" list (Maintainability).
3. app/utils: one photo-name helper to replace the six copies (AI slop).
4. useUploadQueue.ts, queueStore.ts and architecture.md: remove retarget (AI slop, Docs).
5. g/[token]/index.get.ts:60, or the two docs: make the code and docs agree (Performance, Docs).
6. overview.get.ts: send the reads as one `db.batch` (Performance).
7. scripts/seed.ts: before the upsert, delete stations that are no longer in `data/` and have no scores (Maintainability).
8. how-it-was-built.md:147-152: finish the notes or cut them (Docs).

## What you couldn't check

- Real phones, VoiceOver or TalkBack, or contrast in sunlight. I only had the screenshots.
- The live demo. I didn't open it.
- How real R2 behaves: whether it enforces the signed size, and the copy-if-unchanged check. The log only exercises the dev stand-in.
- Cloudflare settings: the billing alert, the bucket's CORS and lifecycle rules, log retention, and whether the logs keep cookies.
- The load test, the token and time figures in how-it-was-built.md, and about 6,000 lines of screen code I didn't read.
- I only read files and ran searches. The test results come from the log you supplied.
