import { getFluidSession } from "@/lib/fluid-session";

export default async function Home() {
  const session = await getFluidSession();

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 720 }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Hello from your Mist-hosted droplet 🌫️</h1>

      {session ? (
        <p>
          Signed in as <strong>{session.user_name}</strong> at{" "}
          <strong>{session.company_name}</strong>.
        </p>
      ) : (
        <p>
          Running in <code>MIST_DEV</code> mode — auth is bypassed locally. In production
          this page renders the visitor&apos;s Fluid identity.
        </p>
      )}

      <h2>What you have</h2>
      <ul>
        <li>
          <code>lib/db.ts</code> — environment-aware Postgres client (PGlite locally,
          Neon in production).
        </li>
        <li>
          <code>app/api/auth/[...fluid]/route.ts</code> — Fluid droplet auth handshake.
        </li>
        <li>
          <code>app/api/health/route.ts</code> — try{" "}
          <a href="/api/health">/api/health</a> right now.
        </li>
        <li>
          <code>middleware.ts</code> — gates pages on a session in production.
        </li>
      </ul>

      <h2>Next steps</h2>
      <ol>
        <li>Edit <code>app/page.tsx</code>.</li>
        <li><code>fluid droplet mist push</code> when you&apos;re happy.</li>
      </ol>
    </main>
  );
}
