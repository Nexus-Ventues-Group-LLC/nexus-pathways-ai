---
name: Clerk seeded test identities
description: Constraint when browser-testing application users whose database records use placeholder Clerk subjects.
---

Programmatic Clerk browser testing cannot assume a placeholder subject stored only in the application database. Clerk also rejects reserved `.test` addresses during tester-created sign-in.

**Why:** A browser test could create a real Clerk session, but its subject did not match the seeded application user, so portal identity resolution correctly rejected it.

**How to apply:** For authenticated browser tests, provision and map a real Clerk test user first. When that is intentionally out of scope, validate authorization through service/HTTP integration tests rather than weakening identity matching.