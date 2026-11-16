---
name: hillclimb
description: Use when the user asks to hillclimb, polish or improve something through rounds of review.
---
# Hillclimb
1. Ask what to climb and the target score. Screens or flows: use `hillclimb-ui`. Code, architecture or docs: use `council` for the reviews.
2. Each round, reviewers score and list findings. Triage each one: accept, reject with a reason, or ask the user.
3. Accept what fixes something real. Reject what adds UI, states or code without fixing a real failure. Fight scope creep.
4. Stop and report when the target is met, when scores stall or drop, or when findings turn into edge cases. If quality is getting worse, pause and propose a different approach.
5. Report scores by round, what changed, and what was rejected and why.
