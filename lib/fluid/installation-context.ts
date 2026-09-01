import { findActiveCompanyByInstallation } from "../repositories/companies";
import type { Company } from "../schema";
import {
  FLUID_INSTALLATION_HEADER,
  isFluidInstallationReference,
} from "./installation-reference";

export { FLUID_INSTALLATION_HEADER } from "./installation-reference";

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
  if (!isFluidInstallationReference(installationId)) {
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
