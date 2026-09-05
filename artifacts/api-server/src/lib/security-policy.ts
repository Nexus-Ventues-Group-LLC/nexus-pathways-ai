/**
 * Pure authorization decisions shared by middleware and regression tests.
 * No Clerk, database, or HTTP dependency belongs in this module.
 */
export type ScopeIds = { organizationId: string; agencyId?: string | null; regionId?: string | null; facilityId?: string | null };

export function authenticationOutcome(input: {
  clerkUserId: string | null;
  verifiedIdentity: boolean;
  sessionRevoked: boolean;
}): 200 | 401 {
  return input.clerkUserId && input.verifiedIdentity && !input.sessionRevoked ? 200 : 401;
}

export function permissionOutcome(permissions: readonly string[], required: string): 200 | 403 {
  return permissions.includes(required) ? 200 : 403;
}

/** Equivalent to the tenant/facility SQL predicates used by scoped services. */
export function isInScope(record: ScopeIds, scope: ScopeIds): boolean {
  return record.organizationId === scope.organizationId
    && (!scope.agencyId || record.agencyId === scope.agencyId)
    && (!scope.regionId || record.regionId === scope.regionId)
    && (!scope.facilityId || record.facilityId === scope.facilityId);
}

export function canCreateFacility(scope: ScopeIds): boolean {
  return !scope.facilityId;
}

export function auditDraft(input: {
  actorUserId: string;
  actorDisplayName: string;
  scope: ScopeIds;
  action: string;
  category: string;
  outcome: "success" | "denied";
  resourceType?: string;
}) {
  return {
    actorUserId: input.actorUserId,
    actorDisplayName: input.actorDisplayName,
    organizationId: input.scope.organizationId,
    facilityId: input.scope.facilityId ?? null,
    action: input.action,
    category: input.category,
    outcome: input.outcome,
    resourceType: input.resourceType ?? null,
  };
}