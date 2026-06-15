import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const conn = await db();
    await conn.execute(sql`SELECT 1`);
    return Response.json({ db: "ok" });
  } catch (err: unknown) {
    return Response.json(
      { db: "error", message: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
