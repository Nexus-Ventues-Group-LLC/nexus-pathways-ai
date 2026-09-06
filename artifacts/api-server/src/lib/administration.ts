import { and, eq } from "drizzle-orm";
import {
  agenciesTable, db, facilitiesTable, programsTable, regionsTable, tenantConfigurationsTable,
} from "@workspace/db";
import type { PortalContext } from "./identity";
import { writeAudit } from "./identity";
import { canCreateFacility } from "./security-policy";

type ScopeError = "not-found" | "forbidden";
export class AdministrationError extends Error { constructor(readonly kind: ScopeError) { super(kind); } }

function hierarchyWhere(context: PortalContext) {
  return and(
    eq(agenciesTable.organizationId, context.scope.organization.id),
    context.scope.agency ? eq(agenciesTable.id, context.scope.agency.id) : undefined,
    context.scope.region ? eq(regionsTable.id, context.scope.region.id) : undefined,
    context.scope.facility ? eq(facilitiesTable.id, context.scope.facility.id) : undefined,
  );
}

async function visibleFacility(id: string, context: PortalContext) {
  const [row] = await db.select({ facility: facilitiesTable }).from(facilitiesTable)
    .innerJoin(regionsTable, eq(facilitiesTable.regionId, regionsTable.id))
    .innerJoin(agenciesTable, eq(regionsTable.agencyId, agenciesTable.id))
    .where(and(eq(facilitiesTable.id, id), hierarchyWhere(context))).limit(1);
  return row?.facility;
}
async function visibleRegion(id: string, context: PortalContext) {
  const [row] = await db.select({ region: regionsTable }).from(regionsTable)
    .innerJoin(agenciesTable, eq(regionsTable.agencyId, agenciesTable.id))
    .leftJoin(facilitiesTable, eq(facilitiesTable.regionId, regionsTable.id))
    .where(and(eq(regionsTable.id, id), eq(agenciesTable.organizationId, context.scope.organization.id),
      context.scope.agency ? eq(agenciesTable.id, context.scope.agency.id) : undefined,
      context.scope.region ? eq(regionsTable.id, context.scope.region.id) : undefined)).limit(1);
  return row?.region;
}

export async function hierarchy(context: PortalContext) {
  const rows = await db.select({ agency: agenciesTable, region: regionsTable, facility: facilitiesTable, program: programsTable })
    .from(agenciesTable).leftJoin(regionsTable, eq(regionsTable.agencyId, agenciesTable.id))
    .leftJoin(facilitiesTable, eq(facilitiesTable.regionId, regionsTable.id))
    .leftJoin(programsTable, eq(programsTable.facilityId, facilitiesTable.id)).where(hierarchyWhere(context));
  const agencies = new Map<string, any>();
  for (const row of rows) {
    let agency = agencies.get(row.agency.id);
    if (!agency) { agency = { id: row.agency.id, organizationId: row.agency.organizationId, name: row.agency.name, regions: [] }; agencies.set(row.agency.id, agency); }
    if (!row.region) continue;
    let region = agency.regions.find((item: any) => item.id === row.region!.id);
    if (!region) { region = { id: row.region.id, agencyId: row.region.agencyId, name: row.region.name, facilities: [] }; agency.regions.push(region); }
    if (!row.facility) continue;
    let facility = region.facilities.find((item: any) => item.id === row.facility!.id);
    if (!facility) { facility = { id: row.facility.id, regionId: row.facility.regionId, name: row.facility.name, programs: [] }; region.facilities.push(facility); }
    if (row.program) facility.programs.push({ id: row.program.id, facilityId: row.program.facilityId, name: row.program.name });
  }
  return { organization: context.scope.organization, agencies: [...agencies.values()] };
}

async function audit(context: PortalContext, action: string, resourceType: string, facilityId?: string) {
  await writeAudit({ actorUserId: context.userId, actorDisplayName: context.displayName, organizationId: context.scope.organization.id, facilityId: facilityId ?? context.scope.facility?.id, action, category: "administration", resourceType, outcome: "success" });
}
async function deny(context: PortalContext, action: string, resourceType: string) {
  await writeAudit({ actorUserId: context.userId, actorDisplayName: context.displayName, organizationId: context.scope.organization.id, facilityId: context.scope.facility?.id, action, category: "administration", resourceType, outcome: "denied" });
  throw new AdministrationError("not-found");
}
export async function createFacility(context: PortalContext, input: { regionId: string; name: string }) {
  if (!canCreateFacility({
    organizationId: context.scope.organization.id,
    agencyId: context.scope.agency?.id,
    regionId: context.scope.region?.id,
    facilityId: context.scope.facility?.id,
  })) return deny(context, "facility.create.denied", "facility");
  const region = await visibleRegion(input.regionId, context);
  if (!region) return deny(context, "facility.create.denied", "facility");
  const [facility] = await db.insert(facilitiesTable).values(input).returning();
  await audit(context, "facility.created", "facility", facility.id);
  return facility;
}
export async function updateFacility(context: PortalContext, id: string, input: { name: string }) {
  if (!await visibleFacility(id, context)) return deny(context, "facility.update.denied", "facility");
  const [facility] = await db.update(facilitiesTable).set(input).where(eq(facilitiesTable.id, id)).returning();
  await audit(context, "facility.updated", "facility", facility.id);
  return facility;
}
export async function createProgram(context: PortalContext, input: { facilityId: string; name: string }) {
  if (!await visibleFacility(input.facilityId, context)) return deny(context, "program.create.denied", "program");
  const [program] = await db.insert(programsTable).values(input).returning();
  await audit(context, "program.created", "program", input.facilityId);
  return program;
}
export async function updateProgram(context: PortalContext, id: string, input: { name: string }) {
  const [program] = await db.select({ program: programsTable }).from(programsTable).innerJoin(facilitiesTable, eq(programsTable.facilityId, facilitiesTable.id)).innerJoin(regionsTable, eq(facilitiesTable.regionId, regionsTable.id)).innerJoin(agenciesTable, eq(regionsTable.agencyId, agenciesTable.id)).where(and(eq(programsTable.id, id), hierarchyWhere(context))).limit(1);
  if (!program) return deny(context, "program.update.denied", "program");
  const [updated] = await db.update(programsTable).set(input).where(eq(programsTable.id, id)).returning();
  await audit(context, "program.updated", "program", program.program.facilityId);
  return updated;
}
function requireOrganizationScope(context: PortalContext) {
  if (context.scope.level !== "organization") throw new AdministrationError("forbidden");
}
export async function tenantConfiguration(context: PortalContext) {
  requireOrganizationScope(context);
  const [config] = await db.select().from(tenantConfigurationsTable).where(eq(tenantConfigurationsTable.organizationId, context.scope.organization.id)).limit(1);
  if (config) return config;
  const [created] = await db.insert(tenantConfigurationsTable).values({
    organizationId: context.scope.organization.id,
    modules: { abe: true, hse: true, specialEducation: false, accessibility: true, aiTutor: false, career: false, reentry: false, passport: false, offlineMode: false },
    policies: { sessionTimeoutMinutes: 60, inactivityTimeoutMinutes: 30 },
  }).returning();
  return created;
}
export async function updateTenantConfiguration(context: PortalContext, input: { modules: Record<string, boolean>; policies: Record<string, unknown> }) {
  requireOrganizationScope(context);
  const [config] = await db.insert(tenantConfigurationsTable).values({ organizationId: context.scope.organization.id, ...input }).onConflictDoUpdate({ target: tenantConfigurationsTable.organizationId, set: input }).returning();
  await audit(context, "tenant_configuration.updated", "tenant_configuration");
  return config;
}