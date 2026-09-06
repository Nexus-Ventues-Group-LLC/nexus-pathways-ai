import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import {
  agenciesTable,
  auditEventsTable,
  db,
  facilitiesTable,
  organizationsTable,
  programsTable,
  regionsTable,
  usersTable,
} from "@workspace/db";
import {
  AdministrationError,
  createFacility,
  hierarchy,
  updateProgram,
} from "./administration";
import { visibleAuditEvents } from "./dashboard";
import type { PortalContext } from "./identity";
import { createFixtureNamespace } from "../test/fixture-namespace";

const fixtures = createFixtureNamespace("administration");
const ids = {
  organization: fixtures.id(),
  agency: fixtures.id(),
  region: fixtures.id(),
  facilityA: fixtures.id(),
  facilityB: fixtures.id(),
  programA: fixtures.id(),
  programB: fixtures.id(),
  foreignOrganization: fixtures.id(),
  foreignAgency: fixtures.id(),
  foreignRegion: fixtures.id(),
  foreignFacility: fixtures.id(),
  user: fixtures.id(),
};

const ref = (id: string, name: string) => ({ id, name });
const baseContext = {
  userId: ids.user,
  displayName: "Integration Administrator",
  email: "integration@example.test",
  role: "administrator",
  permissions: ["admin.overview", "admin.hierarchy.manage", "audit.read"],
};
const organizationContext: PortalContext = {
  ...baseContext,
  scope: {
    organization: ref(ids.organization, "Integration State"),
    agency: null,
    region: null,
    facility: null,
    program: null,
    cohort: null,
    level: "organization",
  },
};
const regionContext: PortalContext = {
  ...baseContext,
  scope: {
    organization: ref(ids.organization, "Integration State"),
    agency: ref(ids.agency, "Integration Agency"),
    region: ref(ids.region, "Integration Region"),
    facility: null,
    program: null,
    cohort: null,
    level: "region",
  },
};
const facilityContext: PortalContext = {
  ...baseContext,
  scope: {
    ...regionContext.scope,
    facility: ref(ids.facilityA, "Facility A"),
    level: "facility",
  },
};

beforeAll(async () => {
  await db.insert(organizationsTable).values([
    { id: ids.organization, name: "Integration State" },
    { id: ids.foreignOrganization, name: "Foreign State" },
  ]).onConflictDoNothing();
  await db.insert(agenciesTable).values([
    { id: ids.agency, organizationId: ids.organization, name: "Integration Agency" },
    { id: ids.foreignAgency, organizationId: ids.foreignOrganization, name: "Foreign Agency" },
  ]).onConflictDoNothing();
  await db.insert(regionsTable).values([
    { id: ids.region, agencyId: ids.agency, name: "Integration Region" },
    { id: ids.foreignRegion, agencyId: ids.foreignAgency, name: "Foreign Region" },
  ]).onConflictDoNothing();
  await db.insert(facilitiesTable).values([
    { id: ids.facilityA, regionId: ids.region, name: "Facility A" },
    { id: ids.facilityB, regionId: ids.region, name: "Facility B" },
    { id: ids.foreignFacility, regionId: ids.foreignRegion, name: "Foreign Facility" },
  ]).onConflictDoNothing();
  await db.insert(programsTable).values([
    { id: ids.programA, facilityId: ids.facilityA, name: "Program A" },
    { id: ids.programB, facilityId: ids.facilityB, name: "Program B" },
  ]).onConflictDoNothing();
  await db.insert(usersTable).values({
    id: ids.user,
    clerkUserId: fixtures.key("user"),
    displayName: baseContext.displayName,
    email: baseContext.email,
  }).onConflictDoNothing();
  await db.insert(auditEventsTable).values([
    { actorUserId: ids.user, actorDisplayName: baseContext.displayName, organizationId: ids.organization, facilityId: ids.facilityA, action: "phase2.test.facility-a", category: "test", outcome: "success" },
    { actorUserId: ids.user, actorDisplayName: baseContext.displayName, organizationId: ids.organization, facilityId: ids.facilityB, action: "phase2.test.facility-b", category: "test", outcome: "success" },
    { actorUserId: ids.user, actorDisplayName: baseContext.displayName, organizationId: ids.foreignOrganization, facilityId: ids.foreignFacility, action: "phase2.test.foreign", category: "test", outcome: "success" },
  ]);
});

afterAll(async () => {
  await db.delete(auditEventsTable).where(eq(auditEventsTable.actorUserId, ids.user));
  await db.delete(usersTable).where(eq(usersTable.id, ids.user));
  await db.delete(programsTable).where(inArray(programsTable.id, [ids.programA, ids.programB]));
  await db.delete(facilitiesTable).where(inArray(facilitiesTable.id, [ids.facilityA, ids.facilityB, ids.foreignFacility]));
  await db.delete(regionsTable).where(inArray(regionsTable.id, [ids.region, ids.foreignRegion]));
  await db.delete(agenciesTable).where(inArray(agenciesTable.id, [ids.agency, ids.foreignAgency]));
  await db.delete(organizationsTable).where(inArray(organizationsTable.id, [ids.organization, ids.foreignOrganization]));
});

describe("Phase 2 administration database isolation", () => {
  it("shows both in-tenant facilities to an organization administrator and one to a facility administrator", async () => {
    const organizationHierarchy = await hierarchy(organizationContext);
    const organizationFacilities = organizationHierarchy.agencies.flatMap((agency) =>
      agency.regions.flatMap((region: { facilities: Array<{ id: string }> }) => region.facilities),
    );
    expect(organizationFacilities.map((facility: { id: string }) => facility.id).sort()).toEqual(
      [ids.facilityA, ids.facilityB].sort(),
    );

    const facilityHierarchy = await hierarchy(facilityContext);
    const facilityIds = facilityHierarchy.agencies.flatMap((agency) =>
      agency.regions.flatMap((region: { facilities: Array<{ id: string }> }) =>
        region.facilities.map((facility) => facility.id),
      ),
    );
    expect(facilityIds).toEqual([ids.facilityA]);
  });

  it("limits audit reads by region, facility, and tenant", async () => {
    const regionActions = (await visibleAuditEvents(regionContext, 100)).map((event) => event.action);
    expect(regionActions).toContain("phase2.test.facility-a");
    expect(regionActions).toContain("phase2.test.facility-b");
    expect(regionActions).not.toContain("phase2.test.foreign");

    const facilityActions = (await visibleAuditEvents(facilityContext, 100)).map((event) => event.action);
    expect(facilityActions).toContain("phase2.test.facility-a");
    expect(facilityActions).not.toContain("phase2.test.facility-b");
    expect(facilityActions).not.toContain("phase2.test.foreign");
  });

  it("denies sibling facility creation and sibling program updates", async () => {
    await expect(createFacility(facilityContext, {
      regionId: ids.region,
      name: "Unauthorized Sibling",
    })).rejects.toEqual(expect.objectContaining<Partial<AdministrationError>>({ kind: "not-found" }));

    await expect(updateProgram(facilityContext, ids.programB, {
      name: "Unauthorized Rename",
    })).rejects.toEqual(expect.objectContaining<Partial<AdministrationError>>({ kind: "not-found" }));

    const [program] = await db.select().from(programsTable).where(and(
      eq(programsTable.id, ids.programB),
      eq(programsTable.name, "Program B"),
    ));
    expect(program).toBeDefined();
  });
});