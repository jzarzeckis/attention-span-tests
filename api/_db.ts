import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Module-level singletons — survive across warm invocations within the same worker.
// Each Edge Function is bundled separately, so each worker has its own isolated state.

let _sql: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;
  if (!_sql) _sql = neon(databaseUrl);
  return _sql;
}

// ── Visitor / survey / test-session tables ────────────────────────────────────

let tablesInitialized = false;

export async function ensureTables(sql: NeonQueryFunction<false, false>): Promise<void> {
  if (tablesInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS visitors (
      uuid TEXT PRIMARY KEY,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE visitors ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE
  `;
  // Backfill started_at for visitors who completed all 4 tests but predate
  // the started_at column. Only backfill those who reached the final results
  // (finished every test without skipping). Use yesterday morning as a
  // conservative placeholder so they appear in the funnel.
  await sql`
    UPDATE visitors
    SET started_at = (CURRENT_DATE - INTERVAL '1 day') + TIME '08:00:00'
    WHERE started_at IS NULL
      AND EXISTS (
        SELECT 1 FROM test_sessions WHERE visitor_uuid = visitors.uuid
          AND test_id = 'sart' AND finished_at IS NOT NULL AND skipped = FALSE
      )
      AND EXISTS (
        SELECT 1 FROM test_sessions WHERE visitor_uuid = visitors.uuid
          AND test_id = 'stroop' AND finished_at IS NOT NULL AND skipped = FALSE
      )
      AND EXISTS (
        SELECT 1 FROM test_sessions WHERE visitor_uuid = visitors.uuid
          AND test_id = 'pvt' AND finished_at IS NOT NULL AND skipped = FALSE
      )
      AND EXISTS (
        SELECT 1 FROM test_sessions WHERE visitor_uuid = visitors.uuid
          AND test_id = 'gonogo' AND finished_at IS NOT NULL AND skipped = FALSE
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
  tablesInitialized = true;
}

// ── Leaderboard table ─────────────────────────────────────────────────────────

let leaderboardInitialized = false;

export async function ensureLeaderboardTable(sql: NeonQueryFunction<false, false>): Promise<void> {
  if (leaderboardInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      score INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS visitor_uuid TEXT
  `;
  // Partial unique index so each visitor can only have one leaderboard entry.
  // NULL values are excluded so anonymous submissions (no cookie) are still allowed.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_visitor_uuid_unique
    ON leaderboard (visitor_uuid)
    WHERE visitor_uuid IS NOT NULL
  `;
  leaderboardInitialized = true;
}
