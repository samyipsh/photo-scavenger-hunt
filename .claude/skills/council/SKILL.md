---
name: council
description: Use when the user says council, or asks for independent reviews of a plan, a PR, screens or a repo.
---
# Council
1. Fix known issues and run the checks first, so the council reviews the current state.
2. Ask one strong model per provider (Claude Opus, Codex), each in a fresh read-only session, with the same brief: what it's for and its real scope, where to look (eg. files, diff, screenshots), a score out of 10, and findings that cite a file and line. Give facts, not your view or the target.
3. Read each result as it lands. 
4. Triage in one table: accept, reject with a reason, or ask the user. Fix, then start a fresh round.
5. If there's a PR, put `## Council review` in its description: each reviewer's score by round. Write "no score" rather than invent one.
6. Fight scope creep. Stop when findings turn into edge cases.
