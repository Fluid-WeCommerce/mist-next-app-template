import { findActiveCompanyByInstallation } from "../repositories/companies";
import type { Company } from "../schema";

export const FLUID_INSTALLATION_HEADER = "x-fluid-droplet-installation";

export type FluidInstallationContext = {
  installationId: string;
  companyId: number;
  installation: Company;
  assurance: "installation-reference";
};

export class FluidInstallationContextError extends Error {
  constructor() {
    super("Fluid installation context not found");
    this.name = "FluidInstallationContextError";
  }
}

export async function resolveFluidInstallation(
  request: Request,
): Promise<FluidInstallationContext> {
  const installationId = request.headers.get(FLUID_INSTALLATION_HEADER);
  if (!installationId || !/^dri_[A-Za-z0-9_-]+$/.test(installationId)) {
    throw new FluidInstallationContextError();
  }

  const installation = await findActiveCompanyByInstallation(installationId);
  if (!installation || installation.fluidCompanyId === null) {
    throw new FluidInstallationContextError();
  }

  return {
    installationId,
    companyId: installation.fluidCompanyId,
    installation,
    assurance: "installation-reference",
  };
}
