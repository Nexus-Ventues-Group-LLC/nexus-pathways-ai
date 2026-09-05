import { Router, type IRouter } from "express";
import { GetAdminOverviewResponse, GetCurrentUserResponse, GetDashboardResponse, ListAuditEventsQueryParams, ListAuditEventsResponse } from "@workspace/api-zod";
import { requirePermission, requirePortalAuth } from "../middlewares/auth";
import { adminOverview, dashboardFor, visibleAuditEvents } from "../lib/dashboard";

const router: IRouter = Router();
router.get("/me", requirePortalAuth, (req, res): void => {
  const context = req.portalContext!;
  res.json(GetCurrentUserResponse.parse({ id: context.userId, displayName: context.displayName, email: context.email, role: context.role, permissions: context.permissions, scope: context.scope }));
});
router.get("/dashboard", requirePortalAuth, (req, res): void => { res.json(GetDashboardResponse.parse(dashboardFor(req.portalContext!))); });
router.get("/admin/overview", requirePortalAuth, requirePermission("admin.overview"), async (req, res): Promise<void> => {
  res.json(GetAdminOverviewResponse.parse(await adminOverview(req.portalContext!)));
});
router.get("/audit-events", requirePortalAuth, requirePermission("audit.read"), async (req, res): Promise<void> => {
  const query = ListAuditEventsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  res.json(ListAuditEventsResponse.parse(await visibleAuditEvents(req.portalContext!, query.data.limit)));
});
export default router;