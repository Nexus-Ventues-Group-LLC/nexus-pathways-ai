import { Router, type IRouter } from "express";
import healthRouter from "./health";
import portalRouter from "./portal";
import administrationRouter from "./administration";
import learnerRouter from "./learner";
import curriculumRouter from "./curriculum";
import assessmentsRouter from "./assessments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(portalRouter);
router.use(administrationRouter);
router.use(learnerRouter);
router.use(curriculumRouter);
router.use(assessmentsRouter);

export default router;
