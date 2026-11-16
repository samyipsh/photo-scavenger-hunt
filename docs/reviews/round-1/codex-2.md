## Scores

| Category | Score | Reason |
|---|---:|---|
| Scope fit | 9 | The features match the outing’s demonstrated needs, with some excess photo-editor complexity. |
| Phone UX and accessibility | 8 | Clear phone layouts and substantial accessibility work, but cropping requires pointer gestures. |
| Reliability and tests | 8 | Strong server checks support safe retries and conflicts; browser recovery is much less tested. |
| Security and privacy | 7 | Proportionate controls, undermined by a sender-ownership exception and incomplete deletion recovery. |
| Performance and cost | 8 | Sensible for this event on Paid, with inefficient gallery polling for free-plan reuse. |
| Running it on the day | 8 | Useful controls and monitoring exist, but failed file deletion can disappear from committee tools. |
| Maintainability | 7 | Event configuration is mostly concentrated, while large components and hardcoded regional assumptions complicate changes. |
| Docs and honesty | 7 | Unusually candid limitations, alongside several false implementation and reuse claims. |
| AI slop | 7 | Most complexity serves identifiable features, but obsolete queue machinery and duplicated workflows remain. |

## Evidence

Paths are repository-relative; `check-all.log` and `usage-on-the-day.md` refer to the supplied evidence.

**1. Scope fit**

- `usage-on-the-day.md:3–11` records 21 uploading phones, 280 event photos, judging, likes, all 25 station scores and several controls: the central features earned their place.
- The planned committee functions (`docs/app-plan.md:104–107`) correspond to the judge, station and Manage pages; upload and scoreboard controls are implemented at `app/pages/c/scores.vue:341–380`.

**2. Phone UX and accessibility**

- The supplied group, challenge, station and gallery screenshots show readable layouts and reachable actions. `app/components/BottomSheet.vue:26–41` supplies accessible titles/descriptions; `PhotoViewer.vue:724–730` provides Previous/Next alternatives to swiping.
- `app/composables/useBackClose.ts:29–58` handles supported Android Back interactions. However, crop handles are unfocusable divs with only pointer handlers (`app/components/PhotoCrop.vue:218–249`): keyboard and screen-reader users cannot adjust the crop.

**3. Reliability and tests**

- `check-all.log:9–10,647–702` confirms 116 passing unit tests and successful API checks, including repeated and concurrent finishes, duplicates and stale scores.
- Start/finish reuse client IDs; finish uses conditional copies and conflict-safe insertion (`server/utils/uploads.ts:30–33`; `server/api/g/[token]/photos/[id]/finish.post.ts:26–62`). Score writes condition on the previous version (`server/api/committee/stations/[id].post.ts:26–41`).
- Queue recovery remains under-tested: `tests/queueStore.test.ts:5–16` tests conversion helpers, not IndexedDB persistence. Uploads still store raw Files/Blobs (`app/utils/queueStore.ts:151`), despite the documented Safari problem and byte-storage workaround for drafts (`:25–28,176–179`).

**4. Security and privacy**

- Committee authorization, eight-failure login throttling and blocked-device checks exist (`server/utils/auth.ts:17–20`; `server/api/committee/login.post.ts:24–39`; `server/utils/devices.ts:18–20`).
- Sender ownership is missing from `/claim`: any unblocked phone holding the public group token can assign another sender’s untagged photo (`server/api/g/[token]/photos/[id]/claim.post.ts:12–22`).
- Normal uploads are canvas-reencoded, removing original metadata (`app/utils/image.ts:33–57,81–90`). Refusal logging avoids reading bodies/cookies, although request logs retain identifying headers as documented (`server/utils/refusalLog.ts:3–6`).

**5. Performance and cost**

- Album copies target 2048 px and thumbnails 400 px (`app/utils/image.ts:8–9`). Cached scoreboard requests avoid full calculation; rebuild reads are batched (`server/utils/scoreboard.ts:17–34,66–81`).
- Gallery polling still loads every photo and signs links before calculating its ETag (`server/api/gallery/index.get.ts:17–24`; `server/utils/etag.ts:9–15`). Thus 304 saves bandwidth, not database work; `docs/caching.md:81–93` correctly warns about free-plan exhaustion.

**6. Running it on the day**

- Controls preserve the last successful response and expose inline failures (`app/pages/c/scores.vue:15–21,350–369`). `scripts/watch-live.ts:104–123` summarizes errors, refusals and unfinished uploads.
- Deletion marks rows before removing files (`server/api/committee/photos/batch.post.ts:64–84`). Hidden excludes marked rows (`hidden.get.ts:15`); its retry list exists only in memory (`app/pages/c/hidden.vue:27–30`). Reloading loses unfinished deletions.

**7. Maintainability**

- Adding a seventh station touches `data/event.ts:35–37,67–74`, guide timetable text (`data/guide.ts:20–21`), optionally its photo challenge (`data/challenges.ts:47–51`) and a six-slot test (`tests/scoring.test.ts:220–222`). The existing seed and dynamic pages handle the station without new routes (`scripts/seed.ts:45–47`).
- `AGENTS.md` gives useful navigation and checks, but regional behavior escapes configuration: emergency dialing (`app/pages/help.vue:63`) and UTC+8/time formatting (`shared/utils/rotation.ts:9,83`; `shared/utils/photoTime.ts:16`).

**8. Docs and honesty**

- Claims checked **1–3, supported**: SPA (`README.md:22` → `nuxt.config.ts:11`); direct uploads (`README.md:22` → `useUploadQueue.ts:244–252`); clone-friendly stand-ins (`README.md:36` → `scripts/photos.ts:23–28`).
- Claims **4–6, supported**: demo photo isolation (`README.md:14` → `server/utils/demo.ts:28–31`); nightly reset (`README.md:14` → `server/middleware/demo-reset.ts:4`); CI checks (`docs/how-it-was-built.md:22` → `.github/workflows/check.yml:24` and supplied log).
- Claims **7–8, false**: sender-only changes (`docs/how-it-was-built.md:23`) have the `/claim` exception; all event specifics living in `data/` (`README.md:52`) excludes the emergency number and timezone above.
- Two further overstatements: one config/deploy “sets it all up” (`docs/how-it-was-built.md:15`) contradicts manual provisioning at `docs/architecture.md:231–245`; thumbnail-only group responses (`architecture.md:31`) actually include large links (`server/api/g/[token]/index.get.ts:59–60`).

**9. AI slop**

- `rg` found no callers of queue `retarget` or `release`; `held` never becomes true (`app/composables/useUploadQueue.ts:163,262–276,425–439`). The obsolete behavior is explicitly acknowledged at `docs/architecture.md:53`.
- Read-only line counts found 1,021 lines in gallery, 936 in PhotoViewer and 889 in judge. Much is earned, but moving-and-passing logic is duplicated (`app/pages/c/judge.vue:217–258`; `app/components/PhotoViewer.vue:520–557`), and unused photo location columns remain (`server/db/schema.ts:81–82`).

## Biggest problems

1. **Failed deletions become invisible after reload.** Keep durable deletion-pending state and expose retries until R2 confirms removal.
2. **Reuse can retain the wrong emergency number and clock.** Put both in event configuration and document regional setup.
3. **`/claim` bypasses sender ownership.** Add the device ownership predicate and a cross-phone rejection test.
4. **Upload persistence misses the app’s own Safari workaround.** Serialize queue files as bytes, as drafts already do; verify recovery after closing the tab.
5. **Cropping excludes non-pointer users.** Add labeled keyboard-operable crop adjustments.

## Low-hanging fruit

- Remove unused hold/release controls from `useUploadQueue.ts` — **AI slop**.
- Correct the deployment and thumbnail-only claims in the docs — **Docs**.
- Parameterize the six-slot test in `tests/scoring.test.ts` — **Maintainability**.
- Add a two-phone `/claim` API check in `scripts/api-check.ts` — **Security**.
- Add a close/reopen upload-recovery browser check — **Reliability**.

## What you couldn't check

The demo fetch failed. I inspected all supplied screenshots, but did not test physical phones, screen readers, outdoor contrast, actual 4G performance or real R2 failure recovery. The supplied log covers local development storage. Historical token/time figures, production configuration and actual bills were not independently verifiable. No files were changed; no tests or mutating scripts were run.