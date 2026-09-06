import { and, asc, eq, like, notLike, sql } from "drizzle-orm";
import {
  approvedLearnerResourcesTable, courseCohortAssignmentsTable, coursesTable, db, learnerActivityTable, learnerCourseworkAssignmentsTable,
  learnerCourseworkTable, learnerGoalsTable, learnerPresentationPreferencesTable,
  learnerProfilesTable, tenantConfigurationsTable, learnerAssessmentAssignmentsTable, learnerAssessmentAttemptsTable,
  learnerAssessmentDefinitionsTable, learnerAssessmentQuestionsTable, learnerAssessmentResponsesTable, learnerMasteryTable,
  lessonsTable, unitsTable, modulesTable, subjectsTable,
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
  // Curriculum visibility is enforced at query time: learner cohort assignment + published tenant course.
  const curriculum = await db.select({
    id: coursesTable.id, title: coursesTable.title, description: coursesTable.description,
  }).from(learnerProfilesTable).innerJoin(courseCohortAssignmentsTable, eq(courseCohortAssignmentsTable.cohortId, learnerProfilesTable.cohortId))
    .innerJoin(coursesTable, eq(courseCohortAssignmentsTable.courseId, coursesTable.id))
    .where(and(eq(learnerProfilesTable.userId, context.userId), eq(coursesTable.organizationId, context.scope.organization.id),
      eq(coursesTable.lifecycle, "published"), sql`${courseCohortAssignmentsTable.unassignedAt} is null`));
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
  // Keep the existing learner-home coursework response shape while sourced curriculum is introduced.
  const mapped = curriculum.map((item) => ({ id: item.id, title: item.title, description: item.description, instructionalHours: 0, status: "assigned" as const, completedAt: null }));
  await audit(context, "learner.home.read");
  return { coursework: mapped, goals: { goals: goals?.goals ?? [] }, presentationPreferences: preferences ? { textSize: preferences.textSize as Preferences["textSize"], highContrast: preferences.highContrast === 1, reduceMotion: preferences.reduceMotion === 1 } : defaults, resources, instructionalHoursCompleted: 0, activity: await activity(context) };
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

type SnapshotQuestion = { id: string; prompt: string; choices: string[]; position: number; skillId: string | null; skillLabel: string | null; correctAnswer: string };
type AssessmentSnapshot = { questions: SnapshotQuestion[] };
const assessmentAudit = (context: PortalContext, action: string, outcome = "success") =>
  audit(context, action, outcome, "assessment");
const attemptView = (attempt: typeof learnerAssessmentAttemptsTable.$inferSelect, totalQuestions: number) => {
  const snapshot = attempt.definitionSnapshot as AssessmentSnapshot;
  return {
  id: attempt.id, assessmentId: attempt.assessmentId, status: attempt.status,
  startedAt: attempt.startedAt, submittedAt: attempt.submittedAt, score: attempt.score,
  totalQuestions, correctAnswers: attempt.correctAnswers,
  questions: snapshot.questions.map(({ id, prompt, choices, position, skillId }) => ({ id, prompt, choices, position, skillId })),
  };
};

/** Visibility is checked on every operation, rather than trusting a client-held assignment id. */
async function eligibleAssessment(context: PortalContext, assessmentId: string) {
  const [definition] = await db.select().from(learnerAssessmentDefinitionsTable).where(and(
    eq(learnerAssessmentDefinitionsTable.id, assessmentId),
    eq(learnerAssessmentDefinitionsTable.organizationId, context.scope.organization.id),
  )).limit(1);
  if (!definition) return null;
  if (definition.kind === "lesson" || definition.kind === "unit") {
    const courseEligibility = definition.kind === "lesson"
      ? db.select({ id: learnerAssessmentDefinitionsTable.id }).from(learnerAssessmentDefinitionsTable)
        .innerJoin(lessonsTable, eq(learnerAssessmentDefinitionsTable.lessonId, lessonsTable.id))
        .innerJoin(unitsTable, eq(lessonsTable.unitId, unitsTable.id)).innerJoin(modulesTable, eq(unitsTable.moduleId, modulesTable.id))
        .innerJoin(subjectsTable, eq(modulesTable.subjectId, subjectsTable.id)).innerJoin(coursesTable, eq(subjectsTable.courseId, coursesTable.id))
        .innerJoin(courseCohortAssignmentsTable, eq(courseCohortAssignmentsTable.courseId, coursesTable.id))
        .innerJoin(learnerProfilesTable, eq(learnerProfilesTable.cohortId, courseCohortAssignmentsTable.cohortId))
        .where(and(eq(learnerAssessmentDefinitionsTable.id, assessmentId), eq(learnerProfilesTable.userId, context.userId),
          eq(coursesTable.organizationId, context.scope.organization.id), eq(coursesTable.lifecycle, "published"), sql`${courseCohortAssignmentsTable.unassignedAt} is null`)).limit(1)
      : db.select({ id: learnerAssessmentDefinitionsTable.id }).from(learnerAssessmentDefinitionsTable)
        .innerJoin(unitsTable, eq(learnerAssessmentDefinitionsTable.unitId, unitsTable.id)).innerJoin(modulesTable, eq(unitsTable.moduleId, modulesTable.id))
        .innerJoin(subjectsTable, eq(modulesTable.subjectId, subjectsTable.id)).innerJoin(coursesTable, eq(subjectsTable.courseId, coursesTable.id))
        .innerJoin(courseCohortAssignmentsTable, eq(courseCohortAssignmentsTable.courseId, coursesTable.id))
        .innerJoin(learnerProfilesTable, eq(learnerProfilesTable.cohortId, courseCohortAssignmentsTable.cohortId))
        .where(and(eq(learnerAssessmentDefinitionsTable.id, assessmentId), eq(learnerProfilesTable.userId, context.userId),
          eq(coursesTable.organizationId, context.scope.organization.id), eq(coursesTable.lifecycle, "published"), sql`${courseCohortAssignmentsTable.unassignedAt} is null`)).limit(1);
    return (await courseEligibility)[0] ? definition : null;
  }
  const [assignment] = await db.select({ id: learnerAssessmentAssignmentsTable.id }).from(learnerAssessmentAssignmentsTable).where(and(
    eq(learnerAssessmentAssignmentsTable.assessmentId, assessmentId), eq(learnerAssessmentAssignmentsTable.learnerUserId, context.userId),
    eq(learnerAssessmentAssignmentsTable.organizationId, context.scope.organization.id), sql`${learnerAssessmentAssignmentsTable.unassignedAt} is null`,
  )).limit(1);
  return assignment ? definition : null;
}
async function questionCount(assessmentId: string) {
  const rows = await db.select({ id: learnerAssessmentQuestionsTable.id }).from(learnerAssessmentQuestionsTable)
    .where(eq(learnerAssessmentQuestionsTable.assessmentId, assessmentId));
  return rows.length;
}
export async function listAssessments(context: PortalContext) {
  const definitions = await db.select().from(learnerAssessmentDefinitionsTable)
    .where(eq(learnerAssessmentDefinitionsTable.organizationId, context.scope.organization.id));
  const result = [];
  for (const definition of definitions) if (await eligibleAssessment(context, definition.id)) {
    result.push({ id: definition.id, title: definition.title, instructions: definition.instructions, kind: definition.kind, questionCount: await questionCount(definition.id) });
  }
  await assessmentAudit(context, "learner.assessments.read");
  return result;
}
export async function assessmentDetail(context: PortalContext, assessmentId: string) {
  const definition = await eligibleAssessment(context, assessmentId);
  if (!definition) { await assessmentAudit(context, "learner.assessment.read.denied", "denied"); return null; }
  const questions = await db.select({ id: learnerAssessmentQuestionsTable.id, prompt: learnerAssessmentQuestionsTable.prompt, choices: learnerAssessmentQuestionsTable.choices, position: learnerAssessmentQuestionsTable.position, skillId: learnerAssessmentQuestionsTable.skillId })
    .from(learnerAssessmentQuestionsTable).where(eq(learnerAssessmentQuestionsTable.assessmentId, assessmentId)).orderBy(asc(learnerAssessmentQuestionsTable.position));
  await assessmentAudit(context, "learner.assessment.read");
  return { id: definition.id, title: definition.title, instructions: definition.instructions, kind: definition.kind, questionCount: questions.length, questions };
}
export async function startAssessmentAttempt(context: PortalContext, assessmentId: string) {
  const definition = await eligibleAssessment(context, assessmentId);
  if (!definition) { await assessmentAudit(context, "learner.assessment.start.denied", "denied"); return null; }
  const [open] = await db.select().from(learnerAssessmentAttemptsTable).where(and(eq(learnerAssessmentAttemptsTable.assessmentId, assessmentId),
    eq(learnerAssessmentAttemptsTable.learnerUserId, context.userId), eq(learnerAssessmentAttemptsTable.organizationId, context.scope.organization.id),
    eq(learnerAssessmentAttemptsTable.status, "in_progress"))).limit(1);
  if (open) { await assessmentAudit(context, "learner.assessment.resumed"); return attemptView(open, (open.definitionSnapshot as AssessmentSnapshot).questions.length); }
  const questions = await db.select({ id: learnerAssessmentQuestionsTable.id, prompt: learnerAssessmentQuestionsTable.prompt, choices: learnerAssessmentQuestionsTable.choices, position: learnerAssessmentQuestionsTable.position, skillId: learnerAssessmentQuestionsTable.skillId, skillLabel: learnerAssessmentQuestionsTable.skillLabel, correctAnswer: learnerAssessmentQuestionsTable.correctAnswer })
    .from(learnerAssessmentQuestionsTable).where(eq(learnerAssessmentQuestionsTable.assessmentId, assessmentId)).orderBy(asc(learnerAssessmentQuestionsTable.position));
  const [attempt] = await db.insert(learnerAssessmentAttemptsTable).values({ organizationId: context.scope.organization.id, assessmentId, learnerUserId: context.userId, definitionSnapshot: { questions } })
    .onConflictDoNothing().returning();
  if (attempt) { await assessmentAudit(context, "learner.assessment.started"); return attemptView(attempt, questions.length); }
  const [resumed] = await db.select().from(learnerAssessmentAttemptsTable).where(and(eq(learnerAssessmentAttemptsTable.assessmentId, assessmentId),
    eq(learnerAssessmentAttemptsTable.learnerUserId, context.userId), eq(learnerAssessmentAttemptsTable.organizationId, context.scope.organization.id),
    eq(learnerAssessmentAttemptsTable.status, "in_progress"))).limit(1);
  if (!resumed) throw new Error("Unable to create assessment attempt");
  await assessmentAudit(context, "learner.assessment.resumed");
  return attemptView(resumed, (resumed.definitionSnapshot as AssessmentSnapshot).questions.length);
}
export async function assessmentAttempts(context: PortalContext, assessmentId: string) {
  if (!await eligibleAssessment(context, assessmentId)) { await assessmentAudit(context, "learner.assessment.history.denied", "denied"); return null; }
  const attempts = await db.select().from(learnerAssessmentAttemptsTable).where(and(eq(learnerAssessmentAttemptsTable.assessmentId, assessmentId),
    eq(learnerAssessmentAttemptsTable.learnerUserId, context.userId), eq(learnerAssessmentAttemptsTable.organizationId, context.scope.organization.id))).orderBy(sql`${learnerAssessmentAttemptsTable.startedAt} desc`);
  await assessmentAudit(context, "learner.assessment.history.read");
  return attempts.map((attempt) => attemptView(attempt, (attempt.definitionSnapshot as AssessmentSnapshot).questions.length));
}
export async function submitAssessment(context: PortalContext, assessmentId: string, attemptId: string, input: { questionId: string; answer: string }[]) {
  const definition = await eligibleAssessment(context, assessmentId);
  if (!definition) { await assessmentAudit(context, "learner.assessment.submit.denied", "denied"); return null; }
  const [attempt] = await db.select().from(learnerAssessmentAttemptsTable).where(and(eq(learnerAssessmentAttemptsTable.id, attemptId), eq(learnerAssessmentAttemptsTable.assessmentId, assessmentId),
    eq(learnerAssessmentAttemptsTable.learnerUserId, context.userId), eq(learnerAssessmentAttemptsTable.organizationId, context.scope.organization.id))).limit(1);
  if (!attempt) { await assessmentAudit(context, "learner.assessment.submit.denied", "denied"); return null; }
  const snapshot = attempt.definitionSnapshot as AssessmentSnapshot;
  if (attempt.status === "submitted") { await assessmentAudit(context, "learner.assessment.submit.idempotent"); return attemptView(attempt, snapshot.questions.length); }
  const answers = new Map(input.map((response) => [response.questionId, response.answer]));
  const expectedQuestionIds = new Set(snapshot.questions.map((question) => question.id));
  if (input.length !== expectedQuestionIds.size || answers.size !== input.length || input.some((response) => !expectedQuestionIds.has(response.questionId))) {
    await assessmentAudit(context, "learner.assessment.submit.denied", "denied"); throw new Error("Invalid assessment response");
  }
  const scored = snapshot.questions.map((question) => ({ questionId: question.id, answer: answers.get(question.id)!, isCorrect: answers.get(question.id)! === question.correctAnswer ? 1 : 0, skillId: question.skillId, skillLabel: question.skillLabel }));
  const correctAnswers = scored.reduce((sum, response) => sum + response.isCorrect, 0);
  const score = snapshot.questions.length ? Math.round((correctAnswers / snapshot.questions.length) * 100) : 0;
  let claimedSubmission = false;
  await db.transaction(async (tx) => {
    const [claimed] = await tx.update(learnerAssessmentAttemptsTable).set({ status: "submitted", submittedAt: new Date(), score, correctAnswers })
      .where(and(eq(learnerAssessmentAttemptsTable.id, attemptId), eq(learnerAssessmentAttemptsTable.status, "in_progress"))).returning({ id: learnerAssessmentAttemptsTable.id });
    if (!claimed) return;
    claimedSubmission = true;
    if (scored.length) await tx.insert(learnerAssessmentResponsesTable).values(scored.map(({ questionId, answer, isCorrect }) => ({ attemptId, questionId, answer, isCorrect })));
    // A skill's score is its correct/total ratio within the submitted attempt. The newest
    // attempt by startedAt (UUID tie-break) wins, so retry ordering cannot change mastery.
    const bySkill = new Map<string, { skillId: string | null; correct: number; total: number }>();
    for (const response of scored) {
      const key = response.skillId ?? response.skillLabel ?? "overall";
      const aggregate = bySkill.get(key) ?? { skillId: response.skillId, correct: 0, total: 0 };
      aggregate.correct += response.isCorrect; aggregate.total += 1; bySkill.set(key, aggregate);
    }
    for (const [masteryKey, aggregate] of bySkill) {
      const skillScore = Math.round((aggregate.correct / aggregate.total) * 100);
      await tx.insert(learnerMasteryTable).values({
        learnerUserId: context.userId, organizationId: context.scope.organization.id, skillId: aggregate.skillId, masteryKey,
        assessmentKind: definition.kind, score: skillScore, latestAttemptId: attemptId, latestAttemptStartedAt: attempt.startedAt,
      }).onConflictDoUpdate({
        target: [learnerMasteryTable.learnerUserId, learnerMasteryTable.organizationId, learnerMasteryTable.masteryKey, learnerMasteryTable.assessmentKind],
        set: { skillId: aggregate.skillId, score: skillScore, latestAttemptId: attemptId, latestAttemptStartedAt: attempt.startedAt, updatedAt: new Date() },
        where: sql`excluded.latest_attempt_started_at > ${learnerMasteryTable.latestAttemptStartedAt} or (excluded.latest_attempt_started_at = ${learnerMasteryTable.latestAttemptStartedAt} and excluded.latest_attempt_id > ${learnerMasteryTable.latestAttemptId})`,
      });
    }
  });
  const [submitted] = await db.select().from(learnerAssessmentAttemptsTable).where(eq(learnerAssessmentAttemptsTable.id, attemptId)).limit(1);
  await assessmentAudit(context, claimedSubmission ? "learner.assessment.submitted" : "learner.assessment.submit.idempotent");
  return attemptView(submitted!, snapshot.questions.length);
}
export async function learnerMastery(context: PortalContext) {
  const rows = await db.select().from(learnerMasteryTable).where(and(eq(learnerMasteryTable.learnerUserId, context.userId), eq(learnerMasteryTable.organizationId, context.scope.organization.id)));
  await assessmentAudit(context, "learner.mastery.read");
  return rows.map(({ skillId, assessmentKind, score, updatedAt }) => ({ skillId, assessmentKind, score, updatedAt }));
}