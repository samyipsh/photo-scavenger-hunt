## Scores

| Category | Score | Reason |
|---|---:|---|
| Scope fit | 8 | The core flows were used, although the game encouraged more competition than conversation (`usage-on-the-day.md:3`; `docs/how-it-was-built.md:145`). |
| Phone UX and accessibility | 7 | The supplied layouts are legible and controls are generally large, but cropping requires pointer input (`app/components/PhotoCrop.vue:247`). |
| Reliability and tests | 7 | Upload retries and score conflicts have meaningful checks, but judging lacks protection against changed challenges (`committee/photos/[id].patch.ts:36`). |
| Security and privacy | 7 | The trust model fits the outing, but the claim route bypasses the stated sender-only editing rule (`claim.post.ts:20`). |
| Performance and cost | 8 | Direct photo transfers and cached scores suit this size; gallery revalidation still reads the whole list (`server/api/gallery/index.get.ts:18`). |
| Running it on the day | 7 | Controls and monitoring are useful, but failed file deletion can disappear from recovery screens (`hidden.get.ts:15`). |
| Maintainability | 7 | Ordinary event changes stay mostly in data files, but reseeding and hardcoded locale assumptions complicate reuse (`scripts/seed.ts:45`). |
| Docs and honesty | 8 | Disclosure is unusually candid, but sender-only editing and complete event isolation are overstated (`docs/how-it-was-built.md:23`; `README.md:52`). |
| AI slop | 7 | Most substantial code serves real behavior, but duplicated matching and abandoned upload-retargeting remain (`PhotoViewer.vue:101`; `useUploadQueue.ts:431`). |

## Evidence

Paths below are relative to the repository; the supplied logs are under `../evidence/`.

**1. Scope fit**

- `docs/app-plan.md:101` specifies group uploads, judging, station scores, gallery and scoreboard; the corresponding pages exist. `../evidence/usage-on-the-day.md:3` records 21 uploading phones, 280 photos and all 25 station scores.
- `docs/how-it-was-built.md:145` explicitly reports less conversation and excessive competition after photography started. That is a real scope tradeoff; another layer of interface polish would not resolve it.

**2. Phone UX and accessibility**

- Inspected all 18 supplied screenshots, including challenge sheets and committee screens. `app/components/ui/button/index.ts:19` establishes 44 px default controls; `app/components/gallery/Tile.vue:118` supplies meaningful heart labels and pressed state.
- `app/components/PhotoViewer.vue:726` provides screen-reader Previous/Next buttons; `app/composables/useBackClose.ts:29` implements Back handling. However, crop handles are unfocusable `<div>` elements with only pointer handlers at [PhotoCrop.vue:247](<app/components/PhotoCrop.vue:247>).

**3. Reliability and tests**

- `check-all.log:9` confirms 116 passing tests; lines 653, 662, 667 and 673 confirm repeat uploads, simultaneous finishes, duplicate races and stale-score rejection. `useScoreQueue.ts:110` also handles a successful save whose response was lost.
- `tests/queueStore.test.ts:5` checks serialization, not IndexedDB recovery; `tests/uploadRules.test.ts:4` checks decisions, not the running queue. Browser persistence/reconnect behavior remains largely outside these tests.
- [committee/photos/[id].patch.ts:36](<server/api/committee/photos/[id].patch.ts:36>) checks whether a photo was judged, but not whether its challenge or label changed since the judge loaded it.

**4. Security and privacy**

- `docs/app-plan.md:116` deliberately accepts public group links and replaceable phone IDs. `login.post.ts:24` throttles failed sign-ins; `storage.ts:185` signs upload size/type; `app/utils/image.ts:55` re-encodes through canvas, dropping original metadata in the normal upload flow.
- [claim.post.ts:20](<server/api/g/[token]/photos/[id]/claim.post.ts:20>) checks group ownership but never compares the requesting phone with the uploader. Another phone can retag an unassigned photo. The negative ownership test at `scripts/api-check.ts:148` covers only PATCH.
- `server/utils/refusalLog.ts:16` limits custom refusal logging to status, reason, route pattern and group. `docs/architecture.md:34` separately discloses platform request logging.

**5. Performance and cost**

- `useUploadQueue.ts:247` sends directly to storage; `app/utils/image.ts:84` creates 2048 px copies and 400 px thumbnails. `server/utils/scoreboard.ts:66` reads cached/frozen settings together and saves rebuilds asynchronously.
- `server/api/gallery/index.get.ts:18` and `server/utils/etag.ts:9` show that 304 responses save bandwidth, not database reads or response construction. `docs/caching.md:88` honestly explains the free-plan consequence.

**6. Running it on the day**

- `scripts/watch-live.ts:104` summarizes errors, refusals and unfinished uploads. `app/pages/c/scores.vue:83` previews timetable changes; `committee/overview.get.ts:13` exposes outstanding judging and hidden-photo counts.
- `photos/batch.post.ts:64` marks deletion before removing files. [hidden.get.ts:15](<server/api/committee/photos/hidden.get.ts:15>) then excludes marked photos; `app/pages/c/hidden.vue:30` retains failed deletions only in memory.
- `app/pages/c/station/[id].vue:29` silently swallows refresh failures, leaving potentially stale round times without a warning.

**7. Maintainability**

- Adding a station requires editing stations/counts/contacts in `data/event.ts:35`, optionally its photo challenge in `data/challenges.ts:47`, and the written timetable in `data/guide.ts:20`. `scripts/seed.ts:45` feeds generic rotation, scoreboard and score-grid code; those need no corresponding edit.
- The seed never retires removed stations. Its sequential upserts also cannot simply swap occupied slots because `server/db/schema.ts:26` makes slots unique.
- `app/pages/help.vue:63` embeds `995`; `shared/utils/rotation.ts:9` embeds UTC+8. Changing only event data cannot fully relocate the event.

**8. Docs and honesty — eight claims checked**

- **1–2 confirmed:** README:22’s SPA and direct-photo-transfer claims match `nuxt.config.ts:11` and `useUploadQueue.ts:247`.
- **3–4 supported by implementation:** README:14’s device-scoped demo lists and nightly reset match `server/utils/demo.ts:28` and `:72`; reset is triggered by the first later API request.
- **5–6 confirmed:** `how-it-was-built.md:22`’s CI checks match `.github/workflows/check.yml:24` and the supplied log; README:26’s Node requirement matches `package.json:43`.
- **7–8 false as written:** `how-it-was-built.md:23`’s sender-only editing claim conflicts with `claim.post.ts:20`; README:52’s complete event isolation conflicts with the emergency-number and timezone literals above.

**9. AI slop**

- Near-identical animal matching appears in `c/judge.vue:61`, `PhotoViewer.vue:101` and `app/utils/animalNames.ts:11`, despite an existing shared utility.
- `rg` found no caller of upload `retarget` outside its implementation (`useUploadQueue.ts:431`), and only the declaration of `LikeResult` (`app/types/api.ts:52`).
- `wc -l` reports gallery 1,021 lines, viewer 936 and judge 889. Gestures, selection and saving explain much of that size; the dead paths and duplicated logic do not.

## Biggest problems

1. **Failed deletion loses durable recovery.** Closing the page can strand retained R2 files. Smallest fix: persist deletion-pending state and expose retries until storage confirms removal.
2. **A stale judge can judge the wrong challenge.** Moving a photo resets it to unchecked, allowing an old decision through. Smallest fix: condition decisions on the challenge/label version displayed.
3. **Claim bypasses uploader ownership.** Smallest fix: require matching `deviceId`, with a second-phone regression check.
4. **Data-only reuse can retain the wrong emergency number and timezone.** Smallest fix: make both event settings and document their use.
5. **Cropping excludes keyboard users.** Smallest fix: focusable, labelled handles with arrow-key adjustment.

## Low-hanging fruit

- `claim.post.ts`: add the ownership predicate and negative test — **Security**.
- `PhotoViewer.vue`, `c/judge.vue`: reuse animal matching — **AI slop**.
- `useUploadQueue.ts`: remove unused retargeting after checking compatibility — **AI slop**.
- `c/station/[id].vue`: add refresh timeout, failure indicator and expired-session handling — **Operations**.
- `help.vue`: move emergency contact configuration into `data/event.ts` — **Maintainability**.
- `AGENTS.md:27`: remove the reference to nonexistent `useMyStation.ts` — **Docs**.

## What you couldn't check

The demo fetch failed. No real-device, 360 px, VoiceOver/TalkBack, outdoor or bad-signal testing was performed. Production R2/CORS/lifecycle settings, bills and historical build/token figures were unavailable. Checks were not rerun because they write files and reset the database; the supplied passing log was used. No repository files were changed.