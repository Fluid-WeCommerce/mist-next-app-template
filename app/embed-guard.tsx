"use client";

// Client-side embed guard.
//
// Optional companion to proxy.ts. Wrap a page's contents in <EmbedGuard>
// to show a friendly "open this in Fluid" message when the droplet is loaded
// directly (not inside a Fluid iframe). The home page stays public by default —
// only wrap the routes you want to require embedding.

import { useEffect, useState } from "react";

export function EmbedGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checking" | "embedded" | "standalone">("checking");

  useEffect(() => {
    const inIframe = window.self !== window.top;
    if (!inIframe) {
      setStatus("standalone");
      return;
    }

    // Cross-origin access to the parent throws — which is exactly what we
    // expect when correctly embedded in Fluid. Treat a same-origin parent that
    // isn't fluid.app as standalone.
    try {
      const host = window.top?.location.hostname ?? "";
      setStatus(host.includes("fluid.app") ? "embedded" : "standalone");
    } catch {
      setStatus("embedded");
    }
  }, []);

  if (status === "checking") {
    return (
      <main style={centered}>
        <p>Loading…</p>
      </main>
    );
  }

  if (status === "standalone") {
    return (
      <main style={centered}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>
            Open this in Fluid
          </h1>
          <p style={{ color: "#64748b" }}>
            This droplet runs inside the Fluid platform. Install it from the
            Droplet Marketplace and open it from your Fluid account.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}

const centered: React.CSSProperties = {
  display: "flex",
  minHeight: "100vh",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem",
  fontFamily: "system-ui, sans-serif",
};
