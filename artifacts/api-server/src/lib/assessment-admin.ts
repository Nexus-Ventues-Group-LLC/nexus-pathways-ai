import { and, eq, isNull } from "drizzle-orm";
import {
  agenciesTable, assessmentsTable, cohortsTable, coursesTable, db, facilitiesTable, learnerAssessmentAssignmentsTable,
  learnerAssessmentDefinitionsTable, learnerAssessmentQuestionsTable, learnerProfilesTable, lessonsTable,
  modulesTable, programsTable, regionsTable, skillsTable, subjectsTable, unitsTable, usersTable,
} from "@workspace/db";
import type { PortalContext } from "./identity";
import { writeAudit } from "./identity";

export class AssessmentAdminError extends Error { constructor(readonly kind: "not-found" | "invalid") { super(kind); } }
const audit = (context: PortalContext, action: string, outcome = "success") => writeAudit({
  actorUserId: context.userId, actorDisplayName: context.displayName, organizationId: context.scope.organization.id,
  facilityId: context.scope.facility?.id, action, category: "curriculum", resourceType: "assessment", outcome,
});
type QuestionInput = { prompt: string; choices: string[]; correctAnswer: string; skillId?: string; skillLabel?: string };
type DefinitionInput = { kind: "placement" | "diagnostic" | "lesson" | "unit" | "practice"; title: string; instructions?: string; curriculumAssessmentId?: string; unitId?: string; questions: QuestionInput[] };

async function curriculumAssessment(context: PortalContext, assessmentId: string) {
  const [row] = await db.select({ assessment: assessmentsTable, lessonId: lessonsTable.id, unitId: unitsTable.id }).from(assessmentsTable)
    .innerJoin(lessonsTable, eq(assessmentsTable.lessonId, lessonsTable.id)).innerJoin(unitsTable, eq(lessonsTable.unitId, unitsTable.id))
    .innerJoin(modulesTable, eq(unitsTable.moduleId, modulesTable.id)).innerJoin(subjectsTable, eq(modulesTable.subjectId, subjectsTable.id))
    .innerJoin(coursesTable, eq(subjectsTable.courseId, coursesTable.id))
    .where(and(eq(assessmentsTable.id, assessmentId), eq(coursesTable.organizationId, context.scope.organization.id))).limit(1);
  return row;
}

async function validSkill(context: PortalContext, skillId: string) {
  const [skill] = await db.select({ id: skillsTable.id }).from(skillsTable).innerJoin(assessmentsTable, eq(skillsTable.assessmentId, assessmentsTable.id))
    .innerJoin(lessonsTable, eq(assessmentsTable.lessonId, lessonsTable.id)).innerJoin(unitsTable, eq(lessonsTable.unitId, unitsTable.id))
    .innerJoin(modulesTable, eq(unitsTable.moduleId, modulesTable.id)).innerJoin(subjectsTable, eq(modulesTable.subjectId, subjectsTable.id))
    .innerJoin(coursesTable, eq(subjectsTable.courseId, coursesTable.id))
    .where(and(eq(skillsTable.id, skillId), eq(coursesTable.organizationId, context.scope.organization.id))).limit(1);
  return skill;
}
export async function createAssessmentDefinition(context: PortalContext, input: DefinitionInput) {
  if (!input.questions.length || input.questions.some((q) => q.choices.length < 2 || new Set(q.choices).size !== q.choices.length || !q.choices.includes(q.correctAnswer))) {
    await audit(context, "assessment.definition.create.denied", "denied"); throw new AssessmentAdminError("invalid");
  }
  let lessonId: string | null = null; let unitId = input.unitId ?? null; let title = input.title; let instructions = input.instructions ?? "";
  if (input.kind === "lesson" || input.curriculumAssessmentId) {
    if (!input.curriculumAssessmentId) throw new AssessmentAdminError("invalid");
    const linked = await curriculumAssessment(context, input.curriculumAssessmentId);
    if (!linked) throw new AssessmentAdminError("not-found");
    if (input.kind !== "lesson" && input.kind !== "unit") throw new AssessmentAdminError("invalid");
    lessonId = linked.lessonId; unitId = linked.unitId; title = linked.assessment.title; instructions = linked.assessment.instructions;
    const [existing] = await db.select({ id: learnerAssessmentDefinitionsTable.id }).from(learnerAssessmentDefinitionsTable)
      .where(eq(learnerAssessmentDefinitionsTable.curriculumAssessmentId, input.curriculumAssessmentId)).limit(1);
    if (existing) throw new AssessmentAdminError("invalid");
  } else if (input.kind === "unit") {
    if (!unitId) throw new AssessmentAdminError("invalid");
    // A unit assessment must be inside this tenant's course hierarchy.
    const [unit] = await db.select({ id: unitsTable.id }).from(unitsTable).innerJoin(modulesTable, eq(unitsTable.moduleId, modulesTable.id))
      .innerJoin(subjectsTable, eq(modulesTable.subjectId, subjectsTable.id)).innerJoin(coursesTable, eq(subjectsTable.courseId, coursesTable.id))
      .where(and(eq(unitsTable.id, unitId), eq(coursesTable.organizationId, context.scope.organization.id))).limit(1);
    if (!unit) throw new AssessmentAdminError("not-found");
  } else if (unitId) throw new AssessmentAdminError("invalid");
  for (const question of input.questions) if (question.skillId && !await validSkill(context, question.skillId)) throw new AssessmentAdminError("not-found");
  const definition = await db.transaction(async (tx) => {
    const [created] = await tx.insert(learnerAssessmentDefinitionsTable).values({
      organizationId: context.scope.organization.id, kind: input.kind, title, instructions, lessonId, unitId,
      curriculumAssessmentId: input.curriculumAssessmentId ?? null,
    }).returning();
    await tx.insert(learnerAssessmentQuestionsTable).values(input.questions.map((question, position) => ({
      assessmentId: created.id, prompt: question.prompt, choices: question.choices, correctAnswer: question.correctAnswer,
      skillId: question.skillId ?? null, skillLabel: question.skillLabel ?? null, position,
    })));
    return created;
  });
  await audit(context, "assessment.definition.created");
  return { id: definition.id, title: definition.title, instructions: definition.instructions, kind: definition.kind, questionCount: input.questions.length, curriculumAssessmentId: definition.curriculumAssessmentId, unitId: definition.unitId };
}
async function tenantLearner(context: PortalContext, learnerUserId: string) {
  const [learner] = await db.select({ id: learnerProfilesTable.userId }).from(learnerProfilesTable).innerJoin(cohortsTable, eq(learnerProfilesTable.cohortId, cohortsTable.id))
    .innerJoin(programsTable, eq(cohortsTable.programId, programsTable.id)).innerJoin(facilitiesTable, eq(programsTable.facilityId, facilitiesTable.id))
    .innerJoin(regionsTable, eq(facilitiesTable.regionId, regionsTable.id)).innerJoin(agenciesTable, eq(regionsTable.agencyId, agenciesTable.id))
    .where(and(eq(learnerProfilesTable.userId, learnerUserId), eq(agenciesTable.organizationId, context.scope.organization.id))).limit(1);
  return learner;
}
export async function assignAssessmentToLearner(context: PortalContext, assessmentId: string, input: { learnerUserId: string; assigned: boolean }) {
  const [definition] = await db.select().from(learnerAssessmentDefinitionsTable).where(and(eq(learnerAssessmentDefinitionsTable.id, assessmentId), eq(learnerAssessmentDefinitionsTable.organizationId, context.scope.organization.id))).limit(1);
  if (!definition || !await tenantLearner(context, input.learnerUserId)) { await audit(context, "assessment.assignment.denied", "denied"); throw new AssessmentAdminError("not-found"); }
  if (definition.kind === "lesson" || definition.kind === "unit") throw new AssessmentAdminError("invalid");
  let assignment;
  if (input.assigned) [assignment] = await db.insert(learnerAssessmentAssignmentsTable).values({ organizationId: context.scope.organization.id, assessmentId, learnerUserId: input.learnerUserId })
    .onConflictDoUpdate({ target: [learnerAssessmentAssignmentsTable.assessmentId, learnerAssessmentAssignmentsTable.learnerUserId], set: { unassignedAt: null, assignedAt: new Date() } }).returning();
  else [assignment] = await db.update(learnerAssessmentAssignmentsTable).set({ unassignedAt: new Date() }).where(and(eq(learnerAssessmentAssignmentsTable.assessmentId, assessmentId), eq(learnerAssessmentAssignmentsTable.learnerUserId, input.learnerUserId), eq(learnerAssessmentAssignmentsTable.organizationId, context.scope.organization.id))).returning();
  if (!assignment) throw new AssessmentAdminError("not-found");
  await audit(context, input.assigned ? "assessment.assigned" : "assessment.unassigned");
  return assignment;
}
export async function listAssessmentDefinitions(context: PortalContext) {
  const definitions = await db.select().from(learnerAssessmentDefinitionsTable)
    .where(eq(learnerAssessmentDefinitionsTable.organizationId, context.scope.organization.id));
  const result = [];
  for (const definition of definitions) {
    const questions = await db.select({ id: learnerAssessmentQuestionsTable.id }).from(learnerAssessmentQuestionsTable)
      .where(eq(learnerAssessmentQuestionsTable.assessmentId, definition.id));
    const assignments = await db.select({ id: learnerAssessmentAssignmentsTable.id }).from(learnerAssessmentAssignmentsTable)
      .where(and(eq(learnerAssessmentAssignmentsTable.assessmentId, definition.id), eq(learnerAssessmentAssignmentsTable.organizationId, context.scope.organization.id), isNull(learnerAssessmentAssignmentsTable.unassignedAt)));
    result.push({ id: definition.id, title: definition.title, instructions: definition.instructions, kind: definition.kind, questionCount: questions.length,
      curriculumAssessmentId: definition.curriculumAssessmentId, unitId: definition.unitId, assignmentCount: assignments.length });
  }
  await audit(context, "assessment.definitions.read");
  return result;
}
export async function listEligibleAssessmentLearners(context: PortalContext) {
  const learners = await db.select({
    id: usersTable.id, displayName: usersTable.displayName, cohort: cohortsTable.name, program: programsTable.name, facility: facilitiesTable.name,
  }).from(learnerProfilesTable).innerJoin(usersTable, eq(learnerProfilesTable.userId, usersTable.id))
    .innerJoin(cohortsTable, eq(learnerProfilesTable.cohortId, cohortsTable.id)).innerJoin(programsTable, eq(cohortsTable.programId, programsTable.id))
    .innerJoin(facilitiesTable, eq(programsTable.facilityId, facilitiesTable.id)).innerJoin(regionsTable, eq(facilitiesTable.regionId, regionsTable.id))
    .innerJoin(agenciesTable, eq(regionsTable.agencyId, agenciesTable.id))
    .where(eq(agenciesTable.organizationId, context.scope.organization.id));
  await audit(context, "assessment.eligible_learners.read");
  return learners;
}