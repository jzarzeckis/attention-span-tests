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

async function ensureTables(sql: NeonQueryFunction<false, false>) {
  await sql`
    CREATE TABLE IF NOT EXISTS visitors (
      uuid TEXT PRIMARY KEY,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS visitor_surveys (
      id SERIAL PRIMARY KEY,
      visitor_uuid TEXT NOT NULL REFERENCES visitors(uuid) ON DELETE CASCADE,
      age TEXT NOT NULL,
      short_form_usage TEXT NOT NULL,
      restlessness TEXT NOT NULL,
      self_rated_attention INTEGER NOT NULL,
      screen_time TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
}

function isValidUUID(s: unknown): s is string {
  if (typeof s !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const sql = await getDb();
  if (!sql) {
    // Gracefully degrade if DB not configured
    return json({ hasSurvey: false, configured: false });
  }

  await ensureTables(sql);

  // GET /api/session?visitor_id=<uuid> — check if visitor has survey data
  if (req.method === "GET") {
    const url = new URL(req.url);
    const visitorId = url.searchParams.get("visitor_id");

    if (!isValidUUID(visitorId)) {
      return json({ hasSurvey: false });
    }

    const rows = await sql`
      SELECT age, short_form_usage, restlessness, self_rated_attention, screen_time
      FROM visitor_surveys
      WHERE visitor_uuid = ${visitorId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      return json({ hasSurvey: false });
    }

    const row = rows[0]!;
    return json({
      hasSurvey: true,
      surveyData: {
        age: String(row.age),
        shortFormUsage: String(row.short_form_usage),
        restlessness: String(row.restlessness),
        selfRatedAttention: Number(row.self_rated_attention),
        screenTime: String(row.screen_time),
      },
    });
  }

  // POST /api/session — register visitor or save survey
  if (req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const { action, visitorId } = body;

    if (!isValidUUID(visitorId)) {
      return json({ error: "Invalid visitor_id" }, 400);
    }

    if (action === "register") {
      // Upsert visitor record
      await sql`
        INSERT INTO visitors (uuid) VALUES (${visitorId})
        ON CONFLICT (uuid) DO NOTHING
      `;
      return json({ success: true });
    }

    if (action === "survey") {
      const { surveyData } = body as { surveyData?: Record<string, unknown> };
      if (!surveyData) return json({ error: "Missing surveyData" }, 400);

      const { age, shortFormUsage, restlessness, selfRatedAttention, screenTime } = surveyData;

      if (
        typeof age !== "string" ||
        typeof shortFormUsage !== "string" ||
        typeof restlessness !== "string" ||
        typeof selfRatedAttention !== "number" ||
        typeof screenTime !== "string"
      ) {
        return json({ error: "Invalid survey data" }, 400);
      }

      // Ensure visitor exists first
      await sql`
        INSERT INTO visitors (uuid) VALUES (${visitorId})
        ON CONFLICT (uuid) DO NOTHING
      `;

      // Upsert survey: replace previous survey for this visitor
      await sql`
        DELETE FROM visitor_surveys WHERE visitor_uuid = ${visitorId}
      `;
      await sql`
        INSERT INTO visitor_surveys (visitor_uuid, age, short_form_usage, restlessness, self_rated_attention, screen_time)
        VALUES (${visitorId}, ${age}, ${shortFormUsage}, ${restlessness}, ${Math.round(selfRatedAttention)}, ${screenTime})
      `;

      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  }

  return json({ error: "Method not allowed" }, 405);
}
