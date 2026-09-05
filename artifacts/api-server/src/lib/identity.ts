import { eq } from "drizzle-orm";
import {
  agenciesTable, applicationSessionsTable, auditEventsTable, cohortsTable, db, facilitiesTable,
  organizationsTable, permissionsTable, programsTable, regionsTable, rolePermissionsTable,
  rolesTable, userRoleAssignmentsTable, usersTable,
} from "@workspace/db";

export type PortalContext = {
  userId: string; displayName: string; email: string | null; role: string; permissions: string[];
  scope: { organization: Ref; agency: Ref | null; region: Ref | null; facility: Ref | null; program: Ref | null; cohort: Ref | null; level: ScopeLevel };
};
type Ref = { id: string; name: string };
export type ScopeLevel = "organization" | "agency" | "region" | "facility" | "program" | "cohort";

export async function provisionIdentity(input: { clerkUserId: string; displayName: string; email: string | null; sessionId: string | null }) {
  let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, input.clerkUserId)).limit(1);
  if (!user) [user] = await db.insert(usersTable).values({ clerkUserId: input.clerkUserId, displayName: input.displayName, email: input.email }).returning();
  if (input.sessionId) {
    const [session] = await db.select().from(applicationSessionsTable).where(eq(applicationSessionsTable.clerkSessionId, input.sessionId)).limit(1);
    if (session?.revokedAt) return { user, revoked: true };
    if (!session) await db.insert(applicationSessionsTable).values({ userId: user.id, clerkSessionId: input.sessionId });
  }
  return { user, revoked: false };
}

export async function getPortalContext(userId: string): Promise<PortalContext | null> {
  const rows = await db.select({
    userId: usersTable.id, roleId: rolesTable.id, displayName: usersTable.displayName, email: usersTable.email, role: rolesTable.key,
    organization: organizationsTable, agency: agenciesTable, region: regionsTable, facility: facilitiesTable, program: programsTable, cohort: cohortsTable,
  }).from(userRoleAssignmentsTable)
    .innerJoin(usersTable, eq(userRoleAssignmentsTable.userId, usersTable.id))
    .innerJoin(rolesTable, eq(userRoleAssignmentsTable.roleId, rolesTable.id))
    .innerJoin(organizationsTable, eq(userRoleAssignmentsTable.organizationId, organizationsTable.id))
    .leftJoin(agenciesTable, eq(userRoleAssignmentsTable.agencyId, agenciesTable.id))
    .leftJoin(regionsTable, eq(userRoleAssignmentsTable.regionId, regionsTable.id))
    .leftJoin(facilitiesTable, eq(userRoleAssignmentsTable.facilityId, facilitiesTable.id))
    .leftJoin(programsTable, eq(userRoleAssignmentsTable.programId, programsTable.id))
    .leftJoin(cohortsTable, eq(userRoleAssignmentsTable.cohortId, cohortsTable.id))
    .where(eq(userRoleAssignmentsTable.userId, userId)).limit(1);
  const row = rows[0];
  if (!row) return null;
  const permissions = await db.select({ key: permissionsTable.key }).from(rolePermissionsTable)
    .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
    .where(eq(rolePermissionsTable.roleId, row.roleId));
  const ref = (x: { id: string; name: string } | null): Ref | null => x ? ({ id: x.id, name: x.name }) : null;
  const level: ScopeLevel = row.cohort ? "cohort" : row.program ? "program" : row.facility ? "facility" : row.region ? "region" : row.agency ? "agency" : "organization";
  return { userId: row.userId, displayName: row.displayName, email: row.email, role: row.role, permissions: permissions.map((p) => p.key),
    scope: { organization: ref(row.organization)!, agency: ref(row.agency), region: ref(row.region), facility: ref(row.facility), program: ref(row.program), cohort: ref(row.cohort), level } };
}

export async function writeAudit(input: { actorUserId?: string; actorDisplayName: string; organizationId?: string; facilityId?: string; action: string; category: string; resourceType?: string; outcome: string }) {
  await db.insert(auditEventsTable).values({ ...input, actorUserId: input.actorUserId ?? null, organizationId: input.organizationId ?? null, facilityId: input.facilityId ?? null, resourceType: input.resourceType ?? null });
}