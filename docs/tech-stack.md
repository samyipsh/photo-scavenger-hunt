# Tech stack

What each part of the app uses, and where to look. `architecture.md` explains how the parts fit together, with diagrams.

The choices suit an app that runs once, for one morning. Everything sits on one Cloudflare account, there's nothing to patch, and the free tier nearly fits. `app-plan.md` has the reasoning, including why a longer-lived app should use more portable pieces.

Agents wrote the code, but most of the architecture is reused from the owner's earlier projects and research: how the app and server are split, the environments and checks, sign-in and permissions, and how database changes reach live. The sections below describe each. Change them with the same care.

## The app

| Part | Uses | Where |
| --- | --- | --- |
| Framework | Nuxt 4 as a single-page app (`ssr: false`), Vue 3, TypeScript | `nuxt.config.ts`, `app/` |
| Components | shadcn-vue on Reka UI, Tailwind CSS 4, Lucide icons, vue-sonner for toasts | `app/components/ui/` |
| Weak signal | Photos waiting to send are kept in IndexedDB and retried. Station scores wait in localStorage. Pages keep showing their last answer when a refresh fails | `app/composables/useUploadQueue.ts`, `app/utils/queueStore.ts`, `app/composables/useScoreQueue.ts`, `app/composables/useLastGood.ts` |
| Android Back | The browser's CloseWatcher closes the open sheet or dialog instead of leaving the page | `app/composables/useBackClose.ts` |

## The server

| Part | Uses | Where |
| --- | --- | --- |
| Hosting | One Cloudflare Worker serves the built app as static files and answers the API. Smart Placement may run it near the database instead of near the phone | `wrangler.jsonc` |
| API | Nitro event handlers, built with the `cloudflare_module` preset | `server/api/` |
| Database | Cloudflare D1, which is SQLite, through Drizzle ORM | `server/db/schema.ts` |
| Photos | A private Cloudflare R2 bucket. Phones upload and load photos with signed links, made with R2's S3 API and aws4fetch, so photo bytes never pass through the Worker | `server/utils/storage.ts`, `server/utils/viewLinks.ts` |
| Caching | The scoreboard is kept in one database row and rebuilt when it's 10 seconds old. Answers that are the same for everyone carry an ETag and come back as 304 when unchanged | `server/utils/scoreboard.ts`, `server/utils/etag.ts`, `docs/caching.md` |
| Logs | Workers Logs, plus one line for each refused request saying why | `server/plugins/refusal-log.ts`, `scripts/watch-live.ts` |

## Sign-in and permissions

There are no accounts. The app recognises four kinds of visitor.

| Who | Recognised by | Can |
| --- | --- | --- |
| Anyone with the app link | Nothing | See the groups, gallery, scoreboard and guide, and like photos |
| A group | A random token in the group's link, `/g/<token>`. The seed makes each token once and keeps it in `data/tokens.local.json`, which git ignores | Send photos for that group and see its own verdicts |
| One phone | A random ID in the browser's storage, sent as `x-device-id` | Like each photo once, and move or remove photos it sent. The committee can block it |
| The committee | One shared passphrase, then a sealed session cookie from nuxt-auth-utils | Judge, enter scores, run the day's controls, block phones |

Committee routes call `requireCommittee` and group routes call `requireGroup`, both in `server/utils/auth.ts`. The passphrase check compares in constant time. After 8 wrong tries from one address, that address waits out the rest of a 15-minute window (`server/api/committee/login.post.ts`).

## Database changes, from laptop to live

Drizzle owns the schema and Wrangler applies the migrations.

1. Change `server/db/schema.ts`.
2. Run `pnpm db:generate`. drizzle-kit compares the schema with its last snapshot and writes a numbered SQL migration to `server/db/migrations/`. Rename the file to say what it does, and update its tag in `server/db/migrations/meta/_journal.json`.
3. Apply it to each database with Wrangler: `pnpm db:migrate:local`, then `pnpm db:migrate:staging`, then `pnpm db:migrate:remote` for live. Wrangler records each applied file in the database's `d1_migrations` table, so every migration runs once per database.
4. Deploy the code only after its migration is applied, so new code never meets an old schema.

`scripts/seed.ts` turns the event in `data/` (groups, stations, challenges) into SQL that `wrangler d1 execute` runs. `pnpm db:reset:local` rebuilds the local database from nothing.

## Environments and secrets

| Environment | What runs | Config |
| --- | --- | --- |
| Local | `pnpm dev`. Wrangler emulates D1 and R2 on the laptop, and uploads go to a stand-in route | `.env` |
| Staging | Its own Worker, database and bucket, for trying changes without touching live | `wrangler.staging.jsonc` |
| Live | The event's Worker, database and bucket | `wrangler.jsonc` |

The committee passphrase, the session secret and the R2 keys live in `.env` locally and in Worker secrets on Cloudflare. None are in git. Each R2 key pair can only read and write its own bucket.

## Checks

| Check | Uses | Run with |
| --- | --- | --- |
| Types | `nuxt typecheck` (vue-tsc), and tsc for the scripts | `pnpm verify` |
| Unit tests | Vitest, covering scoring, the timetable, the upload queue, view links, cropping and the `data/` files, among others | `pnpm verify` |
| API | `scripts/api-check.ts` runs the API's rules end to end against `pnpm dev` or staging | `pnpm check:api` |
| CI | GitHub Actions runs all of the above, a build and a fresh database on every push. It needs no secrets | `.github/workflows/check.yml`, `pnpm check:all` |
| Demo data and screenshots | Playwright drives a real browser | `scripts/demo-data.ts` |

## Working on it with agents

`AGENTS.md` holds the rules and the checks to run, and Claude Code reads it through `CLAUDE.md`. The `hillclimb-ui` skill in `.claude/skills/` runs a scoped UI review loop with independent reviewers.
