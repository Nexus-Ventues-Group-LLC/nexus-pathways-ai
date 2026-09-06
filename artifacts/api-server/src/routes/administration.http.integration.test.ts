import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  agenciesTable,
  auditEventsTable,
  db,
  facilitiesTable,
  organizationsTable,
  permissionsTable,
  programsTable,
  regionsTable,
  rolePermissionsTable,
  rolesTable,
  userRoleAssignmentsTable,
  usersTable,
} from "@workspace/db";
import { createFixtureNamespace } from "../test/fixture-namespace";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: (req: { headers: Record<string, string | undefined> }) => {
    const userId = req.headers["x-test-clerk-user"];
    return userId
      ? {
          userId,
          sessionId: null,
          sessionClaims: {
            email: `${userId}@example.test`,
            email_verified: true,
            name: userId,
          },
        }
      : { userId: null, sessionId: null, sessionClaims: {} };
  },
}));

const fixtures = createFixtureNamespace("administration-http");
const ids = {
  organization: fixtures.id(),
  foreignOrganization: fixtures.id(),
  agencyA: fixtures.id(),
  agencyB: fixtures.id(),
  foreignAgency: fixtures.id(),
  regionA: fixtures.id(),
  regionB: fixtures.id(),
  foreignRegion: fixtures.id(),
  facilityA: fixtures.id(),
  facilityB: fixtures.id(),
  siblingAgencyFacility: fixtures.id(),
  foreignFacility: fixtures.id(),
  programA: fixtures.id(),
  programB: fixtures.id(),
  roleAdmin: fixtures.id(),
  roleLimited: fixtures.id(),
  organizationUser: fixtures.id(),
  agencyUser: fixtures.id(),
  regionUser: fixtures.id(),
  facilityUser: fixtures.id(),
  limitedUser: fixtures.id(),
};

const clerkIds = {
  organization: fixtures.key("org-admin"),
  agency: fixtures.key("agency-admin"),
  region: fixtures.key("region-admin"),
  facility: fixtures.key("facility-admin"),
  limited: fixtures.key("limited-admin"),
};

let server: Server;
let baseUrl: string;
const createdFacilityIds: string[] = [];
const createdProgramIds: string[] = [];

async function request(path: string, clerkUserId?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (clerkUserId) headers.set("x-test-clerk-user", clerkUserId);
  if (init.body) headers.set("content-type", "application/json");
  return fetch(`${baseUrl}/api${path}`, { ...init, headers });
}

function hierarchyFacilityIds(body: {
  agencies: Array<{ regions: Array<{ facilities: Array<{ id: string }> }> }>;
}) {
  return body.agencies.flatMap((agency) =>
    agency.regions.flatMap((region) => region.facilities.map((facility) => facility.id)),
  );
}

beforeAll(async () => {
  await db.insert(organizationsTable).values([
    { id: ids.organization, name: "HTTP State" },
    { id: ids.foreignOrganization, name: "Foreign HTTP State" },
  ]).onConflictDoNothing();
  await db.insert(agenciesTable).values([
    { id: ids.agencyA, organizationId: ids.organization, name: "Agency A" },
    { id: ids.agencyB, organizationId: ids.organization, name: "Agency B" },
    { id: ids.foreignAgency, organizationId: ids.foreignOrganization, name: "Foreign Agency" },
  ]).onConflictDoNothing();
  await db.insert(regionsTable).values([
    { id: ids.regionA, agencyId: ids.agencyA, name: "Region A" },
    { id: ids.regionB, agencyId: ids.agencyB, name: "Region B" },
    { id: ids.foreignRegion, agencyId: ids.foreignAgency, name: "Foreign Region" },
  ]).onConflictDoNothing();
  await db.insert(facilitiesTable).values([
    { id: ids.facilityA, regionId: ids.regionA, name: "Facility A" },
    { id: ids.facilityB, regionId: ids.regionA, name: "Facility B" },
    { id: ids.siblingAgencyFacility, regionId: ids.regionB, name: "Sibling Agency Facility" },
    { id: ids.foreignFacility, regionId: ids.foreignRegion, name: "Foreign Facility" },
  ]).onConflictDoNothing();
  await db.insert(programsTable).values([
    { id: ids.programA, facilityId: ids.facilityA, name: "Program A" },
    { id: ids.programB, facilityId: ids.facilityB, name: "Program B" },
  ]).onConflictDoNothing();
  await db.insert(rolesTable).values([
    { id: ids.roleAdmin, key: fixtures.key("admin-role"), name: "HTTP Integration Admin" },
    { id: ids.roleLimited, key: fixtures.key("limited-role"), name: "HTTP Integration Limited" },
  ]).onConflictDoNothing();
  const permissionRows = await db.select({ id: permissionsTable.id, key: permissionsTable.key })
    .from(permissionsTable)
    .where(inArray(permissionsTable.key, ["admin.overview", "admin.hierarchy.manage", "audit.read"]));
  const permissionId = new Map(permissionRows.map((permission) => [permission.key, permission.id]));
  if (permissionId.size !== 3) throw new Error("Required administration permissions have not been seeded");
  await db.insert(rolePermissionsTable).values(
    ["admin.overview", "admin.hierarchy.manage", "audit.read"].map((key) => ({
      roleId: ids.roleAdmin,
      permissionId: permissionId.get(key)!,
    })),
  ).onConflictDoNothing();
  await db.insert(usersTable).values([
    { id: ids.organizationUser, clerkUserId: clerkIds.organization, displayName: "Organization Admin" },
    { id: ids.agencyUser, clerkUserId: clerkIds.agency, displayName: "Agency Admin" },
    { id: ids.regionUser, clerkUserId: clerkIds.region, displayName: "Region Admin" },
    { id: ids.facilityUser, clerkUserId: clerkIds.facility, displayName: "Facility Admin" },
    { id: ids.limitedUser, clerkUserId: clerkIds.limited, displayName: "Limited Admin" },
  ]).onConflictDoNothing();
  await db.insert(userRoleAssignmentsTable).values([
    { userId: ids.organizationUser, roleId: ids.roleAdmin, organizationId: ids.organization },
    { userId: ids.agencyUser, roleId: ids.roleAdmin, organizationId: ids.organization, agencyId: ids.agencyA },
    { userId: ids.regionUser, roleId: ids.roleAdmin, organizationId: ids.organization, agencyId: ids.agencyA, regionId: ids.regionA },
    { userId: ids.facilityUser, roleId: ids.roleAdmin, organizationId: ids.organization, agencyId: ids.agencyA, regionId: ids.regionA, facilityId: ids.facilityA },
    { userId: ids.limitedUser, roleId: ids.roleLimited, organizationId: ids.organization },
  ]);
  await db.insert(auditEventsTable).values([
    { actorDisplayName: "Fixture", organizationId: ids.organization, facilityId: ids.facilityA, action: "http.fixture.facility-a", category: "test", outcome: "success" },
    { actorDisplayName: "Fixture", organizationId: ids.organization, facilityId: ids.facilityB, action: "http.fixture.facility-b", category: "test", outcome: "success" },
    { actorDisplayName: "Fixture", organizationId: ids.organization, facilityId: ids.siblingAgencyFacility, action: "http.fixture.sibling-agency", category: "test", outcome: "success" },
    { actorDisplayName: "Fixture", organizationId: ids.foreignOrganization, facilityId: ids.foreignFacility, action: "http.fixture.foreign", category: "test", outcome: "success" },
  ]);

  const { default: app } = await import("../app");
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP test server");
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await db.delete(auditEventsTable).where(inArray(auditEventsTable.organizationId, [ids.organization, ids.foreignOrganization]));
  await db.delete(userRoleAssignmentsTable).where(inArray(userRoleAssignmentsTable.userId, [
    ids.organizationUser, ids.agencyUser, ids.regionUser, ids.facilityUser, ids.limitedUser,
  ]));
  await db.delete(usersTable).where(inArray(usersTable.id, [
    ids.organizationUser, ids.agencyUser, ids.regionUser, ids.facilityUser, ids.limitedUser,
  ]));
  if (createdProgramIds.length) await db.delete(programsTable).where(inArray(programsTable.id, createdProgramIds));
  await db.delete(programsTable).where(inArray(programsTable.id, [ids.programA, ids.programB]));
  if (createdFacilityIds.length) await db.delete(facilitiesTable).where(inArray(facilitiesTable.id, createdFacilityIds));
  await db.delete(facilitiesTable).where(inArray(facilitiesTable.id, [
    ids.facilityA, ids.facilityB, ids.siblingAgencyFacility, ids.foreignFacility,
  ]));
  await db.delete(regionsTable).where(inArray(regionsTable.id, [ids.regionA, ids.regionB, ids.foreignRegion]));
  await db.delete(agenciesTable).where(inArray(agenciesTable.id, [ids.agencyA, ids.agencyB, ids.foreignAgency]));
  await db.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, ids.roleAdmin));
  await db.delete(rolesTable).where(inArray(rolesTable.id, [ids.roleAdmin, ids.roleLimited]));
  await db.delete(organizationsTable).where(inArray(organizationsTable.id, [ids.organization, ids.foreignOrganization]));
});

describe("administration HTTP authorization and scope", () => {
  it.each([
    [clerkIds.organization, [ids.facilityA, ids.facilityB, ids.siblingAgencyFacility]],
    [clerkIds.agency, [ids.facilityA, ids.facilityB]],
    [clerkIds.region, [ids.facilityA, ids.facilityB]],
    [clerkIds.facility, [ids.facilityA]],
  ])("returns only the signed-in administrator's hierarchy for %s", async (clerkUserId, expected) => {
    const response = await request("/admin/hierarchy", clerkUserId);
    expect(response.status).toBe(200);
    const body = await response.json() as Parameters<typeof hierarchyFacilityIds>[0];
    expect(hierarchyFacilityIds(body).sort()).toEqual([...expected].sort());
  });

  it.each([
    [clerkIds.organization, ["http.fixture.facility-a", "http.fixture.facility-b", "http.fixture.sibling-agency"]],
    [clerkIds.agency, ["http.fixture.facility-a", "http.fixture.facility-b"]],
    [clerkIds.region, ["http.fixture.facility-a", "http.fixture.facility-b"]],
    [clerkIds.facility, ["http.fixture.facility-a"]],
  ])("excludes sibling and cross-tenant audit events for %s", async (clerkUserId, expected) => {
    const response = await request("/audit-events?limit=100", clerkUserId);
    expect(response.status).toBe(200);
    const actions = ((await response.json()) as Array<{ action: string }>).map((event) => event.action);
    for (const action of expected) expect(actions).toContain(action);
    expect(actions).not.toContain("http.fixture.foreign");
    if (clerkUserId !== clerkIds.organization) expect(actions).not.toContain("http.fixture.sibling-agency");
    if (clerkUserId === clerkIds.facility) expect(actions).not.toContain("http.fixture.facility-b");
  });

  it("returns contracted mutation statuses and records success and denial audits", async () => {
    const createFacilityResponse = await request("/admin/facilities", clerkIds.region, {
      method: "POST",
      body: JSON.stringify({ regionId: ids.regionA, name: "Created over HTTP" }),
    });
    expect(createFacilityResponse.status).toBe(201);
    const createdFacility = await createFacilityResponse.json() as { id: string };
    createdFacilityIds.push(createdFacility.id);

    const updateFacilityResponse = await request(`/admin/facilities/${createdFacility.id}`, clerkIds.region, {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated over HTTP" }),
    });
    expect(updateFacilityResponse.status).toBe(200);

    const createProgramResponse = await request("/admin/programs", clerkIds.facility, {
      method: "POST",
      body: JSON.stringify({ facilityId: ids.facilityA, name: "Created Program" }),
    });
    expect(createProgramResponse.status).toBe(201);
    const createdProgram = await createProgramResponse.json() as { id: string };
    createdProgramIds.push(createdProgram.id);

    const updateProgramResponse = await request(`/admin/programs/${createdProgram.id}`, clerkIds.facility, {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Program" }),
    });
    expect(updateProgramResponse.status).toBe(200);

    const deniedResponse = await request(`/admin/programs/${ids.programB}`, clerkIds.facility, {
      method: "PATCH",
      body: JSON.stringify({ name: "Must not change" }),
    });
    expect(deniedResponse.status).toBe(404);
    const deniedFacilityResponse = await request("/admin/facilities", clerkIds.facility, {
      method: "POST",
      body: JSON.stringify({ regionId: ids.regionA, name: "Must not be created" }),
    });
    expect(deniedFacilityResponse.status).toBe(404);

    const audits = await db.select({ action: auditEventsTable.action, outcome: auditEventsTable.outcome })
      .from(auditEventsTable)
      .where(eq(auditEventsTable.actorUserId, ids.facilityUser));
    expect(audits).toEqual(expect.arrayContaining([
      { action: "program.created", outcome: "success" },
      { action: "program.updated", outcome: "success" },
      { action: "program.update.denied", outcome: "denied" },
      { action: "facility.create.denied", outcome: "denied" },
    ]));
    const regionAudits = await db.select({ action: auditEventsTable.action, outcome: auditEventsTable.outcome })
      .from(auditEventsTable)
      .where(eq(auditEventsTable.actorUserId, ids.regionUser));
    expect(regionAudits).toEqual(expect.arrayContaining([
      { action: "facility.created", outcome: "success" },
      { action: "facility.updated", outcome: "success" },
    ]));
  });

  it("runs generated request validation before a mutation", async () => {
    const response = await request("/admin/facilities", clerkIds.organization, {
      method: "POST",
      body: JSON.stringify({ regionId: "not-a-uuid", name: "" }),
    });
    expect(response.status).toBe(400);
  });

  it("returns 403 and writes a denial audit when permission is missing", async () => {
    const response = await request("/admin/hierarchy", clerkIds.limited);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    const [audit] = await db.select({ action: auditEventsTable.action, outcome: auditEventsTable.outcome, resourceType: auditEventsTable.resourceType })
      .from(auditEventsTable)
      .where(eq(auditEventsTable.actorUserId, ids.limitedUser));
    expect(audit).toEqual({ action: "access.authenticated", outcome: "success", resourceType: null });
    const denials = await db.select({ action: auditEventsTable.action, outcome: auditEventsTable.outcome, resourceType: auditEventsTable.resourceType })
      .from(auditEventsTable)
      .where(eq(auditEventsTable.actorUserId, ids.limitedUser));
    expect(denials).toContainEqual({ action: "access.denied", outcome: "denied", resourceType: "admin.overview" });
  });

  it("returns 401 when no Clerk identity is present", async () => {
    const response = await request("/admin/hierarchy");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });
});