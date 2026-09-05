import { integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { cohortsTable, organizationsTable, usersTable } from "./phase1";

const id = (name: string) => uuid(name).defaultRandom().primaryKey();
const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date());

export const curriculumLifecycleEnum = pgEnum("curriculum_lifecycle", ["draft", "review", "approved", "published", "retired"]);
/** Tenant-owned root aggregate. Descendants are always owned by this course's organization. */
export const coursesTable = pgTable("courses", {
  id: id("id"),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  lifecycle: curriculumLifecycleEnum("lifecycle").notNull().default("draft"),
  currentVersion: integer("current_version").notNull().default(1),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdByUserId: uuid("created_by_user_id").references(() => usersTable.id),
  createdAt,
  updatedAt,
});
export const subjectsTable = pgTable("course_subjects", { id: id("id"), courseId: uuid("course_id").notNull().references(() => coursesTable.id), title: text("title").notNull(), description: text("description").notNull().default(""), position: integer("position").notNull().default(0), createdAt, updatedAt });
export const modulesTable = pgTable("subject_modules", { id: id("id"), subjectId: uuid("subject_id").notNull().references(() => subjectsTable.id), title: text("title").notNull(), description: text("description").notNull().default(""), position: integer("position").notNull().default(0), createdAt, updatedAt });
export const unitsTable = pgTable("module_units", { id: id("id"), moduleId: uuid("module_id").notNull().references(() => modulesTable.id), title: text("title").notNull(), description: text("description").notNull().default(""), position: integer("position").notNull().default(0), createdAt, updatedAt });
export const lessonsTable = pgTable("unit_lessons", { id: id("id"), unitId: uuid("unit_id").notNull().references(() => unitsTable.id), title: text("title").notNull(), description: text("description").notNull().default(""), position: integer("position").notNull().default(0), createdAt, updatedAt });
export const activitiesTable = pgTable("lesson_activities", { id: id("id"), lessonId: uuid("lesson_id").notNull().references(() => lessonsTable.id), title: text("title").notNull(), content: text("content").notNull().default(""), position: integer("position").notNull().default(0), instructionalMinutes: integer("instructional_minutes").notNull().default(0), createdAt, updatedAt });
export const assessmentsTable = pgTable("lesson_assessments", { id: id("id"), lessonId: uuid("lesson_id").notNull().references(() => lessonsTable.id), title: text("title").notNull(), instructions: text("instructions").notNull().default(""), position: integer("position").notNull().default(0), createdAt, updatedAt });
export const skillsTable = pgTable("assessment_skills", { id: id("id"), assessmentId: uuid("assessment_id").notNull().references(() => assessmentsTable.id), title: text("title").notNull(), description: text("description").notNull().default(""), position: integer("position").notNull().default(0), createdAt, updatedAt });
/** Immutable snapshots are retained whenever a course's lifecycle/version changes. */
export const courseVersionsTable = pgTable("course_versions", {
  id: id("id"), courseId: uuid("course_id").notNull().references(() => coursesTable.id), version: integer("version").notNull(),
  lifecycle: curriculumLifecycleEnum("lifecycle").notNull(), snapshot: jsonb("snapshot").notNull(), changedByUserId: uuid("changed_by_user_id").references(() => usersTable.id),
  changeNote: text("change_note"), createdAt,
}, (t) => [uniqueIndex("course_versions_course_version_unique").on(t.courseId, t.version)]);
/** A course is learner-visible only when both this assignment and its course are published. */
export const courseCohortAssignmentsTable = pgTable("course_cohort_assignments", {
  id: id("id"), courseId: uuid("course_id").notNull().references(() => coursesTable.id), cohortId: uuid("cohort_id").notNull().references(() => cohortsTable.id),
  assignedByUserId: uuid("assigned_by_user_id").references(() => usersTable.id), assignedAt: createdAt, unassignedAt: timestamp("unassigned_at", { withTimezone: true }),
}, (t) => [uniqueIndex("course_cohort_assignment_unique").on(t.courseId, t.cohortId)]);

export const insertCourseSchema = createInsertSchema(coursesTable).omit({ id: true, currentVersion: true, publishedAt: true, createdAt: true, updatedAt: true });
export const insertSubjectSchema = createInsertSchema(subjectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertModuleSchema = createInsertSchema(modulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUnitSchema = createInsertSchema(unitsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLessonSchema = createInsertSchema(lessonsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertActivitySchema = createInsertSchema(activitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAssessmentSchema = createInsertSchema(assessmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSkillSchema = createInsertSchema(skillsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type Course = typeof coursesTable.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;