"use client";

import { createElement, useEffect, useState } from "react";

/**
 * The animated Mist mark — a pixel-grid M that continuously sheds mist,
 * stirs under the cursor, and regrows. Renders the framework-free
 * <mist-logo> web component (./mist-logo.js).
 *
 * The element registers itself with customElements and draws to a
 * canvas, so it can only load in the browser — the dynamic import in
 * the effect keeps it out of server rendering entirely. The canvas is
 * 16:9 and fills this wrapper's width; the mark sits left of center by
 * design (the empty right side is where the mist drifts), so the whole
 * canvas reads as balanced.
 */
export default function MistMark({ width = 320 }: { width?: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void import("./mist-logo.js").then(() => setReady(true));
  }, []);

  return (
    <div style={{ width, aspectRatio: "16 / 9" }}>
      {ready
        ? // createElement with a string tag keeps TypeScript happy about
          // a custom element React has no intrinsic type for.
          createElement("mist-logo", {
            mode: "loop",
            variant: "mark",
            color: "#fff",
            sound: "off",
          })
        : null}
    </div>
  );
}
