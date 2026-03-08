export const config = { runtime: "edge" };

import { neon } from "@neondatabase/serverless";

const MAX_ENTRIES = 500;

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
  if (!databaseUrl) {
    return null;
  }
  return neon(databaseUrl);
}

async function ensureTable(sql: ReturnType<typeof neon>) {
  await sql`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      score INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
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
    return json({ error: "Leaderboard not configured" }, 503);
  }

  await ensureTable(sql);

  if (req.method === "POST") {
    let body: { name?: unknown; score?: unknown };
    try {
      body = await req.json() as { name?: unknown; score?: unknown };
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const { name, score } = body;

    if (
      typeof name !== "string" ||
      name.trim().length === 0 ||
      typeof score !== "number" ||
      score < 0 ||
      score > 100 ||
      !Number.isFinite(score)
    ) {
      return json({ error: "Invalid input" }, 400);
    }

    const sanitizedName = name.trim().slice(0, 30);
    const roundedScore = Math.round(score);

    await sql`INSERT INTO leaderboard (name, score) VALUES (${sanitizedName}, ${roundedScore})`;

    // Keep only top MAX_ENTRIES by score (remove lowest scores when over limit)
    await sql`
      DELETE FROM leaderboard
      WHERE id NOT IN (
        SELECT id FROM leaderboard
        ORDER BY score DESC, created_at ASC
        LIMIT ${MAX_ENTRIES}
      )
    `;

    return json({ success: true });
  }

  if (req.method === "GET") {
    const rows = await sql`
      SELECT name, score
      FROM leaderboard
      ORDER BY score DESC, created_at ASC
      LIMIT ${MAX_ENTRIES}
    `;

    const entries = rows.map((row) => ({ name: String(row.name), score: Number(row.score) }));
    return json(entries);
  }

  return json({ error: "Method not allowed" }, 405);
}
