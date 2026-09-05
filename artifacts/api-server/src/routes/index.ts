import { Router, type IRouter } from "express";
import healthRouter from "./health";
import portalRouter from "./portal";
import administrationRouter from "./administration";

const router: IRouter = Router();

router.use(healthRouter);
router.use(portalRouter);
router.use(administrationRouter);

export default router;
