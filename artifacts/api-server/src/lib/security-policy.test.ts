import { describe, expect, it } from "vitest";
import { auditDraft, authenticationOutcome, canCreateFacility, isInScope, permissionOutcome } from "./security-policy";

const admin = ["admin.overview", "audit.read"];
const educator = ["portal.read"];
const learner = ["portal.read"];

describe("Phase 1 security policy", () => {
  it("rejects unauthenticated, unverified, and revoked sessions", () => {
    expect(authenticationOutcome({ clerkUserId: null, verifiedIdentity: true, sessionRevoked: false })).toBe(401);
    expect(authenticationOutcome({ clerkUserId: "user_1", verifiedIdentity: false, sessionRevoked: false })).toBe(401);
    expect(authenticationOutcome({ clerkUserId: "user_1", verifiedIdentity: true, sessionRevoked: true })).toBe(401);
    expect(authenticationOutcome({ clerkUserId: "user_1", verifiedIdentity: true, sessionRevoked: false })).toBe(200);
  });

  it("permits administrator-only overview and audit access", () => {
    expect(permissionOutcome(admin, "admin.overview")).toBe(200);
    expect(permissionOutcome(admin, "audit.read")).toBe(200);
    expect(permissionOutcome(educator, "admin.overview")).toBe(403);
    expect(permissionOutcome(learner, "audit.read")).toBe(403);
  });

  it("keeps learner and educator roles out of administrator capabilities", () => {
    for (const permissions of [learner, educator]) {
      expect(permissionOutcome(permissions, "admin.overview")).toBe(403);
      expect(permissionOutcome(permissions, "audit.read")).toBe(403);
    }
  });

  it("enforces both organization and facility scope predicates", () => {
    const scope = { organizationId: "org-a", facilityId: "facility-1" };
    expect(isInScope({ organizationId: "org-a", facilityId: "facility-1" }, scope)).toBe(true);
    expect(isInScope({ organizationId: "org-b", facilityId: "facility-1" }, scope)).toBe(false);
    expect(isInScope({ organizationId: "org-a", facilityId: "facility-2" }, scope)).toBe(false);
  });

  it("allows state and agency administrators to see every descendant facility", () => {
    const stateScope = { organizationId: "org-a" };
    const agencyScope = { organizationId: "org-a", agencyId: "agency-1" };
    expect(isInScope({ organizationId: "org-a", agencyId: "agency-1", regionId: "r-1", facilityId: "f-1" }, stateScope)).toBe(true);
    expect(isInScope({ organizationId: "org-a", agencyId: "agency-1", regionId: "r-2", facilityId: "f-2" }, agencyScope)).toBe(true);
    expect(isInScope({ organizationId: "org-a", agencyId: "agency-2", regionId: "r-3", facilityId: "f-3" }, agencyScope)).toBe(false);
  });

  it("keeps facility-only administrators from traversing sibling facilities", () => {
    const facilityScope = { organizationId: "org-a", agencyId: "agency-1", regionId: "r-1", facilityId: "f-1" };
    expect(isInScope({ organizationId: "org-a", agencyId: "agency-1", regionId: "r-1", facilityId: "f-1" }, facilityScope)).toBe(true);
    expect(isInScope({ organizationId: "org-a", agencyId: "agency-1", regionId: "r-1", facilityId: "f-2" }, facilityScope)).toBe(false);
    expect(isInScope({ organizationId: "org-b", agencyId: "agency-1", regionId: "r-1", facilityId: "f-1" }, facilityScope)).toBe(false);
  });

  it("allows only ancestor-scoped administrators to create facilities", () => {
    expect(canCreateFacility({ organizationId: "org-a" })).toBe(true);
    expect(canCreateFacility({ organizationId: "org-a", agencyId: "agency-1" })).toBe(true);
    expect(canCreateFacility({ organizationId: "org-a", agencyId: "agency-1", regionId: "r-1" })).toBe(true);
    expect(canCreateFacility({ organizationId: "org-a", agencyId: "agency-1", regionId: "r-1", facilityId: "f-1" })).toBe(false);
  });

  it("creates scoped, secret-free audit event records", () => {
    expect(auditDraft({
      actorUserId: "local-user", actorDisplayName: "Avery", scope: { organizationId: "org-a", facilityId: "facility-1" },
      action: "access.denied", category: "authorization", outcome: "denied", resourceType: "audit.read",
    })).toEqual({
      actorUserId: "local-user", actorDisplayName: "Avery", organizationId: "org-a", facilityId: "facility-1",
      action: "access.denied", category: "authorization", outcome: "denied", resourceType: "audit.read",
    });
  });
});