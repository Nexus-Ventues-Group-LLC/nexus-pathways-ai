import { integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { applicationSessionsTable, cohortsTable, organizationsTable, usersTable } from "./phase1";
import { assessmentsTable, lessonsTable, skillsTable, unitsTable } from "./curriculum";

const id = (name: string) => uuid(name).defaultRandom().primaryKey();
const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** Institution-authored demo content; learners can only receive assignments, never author it. */
export const learnerCourseworkTable = pgTable("learner_coursework", {
  id: id("id"),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  cohortId: uuid("cohort_id").notNull().references(() => cohortsTable.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  instructionalMinutes: integer("instructional_minutes").notNull(),
  createdAt,
});
export const learnerCourseworkAssignmentsTable = pgTable("learner_coursework_assignments", {
  id: id("id"),
  learnerUserId: uuid("learner_user_id").notNull().references(() => usersTable.id),
  courseworkId: uuid("coursework_id").notNull().references(() => learnerCourseworkTable.id),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt,
}, (t) => [uniqueIndex("learner_coursework_assignment_unique").on(t.learnerUserId, t.courseworkId)]);
export const learnerGoalsTable = pgTable("learner_goals", {
  learnerUserId: uuid("learner_user_id").notNull().references(() => usersTable.id),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  goals: text("goals").array().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [primaryKey({ columns: [t.learnerUserId, t.organizationId] })]);
export const learnerPresentationPreferencesTable = pgTable("learner_presentation_preferences", {
  learnerUserId: uuid("learner_user_id").primaryKey().references(() => usersTable.id),
  textSize: text("text_size").notNull().default("standard"),
  highContrast: integer("high_contrast").notNull().default(0),
  reduceMotion: integer("reduce_motion").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
export const learnerActivityTable = pgTable("learner_activity", {
  applicationSessionId: uuid("application_session_id").primaryKey().references(() => applicationSessionsTable.id),
  learnerUserId: uuid("learner_user_id").notNull().references(() => usersTable.id),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
});
export const assessmentKindEnum = pgEnum("learner_assessment_kind", ["placement", "diagnostic", "lesson", "unit", "practice"]);
export const assessmentAttemptStatusEnum = pgEnum("learner_assessment_attempt_status", ["in_progress", "submitted"]);
/** Tenant-authorized assessment definitions. Lesson/unit definitions inherit course visibility; other kinds need an explicit learner assignment. */
export const learnerAssessmentDefinitionsTable = pgTable("learner_assessment_definitions", {
  id: id("id"),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  /** One lesson curriculum assessment has one learner delivery definition. */
  curriculumAssessmentId: uuid("curriculum_assessment_id").references(() => assessmentsTable.id, { onDelete: "set null" }),
  lessonId: uuid("lesson_id").references(() => lessonsTable.id, { onDelete: "set null" }),
  unitId: uuid("unit_id").references(() => unitsTable.id, { onDelete: "set null" }),
  kind: assessmentKindEnum("kind").notNull(),
  title: text("title").notNull(),
  instructions: text("instructions").notNull().default(""),
  createdAt,
}, (t) => [uniqueIndex("learner_assessment_definition_curriculum_unique").on(t.curriculumAssessmentId)]);
export const learnerAssessmentQuestionsTable = pgTable("learner_assessment_questions", {
  id: id("id"),
  assessmentId: uuid("assessment_id").notNull().references(() => learnerAssessmentDefinitionsTable.id),
  skillId: uuid("skill_id").references(() => skillsTable.id, { onDelete: "set null" }),
  skillLabel: text("skill_label"),
  prompt: text("prompt").notNull(),
  choices: text("choices").array().notNull().default([]),
  correctAnswer: text("correct_answer").notNull(),
  position: integer("position").notNull().default(0),
  createdAt,
}, (t) => [uniqueIndex("learner_assessment_question_position_unique").on(t.assessmentId, t.position)]);
/** Explicit assignments are mandatory for placement, diagnostic, and practice assessments. */
export const learnerAssessmentAssignmentsTable = pgTable("learner_assessment_assignments", {
  id: id("id"),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  assessmentId: uuid("assessment_id").notNull().references(() => learnerAssessmentDefinitionsTable.id),
  learnerUserId: uuid("learner_user_id").notNull().references(() => usersTable.id),
  assignedAt: createdAt,
  unassignedAt: timestamp("unassigned_at", { withTimezone: true }),
}, (t) => [uniqueIndex("learner_assessment_assignment_unique").on(t.assessmentId, t.learnerUserId)]);
/** Snapshot contains the ordered questions and answer key used for reproducible scoring after definitions change. */
export const learnerAssessmentAttemptsTable = pgTable("learner_assessment_attempts", {
  id: id("id"),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  assessmentId: uuid("assessment_id").notNull().references(() => learnerAssessmentDefinitionsTable.id),
  learnerUserId: uuid("learner_user_id").notNull().references(() => usersTable.id),
  status: assessmentAttemptStatusEnum("status").notNull().default("in_progress"),
  definitionSnapshot: jsonb("definition_snapshot").notNull(),
  score: integer("score"),
  correctAnswers: integer("correct_answers"),
  startedAt: createdAt,
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
}, (t) => [uniqueIndex("learner_assessment_one_open_attempt_unique")
  .on(t.organizationId, t.assessmentId, t.learnerUserId)
  .where(sql`${t.status} = 'in_progress'`)]);
export const learnerAssessmentResponsesTable = pgTable("learner_assessment_responses", {
  id: id("id"),
  attemptId: uuid("attempt_id").notNull().references(() => learnerAssessmentAttemptsTable.id),
  questionId: uuid("question_id").notNull().references(() => learnerAssessmentQuestionsTable.id),
  answer: text("answer").notNull(),
  isCorrect: integer("is_correct").notNull(),
  createdAt,
}, (t) => [uniqueIndex("learner_assessment_response_unique").on(t.attemptId, t.questionId)]);
export const learnerMasteryTable = pgTable("learner_mastery", {
  learnerUserId: uuid("learner_user_id").notNull().references(() => usersTable.id),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  skillId: uuid("skill_id").references(() => skillsTable.id, { onDelete: "set null" }),
  masteryKey: text("mastery_key").notNull(),
  assessmentKind: assessmentKindEnum("assessment_kind").notNull(),
  score: integer("score").notNull(),
  /** Latest submitted attempt wins by startedAt, then UUID for a deterministic tie-break. */
  latestAttemptId: uuid("latest_attempt_id").notNull().references(() => learnerAssessmentAttemptsTable.id),
  latestAttemptStartedAt: timestamp("latest_attempt_started_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [primaryKey({ columns: [t.learnerUserId, t.organizationId, t.masteryKey, t.assessmentKind] })]);
/** Route-only internal resource catalogue; no learner-supplied external URLs are stored. */
export const approvedLearnerResourcesTable = pgTable("approved_learner_resources", {
  id: id("id"),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  route: text("route").notNull(),
  createdAt,
}, (t) => [uniqueIndex("approved_learner_resource_route_unique").on(t.organizationId, t.route)]);

export const insertLearnerCourseworkSchema = createInsertSchema(learnerCourseworkTable).omit({ id: true, createdAt: true });
export const insertLearnerCourseworkAssignmentSchema = createInsertSchema(learnerCourseworkAssignmentsTable).omit({ id: true, createdAt: true });
export const insertLearnerGoalsSchema = createInsertSchema(learnerGoalsTable).omit({ updatedAt: true });
export const insertLearnerPresentationPreferencesSchema = createInsertSchema(learnerPresentationPreferencesTable).omit({ updatedAt: true });
export type LearnerCoursework = typeof learnerCourseworkTable.$inferSelect;
export type LearnerCourseworkAssignment = typeof learnerCourseworkAssignmentsTable.$inferSelect;
export type LearnerGoals = typeof learnerGoalsTable.$inferSelect;
export type LearnerPresentationPreferences = typeof learnerPresentationPreferencesTable.$inferSelect;
export type InsertLearnerCoursework = z.infer<typeof insertLearnerCourseworkSchema>;