import { describe, it, expect, beforeEach } from "vitest";
import { registerHandler, routeEvent, hasHandler, clearHandlers } from "./event-handler";

describe("event-handler", () => {
  beforeEach(() => clearHandlers());

  it("routes an event to its registered handler", async () => {
    const seen: unknown[] = [];
    registerHandler("order.created", async (p) => {
      seen.push(p);
    });

    const handled = await routeEvent("order.created", { id: 1 });
    expect(handled).toBe(true);
    expect(seen).toEqual([{ id: 1 }]);
  });

  it("returns false when no handler is registered", async () => {
    expect(await routeEvent("nope.none", {})).toBe(false);
  });

  it("falls back to the unversioned handler when a version has none", async () => {
    let calls = 0;
    registerHandler("api.event", async () => {
      calls++;
    });
    expect(await routeEvent("api.event", {}, "v2")).toBe(true);
    expect(calls).toBe(1);
  });

  it("prefers a versioned handler when present", async () => {
    const order: string[] = [];
    registerHandler("api.event", async () => void order.push("base"));
    registerHandler("api.event", async () => void order.push("v2"), "v2");
    await routeEvent("api.event", {}, "v2");
    expect(order).toEqual(["v2"]);
  });

  it("hasHandler reflects registration", () => {
    expect(hasHandler("x.y")).toBe(false);
    registerHandler("x.y", async () => {});
    expect(hasHandler("x.y")).toBe(true);
  });
});
