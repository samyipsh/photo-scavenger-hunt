---
name: send-off
description: Use at the start of any task that will end in a pull request, including tasks run through another skill.
---
# Send-off
At the start, show this list in plain text, then carry on with the ticked items unless the user changes them:
- [x] Rebase or merge main if there's a conflict
- [x] Get CI green
- [x] Fix review feedback as it comes in
- [ ] Merge when everything is green

Do each ticked item without asking again. In the Claude app, the PR's Auto-fix and auto-merge switches do this. Merging never means deploying to production.
