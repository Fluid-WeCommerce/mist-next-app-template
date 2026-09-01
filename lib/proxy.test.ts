import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "../proxy";

describe("proxy", () => {
  it("prevents the iframe bootstrap URL from leaking through referrers", () => {
    const request = new NextRequest(
      "https://droplet.example/?dri=dri_01templateinstall",
    );

    const response = proxy(request);

    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });
});
