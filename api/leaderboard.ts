export const config = { runtime: "edge" };

const KEY = "leaderboard";
const MAX_ENTRIES = 500;

async function kvCommand(url: string, token: string, command: (string | number)[]): Promise<{ result: unknown; error?: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  return res.json() as Promise<{ result: unknown; error?: string }>;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    return json({ error: "Leaderboard not configured" }, 503);
  }

  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST" },
    });
  }

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

    const sanitizedName = name.trim().replace(/[|]/g, "").slice(0, 30);
    const member = `${sanitizedName}|${Date.now()}`;

    // Add to sorted set
    await kvCommand(kvUrl, kvToken, ["ZADD", KEY, Math.round(score), member]);

    // Keep only top MAX_ENTRIES by removing lowest scores
    const totalRes = await kvCommand(kvUrl, kvToken, ["ZCARD", KEY]);
    const total = (totalRes.result as number) ?? 0;
    if (total > MAX_ENTRIES) {
      await kvCommand(kvUrl, kvToken, ["ZREMRANGEBYRANK", KEY, 0, total - MAX_ENTRIES - 1]);
    }

    return json({ success: true });
  }

  if (req.method === "GET") {
    // Get top 500 entries, highest score first, with scores
    const rangeRes = await kvCommand(kvUrl, kvToken, [
      "ZRANGE", KEY, "+inf", "-inf", "BYSCORE", "REV", "WITHSCORES", "LIMIT", "0", String(MAX_ENTRIES),
    ]);

    const raw = rangeRes.result as (string | number)[] | null;
    if (!raw || raw.length === 0) {
      return json([]);
    }

    // raw alternates: [member, score, member, score, ...]
    const entries: { name: string; score: number }[] = [];
    for (let i = 0; i < raw.length - 1; i += 2) {
      const member = String(raw[i]);
      const score = Number(raw[i + 1]);
      const pipeIdx = member.lastIndexOf("|");
      const name = pipeIdx >= 0 ? member.slice(0, pipeIdx) : member;
      entries.push({ name, score });
    }

    return json(entries);
  }

  return json({ error: "Method not allowed" }, 405);
}
