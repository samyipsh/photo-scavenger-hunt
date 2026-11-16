## Scores

| Category | Score | Reason |
|---|---:|---|
| Scope fit | 9 | The core features match recorded use; the main excess is competitive pressure (`usage-on-the-day.md:4–11`, `docs/how-it-was-built.md:145`). |
| Phone UX and accessibility | 7 | Large controls and explicit Back handling are present, but cropping requires pointer gestures (`PhotoCrop.vue:218–249`). |
| Reliability and tests | 7 | Server retry guards are substantial, but client persistence and judging races remain insufficiently covered (`queueStore.ts:149`, committee photo PATCH:36). |
| Security and privacy | 8 | Event permissions fit the stated threat model, but demo isolation misses direct photo access (committee photo GET:7). |
| Performance and cost | 8 | Image shrinking and scoreboard caching fit this crowd; gallery revalidation still reads and signs the complete list (gallery GET:17–24). |
| Running it on the day | 8 | Controls and monitoring are useful, but failed deletion recovery depends on retaining browser state (`hidden.vue:31`). |
| Maintainability | 8 | Ordinary event changes mostly stay in data, although reseeding has avoidable traps (`seed.ts:35–49`). |
| Docs and honesty | 8 | Most checkable claims hold; demo privacy and “everything in data” need qualification (`README.md:14,52`). |
| AI slop | 8 | Most complexity serves identifiable flows, with some duplicated projections and dead schema remaining (`schema.ts:82–83`). |

## Evidence

Paths below are repository-relative; `check-all.log` and `usage-on-the-day.md` refer to the supplied evidence files.

**Scope fit**

- `docs/app-plan.md:102–109` maps directly to the group, scoreboard, gallery and committee pages; recorded use includes 280 photos, judging, all 25 station scores and several Controls (`usage-on-the-day.md:4–11`).
- The competition concern comes from actual experience: `docs/how-it-was-built.md:145–153` says photography displaced conversation and proposes reducing incentives. That is stronger evidence than screenshot-review scores.

**Phone UX and accessibility**

- Inspected all 18 supplied screenshots. `group.jpg`, `challenge.jpg` and `station.jpg` show large actions and readable copy. Button defaults enforce 44 px height and 16 px text (`app/components/ui/button/index.ts:7,19–26`).
- Sheets have titles, descriptions and labelled close buttons (`app/components/BottomSheet.vue:26–41`); the viewer provides accessible Previous/Next controls (`app/components/PhotoViewer.vue:696–716`). Back handling is explicit (`app/composables/useBackClose.ts:29–58`).
- Crop handles are unfocusable `div`s with pointer handlers and no keyboard equivalent (`app/components/PhotoCrop.vue:218–249`).

**Reliability and tests**

- Supplied `check-all.log:9–10,182,650–708` records 116 passing unit tests, a production build and passing API checks, including simultaneous finishes and stale score rejection.
- Upload IDs survive retries; conditional copies and conflict handling protect kept files (`server/api/g/[token]/photos/[id]/finish.post.ts:19–62`). Station writes compare the expected version (`server/api/committee/stations/[id].post.ts:26–40`).
- The Safari workaround covers drafts, while `saveUpload` still stores File/Blob objects directly (`app/utils/queueStore.ts:23–26,149–177`). Its tests check serialization helpers, not IndexedDB recovery (`tests/queueStore.test.ts:5–16`).

**Security and privacy**

- Committee authorization, mandatory uploader IDs and ownership checks exist (`server/utils/auth.ts:17–20`, `uploads.ts:38–40`, `devices.ts:25–28`). Canvas encoding drops normal uploads’ metadata (`app/utils/image.ts:51–57,84–89`). Monitoring processes IP and device identifiers (`scripts/watch-live.ts:66–71`).
- Demo lists apply visibility filtering (`server/utils/demo.ts:28–31`), but direct committee photo GET returns the whole row without it (`server/api/committee/photos/[id].get.ts:6–9`). Given a visitor photo ID and the public demo passphrase, another visitor can obtain its device ID and impersonate that phone.

**Performance and cost**

- Album copies are bounded to 2048 px, thumbnails to 400 px, with quality reduction (`app/utils/image.ts:8–9,84–89`). Stable signed links support browser caching (`server/utils/storage.ts:79–110`).
- Cached scoreboard responses use one settings query; rebuilds batch reads and defer the cache write (`server/utils/scoreboard.ts:17–32,64–79`). Gallery ETags save response bytes, but execute after database reads and signing (`server/api/gallery/index.get.ts:17–24`).

**Running it on the day**

- Shared controls cover uploads, round times, freezing and answer release (`server/api/committee/settings.post.ts:14–32`). The watcher reports errors and unfinished uploads (`scripts/watch-live.ts:95–120`).
- Failed purges remain only in an in-memory map (`app/pages/c/hidden.vue:28–47`). The server excludes tombstones from Hidden photos (`server/api/committee/photos/hidden.get.ts:15`), so reopening the page loses the retry affordance.

**Maintainability**

- Adding a game before Photo walk touches `data/event.ts:41–43,74–80`, its optional photo challenge in `data/challenges.ts:47–51`, and the printed timetable in `data/guide.ts:20–21`. Rotation and score-grid code adapt without edits (`shared/utils/rotation.ts:43`, `ScoreGrid.vue:26–35`); no schema change is needed.
- Reseeding that insertion can hit the existing walk’s unique slot before moving it (`server/db/schema.ts:26`, `scripts/seed.ts:47–49`). Increasing group count also fails to unhide previously hidden groups (`seed.ts:35,42`).

**Docs and honesty — eight checked claims**

- **1–2 hold:** README’s SPA/Worker and direct-upload claims (`README.md:22`) match `nuxt.config.ts:11`, `wrangler.jsonc:6–9` and `useUploadQueue.ts:235–239`.
- **3–4 hold:** README’s approximate code size and Node requirement (`README.md:20,26`): read-only counting found 17,165 non-library TS/Vue lines plus 1,099 copied UI lines; `package.json:43` requires Node 24.
- **5–6 hold:** CI on each push and separate staging resources (`docs/how-it-was-built.md:22`) match `.github/workflows/check.yml:4,24` and `wrangler.staging.jsonc:7–21`.
- **7–8 overstated:** “only your phone” (`README.md:14`) has the direct-access exception above; “everything” event-specific in data (`README.md:52`) misses the hardcoded loading-screen name (`app/spa-loading-template.html:6`), although the reuse skill acknowledges it.

**AI slop**

- A comment-stripped scan of 226 named value exports outside copied UI found no single-reference candidates; this is screening, not proof of use. Dead photo coordinates remain (`server/db/schema.ts:82–83`).
- Largest files are gallery 1,032 lines, viewer 922, judge 872 and group page 863. Gestures, selection and recovery explain much of that size, but photo response mapping is repeated (`server/utils/gallery.ts:11–26`, group GET:41–60).

## Biggest problems

1. **Queued uploads bypass the documented Safari storage workaround.** In the affected modes, closing the tab can lose them. Smallest fix: use byte serialization for queued originals and shrunk copies, then test reopening.
2. **Failed deletion becomes invisible after navigation.** R2 bytes can remain while the record disappears from recovery screens. Smallest fix: persist pending purges server-side and expose Retry.
3. **Judging does not validate the photo version viewed.** A sender can change its challenge while a judge is viewing it; rejection checks only `checkedAt` (`committee/photos/[id].patch.ts:36–50`). Smallest fix: condition verdict writes on the viewed revision.
4. **Demo isolation has a known-ID escape.** Smallest fix: apply demo visibility checks to direct photo reads and mutations.
5. **Cropping excludes keyboard and screen-reader operation.** Smallest fix: add labelled frame controls or keyboard-operable handles.

## Low-hanging fruit

- **Maintainability:** unhide returning groups in `scripts/seed.ts:35`.
- **Running it:** handle session expiry in `app/pages/c/station/[id].vue:17–34`.
- **Performance/privacy:** remove the external font request in `app/assets/css/main.css:2`.
- **Docs:** qualify the data-only claim in `README.md:52`.
- **Docs:** replace “at most once” in `docs/caching.md:9` with wording acknowledging overlapping rebuilds.
- **AI slop:** reuse the common photo projection in the group GET route.

## What you couldn't check

The browser service was unavailable, and the web tool could not reach the demo. I could not verify 360 px layouts, actual screen-reader focus, device Back gestures, Safari persistence, real R2 failure recovery, 4G timings or billing. Findings about failure sequences are source-derived. I relied on the supplied check log and did not rerun mutating checks. Original private history, token totals and review independence remain unverified.