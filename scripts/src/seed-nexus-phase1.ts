import {
  agenciesTable, cohortsTable, db, facilitiesTable, learnerProfilesTable, organizationsTable,
  permissionsTable, programsTable, regionsTable, rolePermissionsTable, rolesTable, staffProfilesTable,
  tenantConfigurationsTable, userRoleAssignmentsTable, usersTable, learnerCourseworkAssignmentsTable,
  learnerCourseworkTable, approvedLearnerResourcesTable,
} from "@workspace/db";

const ids = {
  org: "10000000-0000-4000-8000-000000000001", agency: "10000000-0000-4000-8000-000000000002",
  region: "10000000-0000-4000-8000-000000000003", facility: "10000000-0000-4000-8000-000000000004",
  program: "10000000-0000-4000-8000-000000000005", cohort: "10000000-0000-4000-8000-000000000006",
  secondFacility: "10000000-0000-4000-8000-000000000007", secondProgram: "10000000-0000-4000-8000-000000000008",
  adminRole: "10000000-0000-4000-8000-000000000010", educatorRole: "10000000-0000-4000-8000-000000000011", learnerRole: "10000000-0000-4000-8000-000000000012",
  overview: "10000000-0000-4000-8000-000000000020", audit: "10000000-0000-4000-8000-000000000021", manageHierarchy: "10000000-0000-4000-8000-000000000022", manageTenant: "10000000-0000-4000-8000-000000000023", manageCurriculum: "10000000-0000-4000-8000-000000000024",
  admin: "10000000-0000-4000-8000-000000000030", educator: "10000000-0000-4000-8000-000000000031", learner: "10000000-0000-4000-8000-000000000032",
  facilityAdmin: "10000000-0000-4000-8000-000000000033",
  coursework: "10000000-0000-4000-8000-000000000050",
  resource: "10000000-0000-4000-8000-000000000051",
};
async function seed() {
  await db.insert(organizationsTable).values({ id: ids.org, name: "Escambia County Pathways" }).onConflictDoNothing();
  await db.insert(agenciesTable).values({ id: ids.agency, organizationId: ids.org, name: "Escambia County Corrections" }).onConflictDoNothing();
  await db.insert(regionsTable).values({ id: ids.region, agencyId: ids.agency, name: "Pensacola Region" }).onConflictDoNothing();
  await db.insert(facilitiesTable).values({ id: ids.facility, regionId: ids.region, name: "Escambia County Jail" }).onConflictDoNothing();
  await db.insert(programsTable).values({ id: ids.program, facilityId: ids.facility, name: "Nexus Foundations" }).onConflictDoNothing();
  await db.insert(facilitiesTable).values({ id: ids.secondFacility, regionId: ids.region, name: "Escambia County Work Annex" }).onConflictDoNothing();
  await db.insert(programsTable).values({ id: ids.secondProgram, facilityId: ids.secondFacility, name: "Workforce Readiness" }).onConflictDoNothing();
  await db.insert(cohortsTable).values({ id: ids.cohort, programId: ids.program, name: "Spring 2026 Cohort" }).onConflictDoNothing();
  await db.insert(tenantConfigurationsTable).values({
    organizationId: ids.org,
    modules: { abe: true, hse: true, specialEducation: false, accessibility: true, aiTutor: false, career: false, reentry: false, passport: false, offlineMode: false },
    policies: { sessionTimeoutMinutes: 60, inactivityTimeoutMinutes: 30 },
  }).onConflictDoUpdate({
    target: tenantConfigurationsTable.organizationId,
    set: {
      modules: { abe: true, hse: true, specialEducation: false, accessibility: true, aiTutor: false, career: false, reentry: false, passport: false, offlineMode: false },
      policies: { sessionTimeoutMinutes: 60, inactivityTimeoutMinutes: 30 },
    },
  });
  await db.insert(rolesTable).values([
    { id: ids.adminRole, key: "administrator", name: "Administrator" }, { id: ids.educatorRole, key: "educator", name: "Educator" }, { id: ids.learnerRole, key: "learner", name: "Learner" },
  ]).onConflictDoNothing();
  await db.insert(permissionsTable).values([{ id: ids.overview, key: "admin.overview", description: "View scoped administration overview" }, { id: ids.audit, key: "audit.read", description: "Read scoped security audit events" }, { id: ids.manageHierarchy, key: "admin.hierarchy.manage", description: "Manage facilities and programs in assigned scope" }, { id: ids.manageTenant, key: "tenant.configuration.manage", description: "Manage tenant configuration" }, { id: ids.manageCurriculum, key: "curriculum.manage", description: "Author, review, publish, and assign curriculum in assigned scope" }]).onConflictDoNothing();
  await db.insert(rolePermissionsTable).values([{ roleId: ids.adminRole, permissionId: ids.overview }, { roleId: ids.adminRole, permissionId: ids.audit }, { roleId: ids.adminRole, permissionId: ids.manageHierarchy }, { roleId: ids.adminRole, permissionId: ids.manageTenant }, { roleId: ids.adminRole, permissionId: ids.manageCurriculum }, { roleId: ids.educatorRole, permissionId: ids.manageCurriculum }]).onConflictDoNothing();
  await db.insert(usersTable).values([
    { id: ids.admin, clerkUserId: "user_nexus_demo_admin", displayName: "Avery Morgan", email: "avery.morgan@example.test" },
    { id: ids.educator, clerkUserId: "user_nexus_demo_educator", displayName: "Jordan Ellis", email: "jordan.ellis@example.test" },
    { id: ids.learner, clerkUserId: "user_nexus_demo_learner", displayName: "Taylor Reed", email: "taylor.reed@example.test" },
    { id: ids.facilityAdmin, clerkUserId: "user_nexus_demo_facility_admin", displayName: "Casey Rivera", email: "casey.rivera@example.test" },
  ]).onConflictDoNothing();
  await db.insert(staffProfilesTable).values([{ userId: ids.admin, title: "Nexus Administrator" }, { userId: ids.facilityAdmin, title: "Facility Administrator" }, { userId: ids.educator, title: "Learning Facilitator" }]).onConflictDoNothing();
  await db.insert(learnerProfilesTable).values({ userId: ids.learner, cohortId: ids.cohort }).onConflictDoNothing();
  await db.insert(learnerCourseworkTable).values({
    id: ids.coursework, organizationId: ids.org, cohortId: ids.cohort,
    title: "Building a Weekly Learning Routine", description: "Practice planning focused study time with this guided demo lesson.", instructionalMinutes: 30,
  }).onConflictDoNothing();
  await db.insert(learnerCourseworkAssignmentsTable).values({ learnerUserId: ids.learner, courseworkId: ids.coursework }).onConflictDoNothing();
  await db.insert(approvedLearnerResourcesTable).values({
    id: ids.resource,
    organizationId: ids.org,
    title: "Nexus learning strategies",
    summary: "Practical ways to plan focused study time and remember what you learn.",
    content: "Choose one clear goal for each study session. Work in focused blocks, pause briefly, and finish by writing down the next step. Review completed work at the end of the week and adjust your plan with your instructor when needed.",
    route: "/learner/resources/learning-strategies",
  }).onConflictDoUpdate({
    target: approvedLearnerResourcesTable.id,
    set: {
      title: "Nexus learning strategies",
      summary: "Practical ways to plan focused study time and remember what you learn.",
      content: "Choose one clear goal for each study session. Work in focused blocks, pause briefly, and finish by writing down the next step. Review completed work at the end of the week and adjust your plan with your instructor when needed.",
      route: "/learner/resources/learning-strategies",
    },
  });
  const facilityScope = { organizationId: ids.org, agencyId: ids.agency, regionId: ids.region, facilityId: ids.facility, programId: ids.program, cohortId: ids.cohort };
  await db.insert(userRoleAssignmentsTable).values({
    id: "10000000-0000-4000-8000-000000000040", userId: ids.admin, roleId: ids.adminRole, organizationId: ids.org,
  }).onConflictDoUpdate({
    target: userRoleAssignmentsTable.id,
    set: { agencyId: null, regionId: null, facilityId: null, programId: null, cohortId: null },
  });
  await db.insert(userRoleAssignmentsTable).values([
    { id: "10000000-0000-4000-8000-000000000043", userId: ids.facilityAdmin, roleId: ids.adminRole, ...facilityScope, programId: null, cohortId: null },
    { id: "10000000-0000-4000-8000-000000000041", userId: ids.educator, roleId: ids.educatorRole, ...facilityScope },
    { id: "10000000-0000-4000-8000-000000000042", userId: ids.learner, roleId: ids.learnerRole, ...facilityScope },
  ]).onConflictDoNothing();
}
seed().then(() => process.exit(0)).catch((error: unknown) => { process.stderr.write(`Nexus seed failed: ${error instanceof Error ? error.message : "unknown error"}\n`); process.exit(1); });