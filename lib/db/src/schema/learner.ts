import { integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { applicationSessionsTable, cohortsTable, organizationsTable, usersTable } from "./phase1";

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