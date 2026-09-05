import { Router, type IRouter } from "express";
import {
  CompleteLearnerCourseworkParams, CompleteLearnerCourseworkResponse, GetLearnerCourseParams, GetLearnerCourseResponse, GetLearnerHomeResponse,
  RecordLearnerActivityResponse, UpdateLearnerGoalsBody, UpdateLearnerGoalsResponse,
  UpdateLearnerPresentationPreferencesBody, UpdateLearnerPresentationPreferencesResponse,
} from "@workspace/api-zod";
import { requireLearner, requirePortalAuth } from "../middlewares/auth";
import { completeCoursework, learnerHome, recordActivity, updateGoals, updatePreferences } from "../lib/learner";
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
export default router;