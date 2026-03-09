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

  // "Give ups" = all visitors who did not finish all tests (gonogo).
  // Uses the visitors table as the base so that people who visit but never start a test are counted too.
  const [startedRow, finishedRow] = await Promise.all([
    sql`SELECT COUNT(*) AS count FROM visitors`,
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
