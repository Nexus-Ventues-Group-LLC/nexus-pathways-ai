---
name: GitHub workflow authorization
description: Constraint when publishing or changing GitHub Actions workflows through the connected GitHub OAuth integration.
---

The connected GitHub integration can administer repositories, rulesets, branches, pull requests, and ordinary source commits, but its offered OAuth scopes do not include GitHub's separate workflow-writing permission. Commits that introduce or modify files under `.github/workflows/` cannot be advanced through the connector.

**Why:** GitHub accepts ordinary reference updates but hides or rejects a reference update when its commit introduces an Actions workflow. Reauthorizing does not help when the integration's offered scope set lacks the workflow permission.

**How to apply:** Have an organization owner add or change the workflow through GitHub's web editor in a pull request. After the workflow is on the default branch, the connector can manage queue enrollment, inspect Actions runs, and administer repository rules normally.