export const config = { runtime: "edge" };

import { getDb, ensureLeaderboardTable } from "./_db";

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

function isValidUUID(s: unknown): s is string {
  if (typeof s !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
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

  await ensureLeaderboardTable(sql);

  if (req.method === "POST") {
    let body: { name?: unknown; score?: unknown; visitorId?: unknown };
    try {
      body = await req.json() as { name?: unknown; score?: unknown; visitorId?: unknown };
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const { name, score, visitorId } = body;

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
    const safeVisitorId = isValidUUID(visitorId) ? visitorId : null;

    await sql`
      INSERT INTO leaderboard (name, score, visitor_uuid)
      VALUES (${sanitizedName}, ${roundedScore}, ${safeVisitorId})
      ON CONFLICT (visitor_uuid) WHERE visitor_uuid IS NOT NULL
      DO UPDATE SET name = EXCLUDED.name, score = EXCLUDED.score, created_at = NOW()
    `;

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
    const url = new URL(req.url);
    const visitorId = url.searchParams.get("visitor_id");
    const safeVisitorId = isValidUUID(visitorId) ? visitorId : null;

    const rows = await sql`
      SELECT name, score, visitor_uuid
      FROM leaderboard
      ORDER BY score DESC, created_at ASC
      LIMIT ${MAX_ENTRIES}
    `;

    const entries = rows.map((row) => ({
      name: String(row.name),
      score: Number(row.score),
      isMine: safeVisitorId !== null && row.visitor_uuid === safeVisitorId,
    }));
    return json(entries);
  }

  return json({ error: "Method not allowed" }, 405);
}
