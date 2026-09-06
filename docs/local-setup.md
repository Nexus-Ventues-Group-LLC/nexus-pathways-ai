# Local setup

Provision PostgreSQL and Clerk through the Replit environment, then run `pnpm --filter @workspace/db run push`. Seed explicitly with `pnpm --filter @workspace/scripts run seed:nexus-phase1`; startup never seeds data. Run `pnpm run typecheck` before changes.