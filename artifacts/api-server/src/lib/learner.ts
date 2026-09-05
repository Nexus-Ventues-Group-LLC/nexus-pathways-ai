import { and, eq, like, notLike, sql } from "drizzle-orm";
import {
  approvedLearnerResourcesTable, db, learnerActivityTable, learnerCourseworkAssignmentsTable,
  learnerCourseworkTable, learnerGoalsTable, learnerPresentationPreferencesTable,
  tenantConfigurationsTable,
} from "@workspace/db";
import type { PortalContext } from "./identity";
import { writeAudit } from "./identity";

const defaults = { textSize: "standard", highContrast: false, reduceMotion: false } as const;
type Preferences = { textSize: "standard" | "large" | "extra-large"; highContrast: boolean; reduceMotion: boolean };
const audit = (context: PortalContext, action: string, outcome = "success", resourceType?: string) =>
  writeAudit({ actorUserId: context.userId, actorDisplayName: context.displayName, organizationId: context.scope.organization.id, facilityId: context.scope.facility?.id, action, category: "learner", resourceType, outcome });

async function policy(context: PortalContext) {
  const [config] = await db.select({ policies: tenantConfigurationsTable.policies }).from(tenantConfigurationsTable)
    .where(eq(tenantConfigurationsTable.organizationId, context.scope.organization.id)).limit(1);
  const values = config?.policies as { sessionTimeoutMinutes?: number; inactivityTimeoutMinutes?: number } | undefined;
  return { sessionTimeoutMinutes: values?.sessionTimeoutMinutes ?? 60, inactivityTimeoutMinutes: values?.inactivityTimeoutMinutes ?? 30 };
}
async function activity(context: PortalContext) {
  const [row] = await db.select().from(learnerActivityTable).where(and(
    eq(learnerActivityTable.learnerUserId, context.userId),
    eq(learnerActivityTable.organizationId, context.scope.organization.id),
  )).orderBy(sql`${learnerActivityTable.lastActiveAt} desc`).limit(1);
  return { lastActiveAt: row?.lastActiveAt ?? new Date(), ...(await policy(context)) };
}
export async function learnerHome(context: PortalContext) {
  const coursework = await db.select({
    id: learnerCourseworkTable.id, title: learnerCourseworkTable.title, description: learnerCourseworkTable.description,
    instructionalMinutes: learnerCourseworkTable.instructionalMinutes, completedAt: learnerCourseworkAssignmentsTable.completedAt,
  }).from(learnerCourseworkAssignmentsTable).innerJoin(learnerCourseworkTable, eq(learnerCourseworkAssignmentsTable.courseworkId, learnerCourseworkTable.id))
    .where(and(eq(learnerCourseworkAssignmentsTable.learnerUserId, context.userId), eq(learnerCourseworkTable.organizationId, context.scope.organization.id)));
  const [goals] = await db.select().from(learnerGoalsTable).where(and(
    eq(learnerGoalsTable.learnerUserId, context.userId),
    eq(learnerGoalsTable.organizationId, context.scope.organization.id),
  )).limit(1);
  const [preferences] = await db.select().from(learnerPresentationPreferencesTable).where(eq(learnerPresentationPreferencesTable.learnerUserId, context.userId)).limit(1);
  const resources = await db.select({
    id: approvedLearnerResourcesTable.id,
    title: approvedLearnerResourcesTable.title,
    summary: approvedLearnerResourcesTable.summary,
    content: approvedLearnerResourcesTable.content,
    route: approvedLearnerResourcesTable.route,
  })
    .from(approvedLearnerResourcesTable).where(and(
      eq(approvedLearnerResourcesTable.organizationId, context.scope.organization.id),
      like(approvedLearnerResourcesTable.route, "/learner/resources/%"),
      notLike(approvedLearnerResourcesTable.route, "//%"),
    ));
  const mapped = coursework.map((item) => ({ id: item.id, title: item.title, description: item.description, instructionalHours: item.instructionalMinutes / 60, status: item.completedAt ? "completed" as const : "assigned" as const, completedAt: item.completedAt }));
  await audit(context, "learner.home.read");
  return { coursework: mapped, goals: { goals: goals?.goals ?? [] }, presentationPreferences: preferences ? { textSize: preferences.textSize as Preferences["textSize"], highContrast: preferences.highContrast === 1, reduceMotion: preferences.reduceMotion === 1 } : defaults, resources, instructionalHoursCompleted: mapped.filter((item) => item.status === "completed").reduce((sum, item) => sum + item.instructionalHours, 0), activity: await activity(context) };
}
export async function completeCoursework(context: PortalContext, courseworkId: string) {
  const [coursework] = await db.select().from(learnerCourseworkTable).innerJoin(learnerCourseworkAssignmentsTable, eq(learnerCourseworkAssignmentsTable.courseworkId, learnerCourseworkTable.id))
    .where(and(eq(learnerCourseworkAssignmentsTable.learnerUserId, context.userId), eq(learnerCourseworkTable.id, courseworkId), eq(learnerCourseworkTable.organizationId, context.scope.organization.id))).limit(1);
  if (!coursework) { await audit(context, "learner.coursework.complete.denied", "denied", "coursework"); return null; }
  const [assignment] = await db.update(learnerCourseworkAssignmentsTable).set({ completedAt: new Date() })
    .where(and(eq(learnerCourseworkAssignmentsTable.learnerUserId, context.userId), eq(learnerCourseworkAssignmentsTable.courseworkId, courseworkId)))
    .returning();
  if (!assignment) { await audit(context, "learner.coursework.complete.denied", "denied", "coursework"); return null; }
  await audit(context, "learner.coursework.completed", "success", "coursework");
  return { id: coursework.learner_coursework.id, title: coursework.learner_coursework.title, description: coursework.learner_coursework.description, instructionalHours: coursework.learner_coursework.instructionalMinutes / 60, status: "completed" as const, completedAt: assignment.completedAt! };
}
export async function updateGoals(context: PortalContext, goals: string[]) {
  const [row] = await db.insert(learnerGoalsTable).values({ learnerUserId: context.userId, organizationId: context.scope.organization.id, goals })
    .onConflictDoUpdate({
      target: [learnerGoalsTable.learnerUserId, learnerGoalsTable.organizationId],
      set: { goals, updatedAt: new Date() },
    }).returning();
  await audit(context, "learner.goals.updated");
  return { goals: row.goals };
}
export async function updatePreferences(context: PortalContext, input: Preferences) {
  const [row] = await db.insert(learnerPresentationPreferencesTable).values({ learnerUserId: context.userId, textSize: input.textSize, highContrast: input.highContrast ? 1 : 0, reduceMotion: input.reduceMotion ? 1 : 0 })
    .onConflictDoUpdate({ target: learnerPresentationPreferencesTable.learnerUserId, set: { textSize: input.textSize, highContrast: input.highContrast ? 1 : 0, reduceMotion: input.reduceMotion ? 1 : 0, updatedAt: new Date() } }).returning();
  await audit(context, "learner.presentation_preferences.updated");
  return { textSize: row.textSize as Preferences["textSize"], highContrast: row.highContrast === 1, reduceMotion: row.reduceMotion === 1 };
}
export async function recordActivity(context: PortalContext, applicationSessionId: string) {
  const [row] = await db.insert(learnerActivityTable).values({
    applicationSessionId,
    learnerUserId: context.userId,
    organizationId: context.scope.organization.id,
    lastActiveAt: new Date(),
  }).onConflictDoUpdate({
    target: learnerActivityTable.applicationSessionId,
    set: { lastActiveAt: sql`now()` },
  }).returning();
  await audit(context, "learner.activity.recorded");
  return { lastActiveAt: row.lastActiveAt, ...(await policy(context)) };
}