import { and, count, desc, eq } from "drizzle-orm";
import {
  agenciesTable, auditEventsTable, cohortsTable, db, facilitiesTable, learnerProfilesTable,
  programsTable, regionsTable, rolesTable, staffProfilesTable, userRoleAssignmentsTable, usersTable,
} from "@workspace/db";
import type { PortalContext } from "./identity";
import { hierarchy } from "./administration";
import { isInScope } from "./security-policy";

export function dashboardFor(context: PortalContext) {
  const administrator = context.permissions.includes("admin.overview");
  const portal = administrator ? "administrator" : context.role === "learner" ? "learner" : "educator";
  return {
    portal, headline: portal === "learner" ? `Welcome, ${context.displayName}` : `${context.scope.facility?.name ?? context.scope.organization.name} portal`,
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
  const facilityId = context.scope.facility?.id;
  if (!facilityId || !context.scope.agency || !context.scope.region) {
    const assignmentScope = and(
      eq(userRoleAssignmentsTable.organizationId, context.scope.organization.id),
      context.scope.agency ? eq(userRoleAssignmentsTable.agencyId, context.scope.agency.id) : undefined,
      context.scope.region ? eq(userRoleAssignmentsTable.regionId, context.scope.region.id) : undefined,
    );
    const [visibleHierarchy, learners, educators] = await Promise.all([
      hierarchy(context),
      db.select({ value: count() }).from(learnerProfilesTable)
        .innerJoin(userRoleAssignmentsTable, eq(userRoleAssignmentsTable.userId, learnerProfilesTable.userId))
        .where(assignmentScope),
      db.select({ value: count() }).from(staffProfilesTable)
        .innerJoin(usersTable, eq(staffProfilesTable.userId, usersTable.id))
        .innerJoin(userRoleAssignmentsTable, eq(userRoleAssignmentsTable.userId, usersTable.id))
        .innerJoin(rolesTable, eq(userRoleAssignmentsTable.roleId, rolesTable.id))
        .where(and(assignmentScope, eq(rolesTable.key, "educator"))),
    ]);
    const regions = visibleHierarchy.agencies.flatMap((agency) => agency.regions);
    const facilities = regions.flatMap((region) => region.facilities);
    const programs = facilities.flatMap((facility) => facility.programs);
    const cohorts = await Promise.all(programs.map((program) => scopedCount(cohortsTable, cohortsTable.programId, program.id)));
    return {
      organization: context.scope.organization,
      agencies: visibleHierarchy.agencies.length,
      regions: regions.length,
      facilities: facilities.length,
      programs: programs.length,
      cohorts: cohorts.reduce((total, value) => total + value, 0),
      learners: learners[0]?.value ?? 0,
      educators: educators[0]?.value ?? 0,
      syntheticDataNotice: "All displayed demonstration data is deterministic and synthetic.",
    };
  }
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
  const scope = context.scope;
  const visibility = scope.facility
    ? eq(auditEventsTable.facilityId, scope.facility.id)
    : scope.region
      ? eq(regionsTable.id, scope.region.id)
      : scope.agency
        ? eq(agenciesTable.id, scope.agency.id)
        : undefined;
  return db.select({
    id: auditEventsTable.id, action: auditEventsTable.action, category: auditEventsTable.category,
    actorDisplayName: auditEventsTable.actorDisplayName, resourceType: auditEventsTable.resourceType,
    createdAt: auditEventsTable.createdAt, outcome: auditEventsTable.outcome,
  }).from(auditEventsTable)
    .leftJoin(facilitiesTable, eq(auditEventsTable.facilityId, facilitiesTable.id))
    .leftJoin(regionsTable, eq(facilitiesTable.regionId, regionsTable.id))
    .leftJoin(agenciesTable, eq(regionsTable.agencyId, agenciesTable.id))
    .where(and(
      eq(auditEventsTable.organizationId, scope.organization.id),
      visibility,
    ))
    .orderBy(desc(auditEventsTable.createdAt)).limit(limit);
}

export { isInScope };