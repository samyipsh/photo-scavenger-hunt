## Scores

| Category | Score | Reason |
|---|---:|---|
| Scope fit | 9 | Actual usage covers the core workflows, and anonymous groups suit this outing. |
| Phone UX and accessibility | 7 | Large, readable controls and deliberate Back handling, but cropping requires pointer gestures. |
| Reliability and tests | 7 | Upload retries are well protected; draft persistence and stale judging still have races. |
| Security and privacy | 8 | Permissions fit the stated threat model, but failed permanent deletion has incomplete recovery. |
| Performance and cost | 8 | Photo resizing and scoreboard caching fit this crowd; gallery polling still scans every photo. |
| Running it on the day | 8 | Useful controls and monitoring, with weaknesses in failure recovery and deployment defaults. |
| Maintainability | 7 | Event data is concentrated, but fixture assumptions and large page controllers complicate reuse. |
| Docs and honesty | 8 | Most technical claims hold; some universal claims and old requirements do not. |
| AI slop | 8 | Some leftovers and duplication remain, but much of the larger components serves real phone behaviour. |

## Evidence

Paths below are relative to the repository. `usage` and `log` mean the supplied evidence files.

**Scope fit**

- `usage:4–11`: 280 event photos, judging, likes, all 25 station scores, and timing/upload/freeze controls were used—not merely demonstrated.
- `docs/app-plan.md:100–109` maps closely to the implemented pages; `server/utils/auth.ts:7–22` keeps access appropriately simple.

**Phone UX and accessibility**

- Viewed the supplied group, challenge, gallery, scoreboard, station, judge, committee and other screenshots. `app/components/ui/button/index.ts:19–27` supplies 44–48 px normal controls; `BottomSheet.vue:26–41` supplies accessible titles and descriptions.
- `app/components/PhotoViewer.vue:691–717` uses a dialog and offers accessible Previous/Next buttons; `useBackClose.ts:29–53` handles supported browsers’ Back.
- `app/components/PhotoCrop.vue:218–250` implements moving and resizing through pointer-only divs, without keyboard handlers or focusable handles.

**Reliability and tests**

- `log:9–10` records 116 passing tests; `log:657–677` covers upload retries, concurrent finishes, duplicate files, judging conflicts and stale score saves.
- `server/api/g/[token]/photos/[id]/finish.post.ts:26–62` combines conditional copies, conflict-safe insertion and cleanup; `server/api/committee/stations/[id].post.ts:26–40` checks the replaced score version.
- `app/utils/queueStore.ts:174–183` allows asynchronous saves to overtake deletion or newer saves. A memory-only IndexedDB stub reproduced both a discarded draft returning and `old.jpg` replacing a saved `retaken.jpg`. `tests/queueStore.test.ts:4–17` only tests serialization.

**Security and privacy**

- Public group links are explicitly accepted in `docs/app-plan.md:117`. `server/utils/devices.ts:25–28` restricts sender edits; `server/api/committee/login.post.ts:24–45` implements lockout. Normal uploads pass through canvas re-encoding (`app/utils/image.ts:50–57`), dropping original metadata.
- `server/api/committee/photos/[id].patch.ts:71–72` marks deletion before removing files. `server/api/committee/photos/hidden.get.ts:15` then excludes that row even if storage deletion failed. Failed purges are retained only in page memory (`app/pages/c/hidden.vue:28–31`).
- `server/utils/refusalLog.ts:16–25` limits custom refusal logging; request-level IP and device logging is disclosed in `docs/architecture.md:34`.

**Performance and cost**

- `app/utils/image.ts:8–9,81–90` produces 2048 px album copies and 400 px thumbnails; `server/utils/scoreboard.ts:64–79` serves a cached board and saves rebuilds after responding.
- `server/api/gallery/index.get.ts:17–24` reads and signs the complete list before `server/utils/etag.ts:9–16` decides on 304. ETags save bandwidth, not database work; `docs/caching.md:77–93` acknowledges this.

**Running it on the day**

- `usage:10–11` confirms scoring and operational controls were exercised. `scripts/watch-live.ts:106–125` reports errors, unfinished uploads and busy phones.
- `app/pages/c/scores.vue:46,63` omits mutation timeouts despite weak-signal requirements. `docs/architecture.md:254–258` accurately discloses manual deployment, expiring keys and production-default commands.

**Maintainability**

- Adding a station entails `data/event.ts:40–43,74`, corresponding guide timing, optionally a photo challenge, then seeding through `scripts/seed.ts:47–53`; the rotation engine already uses configured counts.
- Nevertheless, `tests/scoring.test.ts:209–225` hard-codes six slots and the original date. `scripts/api-check.ts:197–201` assumes Codenames exists. Valid event changes therefore require edits outside `data/`.

**Docs and honesty — eight specific claims checked**

- **Verified:** README:22’s SPA and direct R2 uploads match `nuxt.config.ts:11` and `server/utils/storage.ts:184–207`.
- **Verified:** README:36’s generated stand-ins match `scripts/photos.ts:18–27`; `docs/how-it-was-built.md:22`’s push CI matches `.github/workflows/check.yml:4,24`.
- **Verified:** `docs/how-it-was-built.md:23`’s sender-only editing and repeated-guess lockout match `server/utils/devices.ts:25` and `server/api/committee/login.post.ts:26`.
- **Overstated/false:** README:52’s data-only reuse overlooks `app/spa-loading-template.html:6` and fixture dependencies above. `docs/how-it-was-built.md:3` says every commit carries a Claude co-author line, but `git log -3 --format='%h %s%n%b'` shows none on `51642cb`. Separately, `docs/app-plan.md:176` still calls the countdown a requirement while `docs/ux/flows.md:27` explicitly excludes it.

**AI slop**

- Read-only `wc -l` found gallery 1,032 lines, PhotoViewer 922, judge 872 and group page 863. Gestures, recovery and moderation earn considerable length, but these controllers remain costly to navigate.
- Photo coordinates remain unused (`server/db/schema.ts:82–83`); Inter is imported without being selected (`app/assets/css/main.css:2`). Photo serialization is substantially repeated between `server/utils/gallery.ts:11–26` and `server/api/g/[token]/index.get.ts:41–60`. The identifier scan found no obvious orphaned runtime exports.

## Biggest problems

1. **Failed permanent deletion can leave files accessible without a retry after reload.** Marking the row hides it from server lists before storage succeeds. Smallest fix: persist cleanup-pending status and expose failed purges until storage confirms removal.

2. **Draft persistence can restore discarded or superseded photos.** This was reproduced without filesystem writes. Smallest fix: order operations per draft key and invalidate pending saves when deleting or replacing a draft.

3. **Stale judging can erase newer work.** `server/api/committee/photos/[id].patch.ts:44–50` lets Undo and challenge changes clear verdicts without a version check. Smallest fix: conditional writes against a photo revision, including Undo and moves.

4. **Reuse instructions conceal test coupling.** Changing the event date, slot count or station names can break checks despite valid data. Smallest fix: derive catalogue choices and counts, and give rule tests explicit event-independent fixtures.

5. **Cropping excludes keyboard and screen-reader operation.** Smallest fix: labelled, focusable controls for moving and resizing the frame, with keyboard increments.

## Low-hanging fruit

Each is a bounded change suitable for under an hour:

- Remove the unused Inter import: `app/assets/css/main.css:2` — **Performance / AI slop**.
- Add mutation timeouts: `app/pages/c/scores.vue:46,63` — **Running it**.
- Select an existing scored station: `scripts/api-check.ts:197` — **Maintainability**.
- Remove fixed date/six-slot expectations: `tests/scoring.test.ts:209–225` — **Maintainability**.
- Add delayed-save/discard/retake regression cases: `tests/queueStore.test.ts` — **Reliability**.
- Qualify data-only reuse and universal co-authorship claims: `README.md:52`, `docs/how-it-was-built.md:3` — **Docs**.
- Log failed single-photo purges with the photo ID: `server/api/committee/photos/[id].patch.ts:72` — **Running it**.

## What you couldn't check

The demo was unreachable through the web tool. No real-phone, screen-reader, 360 px, weak-4G or production-R2 testing was performed. I accepted the supplied passing log rather than rerunning mutating checks. Actual billing, original agent-session totals and independent review histories remain unverified.