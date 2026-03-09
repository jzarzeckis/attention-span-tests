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

const VALID_TEST_IDS = ["sart", "stroop", "pvt", "gonogo"] as const;
type TestId = (typeof VALID_TEST_IDS)[number];

async function ensureTables(sql: NeonQueryFunction<false, false>) {
  await sql`
    CREATE TABLE IF NOT EXISTS visitors (
      uuid TEXT PRIMARY KEY,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS test_sessions (
      id SERIAL PRIMARY KEY,
      visitor_uuid TEXT NOT NULL,
      test_id TEXT NOT NULL,
      started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      finished_at TIMESTAMP WITH TIME ZONE,
      results JSONB,
      skipped BOOLEAN NOT NULL DEFAULT FALSE
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS test_sessions_visitor_test
    ON test_sessions (visitor_uuid, test_id)
  `;
}

function isValidUUID(s: unknown): s is string {
  if (typeof s !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function isValidTestId(s: unknown): s is TestId {
  return VALID_TEST_IDS.includes(s as TestId);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const sql = await getDb();
  if (!sql) {
    return json({ success: true, configured: false });
  }

  await ensureTables(sql);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { action, visitorId, testId } = body;

  if (!isValidUUID(visitorId)) {
    return json({ error: "Invalid visitor_id" }, 400);
  }

  if (!isValidTestId(testId)) {
    return json({ error: "Invalid test_id" }, 400);
  }

  if (action === "start") {
    // Upsert visitor and create a new test session row (marking start)
    await sql`
      INSERT INTO visitors (uuid) VALUES (${visitorId})
      ON CONFLICT (uuid) DO NOTHING
    `;

    // Only insert if no unfinished session already exists for this test
    await sql`
      INSERT INTO test_sessions (visitor_uuid, test_id)
      SELECT ${visitorId}, ${testId}
      WHERE NOT EXISTS (
        SELECT 1 FROM test_sessions
        WHERE visitor_uuid = ${visitorId}
          AND test_id = ${testId}
          AND finished_at IS NULL
          AND skipped = FALSE
      )
    `;

    return json({ success: true });
  }

  if (action === "finish") {
    const { results, skipped } = body;
    const isSkipped = skipped === true;

    // Sanitise results — only store if it's a plain object
    const safeResults =
      results !== null &&
      typeof results === "object" &&
      !Array.isArray(results)
        ? results
        : null;

    // Update the most recent unfinished session for this visitor+test
    await sql`
      UPDATE test_sessions
      SET
        finished_at = NOW(),
        results = ${safeResults ? JSON.stringify(safeResults) : null},
        skipped = ${isSkipped}
      WHERE id = (
        SELECT id FROM test_sessions
        WHERE visitor_uuid = ${visitorId}
          AND test_id = ${testId}
          AND finished_at IS NULL
        ORDER BY started_at DESC
        LIMIT 1
      )
    `;

    return json({ success: true });
  }

  return json({ error: "Unknown action" }, 400);
}
