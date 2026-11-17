---
name: repo-review
description: Use when the user asks to score, audit or review the quality of a whole repo, or of one app or package in a monorepo, with independent reviewers.
---
Note that for a plan, a PR or screens, a single round of independent reviews is enough, no need to run this.

Steps
(0) Determine app context
If required, ask the user only what the repo can't tell you: the real scope, if no doc states it, and whether to publish the reviews.

(1) Review and score a repo with independent reviewers. 
- Decide with user how many reviewers to use. 
- Use a fresh read-only session for each reviewer started in the copy's folder. Keep the filled-in brief and the reviews outside the copy, so no run reads another's review. Record the tool versions, the effort and the commit. Give reviewers everything they need to know and permission. More is better.
- Determine likely candidate facets that the user might want to know in the review (each scored out of 10) and propose. Do a first pass of the repo if necessary.
	- Scope fit
	- UI 
	- UX
	- Accessibility
	- Reliability and tests
	- Security and privacy
	- Performance and cost
	- Maintainability: upkeep of current features and fixing bugs when they arise
	- Maintainability: adding more features without breakage or hacky code
	- Maintainability: testability
	- Docs and honesty
	- Cleared of AI slop
- Check each review as it lands. Ideally it cites files and lines.
- Triage scores and findings
