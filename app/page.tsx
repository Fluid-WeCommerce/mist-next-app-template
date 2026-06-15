import { getFluidSession } from "@/lib/fluid-session";

export default async function Home() {
  const session = await getFluidSession();

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 720 }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Hello from your Mist-hosted droplet 🌫️</h1>

      {session ? (
        <p>
          Signed in as <strong>{session.user_name}</strong> at{" "}
          <strong>{session.company_name}</strong>.{" "}
          <a href="/droplet/connect">Reconnect</a>
        </p>
      ) : (
        <p>
          <a href="/droplet/connect">Connect your Fluid account</a> to identify the visitor.
          The home page is public — only the routes you choose to gate require a session.
        </p>
      )}

      <h2>What you have</h2>
      <ul>
        <li>
          <code>lib/db.ts</code> — environment-aware Postgres client (PGlite locally,
          Neon in production).
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
          <a href="/api/health">/api/health</a> right now.
        </li>
      </ul>

      <h2>Next steps</h2>
      <ol>
        <li>Edit <code>app/page.tsx</code>.</li>
        <li>Call <code>getFluidSession()</code> from any route or page that needs the visitor&apos;s identity.</li>
        <li><code>fluid droplet mist push</code> when you&apos;re happy.</li>
      </ol>
    </main>
  );
}
