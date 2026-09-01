// Data access for the `companies` table (the install lifecycle store).
//
// Kept in one module so handlers and services never build SQL inline. Uses the
// Drizzle query builder, which is identical across the PGlite and Neon drivers.

import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "../db";
import { ensureSchema } from "../ensure-schema";
import { companies, type Company, type RegisteredIds } from "../schema";

export interface UpsertCompanyInput {
  fluidCompanyId?: number | null;
  fluidShop?: string | null;
  name?: string | null;
  companyDropletUuid?: string | null;
  dropletInstallationUuid: string;
  authenticationToken?: string | null;
  webhookVerificationToken?: string | null;
}

// Creates or updates a company by its installation UUID (the tenant key).
// A shop can be reinstalled with a new DRI, so fluid_shop is never identity.
export async function upsertCompany(input: UpsertCompanyInput): Promise<Company> {
  await ensureSchema();
  const conn = await db();

  const existing = await findCompany({
    dropletInstallationUuid: input.dropletInstallationUuid,
  });

  if (existing) {
    const [updated] = await conn
      .update(companies)
      .set({ ...stripUndefined(input), active: true, updatedAt: new Date() })
      .where(eq(companies.id, existing.id))
      .returning();
    await deactivateSupersededShopInstallations(
      conn,
      input.fluidShop,
      input.dropletInstallationUuid,
    );
    return updated;
  }

  const [created] = await conn
    .insert(companies)
    .values({ id: randomUUID(), ...stripUndefined(input), active: true })
    .returning();
  await deactivateSupersededShopInstallations(
    conn,
    input.fluidShop,
    input.dropletInstallationUuid,
  );
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

// Resolves request tenancy by the installation UUID Fluid added to the embed.
// This deliberately has no fluid_shop fallback: request context must identify
// one exact, active installation.
export async function findActiveCompanyByInstallation(
  dropletInstallationUuid: string,
): Promise<Company | null> {
  await ensureSchema();
  const conn = await db();
  const rows = await conn
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.dropletInstallationUuid, dropletInstallationUuid),
        eq(companies.active, true),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

// Looks up the active installation that owns a fluid_shop for webhook
// signature checks. Query activity directly so a historical uninstall cannot
// hide a later reinstall with the same shop.
export async function findActiveCompanyByShop(fluidShop: string): Promise<Company | null> {
  await ensureSchema();
  const conn = await db();
  const rows = await conn
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.fluidShop, fluidShop),
        eq(companies.active, true),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
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

export async function eraseCompanyCredentials(companyId: string): Promise<void> {
  const conn = await db();
  await conn
    .update(companies)
    .set({
      authenticationToken: null,
      webhookVerificationToken: null,
      registeredIds: null,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, companyId));
}

// Marks one exact installation inactive on uninstall. Returns the deactivated
// row with its credentials so the caller can clean up remote registrations.
export async function deactivateCompanyByInstallation(
  dropletInstallationUuid: string,
): Promise<Company | null> {
  const company = await findCompany({ dropletInstallationUuid });
  if (!company) return null;

  const conn = await db();
  const [updated] = await conn
    .update(companies)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(companies.id, company.id))
    .returning();
  return updated;
}

async function deactivateSupersededShopInstallations(
  conn: Awaited<ReturnType<typeof db>>,
  fluidShop: string | null | undefined,
  activeInstallationId: string,
): Promise<void> {
  if (!fluidShop) return;

  await conn
    .update(companies)
    .set({ active: false, updatedAt: new Date() })
    .where(
      and(
        eq(companies.fluidShop, fluidShop),
        ne(companies.dropletInstallationUuid, activeInstallationId),
        eq(companies.active, true),
      ),
    );
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
