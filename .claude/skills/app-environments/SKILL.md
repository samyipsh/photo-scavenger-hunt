---
name: app-environments
description: Use when setting up a new app's local, staging and production environments, adding storage or a database, or changing how code, schema, config and secrets move between them.
---
# Environments
- Separate app, database, bucket and keys for local, staging and production (and a demo). Share nothing.
- No default environment: every remote command names one. A default of production is one missed flag from disaster.
- Locally, run the real storage protocol with an S3-compatible server, so signed links, CORS and copies are tested before staging.
- Deploy from CI: main goes to staging; production promotes the same build, with the user's OK each time. Record the commit.
- Migrations ship with the code, run before it, stay backwards-compatible, and never reach a shared database from an unmerged branch. CI rejects duplicate numbers.
- Bucket rules and secrets in a re-runnable script. Expiring keys get a reminder before they lapse.
- Once several agents work at once, give each PR its own environment: its URL, database and key prefix, torn down on close.
