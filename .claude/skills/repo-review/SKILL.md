---
name: repo-review
description: Use when the user asks to score, audit or review the quality of a whole repo, or of one app or package in a monorepo, with independent reviewers.
---
# Repo review

Scores a whole repo with two independent reviewers, the way `docs/reviews/` was made here. For a plan, a PR or screens, use `council` instead. Ask the user only what the repo can't tell you: the real scope, if no doc states it, and whether to publish the reviews.

## 1. Scope

- Write down, in two or three sentences, who uses it, how many, for how long, and what's at stake. Reviewers judge against this, so a one-off app isn't marked down for lacking what a product needs.
- In a monorepo, either review the whole workspace in one brief, with every app and package in scope for every category, or review each app or package on its own (with the shared packages it uses) and report each separately. Either way, also score Package boundaries once for the workspace: each package builds and tests on its own, dependencies point one way, and shared code has one home.
- Fix what you already know is broken and get the checks passing, so the reviewers see the current state.

## 2. Evidence

Reviewers can't run everything, so give them facts they would otherwise guess at. Put them in an `evidence/` folder inside the copy, so both reviewers can read it.

- A copy at one commit (an export or a worktree), so both read the same files. Take out secrets and private data first: the reviews may be published. Take out earlier reviews and their scores too (here, `docs/reviews/` and the README's table), so no reviewer anchors on them.
- The full output of the project's checks on that commit: typecheck, tests, build, and any end-to-end check.
- If it has run for real: what was used and how much, and what failed. Counts only, no personal data.
- If it has screens: every screen, open states included.

## 3. Brief

Copy `brief.md` from this folder and fill in every `<…>`.

- Give facts, not your view, and never the score you expect.
- If the reviewers' model families wrote the code, say so, and ask them to doubt anything that looks tuned to please a reviewer.
- Each category's "Check" line names real files, or a change to trace, so both reviewers look at the same things.
- Maintainability means easy for an agent to find and change, not DRY. The brief says so, or the scores reward abstraction.
- Name every category so that higher is better: "Cleared of AI slop", not "AI slop".
- Keep the nine categories unless the user asks for others. Freeze the brief: later rounds change only the commit and the evidence, so scores compare.

## 4. Run

One strong model per provider, two runs each, all four at once, each in a fresh read-only session started in the copy's folder. Keep the filled-in brief and the reviews outside the copy, so no run reads another's review. Record the tool versions, the effort and the commit.

```bash
# Claude: the brief goes in on stdin. On the command line, the tool flags swallow it and the review comes back empty.
claude -p --model opus --effort xhigh \
  --allowedTools "Read,Grep,Glob,Bash(ls:*),Bash(wc:*),Bash(rg:*),Bash(git log:*),Bash(git show:*)" \
  --disallowedTools "Edit,Write,NotebookEdit" < ../brief.md > ../out/claude-1.md
# Codex: stdin from /dev/null, or it waits for input and writes nothing.
codex exec --sandbox read-only --skip-git-repo-check -c model_reasoning_effort=xhigh -o ../out/codex-1.md "$(cat ../brief.md)" < /dev/null
```

Check each review as it lands. It must not be empty, must have the scores table, and must cite files and lines it could only know by reading them. Rerun one that fails, with the same brief, and say so in the write-up.

## 5. Triage

- Put the scores side by side, both runs of each reviewer, not averaged. Where reviewers differ by 2 or more, quote both reasons.
- List each finding once, in one table: accept, reject with a reason, or ask the user. Check every finding against the code before acting on it: one of ours was wrong.
- Accept by default only real bugs (correctness, data loss, security, privacy) and false claims in the docs. Reject what adds code, states or screens without fixing a real failure. When the reviewers disagree on severity, take the simpler outcome.
- Fix, then run round 2 on the frozen brief at the new commit. Stop when findings turn into edge cases or scores stop moving. Don't climb for a number.

## 6. Publish

If the user wants the reviews public, keep each round in the repo (`docs/reviews/` here is the worked example):

- the brief, the evidence and the raw reviews, unedited apart from local paths;
- a README with the disclosure first, then who reviewed (model, tool, version, effort), the commits, the scores table, the disagreements, what changed between rounds, findings that were wrong, and what was left as is and why.
