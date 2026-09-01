export const FLUID_INSTALLATION_HEADER = "x-fluid-droplet-installation";

export function isFluidInstallationReference(
  value: string | null,
): value is string {
  return value !== null && /^dri_[A-Za-z0-9_-]+$/.test(value);
}

export function readFluidInstallationReference(
  url: string | URL,
): string | null {
  try {
    const installationId = new URL(url).searchParams.get("dri");
    return isFluidInstallationReference(installationId) ? installationId : null;
  } catch {
    return null;
  }
}

export async function fluidInstallationFetch(
  installationId: string,
  input: RequestInfo | URL,
  init: RequestInit = {},
  fetchImplementation: typeof fetch = fetch,
): Promise<Response> {
  if (!isFluidInstallationReference(installationId)) {
    throw new Error("Fluid installation reference is unavailable");
  }

  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init.headers).forEach((value, name) => headers.set(name, value));
  headers.set(FLUID_INSTALLATION_HEADER, installationId);
  return fetchImplementation(input, { ...init, headers });
}
