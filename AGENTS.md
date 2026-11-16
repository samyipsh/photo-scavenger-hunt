# Working on Photo Quest

A phone web app for one church outing: groups send photos for challenges, the committee judges them and enters station game scores, and everyone watches a live scoreboard and gallery. It's built and maintained mostly by AI coding agents; the owner steers from a phone. Read `docs/architecture.md` before changing anything on the server. Copying or adapting the app for another event: follow `.claude/skills/reuse-this-app/SKILL.md`, which also says how to keep the credit.

## Stack

Nuxt 4 single-page app (`ssr: false`) on one Cloudflare Worker, D1 (SQLite, through Drizzle) for data, R2 for photos. Phones upload photos straight to R2 with signed links and load them with signed view links; photo bytes never pass through the Worker. Staging is a separate Worker, database and bucket.

## Where things are

| Path | What |
| --- | --- |
| `data/event.ts`, `data/challenges.ts` | Everything specific to this event: name, date, place, timetable, stations, groups, help contacts, checklist, challenges. Change these for another event, not the engine. |
| `data/guide.ts`, `data/types-of-christ.ts` | The participant guide (`/guide`: timeline, scoring words) and the Types of Christ answers (`/types`). The answers are server-only: `/api/types` sends them once the committee shows them in Manage › Controls. |
| `shared/utils/` | Pure rules used by server, pages and tests: `scoring.ts` (scoreboard, group totals, the station points chart), `rotation.ts` (timetable), `photoTime.ts` (how a photo's time reads), `photos.ts` (size limits, IDs, name cleaning), `refusals.ts` (the codes the phone acts on), `typesOfChrist.ts` (the answers' shape and reference marks), `demo.ts` (demo mode's day, limit and snapshot), `awards.ts`, `device.ts` |
| `server/api/` | Routes by who calls them: `g/[token]/` (a group's link), `committee/` (passphrase session), `photos/` (likes, a phone's own photo), `gallery`, `scoreboard`, `groups`, `types/` (the Types of Christ, once shown) |
| `server/utils/platform.ts` | The only place that knows Cloudflare bindings and env |
| `server/utils/storage.ts`, `viewLinks.ts` | Everything about R2: signed upload and view links, checking and keeping uploads, deleting |
| `server/utils/uploads.ts`, `challenges.ts` | The checks every upload passes; where a photo goes (challenge and label) |
| `server/utils/gallery.ts` | A photo as the gallery's answers carry it, with their groups and challenges; bringing back a photo the committee took out of the gallery |
| `server/utils/demo.ts`, `server/middleware/demo-reset.ts`, `app/composables/useDemo.ts` | Demo mode (`DEMO_MODE`): which photos each phone sees, the 50-photo limit, no deleting showcase photos for good, the nightly reset; the page side's `/api/demo` |
| `server/utils/scoreboard.ts`, `settings.ts`, `auth.ts`, `devices.ts`, `limits.ts`, `etag.ts` | Scoreboard cache, settings rows, committee session, blocked phones, caps, 304s for answers that are the same for everyone |
| `server/db/` | Drizzle schema and numbered migrations |
| `app/pages/`, `app/components/` | Screens; `components/ui` is shadcn-vue |
| `app/composables/useUploadQueue.ts` | The phone's upload queue (start, send, finish, retries); `app/utils/queueStore.ts` keeps it in IndexedDB |
| `app/composables/useCommitteeBatch.ts` | The committee's Hide (gallery), Unhide and Delete for good (`/c/hidden`) on many ticked photos at once |
| `app/composables/useScoreQueue.ts` | Station scores waiting to save (kept in localStorage, retried from any page by `plugins/score-queue.client.ts`) |
| `app/components/PhotoViewer.vue`, `PickChallengeSheet.vue`, `BottomSheet.vue` | The full-screen photo view (gallery, group page, judge); the one sheet for choosing a photo's challenge; every bottom sheet's frame |
| `app/composables/useBackClose.ts` | Android's Back closes an overlay instead of leaving the page (the browser's CloseWatcher) |
| `scripts/` | `check-all.ts` (what CI runs), `api-check.ts`, `seed.ts`, `demo-data.ts`, `photos.ts` (recce photos or drawn stand-ins), `upload-photo.ts`, `demo-snapshot.ts` (demo mode's seeded state), `staging-config.ts`, `staging-data.ts` (look at and clear staging's photos and files), `watch-live.ts` (a summary of live requests each minute), `screens.ts` (the pictures on `docs/screens.html`) |
| `docs/` | `architecture.md` (how it works, with diagrams), `caching.md` (what's kept where, and how it scales), `app-plan.md` (decisions and limits), `ux/flows.md` (every screen), `tech-stack.md` (what each part uses), `how-it-was-built.md` (time, tokens and mistakes), `reviews/` (the independent reviews, both rounds) |
| `.claude/skills/` | How work is run here, reusable elsewhere: `send-off` (ask at the start of any task that ends in a PR), `hillclimb` and `hillclimb-ui`, `council` (independent reviews), `mobile-ux`, `app-environments`, `pdsa-retro`, and `reuse-this-app` (copying the app for another event) |

## Checks before calling work done

1. `pnpm verify`: typecheck (app, scripts and tests) and unit tests, including checks on the `data/` files. `pnpm check:all` runs everything CI runs (verify, build, a fresh local database and the API check); stop your dev server first.
2. Server changes: `pnpm dev`, then `pnpm check:api`. It covers uploads, retries, duplicates, refusals, a phone's own photos, judging, score conflicts, likes, deletion and blocking.
3. Screen changes: load demo data (`pnpm db:reset:local && node scripts/demo-data.ts`, dev server running) and look at the changed screens yourself in the browser at 360 and 390 px, open states included. `?at=2026-11-14T10:12` on any page fakes the time of day. Keep screenshots outside the repo. For a UI or UX review round, use the `hillclimb-ui` skill.
4. Upload or storage changes: also `pnpm run deploy:staging` and `pnpm check:api <staging address>`, because local R2 isn't real R2.
5. Keep `docs/architecture.md` true, diagrams included.

## Rules that must hold

- The phone picks each photo's ID, so every retry is safe: start and finish must stay idempotent.
- Photo bytes never pass through the Worker in production. The `/img` route only works under `nuxt dev`; built apps need the R2 keys.
- Kept photo keys are write-once (they carry the file's checksum). Signed upload links only ever point at `u/`.
- A photo with `files_deleted_at` set is gone for good: it can't be restored, judged or moved.
- Event-specific words, dates and places belong in `data/`, not in the engine.
- Nothing under `app/` or `shared/` imports `data/types-of-christ.ts`, so the answers never ship in the app's files (`tests/data.test.ts` checks; after `pnpm build`, a phrase from them must not be in `.output/public`).
- UI copy is short and plain. Text is at least 16 px, tap targets at least 44 px. Use the existing shadcn-vue components.
- Never run `demo-data.ts`, `api-check.ts` or load tests against the live app. Staging shares the account's limits, so no load tests on the day before an event or on the day.
- Secrets live in `.env` (local) and Worker secrets; never commit them. Only the owner creates R2 API tokens.
- Deploying to live (`pnpm run deploy`) needs the owner's go-ahead each time.

## Common changes

- **A schema change:** edit `server/db/schema.ts`, run `pnpm db:generate`, rename the new migration to say what it does and update its tag in `server/db/migrations/meta/_journal.json`, then apply it with `pnpm db:migrate:local`, `pnpm db:migrate:staging` and, when deploying, `pnpm db:migrate:remote`.
- **A challenge or station:** edit `data/`, then reseed (`pnpm db:reset:local` locally).
- **A new overlay (sheet, dialog, a sheet's second step):** opt it into Android's Back with `useBackClose`; every `BottomSheet` already is. Don't add history entries for it: only the full-size photo and picking photos have those, for iPhone's swipe back.
- **A page that refreshes by itself:** wrap its `useFetch` data in `useLastGood(data, error)`, give the `useFetch` a `timeout` shorter than the refresh, and say "No signal · …" while `error` is set. Nuxt empties a `useFetch`'s data when a refresh fails, which would turn the page into its error screen whenever a phone loses signal for a moment. Not the judge's page: acting on a queue that may be stale (or another group's, after a filter change) is worse than waiting for it. A committee page also calls `useSignInAgain(error)`, so a session that ends while it's open goes back to sign-in.
- **A scoring rule:** `shared/utils/scoring.ts` and its tests in `tests/scoring.test.ts`.
- **The upload flow:** server in `storage.ts`, `uploads.ts` and `server/api/g/[token]/photos/[id]/{start,finish}.post.ts`; phone in `useUploadQueue.ts`. The sequence diagram in `docs/architecture.md` shows the whole exchange.
