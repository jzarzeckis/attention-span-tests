export const config = { runtime: "edge" };

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;
  return neon(databaseUrl);
}

async function ensureTable(sql: NeonQueryFunction<false, false>) {
  await sql`
    CREATE TABLE IF NOT EXISTS give_ups (
      id INTEGER PRIMARY KEY DEFAULT 1,
      count INTEGER NOT NULL DEFAULT 0
    )
  `;
  await sql`
    INSERT INTO give_ups (id, count) VALUES (1, 0)
    ON CONFLICT (id) DO NOTHING
  `;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST" },
    });
  }

  const sql = await getDb();
  if (!sql) {
    return json({ error: "Database not configured" }, 503);
  }

  await ensureTable(sql);

  if (req.method === "GET") {
    const rows = await sql`SELECT count FROM give_ups WHERE id = 1`;
    const count = rows[0] ? Number(rows[0].count) : 0;
    return json({ count });
  }

  if (req.method === "POST") {
    await sql`UPDATE give_ups SET count = count + 1 WHERE id = 1`;
    return json({ success: true });
  }

  return json({ error: "Method not allowed" }, 405);
}
