import {
  agenciesTable, cohortsTable, db, facilitiesTable, learnerProfilesTable, organizationsTable,
  permissionsTable, programsTable, regionsTable, rolePermissionsTable, rolesTable, staffProfilesTable,
  userRoleAssignmentsTable, usersTable,
} from "@workspace/db";

const ids = {
  org: "10000000-0000-4000-8000-000000000001", agency: "10000000-0000-4000-8000-000000000002",
  region: "10000000-0000-4000-8000-000000000003", facility: "10000000-0000-4000-8000-000000000004",
  program: "10000000-0000-4000-8000-000000000005", cohort: "10000000-0000-4000-8000-000000000006",
  adminRole: "10000000-0000-4000-8000-000000000010", educatorRole: "10000000-0000-4000-8000-000000000011", learnerRole: "10000000-0000-4000-8000-000000000012",
  overview: "10000000-0000-4000-8000-000000000020", audit: "10000000-0000-4000-8000-000000000021",
  admin: "10000000-0000-4000-8000-000000000030", educator: "10000000-0000-4000-8000-000000000031", learner: "10000000-0000-4000-8000-000000000032",
};
async function seed() {
  await db.insert(organizationsTable).values({ id: ids.org, name: "Escambia County Pathways" }).onConflictDoNothing();
  await db.insert(agenciesTable).values({ id: ids.agency, organizationId: ids.org, name: "Escambia County Corrections" }).onConflictDoNothing();
  await db.insert(regionsTable).values({ id: ids.region, agencyId: ids.agency, name: "Pensacola Region" }).onConflictDoNothing();
  await db.insert(facilitiesTable).values({ id: ids.facility, regionId: ids.region, name: "Escambia County Jail" }).onConflictDoNothing();
  await db.insert(programsTable).values({ id: ids.program, facilityId: ids.facility, name: "Nexus Foundations" }).onConflictDoNothing();
  await db.insert(cohortsTable).values({ id: ids.cohort, programId: ids.program, name: "Spring 2026 Cohort" }).onConflictDoNothing();
  await db.insert(rolesTable).values([
    { id: ids.adminRole, key: "administrator", name: "Administrator" }, { id: ids.educatorRole, key: "educator", name: "Educator" }, { id: ids.learnerRole, key: "learner", name: "Learner" },
  ]).onConflictDoNothing();
  await db.insert(permissionsTable).values([{ id: ids.overview, key: "admin.overview", description: "View scoped administration overview" }, { id: ids.audit, key: "audit.read", description: "Read scoped security audit events" }]).onConflictDoNothing();
  await db.insert(rolePermissionsTable).values([{ roleId: ids.adminRole, permissionId: ids.overview }, { roleId: ids.adminRole, permissionId: ids.audit }]).onConflictDoNothing();
  await db.insert(usersTable).values([
    { id: ids.admin, clerkUserId: "user_nexus_demo_admin", displayName: "Avery Morgan", email: "avery.morgan@example.test" },
    { id: ids.educator, clerkUserId: "user_nexus_demo_educator", displayName: "Jordan Ellis", email: "jordan.ellis@example.test" },
    { id: ids.learner, clerkUserId: "user_nexus_demo_learner", displayName: "Taylor Reed", email: "taylor.reed@example.test" },
  ]).onConflictDoNothing();
  await db.insert(staffProfilesTable).values([{ userId: ids.admin, title: "Nexus Administrator" }, { userId: ids.educator, title: "Learning Facilitator" }]).onConflictDoNothing();
  await db.insert(learnerProfilesTable).values({ userId: ids.learner, cohortId: ids.cohort }).onConflictDoNothing();
  const scope = { organizationId: ids.org, agencyId: ids.agency, regionId: ids.region, facilityId: ids.facility, programId: ids.program, cohortId: ids.cohort };
  await db.insert(userRoleAssignmentsTable).values([
    { id: "10000000-0000-4000-8000-000000000040", userId: ids.admin, roleId: ids.adminRole, ...scope },
    { id: "10000000-0000-4000-8000-000000000041", userId: ids.educator, roleId: ids.educatorRole, ...scope },
    { id: "10000000-0000-4000-8000-000000000042", userId: ids.learner, roleId: ids.learnerRole, ...scope },
  ]).onConflictDoNothing();
}
seed().then(() => process.exit(0)).catch((error: unknown) => { process.stderr.write(`Nexus seed failed: ${error instanceof Error ? error.message : "unknown error"}\n`); process.exit(1); });