import { and, eq, sql } from "drizzle-orm";
import { activitiesTable, agenciesTable, assessmentsTable, cohortsTable, courseCohortAssignmentsTable, coursesTable, courseVersionsTable, db, facilitiesTable, learnerProfilesTable, lessonsTable, modulesTable, programsTable, regionsTable, skillsTable, subjectsTable, unitsTable } from "@workspace/db";
import type { PortalContext } from "./identity";
import { writeAudit } from "./identity";

export class CurriculumError extends Error { constructor(readonly kind: "not-found" | "invalid") { super(kind); } }
const states = { draft: ["review", "retired"], review: ["draft", "approved", "retired"], approved: ["draft", "published", "retired"], published: ["draft", "retired"], retired: ["draft"] } as const;
const audit = (context: PortalContext, action: string, resourceType: string) => writeAudit({
  actorUserId: context.userId, actorDisplayName: context.displayName, organizationId: context.scope.organization.id,
  facilityId: context.scope.facility?.id, action, category: "curriculum", resourceType, outcome: "success",
});
async function visibleCourse(context: PortalContext, id: string) {
  const [course] = await db.select().from(coursesTable).where(and(eq(coursesTable.id, id), eq(coursesTable.organizationId, context.scope.organization.id))).limit(1);
  return course;
}
export async function listCourses(context: PortalContext) {
  return db.select().from(coursesTable).where(eq(coursesTable.organizationId, context.scope.organization.id)).orderBy(coursesTable.updatedAt);
}
export async function getCourse(context: PortalContext, id: string) {
  const course = await visibleCourse(context, id);
  if (!course) throw new CurriculumError("not-found");
  return course;
}
export async function createCourse(context: PortalContext, input: { title: string; description?: string }) {
  const [course] = await db.insert(coursesTable).values({ organizationId: context.scope.organization.id, title: input.title, description: input.description ?? "", createdByUserId: context.userId }).returning();
  await db.insert(courseVersionsTable).values({ courseId: course.id, version: 1, lifecycle: "draft", snapshot: course, changedByUserId: context.userId, changeNote: "Created" });
  await audit(context, "curriculum.course.created", "course");
  return course;
}
export async function updateCourse(context: PortalContext, id: string, input: { title?: string; description?: string }) {
  const current = await visibleCourse(context, id); if (!current) throw new CurriculumError("not-found");
  if (current.lifecycle === "published") throw new CurriculumError("invalid");
  const version = current.currentVersion + 1;
  const [course] = await db.update(coursesTable).set({ ...input, currentVersion: version, updatedAt: new Date() }).where(eq(coursesTable.id, id)).returning();
  const snapshot = await structure(context, id);
  await db.insert(courseVersionsTable).values({ courseId: id, version, lifecycle: course.lifecycle, snapshot, changedByUserId: context.userId, changeNote: "Course updated" });
  await audit(context, "curriculum.course.updated", "course"); return course;
}
export async function transition(context: PortalContext, id: string, input: { lifecycle: keyof typeof states; changeNote?: string }) {
  const current = await visibleCourse(context, id); if (!current) throw new CurriculumError("not-found");
  if (!states[current.lifecycle].includes(input.lifecycle as never)) throw new CurriculumError("invalid");
  const version = current.currentVersion + 1;
  const [course] = await db.update(coursesTable).set({ lifecycle: input.lifecycle, currentVersion: version, publishedAt: input.lifecycle === "published" ? new Date() : current.publishedAt, updatedAt: new Date() }).where(eq(coursesTable.id, id)).returning();
  const snapshot = await structure(context, id);
  await db.insert(courseVersionsTable).values({ courseId: id, version, lifecycle: input.lifecycle, snapshot, changedByUserId: context.userId, changeNote: input.changeNote ?? null });
  await audit(context, `curriculum.course.${input.lifecycle}`, "course"); return course;
}
async function visibleCohort(context: PortalContext, cohortId: string) {
  const [row] = await db.select({ id: cohortsTable.id }).from(cohortsTable).innerJoin(programsTable, eq(cohortsTable.programId, programsTable.id))
    .innerJoin(facilitiesTable, eq(programsTable.facilityId, facilitiesTable.id)).innerJoin(regionsTable, eq(facilitiesTable.regionId, regionsTable.id))
    .innerJoin(agenciesTable, eq(regionsTable.agencyId, agenciesTable.id)).where(and(eq(cohortsTable.id, cohortId), eq(agenciesTable.organizationId, context.scope.organization.id),
      context.scope.cohort ? eq(cohortsTable.id, context.scope.cohort.id) : undefined, context.scope.program ? eq(programsTable.id, context.scope.program.id) : undefined,
      context.scope.facility ? eq(facilitiesTable.id, context.scope.facility.id) : undefined)).limit(1);
  return row;
}
export async function assign(context: PortalContext, courseId: string, input: { cohortId: string; assigned: boolean }) {
  if (!await visibleCourse(context, courseId) || !await visibleCohort(context, input.cohortId)) throw new CurriculumError("not-found");
  let row;
  if (input.assigned) [row] = await db.insert(courseCohortAssignmentsTable).values({ courseId, cohortId: input.cohortId, assignedByUserId: context.userId }).onConflictDoUpdate({ target: [courseCohortAssignmentsTable.courseId, courseCohortAssignmentsTable.cohortId], set: { assignedByUserId: context.userId, assignedAt: new Date(), unassignedAt: null } }).returning();
  else [row] = await db.update(courseCohortAssignmentsTable).set({ unassignedAt: new Date() }).where(and(eq(courseCohortAssignmentsTable.courseId, courseId), eq(courseCohortAssignmentsTable.cohortId, input.cohortId))).returning();
  if (!row) throw new CurriculumError("not-found"); await audit(context, input.assigned ? "curriculum.course.assigned" : "curriculum.course.unassigned", "course_assignment"); return row;
}
export async function versions(context: PortalContext, courseId: string) {
  if (!await visibleCourse(context, courseId)) throw new CurriculumError("not-found");
  return db.select({ id: courseVersionsTable.id, version: courseVersionsTable.version, lifecycle: courseVersionsTable.lifecycle, changeNote: courseVersionsTable.changeNote, createdAt: courseVersionsTable.createdAt }).from(courseVersionsTable).where(eq(courseVersionsTable.courseId, courseId)).orderBy(courseVersionsTable.version);
}
export async function structure(context: PortalContext, courseId: string) {
  const course = await getCourse(context, courseId);
  const subjects = await db.select().from(subjectsTable).where(eq(subjectsTable.courseId, courseId)).orderBy(subjectsTable.position);
  const modules = await db.select().from(modulesTable).innerJoin(subjectsTable, eq(modulesTable.subjectId, subjectsTable.id)).where(eq(subjectsTable.courseId, courseId));
  const units = await db.select().from(unitsTable).innerJoin(modulesTable, eq(unitsTable.moduleId, modulesTable.id)).innerJoin(subjectsTable, eq(modulesTable.subjectId, subjectsTable.id)).where(eq(subjectsTable.courseId, courseId));
  const lessons = await db.select().from(lessonsTable).innerJoin(unitsTable, eq(lessonsTable.unitId, unitsTable.id)).innerJoin(modulesTable, eq(unitsTable.moduleId, modulesTable.id)).innerJoin(subjectsTable, eq(modulesTable.subjectId, subjectsTable.id)).where(eq(subjectsTable.courseId, courseId));
  const activities = await db.select().from(activitiesTable).innerJoin(lessonsTable, eq(activitiesTable.lessonId, lessonsTable.id)).innerJoin(unitsTable, eq(lessonsTable.unitId, unitsTable.id)).innerJoin(modulesTable, eq(unitsTable.moduleId, modulesTable.id)).innerJoin(subjectsTable, eq(modulesTable.subjectId, subjectsTable.id)).where(eq(subjectsTable.courseId, courseId));
  const assessments = await db.select().from(assessmentsTable).innerJoin(lessonsTable, eq(assessmentsTable.lessonId, lessonsTable.id)).innerJoin(unitsTable, eq(lessonsTable.unitId, unitsTable.id)).innerJoin(modulesTable, eq(unitsTable.moduleId, modulesTable.id)).innerJoin(subjectsTable, eq(modulesTable.subjectId, subjectsTable.id)).where(eq(subjectsTable.courseId, courseId));
  const skills = await db.select().from(skillsTable).innerJoin(assessmentsTable, eq(skillsTable.assessmentId, assessmentsTable.id)).innerJoin(lessonsTable, eq(assessmentsTable.lessonId, lessonsTable.id)).innerJoin(unitsTable, eq(lessonsTable.unitId, unitsTable.id)).innerJoin(modulesTable, eq(unitsTable.moduleId, modulesTable.id)).innerJoin(subjectsTable, eq(modulesTable.subjectId, subjectsTable.id)).where(eq(subjectsTable.courseId, courseId));
  const skillByAssessment = new Map<string, any[]>(); for (const row of skills) { const list = skillByAssessment.get(row.assessment_skills.assessmentId) ?? []; list.push({ ...row.assessment_skills }); skillByAssessment.set(row.assessment_skills.assessmentId, list); }
  const assessmentByLesson = new Map<string, any[]>(); for (const row of assessments) { const list = assessmentByLesson.get(row.lesson_assessments.lessonId) ?? []; list.push({ ...row.lesson_assessments, skills: skillByAssessment.get(row.lesson_assessments.id) ?? [] }); assessmentByLesson.set(row.lesson_assessments.lessonId, list); }
  const activityByLesson = new Map<string, any[]>(); for (const row of activities) { const list = activityByLesson.get(row.lesson_activities.lessonId) ?? []; list.push({ ...row.lesson_activities }); activityByLesson.set(row.lesson_activities.lessonId, list); }
  const lessonByUnit = new Map<string, any[]>(); for (const row of lessons) { const list = lessonByUnit.get(row.unit_lessons.unitId) ?? []; list.push({ ...row.unit_lessons, activities: activityByLesson.get(row.unit_lessons.id) ?? [], assessments: assessmentByLesson.get(row.unit_lessons.id) ?? [] }); lessonByUnit.set(row.unit_lessons.unitId, list); }
  const unitByModule = new Map<string, any[]>(); for (const row of units) { const list = unitByModule.get(row.module_units.moduleId) ?? []; list.push({ ...row.module_units, lessons: lessonByUnit.get(row.module_units.id) ?? [] }); unitByModule.set(row.module_units.moduleId, list); }
  const moduleBySubject = new Map<string, any[]>(); for (const row of modules) { const list = moduleBySubject.get(row.subject_modules.subjectId) ?? []; list.push({ ...row.subject_modules, units: unitByModule.get(row.subject_modules.id) ?? [] }); moduleBySubject.set(row.subject_modules.subjectId, list); }
  return { course, subjects: subjects.map((subject) => ({ ...subject, modules: moduleBySubject.get(subject.id) ?? [] })) };
}
export async function replaceStructure(context: PortalContext, courseId: string, input: any) {
  const course = await visibleCourse(context, courseId); if (!course) throw new CurriculumError("not-found");
  if (course.lifecycle === "published") throw new CurriculumError("invalid");
  await db.transaction(async (tx) => {
    const subjectRows = await tx.select({ id: subjectsTable.id }).from(subjectsTable).where(eq(subjectsTable.courseId, courseId));
    if (subjectRows.length) {
      const ids = subjectRows.map((x) => x.id);
      // Descendant deletes are ordered to work on databases without cascade constraints.
      await tx.delete(skillsTable).where(sql`${skillsTable.assessmentId} in (select a.id from lesson_assessments a join unit_lessons l on a.lesson_id=l.id join module_units u on l.unit_id=u.id join subject_modules m on u.module_id=m.id where m.subject_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)}))`);
      await tx.delete(activitiesTable).where(sql`${activitiesTable.lessonId} in (select l.id from unit_lessons l join module_units u on l.unit_id=u.id join subject_modules m on u.module_id=m.id where m.subject_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)}))`);
      await tx.delete(assessmentsTable).where(sql`${assessmentsTable.lessonId} in (select l.id from unit_lessons l join module_units u on l.unit_id=u.id join subject_modules m on u.module_id=m.id where m.subject_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)}))`);
      await tx.delete(lessonsTable).where(sql`${lessonsTable.unitId} in (select u.id from module_units u join subject_modules m on u.module_id=m.id where m.subject_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)}))`);
      await tx.delete(unitsTable).where(sql`${unitsTable.moduleId} in (select id from subject_modules where subject_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)}))`);
      await tx.delete(modulesTable).where(sql`${modulesTable.subjectId} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);
      await tx.delete(subjectsTable).where(eq(subjectsTable.courseId, courseId));
    }
    for (const [si, subject] of input.subjects.entries()) { const [s] = await tx.insert(subjectsTable).values({ courseId, title: subject.title, description: subject.description ?? "", position: subject.position ?? si }).returning();
      for (const [mi, module] of subject.modules.entries()) { const [m] = await tx.insert(modulesTable).values({ subjectId: s.id, title: module.title, description: module.description ?? "", position: module.position ?? mi }).returning();
        for (const [ui, unit] of module.units.entries()) { const [u] = await tx.insert(unitsTable).values({ moduleId: m.id, title: unit.title, description: unit.description ?? "", position: unit.position ?? ui }).returning();
          for (const [li, lesson] of unit.lessons.entries()) { const [l] = await tx.insert(lessonsTable).values({ unitId: u.id, title: lesson.title, description: lesson.description ?? "", position: lesson.position ?? li }).returning();
            for (const [ai, activity] of lesson.activities.entries()) await tx.insert(activitiesTable).values({ lessonId: l.id, title: activity.title, content: activity.content, position: activity.position ?? ai, instructionalMinutes: activity.instructionalMinutes ?? 0 });
            for (const [ai, assessment] of lesson.assessments.entries()) { const [a] = await tx.insert(assessmentsTable).values({ lessonId: l.id, title: assessment.title, instructions: assessment.instructions ?? "", position: assessment.position ?? ai }).returning();
              for (const [ki, skill] of assessment.skills.entries()) await tx.insert(skillsTable).values({ assessmentId: a.id, title: skill.title, description: skill.description ?? "", position: skill.position ?? ki }); }
          }
        }
      }
    }
    const version = course.currentVersion + 1; await tx.update(coursesTable).set({ currentVersion: version, updatedAt: new Date() }).where(eq(coursesTable.id, courseId));
  });
  const snapshot = await structure(context, courseId);
  await db.insert(courseVersionsTable).values({ courseId, version: course.currentVersion + 1, lifecycle: course.lifecycle, snapshot, changedByUserId: context.userId, changeNote: "Structure replaced" });
  await audit(context, "curriculum.course.structure.replaced", "course"); return snapshot;
}
export async function eligibleCohorts(context: PortalContext) {
  return db.select({ id: cohortsTable.id, name: cohortsTable.name, programId: programsTable.id, programName: programsTable.name }).from(cohortsTable).innerJoin(programsTable, eq(cohortsTable.programId, programsTable.id)).innerJoin(facilitiesTable, eq(programsTable.facilityId, facilitiesTable.id)).innerJoin(regionsTable, eq(facilitiesTable.regionId, regionsTable.id)).innerJoin(agenciesTable, eq(regionsTable.agencyId, agenciesTable.id)).where(and(eq(agenciesTable.organizationId, context.scope.organization.id), context.scope.cohort ? eq(cohortsTable.id, context.scope.cohort.id) : undefined, context.scope.program ? eq(programsTable.id, context.scope.program.id) : undefined, context.scope.facility ? eq(facilitiesTable.id, context.scope.facility.id) : undefined));
}
export async function assignments(context: PortalContext, courseId: string) { if (!await visibleCourse(context, courseId)) throw new CurriculumError("not-found"); return db.select().from(courseCohortAssignmentsTable).where(eq(courseCohortAssignmentsTable.courseId, courseId)); }
/** Learner delivery gate: no course tree is assembled until all tenant, publication, and active cohort assignment checks pass. */
export async function learnerCourseStructure(context: PortalContext, courseId: string) {
  const [eligible] = await db.select({ id: coursesTable.id }).from(learnerProfilesTable)
    .innerJoin(courseCohortAssignmentsTable, eq(courseCohortAssignmentsTable.cohortId, learnerProfilesTable.cohortId))
    .innerJoin(coursesTable, eq(courseCohortAssignmentsTable.courseId, coursesTable.id))
    .where(and(
      eq(learnerProfilesTable.userId, context.userId),
      eq(coursesTable.id, courseId),
      eq(coursesTable.organizationId, context.scope.organization.id),
      eq(coursesTable.lifecycle, "published"),
      sql`${courseCohortAssignmentsTable.unassignedAt} is null`,
    )).limit(1);
  if (!eligible) throw new CurriculumError("not-found");
  const value = await structure(context, courseId);
  await writeAudit({ actorUserId: context.userId, actorDisplayName: context.displayName, organizationId: context.scope.organization.id, facilityId: context.scope.facility?.id, action: "learner.course.read", category: "learner", resourceType: "course", outcome: "success" });
  return value;
}