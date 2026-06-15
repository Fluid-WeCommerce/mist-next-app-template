import { getFluidSession } from "@/lib/fluid-session";
import LaunchScene from "./launch-scene";

export default async function Home() {
  const session = await getFluidSession();

  return (
    <>
      <LaunchScene />
      <main
        style={{
          padding:         "2.5rem",
          fontFamily:      "system-ui, sans-serif",
          maxWidth:        720,
          margin:          "4rem auto",
          color:           "#f5f7fb",
          background:      "rgba(10, 22, 51, 0.55)",
          backdropFilter:  "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderRadius:    16,
          border:          "1px solid rgba(255,255,255,0.12)",
          boxShadow:       "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        <h1 style={{ marginBottom: "0.5rem", fontSize: "2rem" }}>
          Hello from your Mist-hosted droplet 🌫️
        </h1>

        {session ? (
          <p>
            Signed in as <strong>{session.user_name}</strong> at{" "}
            <strong>{session.company_name}</strong>.{" "}
            <a href="/droplet/connect" style={{ color: "#ffd6a8" }}>Reconnect</a>
          </p>
        ) : (
          <p>
            <a href="/droplet/connect" style={{ color: "#ffd6a8" }}>Connect your Fluid account</a>{" "}
            to identify the visitor. The home page is public — only the routes you choose
            to gate require a session.
          </p>
        )}

        <h2 style={{ marginTop: "1.75rem" }}>What you have</h2>
        <ul>
          <li>
            <code>lib/db.ts</code> — environment-aware Postgres client (PGlite locally,
            Postgres in production).
          </li>
          <li>
            <code>app/droplet/connect/route.ts</code> — starts the Fluid auth handshake.
          </li>
          <li>
            <code>app/api/auth/[...fluid]/route.ts</code> — Fluid auth callback that sets
            the session cookie.
          </li>
          <li>
            <code>app/api/health/route.ts</code> — try{" "}
            <a href="/api/health" style={{ color: "#ffd6a8" }}>/api/health</a> right now.
          </li>
        </ul>

        <h2 style={{ marginTop: "1.75rem" }}>Next steps</h2>
        <ol>
          <li>Edit <code>app/page.tsx</code>.</li>
          <li>Call <code>getFluidSession()</code> from any route or page that needs the visitor&apos;s identity.</li>
          <li><code>fluid mist push</code> when you&apos;re happy.</li>
        </ol>
      </main>
    </>
  );
}
