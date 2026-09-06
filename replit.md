## API server tests

- Run the API server test suite: `pnpm --filter @workspace/api-server test`
- Stress shared-database fixture isolation in two concurrent integration-test processes: `pnpm --filter @workspace/api-server test:integration:isolation`

# Nexus Pathways AI

Phase 1 is an Express, Drizzle, PostgreSQL foundation for Clerk-cookie authentication, scoped organization access, local RBAC, revocable application sessions, and immutable audit records.

## Commands
- `pnpm run typecheck` — workspace typecheck
- `pnpm run validate:workflows` — validate every GitHub Actions workflow with actionlint
- `pnpm --filter @workspace/db run push` — apply development schema
- `pnpm --filter @workspace/scripts run seed:nexus-phase1` — opt-in deterministic synthetic seed

## Architecture and conventions
- The OpenAPI contract and generated API libraries are source-controlled and are not edited for implementation work.
- Clerk establishes identity through its canonical Express middleware and browser session cookies. PostgreSQL alone supplies roles, permissions, and hierarchy scope.
- Keep handlers thin, validate all API inputs and outputs with `@workspace/api-zod`, and use structured pino logging only.
- Scope predicates belong in SQL queries. Do not load cross-tenant or cross-facility data before authorizing it.

## Phase 1 boundary
Identity, hierarchy, profiles, assignments, RBAC, session revocation, audit events, and the existing API endpoints are in scope. Curriculum, assessments, AI Tutor, career, reentry, Passport, reporting, integrations, edge deployment, and later phases are deferred.