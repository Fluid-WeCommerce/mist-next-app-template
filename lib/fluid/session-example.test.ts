import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hmacSha256 } from "../crypto";
import { GET } from "../../app/embed/session-example/route";
import { appSessionCookieName } from "./embedded-session";
import { createFluidClientForInstallation, FluidClient } from "./client";

const storeId = "019a0000-0000-7000-8000-000000000001";
const dri = "dri_00000000000000000000000000000001";
const store = `urn:fluid:store:${storeId}`;
const getStore = vi.fn();
const resolve = vi.hoisted(() => vi.fn());
vi.mock("./installation-context", () => ({
  resolveFluidInstallation: resolve, FLUID_INSTALLATION_HEADER: "X-Fluid-Installation",
}));
vi.mock("./client", async (original) => ({
  ...await original<typeof import("./client")>(),
  createFluidClientForInstallation: vi.fn(),
}));
function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ aud: "test-client", iss: "https://fluid.test", dest: store, sub: "urn:fluid:store_admin:viewer", exp: now + 60, nbf: now })).toString("base64url");
  return `${header}.${body}.${hmacSha256("test-key", `${header}.${body}`).toString("base64url")}`;
}
beforeEach(() => {
  vi.stubEnv("FLUID_SESSION_TOKEN_SIGNING_SECRET", "test-key");
  vi.stubEnv("FLUID_OAUTH_CLIENT_ID", "test-client");
  vi.stubEnv("FLUID_SESSION_TOKEN_ISSUER", "https://fluid.test");
  resolve.mockReset().mockResolvedValue({ installationId: dri, companyId: 101, installation: { authenticationToken: "test-dit" } });
  getStore.mockReset().mockResolvedValue(store);
  vi.mocked(createFluidClientForInstallation).mockReturnValue({ getServingStore: getStore } as unknown as FluidClient);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("verifies first load and later documents use the app cookie without a URL token", async () => {
  const jwt = token();
  const first = await GET(new NextRequest(`https://app.test/embed/session-example?dri=${dri}&session_token=${jwt}`));
  expect(first.status).toBe(200);
  expect(first.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(first.headers.get("Cache-Control")).toBe("no-store");
  const cookie = first.cookies.get(appSessionCookieName(dri))!;
  expect(first.headers.get("set-cookie")).toMatch(/HttpOnly/);
  expect(first.headers.get("set-cookie")).toMatch(/Secure/);
  expect(first.headers.get("set-cookie")).toMatch(/SameSite=none/i);
  expect(first.headers.get("set-cookie")).toMatch(/Partitioned/);
  const html = await first.text();
  expect(html).toContain('searchParams.delete("session_token")');
  expect(html).toContain("history.replaceState");
  expect(html).not.toContain(jwt);
  const later = await GET(new NextRequest(`https://app.test/embed/session-example?dri=${dri}&page=next`, { headers: { Cookie: `${cookie.name}=${cookie.value}` } }));
  expect(later.status).toBe(200);
  expect(later.headers.get("set-cookie")).toBeNull(); // no sliding lifetime
  expect(resolve).toHaveBeenCalledTimes(2);
  expect(getStore).toHaveBeenCalledWith(101);
});
it("fails closed without a viewer, for a wrong store and after installation revocation", async () => {
  const url = `https://app.test/embed/session-example?dri=${dri}`;
  expect((await GET(new NextRequest(url))).status).toBe(401);
  getStore.mockResolvedValue("urn:fluid:store:other");
  expect((await GET(new NextRequest(`${url}&session_token=${token()}`))).status).toBe(401);
  resolve.mockRejectedValue(new Error("inactive installation"));
  const denied = await GET(new NextRequest(`${url}&session_token=${token()}`));
  expect(denied.status).toBe(401);
  expect(await denied.text()).not.toContain(token());
});
it("fails closed when the Fluid lookup for the serving store is denied", async () => {
  getStore.mockRejectedValue(new Error("403: forbidden"));
  const response = await GET(new NextRequest(`https://app.test/embed/session-example?dri=${dri}&session_token=${token()}`));
  expect(response.status).toBe(401);
  expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(response.headers.get("set-cookie")).toBeNull();
});
it("rejects a cookie minted for a different installation, whether sent under its own name or the target's name", async () => {
  const driB = "dri_00000000000000000000000000000002";
  const storeB = `urn:fluid:store:${storeId}b`;
  resolve.mockImplementation(async (req: Request) => {
    const requestHeaders = new Headers(req.headers);
    const id = requestHeaders.get("X-Fluid-Installation");
    if (id === driB) return { installationId: driB, companyId: 102, installation: { authenticationToken: "test-dit-b" } };
    return { installationId: dri, companyId: 101, installation: { authenticationToken: "test-dit" } };
  });
  getStore.mockImplementation(async (companyId: number) => (companyId === 102 ? storeB : store));
  const first = await GET(new NextRequest(`https://app.test/embed/session-example?dri=${dri}&session_token=${token()}`));
  expect(first.status).toBe(200);
  const cookieA = first.cookies.get(appSessionCookieName(dri))!;
  const underOwnName = await GET(new NextRequest(`https://app.test/embed/session-example?dri=${driB}`, {
    headers: { Cookie: `${cookieA.name}=${cookieA.value}` },
  }));
  expect(underOwnName.status).toBe(401);
  const underTargetName = await GET(new NextRequest(`https://app.test/embed/session-example?dri=${driB}`, {
    headers: { Cookie: `${appSessionCookieName(driB)}=${cookieA.value}` },
  }));
  expect(underTargetName.status).toBe(401);
});
it("only resolves expected store with the installation DIT and rejects malformed/mismatched API identity", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { company: { id: 101, uuid_v7: storeId } } })));
  vi.stubGlobal("fetch", fetcher);
  const client = new FluidClient("test-dit", "https://api.fluid.test");
  expect(await client.getServingStore(101)).toBe(store);
  expect(fetcher).toHaveBeenCalledWith("https://api.fluid.test/api/company/v1/companies/me", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test-dit" }), redirect: "error" }));
  for (const company of [{ id: 999, uuid_v7: storeId }, { id: 101 }, { id: 101, uuid_v7: "" }]) {
    fetcher.mockResolvedValue(new Response(JSON.stringify({ data: { company } })));
    await expect(client.getServingStore(101)).rejects.toThrow("Fluid serving store could not be resolved");
  }
});
