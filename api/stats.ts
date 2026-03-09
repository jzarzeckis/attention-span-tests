export const config = { runtime: "edge" };

import { getDb, ensureTables } from "./_db";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// Simplified scoring used server-side for composite score distribution
function scoreLinear(value: number, goodThreshold: number, badThreshold: number): number {
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  if (goodThreshold < badThreshold) {
    if (value <= goodThreshold) return 100;
    if (value >= badThreshold) return 0;
    return clamp(100 * (1 - (value - goodThreshold) / (badThreshold - goodThreshold)));
  } else {
    if (value >= goodThreshold) return 100;
    if (value <= badThreshold) return 0;
    return clamp(100 * (value - badThreshold) / (goodThreshold - badThreshold));
  }
}

function computeCompositeFromResults(results: Record<string, unknown>): number | null {
  const scores: number[] = [];

  const sart = results.sart as { commissionRate?: number; omissionRate?: number } | undefined;
  if (sart && typeof sart.commissionRate === "number" && typeof sart.omissionRate === "number") {
    const c = scoreLinear(sart.commissionRate * 100, 11, 30);
    const o = scoreLinear(sart.omissionRate * 100, 5, 30);
    const denom = c + o;
    scores.push(denom > 0 ? Math.round(2 * c * o / denom) : 0);
  }

  const stroop = results.stroop as { interferenceScore?: number; condition3?: { accuracy?: number } } | undefined;
  if (stroop && typeof stroop.interferenceScore === "number" && stroop.condition3?.accuracy !== undefined) {
    const c3AccScore = scoreLinear(stroop.condition3.accuracy, 85, 45);
    const interfScore = scoreLinear(stroop.interferenceScore, 100, 400);
    const denom = c3AccScore + interfScore;
    scores.push(denom > 0 ? Math.round(2 * c3AccScore * interfScore / denom) : 0);
  }

  const pvt = results.pvt as { medianRT?: number; lapseRate?: number } | undefined;
  if (pvt && typeof pvt.medianRT === "number" && typeof pvt.lapseRate === "number") {
    const rtScore = scoreLinear(pvt.medianRT, 300, 500);
    const lapseScore = scoreLinear(pvt.lapseRate * 100, 5, 25);
    scores.push((rtScore + lapseScore) / 2);
  }

  const gonogo = results.gonogo as { commissionErrorRate?: number } | undefined;
  if (gonogo && typeof gonogo.commissionErrorRate === "number") {
    scores.push(scoreLinear(gonogo.commissionErrorRate * 100, 15, 40));
  }

  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function bucketScore(score: number): string {
  const low = Math.floor(score / 10) * 10;
  const high = low + 9;
  return `${low}–${high}`;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
      },
    });
  }

  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const sql = await getDb();
  if (!sql) {
    return json({
      configured: false,
      funnel: [],
      scoreDistribution: [],
      byAge: [],
      byScreenTime: [],
      byShortFormUsage: [],
      byRestlessness: [],
      bySelfRatedAttention: [],
      pvtMedianRTs: [],
      sartCommissionRates: [],
      stroopInterference: [],
      gonogoCommissionRates: [],
      scatterAgeVsScore: [],
      scatterSelfVsScore: [],
      totalVisitors: 0,
      totalSurveys: 0,
    });
  }

  await ensureTables(sql);

  // ── Funnel data ────────────────────────────────────────────────────────────
  const [
    visitorsResult,
    surveysResult,
    sartStarted,
    sartFinished,
    stroopStarted,
    stroopFinished,
    pvtStarted,
    pvtFinished,
    gonogoStarted,
    gonogoFinished,
  ] = await Promise.all([
    sql`SELECT COUNT(*) AS count FROM visitors`,
    sql`SELECT COUNT(DISTINCT visitor_uuid) AS count FROM visitor_surveys`,
    sql`SELECT COUNT(DISTINCT visitor_uuid) AS count FROM test_sessions WHERE test_id = 'sart'`,
    sql`SELECT COUNT(DISTINCT visitor_uuid) AS count FROM test_sessions WHERE test_id = 'sart' AND finished_at IS NOT NULL AND skipped = FALSE`,
    sql`SELECT COUNT(DISTINCT visitor_uuid) AS count FROM test_sessions WHERE test_id = 'stroop'`,
    sql`SELECT COUNT(DISTINCT visitor_uuid) AS count FROM test_sessions WHERE test_id = 'stroop' AND finished_at IS NOT NULL AND skipped = FALSE`,
    sql`SELECT COUNT(DISTINCT visitor_uuid) AS count FROM test_sessions WHERE test_id = 'pvt'`,
    sql`SELECT COUNT(DISTINCT visitor_uuid) AS count FROM test_sessions WHERE test_id = 'pvt' AND finished_at IS NOT NULL AND skipped = FALSE`,
    sql`SELECT COUNT(DISTINCT visitor_uuid) AS count FROM test_sessions WHERE test_id = 'gonogo'`,
    sql`SELECT COUNT(DISTINCT visitor_uuid) AS count FROM test_sessions WHERE test_id = 'gonogo' AND finished_at IS NOT NULL AND skipped = FALSE`,
  ]);

  const totalVisitors = Number(visitorsResult[0]?.count ?? 0);
  const totalSurveys = Number(surveysResult[0]?.count ?? 0);

  const funnel = [
    { label: "Visited", count: totalVisitors },
    { label: "Survey done", count: Number(surveysResult[0]?.count ?? 0) },
    { label: "Stroop started", count: Number(stroopStarted[0]?.count ?? 0) },
    { label: "Stroop done", count: Number(stroopFinished[0]?.count ?? 0) },
    { label: "GoNoGo started", count: Number(gonogoStarted[0]?.count ?? 0) },
    { label: "GoNoGo done", count: Number(gonogoFinished[0]?.count ?? 0) },
    { label: "PVT started", count: Number(pvtStarted[0]?.count ?? 0) },
    { label: "PVT done", count: Number(pvtFinished[0]?.count ?? 0) },
    { label: "SART started", count: Number(sartStarted[0]?.count ?? 0) },
    { label: "SART done", count: Number(sartFinished[0]?.count ?? 0) },
  ];

  // ── Composite score distribution ─────────────────────────────────────────
  // For visitors who completed all 4 tests, compute composite score
  const completedAllRows = await sql`
    SELECT
      ts_sart.results AS sart_results,
      ts_stroop.results AS stroop_results,
      ts_pvt.results AS pvt_results,
      ts_gonogo.results AS gonogo_results
    FROM visitors v
    INNER JOIN test_sessions ts_sart
      ON ts_sart.visitor_uuid = v.uuid AND ts_sart.test_id = 'sart'
      AND ts_sart.finished_at IS NOT NULL AND ts_sart.skipped = FALSE
    INNER JOIN test_sessions ts_stroop
      ON ts_stroop.visitor_uuid = v.uuid AND ts_stroop.test_id = 'stroop'
      AND ts_stroop.finished_at IS NOT NULL AND ts_stroop.skipped = FALSE
    INNER JOIN test_sessions ts_pvt
      ON ts_pvt.visitor_uuid = v.uuid AND ts_pvt.test_id = 'pvt'
      AND ts_pvt.finished_at IS NOT NULL AND ts_pvt.skipped = FALSE
    INNER JOIN test_sessions ts_gonogo
      ON ts_gonogo.visitor_uuid = v.uuid AND ts_gonogo.test_id = 'gonogo'
      AND ts_gonogo.finished_at IS NOT NULL AND ts_gonogo.skipped = FALSE
    LIMIT 2000
  `;

  const scoreBucketMap = new Map<string, number>();
  for (const row of completedAllRows) {
    const composite = computeCompositeFromResults({
      sart: row.sart_results,
      stroop: row.stroop_results,
      pvt: row.pvt_results,
      gonogo: row.gonogo_results,
    });
    if (composite !== null) {
      const bucket = bucketScore(composite);
      scoreBucketMap.set(bucket, (scoreBucketMap.get(bucket) ?? 0) + 1);
    }
  }

  const SCORE_BUCKETS = ["0–9", "10–19", "20–29", "30–39", "40–49", "50–59", "60–69", "70–79", "80–89", "90–99"];
  const scoreDistribution = SCORE_BUCKETS.map((b) => ({ bucket: b, count: scoreBucketMap.get(b) ?? 0 }));

  // ── Demographics breakdowns ────────────────────────────────────────────────
  const [ageRows, screenTimeRows, shortFormRows, restlessnessRows, selfRatedRows] = await Promise.all([
    sql`
      SELECT
        vs.age,
        COUNT(DISTINCT vs.visitor_uuid) AS participant_count,
        AVG(CASE WHEN ts.finished_at IS NOT NULL AND ts.skipped = FALSE THEN (ts.results->>'commissionRate')::float * 100 END) AS avg_sart_commission
      FROM visitor_surveys vs
      LEFT JOIN test_sessions ts ON ts.visitor_uuid = vs.visitor_uuid AND ts.test_id = 'sart'
      GROUP BY vs.age
      ORDER BY vs.age
    `,
    sql`
      SELECT
        vs.screen_time,
        COUNT(DISTINCT vs.visitor_uuid) AS participant_count,
        AVG(CASE WHEN ts_pvt.finished_at IS NOT NULL AND ts_pvt.skipped = FALSE THEN (ts_pvt.results->>'medianRT')::float END) AS avg_pvt_rt
      FROM visitor_surveys vs
      LEFT JOIN test_sessions ts_pvt ON ts_pvt.visitor_uuid = vs.visitor_uuid AND ts_pvt.test_id = 'pvt'
      GROUP BY vs.screen_time
      ORDER BY vs.screen_time
    `,
    sql`
      SELECT
        vs.short_form_usage,
        COUNT(DISTINCT vs.visitor_uuid) AS participant_count,
        AVG(CASE WHEN ts.finished_at IS NOT NULL AND ts.skipped = FALSE THEN (ts.results->>'commissionRate')::float * 100 END) AS avg_sart_commission,
        AVG(CASE WHEN ts_pvt.finished_at IS NOT NULL AND ts_pvt.skipped = FALSE THEN (ts_pvt.results->>'lapseRate')::float * 100 END) AS avg_pvt_lapse
      FROM visitor_surveys vs
      LEFT JOIN test_sessions ts ON ts.visitor_uuid = vs.visitor_uuid AND ts.test_id = 'sart'
      LEFT JOIN test_sessions ts_pvt ON ts_pvt.visitor_uuid = vs.visitor_uuid AND ts_pvt.test_id = 'pvt'
      GROUP BY vs.short_form_usage
      ORDER BY vs.short_form_usage
    `,
    sql`
      SELECT
        vs.restlessness,
        COUNT(DISTINCT vs.visitor_uuid) AS participant_count,
        AVG(CASE WHEN ts.finished_at IS NOT NULL AND ts.skipped = FALSE THEN (ts.results->>'interferenceScore')::float END) AS avg_stroop_interference
      FROM visitor_surveys vs
      LEFT JOIN test_sessions ts ON ts.visitor_uuid = vs.visitor_uuid AND ts.test_id = 'stroop'
      GROUP BY vs.restlessness
      ORDER BY vs.restlessness
    `,
    sql`
      SELECT
        vs.self_rated_attention,
        COUNT(DISTINCT vs.visitor_uuid) AS participant_count,
        AVG(CASE WHEN ts.finished_at IS NOT NULL AND ts.skipped = FALSE THEN (ts.results->>'commissionRate')::float * 100 END) AS avg_sart_commission,
        AVG(CASE WHEN ts_pvt.finished_at IS NOT NULL AND ts_pvt.skipped = FALSE THEN (ts_pvt.results->>'medianRT')::float END) AS avg_pvt_rt
      FROM visitor_surveys vs
      LEFT JOIN test_sessions ts ON ts.visitor_uuid = vs.visitor_uuid AND ts.test_id = 'sart'
      LEFT JOIN test_sessions ts_pvt ON ts_pvt.visitor_uuid = vs.visitor_uuid AND ts_pvt.test_id = 'pvt'
      GROUP BY vs.self_rated_attention
      ORDER BY vs.self_rated_attention
    `,
  ]);

  // ── Per-visitor scatter data (age + self_rated vs composite score) ────────
  const scatterRows = await sql`
    SELECT
      vs.age,
      vs.self_rated_attention,
      ts_sart.results AS sart_results,
      ts_stroop.results AS stroop_results,
      ts_pvt.results AS pvt_results,
      ts_gonogo.results AS gonogo_results
    FROM visitor_surveys vs
    INNER JOIN test_sessions ts_sart
      ON ts_sart.visitor_uuid = vs.visitor_uuid AND ts_sart.test_id = 'sart'
      AND ts_sart.finished_at IS NOT NULL AND ts_sart.skipped = FALSE
    INNER JOIN test_sessions ts_stroop
      ON ts_stroop.visitor_uuid = vs.visitor_uuid AND ts_stroop.test_id = 'stroop'
      AND ts_stroop.finished_at IS NOT NULL AND ts_stroop.skipped = FALSE
    INNER JOIN test_sessions ts_pvt
      ON ts_pvt.visitor_uuid = vs.visitor_uuid AND ts_pvt.test_id = 'pvt'
      AND ts_pvt.finished_at IS NOT NULL AND ts_pvt.skipped = FALSE
    INNER JOIN test_sessions ts_gonogo
      ON ts_gonogo.visitor_uuid = vs.visitor_uuid AND ts_gonogo.test_id = 'gonogo'
      AND ts_gonogo.finished_at IS NOT NULL AND ts_gonogo.skipped = FALSE
    LIMIT 2000
  `;

  const scatterAgeVsScore: Array<{ age: string; score: number }> = [];
  const scatterSelfVsScore: Array<{ selfRated: number; score: number }> = [];

  for (const row of scatterRows) {
    const composite = computeCompositeFromResults({
      sart: row.sart_results,
      stroop: row.stroop_results,
      pvt: row.pvt_results,
      gonogo: row.gonogo_results,
    });
    if (composite !== null) {
      scatterAgeVsScore.push({ age: String(row.age), score: composite });
      scatterSelfVsScore.push({ selfRated: Number(row.self_rated_attention), score: composite });
    }
  }

  // ── Per-test metric distributions ─────────────────────────────────────────
  const [pvtRows, sartRows, stroopRows, gonogoRows] = await Promise.all([
    sql`
      SELECT (results->>'medianRT')::float AS median_rt
      FROM test_sessions
      WHERE test_id = 'pvt' AND finished_at IS NOT NULL AND skipped = FALSE
        AND results->>'medianRT' IS NOT NULL
      LIMIT 2000
    `,
    sql`
      SELECT (results->>'commissionRate')::float * 100 AS commission_rate
      FROM test_sessions
      WHERE test_id = 'sart' AND finished_at IS NOT NULL AND skipped = FALSE
        AND results->>'commissionRate' IS NOT NULL
      LIMIT 2000
    `,
    sql`
      SELECT (results->>'interferenceScore')::float AS interference
      FROM test_sessions
      WHERE test_id = 'stroop' AND finished_at IS NOT NULL AND skipped = FALSE
        AND results->>'interferenceScore' IS NOT NULL
      LIMIT 2000
    `,
    sql`
      SELECT (results->>'commissionErrorRate')::float * 100 AS commission_rate
      FROM test_sessions
      WHERE test_id = 'gonogo' AND finished_at IS NOT NULL AND skipped = FALSE
        AND results->>'commissionErrorRate' IS NOT NULL
      LIMIT 2000
    `,
  ]);

  function buildHistogram(values: number[], buckets: Array<{ label: string; min: number; max: number }>) {
    const counts = buckets.map((b) => ({ bucket: b.label, count: 0 }));
    for (const v of values) {
      for (let i = 0; i < buckets.length; i++) {
        const b = buckets[i]!;
        if (v >= b.min && (i === buckets.length - 1 || v < buckets[i + 1]!.min)) {
          counts[i]!.count++;
          break;
        }
      }
    }
    return counts;
  }

  const pvtMedianRTs = buildHistogram(
    pvtRows.map((r) => Number(r.median_rt)),
    [
      { label: "<200ms", min: 0, max: 200 },
      { label: "200–249", min: 200, max: 250 },
      { label: "250–299", min: 250, max: 300 },
      { label: "300–349", min: 300, max: 350 },
      { label: "350–399", min: 350, max: 400 },
      { label: "400–499", min: 400, max: 500 },
      { label: "≥500ms", min: 500, max: Infinity },
    ]
  );

  const sartCommissionRates = buildHistogram(
    sartRows.map((r) => Number(r.commission_rate)),
    [
      { label: "0–5%", min: 0, max: 5 },
      { label: "5–10%", min: 5, max: 10 },
      { label: "10–15%", min: 10, max: 15 },
      { label: "15–20%", min: 15, max: 20 },
      { label: "20–30%", min: 20, max: 30 },
      { label: "30–50%", min: 30, max: 50 },
      { label: ">50%", min: 50, max: Infinity },
    ]
  );

  const stroopInterference = buildHistogram(
    stroopRows.map((r) => Number(r.interference)),
    [
      { label: "<50ms", min: 0, max: 50 },
      { label: "50–100ms", min: 50, max: 100 },
      { label: "100–150ms", min: 100, max: 150 },
      { label: "150–200ms", min: 150, max: 200 },
      { label: "200–300ms", min: 200, max: 300 },
      { label: "300–500ms", min: 300, max: 500 },
      { label: ">500ms", min: 500, max: Infinity },
    ]
  );

  const gonogoCommissionRates = buildHistogram(
    gonogoRows.map((r) => Number(r.commission_rate)),
    [
      { label: "0–10%", min: 0, max: 10 },
      { label: "10–20%", min: 10, max: 20 },
      { label: "20–30%", min: 20, max: 30 },
      { label: "30–40%", min: 30, max: 40 },
      { label: "40–60%", min: 40, max: 60 },
      { label: ">60%", min: 60, max: Infinity },
    ]
  );

  return json({
    configured: true,
    funnel,
    scoreDistribution,
    byAge: ageRows.map((r) => ({
      label: String(r.age),
      count: Number(r.participant_count),
      avgSartCommission: r.avg_sart_commission !== null ? Math.round(Number(r.avg_sart_commission) * 10) / 10 : null,
    })),
    byScreenTime: screenTimeRows.map((r) => ({
      label: String(r.screen_time),
      count: Number(r.participant_count),
      avgPvtRT: r.avg_pvt_rt !== null ? Math.round(Number(r.avg_pvt_rt)) : null,
    })),
    byShortFormUsage: shortFormRows.map((r) => ({
      label: String(r.short_form_usage),
      count: Number(r.participant_count),
      avgSartCommission: r.avg_sart_commission !== null ? Math.round(Number(r.avg_sart_commission) * 10) / 10 : null,
      avgPvtLapse: r.avg_pvt_lapse !== null ? Math.round(Number(r.avg_pvt_lapse) * 10) / 10 : null,
    })),
    byRestlessness: restlessnessRows.map((r) => ({
      label: String(r.restlessness),
      count: Number(r.participant_count),
      avgStroopInterference: r.avg_stroop_interference !== null ? Math.round(Number(r.avg_stroop_interference)) : null,
    })),
    bySelfRatedAttention: selfRatedRows.map((r) => ({
      label: String(r.self_rated_attention),
      count: Number(r.participant_count),
      avgSartCommission: r.avg_sart_commission !== null ? Math.round(Number(r.avg_sart_commission) * 10) / 10 : null,
      avgPvtRT: r.avg_pvt_rt !== null ? Math.round(Number(r.avg_pvt_rt)) : null,
    })),
    pvtMedianRTs,
    sartCommissionRates,
    stroopInterference,
    gonogoCommissionRates,
    scatterAgeVsScore,
    scatterSelfVsScore,
    totalVisitors,
    totalSurveys,
  });
}
