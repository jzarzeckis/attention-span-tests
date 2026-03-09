export const config = { runtime: "edge" };

import { neon } from "@neondatabase/serverless";

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

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET" },
    });
  }

  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const sql = await getDb();
  if (!sql) {
    return json({ count: 0 });
  }

  // "Give ups" = visitors who started at least one test but did not finish the final test (gonogo).
  // This reuses the test_sessions table rather than maintaining a separate counter.
  const [startedRow, finishedRow] = await Promise.all([
    sql`SELECT COUNT(DISTINCT visitor_uuid) AS count FROM test_sessions`,
    sql`
      SELECT COUNT(DISTINCT visitor_uuid) AS count
      FROM test_sessions
      WHERE test_id = 'gonogo' AND finished_at IS NOT NULL AND skipped = FALSE
    `,
  ]).catch(() => [null, null]);

  if (!startedRow || !finishedRow) {
    return json({ count: 0 });
  }

  const started = Number(startedRow[0]?.count ?? 0);
  const finished = Number(finishedRow[0]?.count ?? 0);
  return json({ count: Math.max(0, started - finished) });
}
