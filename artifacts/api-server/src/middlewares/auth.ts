import type { RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { getPortalContext, provisionIdentity, writeAudit, type PortalContext } from "../lib/identity";
import { authenticationOutcome, permissionOutcome } from "../lib/security-policy";

declare global { namespace Express { interface Request { portalContext?: PortalContext } } }

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
  await writeAudit({ actorUserId: context.userId, actorDisplayName: context.displayName, organizationId: context.scope.organization.id, facilityId: context.scope.facility.id, action: "access.authenticated", category: "security", outcome: "success" });
  next();
};
export function requirePermission(permission: string): RequestHandler {
  return async (req, res, next) => {
    const context = req.portalContext;
    if (!context) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (permissionOutcome(context.permissions, permission) !== 200) {
      await writeAudit({ actorUserId: context.userId, actorDisplayName: context.displayName, organizationId: context.scope.organization.id, facilityId: context.scope.facility.id, action: "access.denied", category: "authorization", resourceType: permission, outcome: "denied" });
      res.status(403).json({ error: "Forbidden" }); return;
    }
    next();
  };
}