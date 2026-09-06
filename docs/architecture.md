# Nexus Pathways AI — Phase 1 architecture

Express exposes only the contract routes under `/api`; Drizzle is the source of truth for hierarchy, local identities, assignments, RBAC, application-session revocation, and audit events. Clerk verifies browser session cookies through its canonical Express middleware and proxy. Clerk claims establish identity only; PostgreSQL assignments establish every role, permission, and scope.

All hierarchy reads use organization and facility predicates. Audit records are append-only application records; the database role used by the service must not receive update or delete grants on `audit_events`.