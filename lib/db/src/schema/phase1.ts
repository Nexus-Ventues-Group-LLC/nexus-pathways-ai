import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

const id = (name: string) => uuid(name).defaultRandom().primaryKey();
const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const organizationsTable = pgTable("organizations", { id: id("id"), name: text("name").notNull(), createdAt: createdAt });
export const agenciesTable = pgTable("agencies", { id: id("id"), organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id), name: text("name").notNull(), createdAt: createdAt });
export const regionsTable = pgTable("regions", { id: id("id"), agencyId: uuid("agency_id").notNull().references(() => agenciesTable.id), name: text("name").notNull(), createdAt: createdAt });
export const facilitiesTable = pgTable("facilities", { id: id("id"), regionId: uuid("region_id").notNull().references(() => regionsTable.id), name: text("name").notNull(), createdAt: createdAt });
export const programsTable = pgTable("programs", { id: id("id"), facilityId: uuid("facility_id").notNull().references(() => facilitiesTable.id), name: text("name").notNull(), createdAt: createdAt });
export const cohortsTable = pgTable("cohorts", { id: id("id"), programId: uuid("program_id").notNull().references(() => programsTable.id), name: text("name").notNull(), createdAt: createdAt });
export const tenantConfigurationsTable = pgTable("tenant_configurations", {
  organizationId: uuid("organization_id").primaryKey().references(() => organizationsTable.id),
  modules: jsonb("modules").notNull().default({}),
  policies: jsonb("policies").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const usersTable = pgTable("users", {
  id: id("id"), clerkUserId: text("clerk_user_id").notNull(), displayName: text("display_name").notNull(),
  email: text("email"), createdAt: createdAt, updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [uniqueIndex("users_clerk_user_id_unique").on(t.clerkUserId)]);
export const learnerProfilesTable = pgTable("learner_profiles", { userId: uuid("user_id").primaryKey().references(() => usersTable.id), cohortId: uuid("cohort_id").notNull().references(() => cohortsTable.id), createdAt: createdAt });
export const staffProfilesTable = pgTable("staff_profiles", { userId: uuid("user_id").primaryKey().references(() => usersTable.id), title: text("title").notNull(), createdAt: createdAt });
export const rolesTable = pgTable("roles", { id: id("id"), key: text("key").notNull(), name: text("name").notNull(), createdAt: createdAt }, (t) => [uniqueIndex("roles_key_unique").on(t.key)]);
export const permissionsTable = pgTable("permissions", { id: id("id"), key: text("key").notNull(), description: text("description").notNull(), createdAt: createdAt }, (t) => [uniqueIndex("permissions_key_unique").on(t.key)]);
export const rolePermissionsTable = pgTable("role_permissions", { roleId: uuid("role_id").notNull().references(() => rolesTable.id), permissionId: uuid("permission_id").notNull().references(() => permissionsTable.id) }, (t) => [uniqueIndex("role_permission_unique").on(t.roleId, t.permissionId)]);
export const userRoleAssignmentsTable = pgTable("user_role_assignments", {
  id: id("id"), userId: uuid("user_id").notNull().references(() => usersTable.id), roleId: uuid("role_id").notNull().references(() => rolesTable.id),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id), agencyId: uuid("agency_id").references(() => agenciesTable.id),
  regionId: uuid("region_id").references(() => regionsTable.id), facilityId: uuid("facility_id").references(() => facilitiesTable.id),
  programId: uuid("program_id").references(() => programsTable.id), cohortId: uuid("cohort_id").references(() => cohortsTable.id), createdAt: createdAt,
});
export const applicationSessionsTable = pgTable("application_sessions", {
  id: id("id"), userId: uuid("user_id").notNull().references(() => usersTable.id), clerkSessionId: text("clerk_session_id").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }), createdAt: createdAt,
}, (t) => [uniqueIndex("application_sessions_clerk_session_unique").on(t.clerkSessionId)]);
export const auditEventsTable = pgTable("audit_events", {
  id: id("id"), actorUserId: uuid("actor_user_id").references(() => usersTable.id), actorDisplayName: text("actor_display_name").notNull(),
  organizationId: uuid("organization_id").references(() => organizationsTable.id), facilityId: uuid("facility_id").references(() => facilitiesTable.id),
  action: text("action").notNull(), category: text("category").notNull(), resourceType: text("resource_type"),
  outcome: text("outcome").notNull(), metadata: jsonb("metadata").notNull().default({}), createdAt: createdAt,
});

export const organizationsRelations = relations(organizationsTable, ({ many }) => ({ agencies: many(agenciesTable) }));
export const agenciesRelations = relations(agenciesTable, ({ one, many }) => ({ organization: one(organizationsTable, { fields: [agenciesTable.organizationId], references: [organizationsTable.id] }), regions: many(regionsTable) }));
export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({ id: true, createdAt: true });
export const insertAuditEventSchema = createInsertSchema(auditEventsTable);
export const insertTenantConfigurationSchema = createInsertSchema(tenantConfigurationsTable).omit({ updatedAt: true });
export type Organization = typeof organizationsTable.$inferSelect;
export type User = typeof usersTable.$inferSelect;
export type AuditEvent = typeof auditEventsTable.$inferSelect;
export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;
export type TenantConfiguration = typeof tenantConfigurationsTable.$inferSelect;
export type InsertTenantConfiguration = z.infer<typeof insertTenantConfigurationSchema>;