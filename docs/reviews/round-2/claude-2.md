I've finished reading the server code, both queues, the docs and the screenshots. The two sweeps (unused exports and duplicates, text size and tap targets) are still running. I'll check what they find and then write the review.

The accessibility sweep is back, and I confirmed its main finding myself. No sheet passes `finalFocus` or uses `DrawerTrigger`, so focus doesn't return to where it was when a sheet closes. Still waiting on the dead-code sweep.

## Scores

| Category | Score | Reason |
| --- | --- | --- |
| Scope fit | 6 | Every flow the plan required shipped and was used on the day, but about 11,500 lines of screens also carry features the plan never asked for, or gave to the organiser. |
| Phone UX and accessibility | 8 | 16 px text, 44 px targets, labelled icon buttons and Back handling hold everywhere checked, but sheets lose focus when they close. |
| Reliability and tests | 7 | The server's upload and conflict rules are solid and tested end to end, but nothing tests the phone's queue. It also saves photos in a way its own comment says Safari can lose. |
| Security and privacy | 8 | It holds to its stated threat model: passphrase lockout, size-checked signed uploads, view links that expire, and GPS removed on the phone. |
| Performance and cost | 7 | The scoreboard cache and the gallery's ETag are good, but every gallery check still reads every photo row. |
| Running it on the day | 8 | Controls, Hidden photos, the checklist and the log watcher cover the morning, but the committee can't see stuck uploads. |
| Maintainability | 6 | A new station is a one-file change, but a new kind of race touches about 20 files. |
| Docs and honesty | 7 | The docs are unusually candid about failures, but five claims are false or overstated. |
| AI slop | 5 | Dead routes, three server paths for deleting a photo, compatibility code for earlier versions of a one-off app, and too much code for one morning. |

## Evidence

**Scope fit**
- Every page in `docs/app-plan.md:100-109` exists. On the day there were 280 photos, 303 passed, all 25 station scores entered, and the freeze and uploads switch were used (`usage-on-the-day.md:4-11`).
- `app-plan.md:180` gives the photo export to the organiser. Even so, `app/composables/usePhotoSave.ts` is 456 lines of share-sheet batching, three download workers and stall recovery.
- Crop and rotate (`PhotoCrop.vue`, `utils/crop.ts` and its tests, about 540 lines) and three kinds of draft (`useUploadQueue.ts:391-420`) aren't in the plan. Screen views weren't measured, so nobody knows whether they were used.
- `how-it-was-built.md:118` says a review loop doubled the app to 8,800 lines. `wc` over `app/` without `ui/` gives 11,469 now.

**Phone UX and accessibility**
- A sweep of `app/pages` and `app/components` found no text under 16 px, an `aria-label` on all 28 icon-only buttons, and `useBackClose` on every overlay (`AppBar.vue:16`, `PickChallengeSheet.vue:47`, `gallery.vue:546`). The screenshots look the same.
- No sheet passes `finalFocus` or uses `DrawerTrigger` (grep over `app/`). After any sheet or the menu closes, a screen-reader user lands at the top of the page.
- `scoreboard.vue:135` "No signal" has no `role="status"`, unlike the other pages. `NowCard.vue:71` makes the whole card a live region. Cropping only works by dragging (`PhotoCrop.vue:218-250`).

**Reliability and tests**
- Start and finish are safe to repeat on the phone's ID (`uploads.ts:30-34`). The copy only goes ahead if the file is the one that was checked (`storage.ts:205-225`), and a unique index settles two phones sending the same file (`finish.post.ts:47-56`). `check-all.log:657-671` passes all of these.
- Judging and scores both refuse a stale save (`committee/photos/[id].patch.ts:36-41`, `stations/[id].post.ts:26-41`). Both conflict checks pass (`check-all.log:676-677`).
- `queueStore.ts:23-26` says Safari's IndexedDB "won't keep a File (or any Blob)… and fails without a word", so drafts are stored as bytes. The upload queue still stores `File` and `Blob` (`queueStore.ts:6-19, 149`), and that's the copy that matters when an iPhone closes the tab.
- `useUploadQueue.ts` is only tested through its pure rules (6 tests in `tests/uploadRules.test.ts`). `api-check` sends photos with its own script, `scripts/upload-photo.ts`, not the phone's code. `nuxt dev` uses a stand-in store (`storage.ts:161`), so CI never runs the real R2 path.

**Security and privacy**
- The passphrase is compared in constant time, and 8 misses per IP per 15 minutes are counted in one database write, with a 600 ms delay on each miss (`login.post.ts:8-46`). The session cookie lasts one day (`nuxt.config.ts`).
- Upload links sign the size and type and only point at `u/` (`storage.ts:184-202`). View links are GET-only and expire (`storage.ts:79-100`). `/img` only works in dev (`storage.ts:124`).
- Every upload is redrawn on a canvas, which drops GPS (`image.ts:81-95`).
- `refusalLog.ts:11` keeps group tokens out of its log line, but the same log entry carries the URL with the token (`refusalLog.ts:5`). In the demo, anyone gets the passphrase from `/api/demo` and can close uploads for every visitor until midnight.

**Performance and cost**
- The scoreboard is one batch of six reads and a one-row cache rebuilt after 10 s, saved after the answer goes out (`scoreboard.ts:17-32, 59-82`).
- The gallery reads every photo row before hashing, so a 304 costs as many D1 rows as a full answer (`gallery/index.get.ts:17-27`). `caching.md:88` says 50 people watching use the free plan's daily reads in an hour.
- The group page refreshes every 30 s (`[token].vue:31-34`) and makes 9 D1 calls without batching (`g/[token]/index.get.ts:9-32`), against `README.md:62`'s own advice to batch.
- The largest JS chunk is 46 KB gzipped (`check-all.log:103`).

**Running it on the day**
- Controls has an uploads switch that asks first, round times, freeze, and the list of blocked phones (`scores.vue:348, 404-417, 507`). Usage shows these were used.
- `scripts/watch-live.ts:16-23` prints a summary each minute, with `!!` lines past set limits.
- Stuck uploads only show on the sender's phone (`architecture.md:98`, "there's no automatic alert").
- The only way to block a phone is to mark one of its photos Inappropriate, which deletes the photo (`[id].patch.ts:75-83`).

**Maintainability**
- New station: the `stations` array, `SLOT_COUNT` and `ROUND_COUNT` in `data/event.ts:41-81`, the timeline in `data/guide.ts`, then a reseed. `tests/data.test.ts:38-55` catches a mismatch.
- New race kind: the schema enum (`schema.ts:43`) and a migration, the `AWARD_BONUS` keys, `scoring.ts`, `server/utils/challenges.ts:21`, the draft kinds (`queueStore.ts:31`), and the components. The race kinds appear 67 times in 20 files.
- `gallery.vue` is 1,032 lines, about 170 of them managing browser history while picking photos (`538-710`). `PhotoViewer.vue` is 922 lines and `judge.vue` 872. A local `groupName` hides the shared one in six files.

**Docs and honesty**
- True: the line counts in `README.md:20`, the write-once keys (`storage.ts:51-57`), `/img` shut in built apps, uploads refused without a phone ID (`uploads.ts:38`), the Types of Christ never imported by the app (`data.test.ts:102-107`), and GPS removed.
- False or overstated:
  - `app-plan.md:78` says photo points come in tiers of 10, 20, 30 and 50, but `data/challenges.ts` also uses 40, 60 and 80.
  - `README.md:52` says "the engine doesn't know about our outing", but KJV and BibleGateway are hard-coded (`shared/utils/typesOfChrist.ts:53-55`, `types.vue:77, 90`), and `FLOWER_COLOURS` sits in `shared/utils/awards.ts:1`.
  - `app-plan.md:47` says it's "built to fit the free plan anyway", which `caching.md:88` contradicts.
  - `architecture.md:51` says queued photos survive a closed tab, which `queueStore.ts:24` undercuts.
  - `blocks/index.post.ts:3` says the route is for undoing an Unblock, but there's no such Undo (`scores.vue:60-69`).

**AI slop**
- Dead code: nothing calls `committee/photos/[id].get.ts`, and only `api-check` calls `blocks/index.post.ts`.
- Delete for good exists three times: `[id].patch.ts:66-74` doesn't require the photo to be hidden first, `batch.post.ts:54-85` does, and `PhotoViewer.vue:660` posts to the batch route itself instead of using `useCommitteeBatch`. Moving a photo and clearing its verdict is written three times. "Doesn't match the challenge" is typed out in 9 places.
- Compatibility code for versions of an app that ran once: `queueStore.ts:26, 168-172` and its test, and `storage.ts:50` with the optional checksum in the `/img` regex.
- About 25 exports are used only in their own file or by tests (`saveScoreboardCache`, `rankPlaces`, `oneLetterOff`).

## Biggest problems

1. **The upload queue can lose photos on iPhone.** It saves `File` and `Blob` to IndexedDB, which the file's own comment says Safari drops without an error. Smallest fix: save queued photos with `toStoredPhoto`/`fromStoredPhoto`, as drafts already are (`queueStore.ts:149-151`).
2. **No automated test covers the phone's upload flow, and none covers real R2.** Smallest fix: a vitest with mocked fetch and XHR covering start, send, finish, a 409 restart, a final refusal and a retry that finds the photo saved.
3. **Closing uploads throws away queued photos.** A 423 counts as final (`uploadRules.ts:11`), so `useUploadQueue.ts:262` removes the photo from IndexedDB. A photo stuck in weak signal at 11:44 is lost if the tab closes after the lead closes uploads at 11:45. Smallest fix: on `uploads-closed`, skip `dropUpload`.
4. **Reusers are told the engine doesn't know about the outing, but it does.** Smallest fix: correct `README.md:52` and the reuse skill, move `FLOWER_COLOURS` to `data/`, and hide `/types` when `TYPES_OF_CHRIST` is empty.
5. **Deleting a photo follows different rules depending on the route, and two routes are dead.** Smallest fix: send the single-photo hide and delete through `batch.post.ts`, and delete the GET route and `POST /blocks`.

## Low-hanging fruit

1. `BottomSheet.vue`, `AppBar.vue`: remember `document.activeElement` when a sheet opens and pass it as `:final-focus`. *Phone UX*
2. `scoreboard.vue:135`: add `role="status"`. In `NowCard.vue:71`, make only the line that changes a live region. *Phone UX*
3. `useScoreQueue.ts:119`: retry 408 and 429, as `isFinalRefusal` does for uploads. *Reliability*
4. `g/[token]/index.get.ts`: put the reads in one `db.batch` and reuse `useGalleryPhoto`. *Performance, AI slop*
5. One shared constant for the default reject reason in `shared/utils`. *AI slop*
6. Delete the compatibility code at `queueStore.ts:168-172`, `storage.ts:50` and the `/img` regex. *AI slop*
7. Fix the points tiers at `app-plan.md:78` and the free-plan claim at `:47`. *Docs*
8. Move `FLOWER_COLOURS` from `shared/utils/awards.ts` to `data/challenges.ts`. *Maintainability*

## What you couldn't check

- Real phones, VoiceOver and TalkBack, and widths of 360 px. I worked from the code and the 390 px screenshots, and didn't open the demo.
- Whether Safari really drops Blobs in IndexedDB today. Problem 1 relies on the code's own comment.
- How real R2 behaves on the conditional copy and CORS, and whether Workers Logs hides the session cookie in request headers.
- The load test, billing alerts, and the token and time figures in `how-it-was-built.md`, none of which are in the repo.
- Whether the save, crop and draft features were used. Screen views weren't measured.
- I didn't run `check:all` again. I relied on the log you gave me.
