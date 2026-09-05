import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  agenciesTable, applicationSessionsTable, approvedLearnerResourcesTable, auditEventsTable, cohortsTable, db, facilitiesTable,
  learnerActivityTable, learnerCourseworkAssignmentsTable, learnerCourseworkTable, learnerGoalsTable, organizationsTable,
  programsTable, regionsTable, tenantConfigurationsTable, usersTable,
} from "@workspace/db";
import { completeCoursework, learnerHome, updateGoals } from "./learner";
import type { PortalContext } from "./identity";
import { requireLearner } from "../middlewares/auth";

const ids = {
  org: "91000000-0000-4000-8000-000000000001", agency: "91000000-0000-4000-8000-000000000002",
  orgB: "91000000-0000-4000-8000-000000000007",
  region: "91000000-0000-4000-8000-000000000003", facility: "91000000-0000-4000-8000-000000000004",
  program: "91000000-0000-4000-8000-000000000005", cohort: "91000000-0000-4000-8000-000000000006",
  learnerA: "91000000-0000-4000-8000-000000000010", learnerB: "91000000-0000-4000-8000-000000000011",
  courseworkA: "91000000-0000-4000-8000-000000000020", courseworkB: "91000000-0000-4000-8000-000000000021",
  expiredSession: "91000000-0000-4000-8000-000000000030",
  freshSession: "91000000-0000-4000-8000-000000000031",
};
const context = (userId: string, organizationId = ids.org): PortalContext => ({
  userId, displayName: userId === ids.learnerA ? "Learner A" : "Learner B", email: null, role: "learner", permissions: [],
  scope: { organization: { id: organizationId, name: "Test Organization" }, agency: null, region: null, facility: null, program: null, cohort: null, level: "organization" },
});
beforeAll(async () => {
  await db.insert(organizationsTable).values([
    { id: ids.org, name: "Test Organization" },
    { id: ids.orgB, name: "Second Test Organization" },
  ]);
  await db.insert(tenantConfigurationsTable).values({
    organizationId: ids.org,
    modules: {},
    policies: { sessionTimeoutMinutes: 5, inactivityTimeoutMinutes: 5 },
  });
  await db.insert(agenciesTable).values({ id: ids.agency, organizationId: ids.org, name: "Test Agency" });
  await db.insert(regionsTable).values({ id: ids.region, agencyId: ids.agency, name: "Test Region" });
  await db.insert(facilitiesTable).values({ id: ids.facility, regionId: ids.region, name: "Test Facility" });
  await db.insert(programsTable).values({ id: ids.program, facilityId: ids.facility, name: "Test Program" });
  await db.insert(cohortsTable).values({ id: ids.cohort, programId: ids.program, name: "Test Cohort" });
  await db.insert(usersTable).values([{ id: ids.learnerA, clerkUserId: "test_learner_a", displayName: "Learner A" }, { id: ids.learnerB, clerkUserId: "test_learner_b", displayName: "Learner B" }]);
  await db.insert(applicationSessionsTable).values({
    id: ids.expiredSession,
    userId: ids.learnerA,
    clerkSessionId: "expired_learner_session",
    createdAt: new Date(Date.now() - 10 * 60_000),
  });
  await db.insert(applicationSessionsTable).values({
    id: ids.freshSession,
    userId: ids.learnerA,
    clerkSessionId: "fresh_learner_session",
  });
  await db.insert(learnerCourseworkTable).values([
    { id: ids.courseworkA, organizationId: ids.org, cohortId: ids.cohort, title: "A", description: "A", instructionalMinutes: 30 },
    { id: ids.courseworkB, organizationId: ids.org, cohortId: ids.cohort, title: "B", description: "B", instructionalMinutes: 60 },
  ]);
  await db.insert(learnerCourseworkAssignmentsTable).values([{ learnerUserId: ids.learnerA, courseworkId: ids.courseworkA }, { learnerUserId: ids.learnerB, courseworkId: ids.courseworkB }]);
});
afterAll(async () => {
  await db.delete(auditEventsTable).where(eq(auditEventsTable.actorUserId, ids.learnerA));
  await db.delete(auditEventsTable).where(eq(auditEventsTable.actorUserId, ids.learnerB));
  await db.delete(learnerGoalsTable).where(eq(learnerGoalsTable.learnerUserId, ids.learnerA));
  await db.delete(learnerGoalsTable).where(eq(learnerGoalsTable.learnerUserId, ids.learnerB));
  await db.delete(learnerActivityTable).where(eq(learnerActivityTable.learnerUserId, ids.learnerA));
  await db.delete(learnerActivityTable).where(eq(learnerActivityTable.learnerUserId, ids.learnerB));
  await db.delete(learnerCourseworkAssignmentsTable).where(eq(learnerCourseworkAssignmentsTable.learnerUserId, ids.learnerA));
  await db.delete(learnerCourseworkAssignmentsTable).where(eq(learnerCourseworkAssignmentsTable.learnerUserId, ids.learnerB));
  await db.delete(approvedLearnerResourcesTable).where(eq(approvedLearnerResourcesTable.organizationId, ids.org));
  await db.delete(learnerCourseworkTable).where(eq(learnerCourseworkTable.organizationId, ids.org));
  await db.delete(applicationSessionsTable).where(eq(applicationSessionsTable.id, ids.expiredSession));
  await db.delete(applicationSessionsTable).where(eq(applicationSessionsTable.id, ids.freshSession));
  await db.delete(usersTable).where(eq(usersTable.id, ids.learnerA));
  await db.delete(usersTable).where(eq(usersTable.id, ids.learnerB));
  await db.delete(cohortsTable).where(eq(cohortsTable.id, ids.cohort));
  await db.delete(programsTable).where(eq(programsTable.id, ids.program));
  await db.delete(facilitiesTable).where(eq(facilitiesTable.id, ids.facility));
  await db.delete(regionsTable).where(eq(regionsTable.id, ids.region));
  await db.delete(agenciesTable).where(eq(agenciesTable.id, ids.agency));
  await db.delete(tenantConfigurationsTable).where(eq(tenantConfigurationsTable.organizationId, ids.org));
  await db.delete(organizationsTable).where(eq(organizationsTable.id, ids.org));
  await db.delete(organizationsTable).where(eq(organizationsTable.id, ids.orgB));
});
describe("learner data ownership and audit persistence", () => {
  it("never returns or completes another learner's coursework", async () => {
    const a = await learnerHome(context(ids.learnerA));
    expect(a.coursework.map((coursework) => coursework.id)).toEqual([ids.courseworkA]);
    await expect(completeCoursework(context(ids.learnerA), ids.courseworkB)).resolves.toBeNull();
    const b = await learnerHome(context(ids.learnerB));
    expect(b.coursework[0]?.status).toBe("assigned");
  });
  it("persists learner-owned goals and audit events", async () => {
    await updateGoals(context(ids.learnerA), ["Complete the demo"]);
    const home = await learnerHome(context(ids.learnerA));
    expect(home.goals.goals).toEqual(["Complete the demo"]);
    const events = await db.select().from(auditEventsTable).where(eq(auditEventsTable.actorUserId, ids.learnerA));
    expect(events.some((event) => event.action === "learner.goals.updated")).toBe(true);
  });
  it("keeps goals isolated when the same learner has multiple tenant scopes", async () => {
    await updateGoals(context(ids.learnerA), ["Organization A goal"]);
    await updateGoals(context(ids.learnerA, ids.orgB), ["Organization B goal"]);
    expect((await learnerHome(context(ids.learnerA))).goals.goals).toEqual(["Organization A goal"]);
    expect((await learnerHome(context(ids.learnerA, ids.orgB))).goals.goals).toEqual(["Organization B goal"]);
  });
  it("denies staff role access to learner-only functions", async () => {
    let statusCode = 0;
    let nextCalled = false;
    const request = { portalContext: { ...context(ids.learnerA), role: "educator" } };
    const response = { status: (code: number) => { statusCode = code; return response; }, json: () => response };
    await requireLearner(request as never, response as never, () => { nextCalled = true; });
    expect(statusCode).toBe(403);
    expect(nextCalled).toBe(false);
  });
  it("revokes and denies an expired learner session on the server", async () => {
    let statusCode = 0;
    let nextCalled = false;
    const request = {
      portalContext: context(ids.learnerA),
      portalSession: {
        id: ids.expiredSession,
        createdAt: new Date(Date.now() - 10 * 60_000),
        revokedAt: null,
      },
    };
    const response = { status: (code: number) => { statusCode = code; return response; }, json: () => response };
    await requireLearner(request as never, response as never, () => { nextCalled = true; });
    expect(statusCode).toBe(401);
    expect(nextCalled).toBe(false);
    const [session] = await db.select().from(applicationSessionsTable)
      .where(eq(applicationSessionsTable.id, ids.expiredSession));
    expect(session?.revokedAt).toBeInstanceOf(Date);
  });
  it("allows a fresh session after an older session expired", async () => {
    let statusCode = 0;
    let nextCalled = false;
    const createdAt = new Date();
    const request = {
      portalContext: context(ids.learnerA),
      portalSession: { id: ids.freshSession, createdAt, revokedAt: null },
    };
    const response = { status: (code: number) => { statusCode = code; return response; }, json: () => response };
    await requireLearner(request as never, response as never, () => { nextCalled = true; });
    expect(statusCode).toBe(0);
    expect(nextCalled).toBe(true);
    const [activity] = await db.select().from(learnerActivityTable)
      .where(eq(learnerActivityTable.applicationSessionId, ids.freshSession));
    expect(activity?.organizationId).toBe(ids.org);
    expect(activity?.lastActiveAt.getTime()).toBe(createdAt.getTime());
  });
});