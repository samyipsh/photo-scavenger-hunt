# How this was built

This app is vibecoded. AI agents wrote almost every line of code, test and doc, and every commit carries a Claude co-author line. I steered. I said what I wanted, tried the app on staging from my phone, and pushed back when something felt wrong. Independent AI reviewers, a fresh Claude and OpenAI's Codex, checked the plan, the screens and each pull request. No person reviewed the code line by line. The architecture underneath is mine, though, reused from earlier projects. [Knowing the architecture mattered most](#knowing-the-architecture-mattered-most) explains.

It ran once, on Sat 14 Nov 2026, for about 30 people in 5 groups at the Singapore Botanic Gardens. Read it as an example of what an agent-built app looks like after six main days of work, not as a maintained product.

The charts behind the numbers here are on an interactive page, [Build analytics](build-analytics.html).

## Why vibecoded, and why this stack

This is my first fully vibecoded app. I've used coding agents heavily for months. On serious projects I still read the code by hand, because I can't risk a bug I haven't seen. Here I wanted to find out how far steering alone gets you, saying what to build and judging the result on a phone without ever opening the code.

This app could take that risk. It ran for one morning, and the worst likely failure was a group losing some photos at a church outing.

The stack follows from the same low stakes. Everything runs on one Cloudflare account. A Worker serves a Nuxt 4 single-page app, D1 holds the data and R2 the photos. A config file per environment and one deploy command ship it. Before the first deploy, each environment needs its database, photo bucket, secrets and bucket rules set up once by hand, as "Running it" in `docs/architecture.md` lists. Hosting cost US$5. The catch is that platform config and runtime quirks hide behaviour from agents, which matters less for an app that runs once. For anything longer-lived I'd pick plain pieces an agent can run and test end to end from a terminal, such as a Node server, Postgres and an S3-compatible bucket. `docs/app-plan.md` has the reasoning and `docs/architecture.md` explains how the app works.

## Knowing the architecture mattered most

Agentic engineering works much better when you already know the architecture underneath. You can judge what an agent proposes, keep what fits and swap what doesn't. Vibecoded here means I didn't read the code. It doesn't mean the agents designed the app. Most of the big decisions were ones I'd made before, on earlier projects or in research for them, and I reused them here:

- **Frontend and backend architecture.** The app and its API ship as one deploy. Server routes are grouped by who calls them: a group's link, the committee, or anyone. Rules like scoring, the timetable and upload limits are plain functions that the pages, the server and the tests all share.
- **Environments and testing.** Local, staging and live each have their own database, photo bucket and secrets, so nothing is tried on live first. Every change runs the typecheck and unit tests, and an API check runs the server's rules end to end against local or staging. CI runs all of it on each push.
- **Authorization.** There are no accounts. Each group gets an unguessable link, each phone gets a random ID, and the committee shares one passphrase that becomes a sealed session cookie, locked out after repeated misses. Every action checks who's asking. A group can only send photos as itself, a phone can only move or remove photos it sent, and only the committee can judge, score, block a phone or change settings.
- **Database changes.** The schema lives in one file. Each change generates a numbered SQL migration, which is applied to each database in turn before the code that needs it ships.

With those settled, my steering was mostly about the product: what each screen should do and how it should feel. It's part of why spec and architecture took 7% of my time and screens 43%. Someone steering without that background would be judging these choices from the agents' explanations alone. I think that's much harder, and the mistakes would be the expensive kind.

## The numbers

| | |
| --- | --- |
| Days worked | 6 main days and 4 light ones, between Tue 3 Nov and Sat 14 Nov 2026, the day of the outing. Two days had no work at all |
| My hands-on time | about 25 to 30 hours over 167 prompts, or 3 to 4 eight-hour days. About 4 of those hours went on planning the outing itself, not the app |
| Agents at work | about 36 hours of wall-clock time with at least one agent running, or 53 agent-hours counting agents that ran side by side |
| Code | about 10,000 lines in `app/` not counting the shadcn-vue components, 1,800 in `server/`, 850 in tests, 1,200 in scripts, 1,450 in docs |
| History | 187 commits on main, 17 merged pull requests |
| Hosting | US$5, one month of Cloudflare Workers Paid taken as insurance |
| After the outing | 15 and 16 Nov, getting the code ready to share: a public demo, this write-up and the open-source copy. About 6.5 more hours of mine over 61 prompts, 6 hours of agent wall-clock time, 6 more commits and 6 more pull requests |

### Tokens

Nearly all the tokens are input, and nearly all of that input came from the cache. Every turn re-reads the whole conversation so far, so a long thread reads the same text thousands of times. Output, the code, docs and reviews the models wrote, is a small slice.

| Model | Input from cache | Input not from cache | Output | At API prices |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5, plus a little Haiku 5.5 | 3.01 billion | 39 million | 11.9 million | about US$1,115 |
| GPT-6.1 Sol, through Codex | 89.5 million | 8.4 million | 0.9 million, 0.5 million of it reasoning | about US$35 |

For Claude, nearly all the input not read from the cache was written to it for later turns.

I didn't pay API prices. Everything ran on spare usage in subscriptions I already pay for. At list API prices it would have cost about US$1,150. More than half the Claude figure is cache reads, which is what long threads cost.

Getting it ready to share on 15 and 16 Nov added 0.59 billion Claude tokens and 17 million Codex tokens, about US$210 more at API prices. That isn't in the table above.

## Models and tools

- **Claude Opus 5.5** at extra-high effort, in the Claude Code desktop app, often driven from my phone. It wrote the code, ran the checks, deployed, and ran about 100 review passes as separate headless sessions, plus subagents for parallel work.
- **Claude Haiku 5.5** for a few subagent calls.
- **GPT-6.1 Sol** at extra-high effort, through the Codex CLI. Claude called it as a second, independent reviewer, about 80 runs over the plan, the UX screenshots, the architecture and each pull request. I also ran one end-to-end test session in the Codex desktop app on 4 Nov.

## Where the time went

Each prompt the developer typed is filed under one category and credited with the time until the next prompt. A gap over 30 minutes counts as 10 minutes, so time away from the chat, such as testing on a phone, mostly goes uncounted. Prompts that mixed several asks are filed under the main one.

| Category | Hours | Share | Prompts | Prompts per result |
| --- | --- | --- | --- | --- |
| UI polish | 4.7 | 19% | 30 | 2.8 |
| Features and fixes | 4.7 | 19% | 31 | 2.4 |
| Planning the outing | 3.8 | 15% | 27 | 2.7 |
| Failed UX climb and cleanup | 3.1 | 12% | 17 | 1.8 |
| Setup, deploys and ops | 3.0 | 12% | 26 | 1.3 |
| UX research and design | 2.9 | 12% | 17 | 2.7 |
| Spec and architecture | 1.8 | 7% | 12 | 2.2 |
| Event day, post-event, open-sourcing | 0.8 | 3% | 7 | 1.7 |
| **Total** | **24.8** | | **167** | **2.4** |

UX research and design covers research into UX conventions and flows for each screen. Examples are the How it works card, what Cancel should do and what to hide. Planning the outing is not app work.

Screens took 10.7 hours, 43%, counting UI polish, UX research and design and the failed climb. Spec and architecture took 1.8 hours, 7%. A looser count, which treats any run of prompts less than 45 minutes apart as continuous work, gives 30 hours in total.

A result is one thing the developer wanted, like a feature, a fix or a design change. The 167 prompts asked for 96 results. 44 of them, 46%, took one prompt, and the mean was 2.4 prompts per result. UI polish needed the most re-asking at 2.8 per result, and setup, deploys and ops the least at 1.3. 37 prompts only approved something or asked a question.

[Build analytics](build-analytics.html) charts all of this by day and by category, and lists what each category covers.

## Timeline

Singapore time, to the nearest hour.

- **Tue 3 Nov.** Plan to live app in one day.
  - Morning: planning the outing itself with Claude
  - 5 pm: first commit, an app plan that Codex and Opus reviewed before any code
  - 10 pm: first deploy to Cloudflare
  - 11 pm: UX gate passed, all three reviewers approving round 6
- **Wed 4 Nov.** Features and architecture.
  - Menu, likes and awards
  - A separate staging app
  - Photos go straight from phones to R2 with signed links
  - `AGENTS.md`, refusal codes, the API check and CI
  - Night: a UX climb left running unattended
- **Thu 5 Nov.** The climb goes off the rails.
  - 11 am to 4 pm: rounds 33 to 36, each split across parallel agents, and the app code doubles
  - 5 pm: cleanup, then a review skill written from what went wrong
- **Fri 6 to Wed 11 Nov.** Light work: printouts, Android Back, a check screen after taking a photo, request logs.
- **Thu 12 Nov.** Six groups become five.
- **Fri 13 Nov.** Final prep.
  - One pull request per fix, each reviewed by Opus and Codex
  - The participant guide
- **Sat 14 Nov.** The outing.
  - An agent watches the live logs
  - Evening: fixes from the day, the guide moves into the app, a faster scoreboard

## What went wrong

### The UX climb that went off the rails

The loop screenshots every screen, has independent Opus and Codex reviewers score the UX, fixes what they flag, and repeats. Six rounds on day one took the app from rough to approved.

Later I typed a climb prompt by hand before going to bed. It asked for at least 9/10, told the agent to run the reviewers on screenshots and make the changes, and set no scope and no rule for stopping. It ran rounds 27 to 36 over about 18 hours. Each round took nearly every fix the reviewers asked for, and the reviewers kept finding more, mostly in what the previous round had added. Scores stalled between 7.4 and 7.8 while the app code more than doubled, from 4,100 lines to 8,800. Lines mentioning undo went from 11 to 107.

The run used 825 million Claude tokens and 24 million Codex tokens, about US$310 at API prices. Cleaning up took about 3 hours of my time. A few things it built were worth keeping, like the full-screen photo viewer and the judge's grid.

### Smaller ones

- **One thread for everything.** My first chat started as "help me plan the outing" and grew into the whole build. It ran from the first day to the last, was compacted 13 times, and used 1.6 billion of the 3 billion Claude tokens, about US$480 at API prices. From 13 Nov each change got its own thread and pull request.
- **Reviewers only saw static screenshots.** After a 9.3/10 round I still found a header icon off the content edge, a redundant helper line, and Android's plain picker where a custom sheet belonged.
- **Scoring architecture invites abstraction.** I worried the reviewers would score DRY code as more maintainable, and that the architecture climb would pull every value into its own variable to please them. So I told them maintainable here means easy for an agent to find and change.

## What I learnt

- **Hill-climbing UI works for polish.** Reviewers scoring screenshots, round after round, is the loop in Theo's [Agents Sucked At UI (Until Today)](https://www.youtube.com/watch?v=xq0eB8vxeqk). The evening after the cleanup, a six-round climb scoped to the award displays stayed on polish: alignment, spacing and wording.
- **Too unbounded, it builds features, and the slop compounds.** Mine had no scope, so reviewers asked for more, the agent added it, and the next round critiqued the additions. The agents also lacked the information to judge well. Static screenshots never showed an open sheet, a menu or a flow. And the orchestrator had no authority to overrule a reviewer, so nearly every "must fix" went in.
- **The orchestrator needs the power to stop.** The agent running the loop should use its judgment and end the climb when scores stall or keep falling, or when the code keeps getting worse, instead of chasing a target it can't reach. After the failed climb I wrote the loop up as a skill, `.claude/skills/hillclimb-ui`. Its rule to pause and tell me when a climb is making things worse came after the failure too.

## What worked

- Getting the plan reviewed by Codex and Opus before any code. The app was live the same evening.
- `AGENTS.md`, `docs/architecture.md` and `pnpm check:api`. Every fresh agent started with the rules and had a check to run before calling server work done.
- A separate staging Worker, database and bucket, so I could try every change on my phone first.
- From 13 Nov, one pull request per change with an Opus and a Codex review each. Claude summarised the reviews, took what made sense and pushed back on the rest.

## UX and design psychology

The biggest lesson from the day wasn't technical. It's about what a game does to an outing.

People loved the photo quest. Before the photos started there was more talking and the walk was more relaxed. Once they started it felt slightly too competitive.

How we fix this to encourage more conversation
- The app and the briefing now say to enjoy the moment. Verbal briefing should also stress this.
- (Rejected) I tried a setting that opens uploads only from a chosen round and dropped it as too harsh. 
- Score photos and animal races lower and place criteria to ask for at least 2 or 3 people in more of the photos. 
- Tweak the awards to award photos with people so there would be more memory keepsakes (eg. Most number of group photos instead of most number of photos). 
- Drop the Most liked award, and after the event invite everyone to like their favourites so the best float to the top. People mostly didn't know they could like photos during the walk, which was deliberate.
- Perhaps limit to only 2 people per group who can take photos this would kinda force converstaions where people who spot it will call others to take and then they can pose (as oppose to everyone just quick snapping with their own phones)


## How these numbers were measured

Claude figures come from the Claude Code session logs for this project, covering the main checkout, worktrees, subagents and headless review runs, with each API response counted once. Codex figures come from Codex's session logs for runs whose working folder was this project.

API prices are list prices on 14 Nov 2026. Claude Opus 5.5 costs US$4 per million input tokens and $20 per million output. Cache reads cost $0.20 per million, and cache writes $5 or $8 for the 5-minute or 1-hour cache. GPT-6.1 Sol costs $2 per million input tokens, $0.10 cached and $10 output.

My time is estimated from when I sent prompts, as described above. Code and commits are counted on `origin/main`.

Figures are as of 14 Nov 2026, the day of the outing, except the After the outing row and the line under the token table, which run to 16 Nov.
