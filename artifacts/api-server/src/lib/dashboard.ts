import { and, count, desc, eq } from "drizzle-orm";
import {
  agenciesTable, auditEventsTable, cohortsTable, db, facilitiesTable, learnerProfilesTable,
  programsTable, regionsTable, rolesTable, staffProfilesTable, userRoleAssignmentsTable, usersTable,
} from "@workspace/db";
import type { PortalContext } from "./identity";
import { isInScope } from "./security-policy";

export function dashboardFor(context: PortalContext) {
  const administrator = context.permissions.includes("admin.overview");
  const portal = administrator ? "administrator" : context.role === "learner" ? "learner" : "educator";
  return {
    portal, headline: portal === "learner" ? `Welcome, ${context.displayName}` : `${context.scope.facility.name} portal`,
    scope: context.scope,
    metrics: [{ label: "Phase 1", value: "Ready", detail: "Identity, access, and organizational context are active." }],
    capabilities: administrator ? ["Scoped administration", "Security audit access"] : ["Scoped portal access"],
  };
}
async function scopedCount(table: typeof agenciesTable | typeof regionsTable | typeof facilitiesTable | typeof programsTable | typeof cohortsTable, column: any, value: string) {
  const [row] = await db.select({ value: count() }).from(table).where(eq(column, value));
  return row?.value ?? 0;
}
export async function adminOverview(context: PortalContext) {
  const facilityId = context.scope.facility.id;
  const [programs, cohorts, learners, educators] = await Promise.all([
    scopedCount(programsTable, programsTable.facilityId, facilityId),
    db.select({ value: count() }).from(cohortsTable).innerJoin(programsTable, eq(cohortsTable.programId, programsTable.id)).where(eq(programsTable.facilityId, facilityId)),
    db.select({ value: count() }).from(learnerProfilesTable).innerJoin(usersTable, eq(learnerProfilesTable.userId, usersTable.id)).innerJoin(userRoleAssignmentsTable, eq(userRoleAssignmentsTable.userId, usersTable.id)).where(and(eq(userRoleAssignmentsTable.organizationId, context.scope.organization.id), eq(userRoleAssignmentsTable.facilityId, facilityId))),
    db.select({ value: count() }).from(staffProfilesTable).innerJoin(usersTable, eq(staffProfilesTable.userId, usersTable.id)).innerJoin(userRoleAssignmentsTable, eq(userRoleAssignmentsTable.userId, usersTable.id)).where(and(eq(userRoleAssignmentsTable.organizationId, context.scope.organization.id), eq(userRoleAssignmentsTable.facilityId, facilityId))),
  ]);
  const [agencies, regions, facilities] = await Promise.all([
    db.select({ value: count() }).from(agenciesTable).innerJoin(regionsTable, eq(regionsTable.agencyId, agenciesTable.id)).innerJoin(facilitiesTable, eq(facilitiesTable.regionId, regionsTable.id)).where(and(eq(agenciesTable.organizationId, context.scope.organization.id), eq(facilitiesTable.id, facilityId))),
    db.select({ value: count() }).from(regionsTable).innerJoin(facilitiesTable, eq(facilitiesTable.regionId, regionsTable.id)).where(and(eq(regionsTable.agencyId, context.scope.agency.id), eq(facilitiesTable.id, facilityId))),
    db.select({ value: count() }).from(facilitiesTable).where(and(eq(facilitiesTable.regionId, context.scope.region.id), eq(facilitiesTable.id, facilityId))),
  ]);
  return { organization: context.scope.organization, agencies: agencies[0]?.value ?? 0, regions: regions[0]?.value ?? 0, facilities: facilities[0]?.value ?? 0, programs,
    cohorts: cohorts[0]?.value ?? 0, learners: learners[0]?.value ?? 0, educators: educators[0]?.value ?? 0,
    syntheticDataNotice: "All displayed Phase 1 demonstration data is deterministic and synthetic." };
}
export async function visibleAuditEvents(context: PortalContext, limit: number) {
  return db.select({
    id: auditEventsTable.id, action: auditEventsTable.action, category: auditEventsTable.category,
    actorDisplayName: auditEventsTable.actorDisplayName, resourceType: auditEventsTable.resourceType,
    createdAt: auditEventsTable.createdAt, outcome: auditEventsTable.outcome,
  }).from(auditEventsTable).where(and(eq(auditEventsTable.organizationId, context.scope.organization.id), eq(auditEventsTable.facilityId, context.scope.facility.id))).orderBy(desc(auditEventsTable.createdAt)).limit(limit);
}

export { isInScope };