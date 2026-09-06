import { Router, type IRouter } from "express";
import {
  AssignAssessmentToLearnerBody, AssignAssessmentToLearnerParams, AssignAssessmentToLearnerResponse,
  CreateAssessmentDefinitionBody, CreateAssessmentDefinitionResponse,
  ListAssessmentDefinitionsResponse, ListEligibleAssessmentLearnersResponse,
} from "@workspace/api-zod";
import { requirePermission, requirePortalAuth } from "../middlewares/auth";
import * as service from "../lib/assessment-admin";

const router: IRouter = Router();
const invalid = (res: any, error: unknown) => res.status(400).json({ error: error instanceof Error ? error.message : "Invalid assessment input" });
const handle = (res: any, error: unknown) => error instanceof service.AssessmentAdminError
  ? (res.status(error.kind === "not-found" ? 404 : 400).json({ error: error.kind === "not-found" ? "Assessment resource not found" : "Invalid assessment input" }), true)
  : false;

router.get("/admin/assessments", requirePortalAuth, requirePermission("curriculum.manage"), async (req, res): Promise<void> => {
  res.json(ListAssessmentDefinitionsResponse.parse(await service.listAssessmentDefinitions(req.portalContext!)));
});
router.get("/admin/assessment-learners", requirePortalAuth, requirePermission("curriculum.manage"), async (req, res): Promise<void> => {
  res.json(ListEligibleAssessmentLearnersResponse.parse(await service.listEligibleAssessmentLearners(req.portalContext!)));
});
router.post("/admin/assessments", requirePortalAuth, requirePermission("curriculum.manage"), async (req, res): Promise<void> => {
  const body = CreateAssessmentDefinitionBody.safeParse(req.body);
  if (!body.success) { invalid(res, body.error); return; }
  try { res.status(201).json(CreateAssessmentDefinitionResponse.parse(await service.createAssessmentDefinition(req.portalContext!, body.data))); }
  catch (error) { if (!handle(res, error)) throw error; }
});
router.post("/admin/assessments/:assessmentId/assignments", requirePortalAuth, requirePermission("curriculum.manage"), async (req, res): Promise<void> => {
  const params = AssignAssessmentToLearnerParams.safeParse(req.params);
  const body = AssignAssessmentToLearnerBody.safeParse(req.body);
  if (!params.success) { invalid(res, params.error); return; }
  if (!body.success) { invalid(res, body.error); return; }
  try { res.json(AssignAssessmentToLearnerResponse.parse(await service.assignAssessmentToLearner(req.portalContext!, params.data.assessmentId, body.data))); }
  catch (error) { if (!handle(res, error)) throw error; }
});
export default router;