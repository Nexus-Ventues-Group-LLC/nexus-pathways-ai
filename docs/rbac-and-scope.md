# RBAC and scope

Roles are `learner`, `educator`, and `administrator`. Permissions are independently stored and assigned through role permissions. `admin.overview` and `audit.read` are administrator permissions in the deterministic seed.

A user role assignment carries organization, agency, region, facility, program, and cohort. Authorization derives only from this row and is enforced in SQL predicates. Clerk public/private metadata is never authorization input. Revoking an application session blocks its Clerk session ID locally.