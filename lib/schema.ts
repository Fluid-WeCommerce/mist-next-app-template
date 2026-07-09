// Drizzle table definitions for the Mist droplet backbone.
//
// Two tables carry the multi-tenant install state and a webhook audit log.
// Column names are snake_case so they match the raw `CREATE TABLE` statements
// in lib/ensure-schema.ts (which bootstrap the same tables on both PGlite and
// Neon without a migration step).

import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

// One row per company that has installed this droplet.
export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  fluidCompanyId: integer("fluid_company_id"),
  fluidShop: text("fluid_shop"),
  name: text("name"),
  // NOT unique — the same droplet UUID is shared across every install.
  companyDropletUuid: text("company_droplet_uuid"),
  // Unique per installation — this is the tenant key.
  dropletInstallationUuid: text("droplet_installation_uuid"),
  authenticationToken: text("authentication_token"),
  webhookVerificationToken: text("webhook_verification_token"),
  // UUIDs of callback/webhook/dropzone registrations created on install,
  // so they can be cleaned up on uninstall.
  registeredIds: jsonb("registered_ids").$type<RegisteredIds>(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Append-only audit log of every webhook received.
export const webhooks = pgTable("webhooks", {
  id: text("id").primaryKey(),
  resource: text("resource").notNull(),
  event: text("event").notNull(),
  eventType: text("event_type").notNull(),
  version: text("version"),
  payload: jsonb("payload"),
  processed: boolean("processed").notNull().default(false),
  error: text("error"),
  companyId: text("company_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RegisteredIds = {
  webhookIds: string[];
  callbackUuids: string[];
  dropZoneUuids: string[];
};

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Webhook = typeof webhooks.$inferSelect;
