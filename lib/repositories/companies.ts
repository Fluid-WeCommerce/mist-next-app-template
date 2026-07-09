// Data access for the `companies` table (the install lifecycle store).
//
// Kept in one module so handlers and services never build SQL inline. Uses the
// Drizzle query builder, which is identical across the PGlite and Neon drivers.

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { ensureSchema } from "../ensure-schema";
import { companies, type Company, type RegisteredIds } from "../schema";

export interface UpsertCompanyInput {
  fluidCompanyId?: number | null;
  fluidShop?: string | null;
  name?: string | null;
  companyDropletUuid?: string | null;
  dropletInstallationUuid?: string | null;
  authenticationToken?: string | null;
  webhookVerificationToken?: string | null;
}

// Creates or updates a company by its installation UUID (the tenant key),
// falling back to fluid_shop for legacy installs that lack one.
export async function upsertCompany(input: UpsertCompanyInput): Promise<Company> {
  await ensureSchema();
  const conn = await db();

  const existing = await findCompany({
    dropletInstallationUuid: input.dropletInstallationUuid,
    fluidShop: input.fluidShop,
  });

  if (existing) {
    const [updated] = await conn
      .update(companies)
      .set({ ...stripUndefined(input), active: true, updatedAt: new Date() })
      .where(eq(companies.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await conn
    .insert(companies)
    .values({ id: randomUUID(), ...stripUndefined(input), active: true })
    .returning();
  return created;
}

// Finds a company by installation UUID (preferred) or fluid_shop.
export async function findCompany(opts: {
  dropletInstallationUuid?: string | null;
  fluidShop?: string | null;
}): Promise<Company | null> {
  await ensureSchema();
  const conn = await db();

  if (opts.dropletInstallationUuid) {
    const rows = await conn
      .select()
      .from(companies)
      .where(eq(companies.dropletInstallationUuid, opts.dropletInstallationUuid))
      .limit(1);
    if (rows[0]) return rows[0];
  }

  if (opts.fluidShop) {
    const rows = await conn
      .select()
      .from(companies)
      .where(eq(companies.fluidShop, opts.fluidShop))
      .limit(1);
    if (rows[0]) return rows[0];
  }

  return null;
}

// Looks up the active company that owns a fluid_shop — used to resolve the
// per-company webhook verification token during signature checks.
export async function findActiveCompanyByShop(fluidShop: string): Promise<Company | null> {
  const company = await findCompany({ fluidShop });
  return company?.active ? company : null;
}

export async function setRegisteredIds(
  companyId: string,
  registeredIds: RegisteredIds,
): Promise<void> {
  const conn = await db();
  await conn
    .update(companies)
    .set({ registeredIds, updatedAt: new Date() })
    .where(eq(companies.id, companyId));
}

// Marks a company inactive on uninstall. Returns the deactivated row (with its
// stored credentials) so the caller can clean up remote registrations.
export async function deactivateCompany(opts: {
  dropletInstallationUuid?: string | null;
  fluidShop?: string | null;
}): Promise<Company | null> {
  const company = await findCompany(opts);
  if (!company) return null;

  const conn = await db();
  const [updated] = await conn
    .update(companies)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(companies.id, company.id))
    .returning();
  return updated;
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
