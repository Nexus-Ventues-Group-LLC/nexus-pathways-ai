import { Router, type IRouter } from "express";
import {
  CompleteLearnerCourseworkParams, CompleteLearnerCourseworkResponse, GetLearnerCourseParams, GetLearnerCourseResponse, GetLearnerHomeResponse,
  RecordLearnerActivityResponse, UpdateLearnerGoalsBody, UpdateLearnerGoalsResponse,
  UpdateLearnerPresentationPreferencesBody, UpdateLearnerPresentationPreferencesResponse,
  GetLearnerAssessmentParams, GetLearnerAssessmentResponse, ListLearnerAssessmentAttemptsParams, ListLearnerAssessmentAttemptsResponse,
  ListLearnerAssessmentsResponse, StartLearnerAssessmentAttemptParams, StartLearnerAssessmentAttemptResponse,
  SubmitLearnerAssessmentResponsesBody, SubmitLearnerAssessmentResponsesParams, SubmitLearnerAssessmentResponsesResponse,
  GetLearnerMasteryResponse,
} from "@workspace/api-zod";
import { requireLearner, requirePortalAuth } from "../middlewares/auth";
import { assessmentAttempts, assessmentDetail, completeCoursework, learnerHome, learnerMastery, listAssessments, recordActivity, startAssessmentAttempt, submitAssessment, updateGoals, updatePreferences } from "../lib/learner";
import { CurriculumError, learnerCourseStructure } from "../lib/curriculum";

const router: IRouter = Router();
router.get("/learner/home", requirePortalAuth, requireLearner, async (req, res): Promise<void> => {
  res.json(GetLearnerHomeResponse.parse(await learnerHome(req.portalContext!)));
});
router.get("/learner/courses/:courseId", requirePortalAuth, requireLearner, async (req, res): Promise<void> => {
  const params = GetLearnerCourseParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  try {
    res.json(GetLearnerCourseResponse.parse(await learnerCourseStructure(req.portalContext!, params.data.courseId)));
  } catch (error) {
    if (error instanceof CurriculumError && error.kind === "not-found") { res.status(404).json({ error: "Course not found" }); return; }
    throw error;
  }
});
router.post("/learner/coursework/:courseworkId/complete", requirePortalAuth, requireLearner, async (req, res): Promise<void> => {
  const params = CompleteLearnerCourseworkParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const coursework = await completeCoursework(req.portalContext!, params.data.courseworkId);
  if (!coursework) { res.status(404).json({ error: "Coursework not found" }); return; }
  res.json(CompleteLearnerCourseworkResponse.parse(coursework));
});
router.patch("/learner/goals", requirePortalAuth, requireLearner, async (req, res): Promise<void> => {
  const body = UpdateLearnerGoalsBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  res.json(UpdateLearnerGoalsResponse.parse(await updateGoals(req.portalContext!, body.data.goals)));
});
router.patch("/learner/presentation-preferences", requirePortalAuth, requireLearner, async (req, res): Promise<void> => {
  const body = UpdateLearnerPresentationPreferencesBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  res.json(UpdateLearnerPresentationPreferencesResponse.parse(await updatePreferences(req.portalContext!, body.data)));
});
router.post("/learner/activity", requirePortalAuth, requireLearner, async (req, res): Promise<void> => {
  res.json(RecordLearnerActivityResponse.parse(await recordActivity(req.portalContext!, req.portalSession!.id)));
});
router.get("/learner/assessments", requirePortalAuth, requireLearner, async (req, res): Promise<void> => {
  res.json(ListLearnerAssessmentsResponse.parse(await listAssessments(req.portalContext!)));
});
router.get("/learner/assessments/:assessmentId", requirePortalAuth, requireLearner, async (req, res): Promise<void> => {
  const params = GetLearnerAssessmentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const assessment = await assessmentDetail(req.portalContext!, params.data.assessmentId);
  if (!assessment) { res.status(404).json({ error: "Assessment not found" }); return; }
  res.json(GetLearnerAssessmentResponse.parse(assessment));
});
router.get("/learner/assessments/:assessmentId/attempts", requirePortalAuth, requireLearner, async (req, res): Promise<void> => {
  const params = ListLearnerAssessmentAttemptsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const attempts = await assessmentAttempts(req.portalContext!, params.data.assessmentId);
  if (!attempts) { res.status(404).json({ error: "Assessment not found" }); return; }
  res.json(ListLearnerAssessmentAttemptsResponse.parse(attempts));
});
router.post("/learner/assessments/:assessmentId/attempts", requirePortalAuth, requireLearner, async (req, res): Promise<void> => {
  const params = StartLearnerAssessmentAttemptParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const attempt = await startAssessmentAttempt(req.portalContext!, params.data.assessmentId);
  if (!attempt) { res.status(404).json({ error: "Assessment not found" }); return; }
  res.json(StartLearnerAssessmentAttemptResponse.parse(attempt));
});
router.post("/learner/assessments/:assessmentId/attempts/:attemptId/responses", requirePortalAuth, requireLearner, async (req, res): Promise<void> => {
  const params = SubmitLearnerAssessmentResponsesParams.safeParse(req.params);
  const body = SubmitLearnerAssessmentResponsesBody.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  try {
    const attempt = await submitAssessment(req.portalContext!, params.data.assessmentId, params.data.attemptId, body.data.responses);
    if (!attempt) { res.status(404).json({ error: "Assessment attempt not found" }); return; }
    res.json(SubmitLearnerAssessmentResponsesResponse.parse(attempt));
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid assessment response") { res.status(400).json({ error: error.message }); return; }
    throw error;
  }
});
router.get("/learner/mastery", requirePortalAuth, requireLearner, async (req, res): Promise<void> => {
  res.json(GetLearnerMasteryResponse.parse(await learnerMastery(req.portalContext!)));
});
export default router;