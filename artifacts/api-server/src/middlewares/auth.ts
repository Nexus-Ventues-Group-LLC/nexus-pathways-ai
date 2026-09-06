import type { RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import {
  applicationSessionsTable,
  db,
  learnerActivityTable,
  tenantConfigurationsTable,
} from "@workspace/db";
import { getPortalContext, provisionIdentity, writeAudit, type PortalContext, type PortalSession } from "../lib/identity";
import { authenticationOutcome, permissionOutcome } from "../lib/security-policy";

declare global { namespace Express { interface Request { portalContext?: PortalContext; portalSession?: PortalSession | null } } }

function identityFromClaims(auth: ReturnType<typeof getAuth>) {
  const claims = (auth.sessionClaims ?? {}) as Record<string, unknown>;
  const email = typeof claims.email === "string" ? claims.email : typeof claims.email_address === "string" ? claims.email_address : null;
  const verified = claims.email_verified === true || claims.emailVerified === true;
  const name = typeof claims.name === "string" ? claims.name : typeof claims.first_name === "string" ? claims.first_name : "Nexus user";
  return { email, verified, name };
}
export const requirePortalAuth: RequestHandler = async (req, res, next) => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const identity = identityFromClaims(auth);
  if (authenticationOutcome({ clerkUserId: auth.userId, verifiedIdentity: identity.verified, sessionRevoked: false }) !== 200) { res.status(401).json({ error: "Verified identity is required" }); return; }
  const provisioned = await provisionIdentity({ clerkUserId: auth.userId, displayName: identity.name, email: identity.email, sessionId: auth.sessionId ?? null });
  if (authenticationOutcome({ clerkUserId: auth.userId, verifiedIdentity: identity.verified, sessionRevoked: provisioned.revoked }) !== 200) { res.status(401).json({ error: "Session revoked" }); return; }
  const context = await getPortalContext(provisioned.user.id);
  if (!context) { await writeAudit({ actorUserId: provisioned.user.id, actorDisplayName: provisioned.user.displayName, action: "access.denied", category: "authorization", outcome: "denied" }); res.status(403).json({ error: "No active Nexus scope assignment" }); return; }
  req.portalContext = context;
  req.portalSession = provisioned.session;
  await writeAudit({ actorUserId: context.userId, actorDisplayName: context.displayName, organizationId: context.scope.organization.id, facilityId: context.scope.facility?.id, action: "access.authenticated", category: "security", outcome: "success" });
  next();
};
export function requirePermission(permission: string): RequestHandler {
  return async (req, res, next) => {
    const context = req.portalContext;
    if (!context) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (permissionOutcome(context.permissions, permission) !== 200) {
      await writeAudit({ actorUserId: context.userId, actorDisplayName: context.displayName, organizationId: context.scope.organization.id, facilityId: context.scope.facility?.id, action: "access.denied", category: "authorization", resourceType: permission, outcome: "denied" });
      res.status(403).json({ error: "Forbidden" }); return;
    }
    next();
  };
}
/** Learner APIs are intentionally role-bound rather than permission-bound. */
export const requireLearner: RequestHandler = async (req, res, next) => {
  const context = req.portalContext;
  if (!context) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (context.role !== "learner") {
    await writeAudit({ actorUserId: context.userId, actorDisplayName: context.displayName, organizationId: context.scope.organization.id, facilityId: context.scope.facility?.id, action: "learner.access.denied", category: "authorization", resourceType: "learner", outcome: "denied" });
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const session = req.portalSession;
  if (!session) { res.status(401).json({ error: "Session is required" }); return; }
  const [configuration] = await db.select({ policies: tenantConfigurationsTable.policies })
    .from(tenantConfigurationsTable)
    .where(eq(tenantConfigurationsTable.organizationId, context.scope.organization.id))
    .limit(1);
  const policies = configuration?.policies as {
    sessionTimeoutMinutes?: number;
    inactivityTimeoutMinutes?: number;
  } | undefined;
  const sessionTimeoutMs = (policies?.sessionTimeoutMinutes ?? 60) * 60_000;
  const inactivityTimeoutMs = (policies?.inactivityTimeoutMinutes ?? 30) * 60_000;
  let [activity] = await db.select({ lastActiveAt: learnerActivityTable.lastActiveAt })
    .from(learnerActivityTable)
    .where(and(
      eq(learnerActivityTable.applicationSessionId, session.id),
      eq(learnerActivityTable.learnerUserId, context.userId),
      eq(learnerActivityTable.organizationId, context.scope.organization.id),
    ))
    .limit(1);
  if (!activity) {
    [activity] = await db.insert(learnerActivityTable).values({
      applicationSessionId: session.id,
      learnerUserId: context.userId,
      organizationId: context.scope.organization.id,
      lastActiveAt: session.createdAt,
    }).returning({ lastActiveAt: learnerActivityTable.lastActiveAt });
  }
  const now = Date.now();
  const lastActiveAt = activity.lastActiveAt;
  const expired = now - session.createdAt.getTime() >= sessionTimeoutMs
    || now - lastActiveAt.getTime() >= inactivityTimeoutMs;
  if (expired) {
    await db.update(applicationSessionsTable)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(applicationSessionsTable.id, session.id),
        eq(applicationSessionsTable.userId, context.userId),
      ));
    await writeAudit({
      actorUserId: context.userId,
      actorDisplayName: context.displayName,
      organizationId: context.scope.organization.id,
      facilityId: context.scope.facility?.id,
      action: "learner.session.expired",
      category: "security",
      resourceType: "session",
      outcome: "denied",
    });
    res.status(401).json({ error: "Session expired" });
    return;
  }
  next();
};