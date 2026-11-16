---
name: reuse-this-app
description: Use when copying, forking or adapting this app for another event or organiser, renaming it, or setting up a copy on a new Cloudflare account.
---
# Reusing this app

Photo Quest was built for one church outing and published so others can run their own. This is the checklist for making a copy work for another event.

## Keep the credit

The app is under the Apache License 2.0. Anyone who shares a copy, changed or not, has to keep `LICENSE` and `NOTICE` with it and mark the files they changed.

1. Keep `LICENSE` and `NOTICE`. Add your own lines to `NOTICE` under the original ones, and leave the original ones in place.
2. Near the top of the new README, say where it came from: "Based on [Photo Quest](https://github.com/samyipsh/photo-scavenger-hunt) by Samuel."
3. Keep this skill, or at least this section, so the next agent working on the copy sees it too.

## Ask the organiser first

Settle these before changing code. Don't guess them.

- The event: name, date, venue, and when and where results are given.
- Groups: how many, and who leads each. The original had 5 groups of about 6.
- Stations and timetable: the games, where each one is, when round 1 starts, how many rounds and how long each lasts.
- Challenges: the photo challenges, their points, and which ones count towards award races.
- Scoring: how much the stations weigh against the photos (`RANK_SCALE`) and what each award race is worth (`AWARD_BONUS`).
- Help: who's on the committee and who carries first aid. A phone number on the Help page is visible to anyone with the app link, so list one only with that person's OK.
- Photos: where the album goes afterwards and how long the bucket keeps them. The original deleted them 120 days after the event.

## Change `data/`, not the engine

Everything about one event lives in `data/`. The code in `app/`, `server/` and `shared/` shouldn't need changes for an event of the same shape.

| File | Holds |
| --- | --- |
| `data/event.ts` | Name, date, venue, time zone (`TIME_ZONE` and its `UTC_OFFSET` on the day, which must agree), timetable, stations with map pins, groups and leaders, help contacts, the local emergency number (`EMERGENCY_NUMBER`), the committee's briefing checklist, links under Help › Misc |
| `data/challenges.ts` | The photo challenges, points and award races |
| `data/guide.ts` | The participant guide at `/guide` |
| `data/types-of-christ.ts` | A puzzle made for the original outing. Replace it with your own puzzle's answers, or remove it along with `/types` and its Help entry |

Then run `pnpm verify` (it checks the `data/` files) and `pnpm db:reset:local`, and look at the screens with `?at=<date>T<time>` to see each round.

## Rename it

The name people see is `EVENT.appName` in `data/event.ts`. Also change the loading screen (`app/spa-loading-template.html`), `name` in `package.json`, the Worker names in `wrangler.jsonc` and `wrangler.staging.jsonc`, and the titles of `README.md`, `AGENTS.md` and `docs/architecture.md`. Search for the old name afterwards.

## Set it up on a new Cloudflare account

"Running it" in `docs/architecture.md` has the commands. In order:

1. Create a D1 database and an R2 bucket for live, and another pair for staging. Give `wrangler d1 create` the `--location` nearest the venue, because every request reads the database and a far one is slow (the README's "Put the database near your venue" has the numbers).
2. Put the names and IDs in `wrangler.jsonc` and `wrangler.staging.jsonc`, and the app's address in `r2/cors.production.json` and `r2/cors.staging.json`.
3. Make one R2 API token per bucket, with Object Read & Write on that bucket only and an expiry date. The account owner makes these. An agent should ask for the keys, not create tokens.
4. Set the secrets with `wrangler secret put`: `NUXT_COMMITTEE_PASSPHRASE`, `NUXT_APP_SECRET` (32 characters or more), `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. Never commit them.
5. Set each bucket's CORS and lifecycle rules, and leave public access off. Photos load through signed links.
6. Apply the migrations, then seed with the app's address so the printed group links are right, then deploy. Staging first, with the `:staging` scripts.
7. Try every flow on staging from a real phone, then run `pnpm check:api <staging address>`.

Plan on Workers Paid (US$5 a month) for the event: at around 50 people, the free plan's 10 ms of CPU per request and its daily D1 reads get tight. `docs/caching.md` and "Limits and cost" in `docs/app-plan.md` explain.

## Before the day

- Send each group its own link. Anyone with a group's link can send photos as that group.
- Don't load test on the same Cloudflare account during the event: staging shares the account's limits.

## If you're steering agents without reading the code

Read `docs/how-it-was-built.md` first. Most of the architecture came from the original developer's earlier projects, not from the agents: how the app and server are split, the environments and checks, sign-in and permissions, and how database changes reach live. Agents steer well inside it. Changing it needs someone who can judge the trade-offs.
