---
name: GitHub workflow authorization
description: Constraint when publishing or changing GitHub Actions workflows through the connected GitHub OAuth integration.
---

The connected GitHub integration can administer repositories, rulesets, branches, pull requests, and ordinary source commits, but its offered OAuth scopes do not include GitHub's separate workflow-writing permission. Use a workflow-capable Git transport for complete source snapshots.

**Why:** Connector uploads reject some HTML payloads and workflow paths. Untracked private keys under the task container's home directory can also disappear between turns, and protected `main` requires checks plus merge-queue review.

**How to apply:** Persist the SSH private key only in encrypted form, decrypt it with a Replit Secret into a temporary file, publish a sync branch, and merge through the required pull-request queue. Verify complete Git tree IDs after merge.