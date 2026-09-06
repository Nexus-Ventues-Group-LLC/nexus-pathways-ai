import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import {
  agenciesTable, assessmentsTable, auditEventsTable, cohortsTable, courseCohortAssignmentsTable, coursesTable,
  courseVersionsTable, db, facilitiesTable, learnerAssessmentAssignmentsTable, learnerAssessmentAttemptsTable,
  learnerAssessmentDefinitionsTable, learnerAssessmentQuestionsTable, learnerAssessmentResponsesTable,
  learnerMasteryTable, learnerProfilesTable, organizationsTable, programsTable, regionsTable, subjectsTable, usersTable,
} from "@workspace/db";
import { createAssessmentDefinition } from "./assessment-admin";
import { assessmentDetail, startAssessmentAttempt, submitAssessment } from "./learner";
import { replaceStructure } from "./curriculum";
import type { PortalContext } from "./identity";
import { createFixtureNamespace } from "../test/fixture-namespace";

const fixtures = createFixtureNamespace("assessment");
const ids = {
  org: fixtures.id(), otherOrg: fixtures.id(),
  agency: fixtures.id(), region: fixtures.id(),
  facility: fixtures.id(), program: fixtures.id(),
  cohort: fixtures.id(), learner: fixtures.id(),
  staff: fixtures.id(), course: fixtures.id(),
};
const context = (userId: string, organizationId = ids.org, role = "learner"): PortalContext => ({
  userId, displayName: role === "learner" ? "Assessment Learner" : "Assessment Staff", email: null, role,
  permissions: role === "learner" ? [] : ["curriculum.manage"],
  scope: { organization: { id: organizationId, name: "Assessment Test" }, agency: null, region: null, facility: null, program: null, cohort: null, level: "organization" },
});
const learnerContext = context(ids.learner);
const staffContext = context(ids.staff, ids.org, "educator");
const structureInput = {
  subjects: [{ title: "Math", modules: [{ title: "Core", units: [{ title: "Unit", lessons: [{
    title: "Lesson", activities: [], assessments: [{ title: "Check", instructions: "Choose.", skills: [] }],
  }] }] }] }],
};
let standaloneId = "";

beforeAll(async () => {
  await db.insert(organizationsTable).values([{ id: ids.org, name: "Assessment Test" }, { id: ids.otherOrg, name: "Other Assessment Test" }]);
  await db.insert(agenciesTable).values({ id: ids.agency, organizationId: ids.org, name: "Agency" });
  await db.insert(regionsTable).values({ id: ids.region, agencyId: ids.agency, name: "Region" });
  await db.insert(facilitiesTable).values({ id: ids.facility, regionId: ids.region, name: "Facility" });
  await db.insert(programsTable).values({ id: ids.program, facilityId: ids.facility, name: "Program" });
  await db.insert(cohortsTable).values({ id: ids.cohort, programId: ids.program, name: "Cohort" });
  await db.insert(usersTable).values([
    { id: ids.learner, clerkUserId: fixtures.key("learner"), displayName: "Assessment Learner" },
    { id: ids.staff, clerkUserId: fixtures.key("staff"), displayName: "Assessment Staff" },
  ]);
  await db.insert(learnerProfilesTable).values({ userId: ids.learner, cohortId: ids.cohort });
  const standalone = await createAssessmentDefinition(staffContext, {
    kind: "practice", title: "Practice", questions: [
      { prompt: "Two plus two?", choices: ["3", "4"], correctAnswer: "4", skillLabel: "addition" },
      { prompt: "Three plus three?", choices: ["5", "6"], correctAnswer: "6", skillLabel: "addition" },
    ],
  });
  standaloneId = standalone.id;
  await db.insert(learnerAssessmentAssignmentsTable).values({ organizationId: ids.org, assessmentId: standaloneId, learnerUserId: ids.learner });
});

afterAll(async () => {
  await db.delete(learnerAssessmentResponsesTable).where(sql`${learnerAssessmentResponsesTable.attemptId} in (select id from learner_assessment_attempts where organization_id=${ids.org})`);
  await db.delete(learnerMasteryTable).where(eq(learnerMasteryTable.organizationId, ids.org));
  await db.delete(learnerAssessmentAttemptsTable).where(eq(learnerAssessmentAttemptsTable.organizationId, ids.org));
  await db.delete(learnerAssessmentQuestionsTable).where(sql`${learnerAssessmentQuestionsTable.assessmentId} in (select id from learner_assessment_definitions where organization_id=${ids.org})`);
  await db.delete(learnerAssessmentAssignmentsTable).where(eq(learnerAssessmentAssignmentsTable.organizationId, ids.org));
  await db.delete(learnerAssessmentDefinitionsTable).where(eq(learnerAssessmentDefinitionsTable.organizationId, ids.org));
  await db.execute(sql`delete from assessment_skills where assessment_id in (select a.id from lesson_assessments a join unit_lessons l on a.lesson_id=l.id join module_units u on l.unit_id=u.id join subject_modules m on u.module_id=m.id join course_subjects s on m.subject_id=s.id where s.course_id=${ids.course})`);
  await db.execute(sql`delete from lesson_activities where lesson_id in (select l.id from unit_lessons l join module_units u on l.unit_id=u.id join subject_modules m on u.module_id=m.id join course_subjects s on m.subject_id=s.id where s.course_id=${ids.course})`);
  await db.execute(sql`delete from lesson_assessments where lesson_id in (select l.id from unit_lessons l join module_units u on l.unit_id=u.id join subject_modules m on u.module_id=m.id join course_subjects s on m.subject_id=s.id where s.course_id=${ids.course})`);
  await db.execute(sql`delete from unit_lessons where unit_id in (select u.id from module_units u join subject_modules m on u.module_id=m.id join course_subjects s on m.subject_id=s.id where s.course_id=${ids.course})`);
  await db.execute(sql`delete from module_units where module_id in (select m.id from subject_modules m join course_subjects s on m.subject_id=s.id where s.course_id=${ids.course})`);
  await db.execute(sql`delete from subject_modules where subject_id in (select id from course_subjects where course_id=${ids.course})`);
  await db.delete(subjectsTable).where(eq(subjectsTable.courseId, ids.course));
  await db.delete(courseVersionsTable).where(eq(courseVersionsTable.courseId, ids.course));
  await db.delete(courseCohortAssignmentsTable).where(eq(courseCohortAssignmentsTable.courseId, ids.course));
  await db.delete(coursesTable).where(eq(coursesTable.id, ids.course));
  await db.delete(auditEventsTable).where(eq(auditEventsTable.actorUserId, ids.learner));
  await db.delete(auditEventsTable).where(eq(auditEventsTable.actorUserId, ids.staff));
  await db.delete(learnerProfilesTable).where(eq(learnerProfilesTable.userId, ids.learner));
  await db.delete(usersTable).where(eq(usersTable.id, ids.learner)); await db.delete(usersTable).where(eq(usersTable.id, ids.staff));
  await db.delete(cohortsTable).where(eq(cohortsTable.id, ids.cohort)); await db.delete(programsTable).where(eq(programsTable.id, ids.program));
  await db.delete(facilitiesTable).where(eq(facilitiesTable.id, ids.facility)); await db.delete(regionsTable).where(eq(regionsTable.id, ids.region));
  await db.delete(agenciesTable).where(eq(agenciesTable.id, ids.agency));
  await db.delete(organizationsTable).where(eq(organizationsTable.id, ids.org)); await db.delete(organizationsTable).where(eq(organizationsTable.id, ids.otherOrg));
});

describe("assessment authoring, ownership, scoring, and retention", () => {
  it("rejects empty and invalid multiple-choice definitions", async () => {
    await expect(createAssessmentDefinition(staffContext, { kind: "practice", title: "Empty", questions: [] })).rejects.toMatchObject({ kind: "invalid" });
    await expect(createAssessmentDefinition(staffContext, {
      kind: "practice", title: "Invalid", questions: [{ prompt: "Question", choices: ["A", "B"], correctAnswer: "C" }],
    })).rejects.toMatchObject({ kind: "invalid" });
  });
  it("returns learner-safe definition and snapshot questions without answer keys", async () => {
    const detail = await assessmentDetail(learnerContext, standaloneId);
    expect(detail?.questions).toHaveLength(2);
    expect(detail?.questions[0]).not.toHaveProperty("correctAnswer");
    const attempt = (await startAssessmentAttempt(learnerContext, standaloneId))!;
    expect(attempt.questions[0]).not.toHaveProperty("correctAnswer");
    const [stored] = await db.select().from(learnerAssessmentAttemptsTable).where(eq(learnerAssessmentAttemptsTable.id, attempt.id));
    expect(JSON.stringify(stored.definitionSnapshot)).toContain("correctAnswer");
  });
  it("rejects empty, missing, duplicate, and unknown response sets before submission", async () => {
    const attempt = (await startAssessmentAttempt(learnerContext, standaloneId))!;
    const first = attempt.questions[0]!.id; const second = attempt.questions[1]!.id;
    for (const responses of [[], [{ questionId: first, answer: "4" }], [{ questionId: first, answer: "4" }, { questionId: first, answer: "4" }],
      [{ questionId: first, answer: "4" }, { questionId: "95000000-0000-4000-8000-999999999999", answer: "6" }]]) {
      await expect(submitAssessment(learnerContext, standaloneId, attempt.id, responses)).rejects.toThrow("Invalid assessment response");
    }
    const [stored] = await db.select().from(learnerAssessmentAttemptsTable).where(eq(learnerAssessmentAttemptsTable.id, attempt.id));
    expect(stored.status).toBe("in_progress"); expect(second).toBeTruthy();
  });
  it("creates one concurrent open attempt and keeps submitted retries idempotent", async () => {
    const [existing] = await db.select().from(learnerAssessmentAttemptsTable).where(and(eq(learnerAssessmentAttemptsTable.assessmentId, standaloneId), eq(learnerAssessmentAttemptsTable.status, "in_progress")));
    if (existing) await submitAssessment(learnerContext, standaloneId, existing.id, (existing.definitionSnapshot as any).questions.map((q: any) => ({ questionId: q.id, answer: q.correctAnswer })));
    const starts = await Promise.all(Array.from({ length: 5 }, () => startAssessmentAttempt(learnerContext, standaloneId)));
    expect(new Set(starts.map((attempt) => attempt!.id)).size).toBe(1);
    const attempt = starts[0]!;
    const responses = attempt.questions.map((question, index) => ({ questionId: question.id, answer: index === 0 ? "4" : "6" }));
    const submitted = await submitAssessment(learnerContext, standaloneId, attempt.id, responses);
    const retry = await submitAssessment(learnerContext, standaloneId, attempt.id, [{ questionId: "ignored", answer: "ignored" }]);
    expect(retry).toEqual(submitted);
    const open = await db.select().from(learnerAssessmentAttemptsTable).where(and(eq(learnerAssessmentAttemptsTable.assessmentId, standaloneId), eq(learnerAssessmentAttemptsTable.status, "in_progress")));
    expect(open).toHaveLength(0);
  });
  it("denies cross-tenant and unassigned learner access", async () => {
    expect(await assessmentDetail(context(ids.learner, ids.otherOrg), standaloneId)).toBeNull();
    await db.update(learnerAssessmentAssignmentsTable).set({ unassignedAt: new Date() }).where(eq(learnerAssessmentAssignmentsTable.assessmentId, standaloneId));
    expect(await assessmentDetail(learnerContext, standaloneId)).toBeNull();
    await db.update(learnerAssessmentAssignmentsTable).set({ unassignedAt: null }).where(eq(learnerAssessmentAssignmentsTable.assessmentId, standaloneId));
  });
  it("replaces curriculum repeatedly while retaining a linked definition and attempt snapshot", async () => {
    await db.insert(coursesTable).values({ id: ids.course, organizationId: ids.org, title: "Retention", lifecycle: "draft", createdByUserId: ids.staff });
    const first = await replaceStructure(staffContext, ids.course, structureInput);
    const curriculumId = first.subjects[0]!.modules[0]!.units[0]!.lessons[0]!.assessments[0]!.id;
    const linked = await createAssessmentDefinition(staffContext, {
      kind: "lesson", title: "Ignored", curriculumAssessmentId: curriculumId,
      questions: [{ prompt: "Retained?", choices: ["yes", "no"], correctAnswer: "yes" }],
    });
    await db.update(coursesTable).set({ lifecycle: "published" }).where(eq(coursesTable.id, ids.course));
    await db.insert(courseCohortAssignmentsTable).values({ courseId: ids.course, cohortId: ids.cohort, assignedByUserId: ids.staff });
    const attempt = (await startAssessmentAttempt(learnerContext, linked.id))!;
    await db.update(coursesTable).set({ lifecycle: "draft" }).where(eq(coursesTable.id, ids.course));
    await replaceStructure(staffContext, ids.course, structureInput);
    await replaceStructure(staffContext, ids.course, structureInput);
    const [retainedDefinition] = await db.select().from(learnerAssessmentDefinitionsTable).where(eq(learnerAssessmentDefinitionsTable.id, linked.id));
    const [retainedAttempt] = await db.select().from(learnerAssessmentAttemptsTable).where(eq(learnerAssessmentAttemptsTable.id, attempt.id));
    expect(retainedDefinition.curriculumAssessmentId).toBeNull();
    expect((retainedAttempt.definitionSnapshot as any).questions[0].correctAnswer).toBe("yes");
  });
});