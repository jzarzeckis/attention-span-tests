export const config = { runtime: "edge" };

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function scoreLinear(
  value: number,
  goodThreshold: number,
  badThreshold: number
): number {
  if (goodThreshold < badThreshold) {
    if (value <= goodThreshold) return 100;
    if (value >= badThreshold) return 0;
    return clamp(
      100 * (1 - (value - goodThreshold) / (badThreshold - goodThreshold)),
      0,
      100
    );
  } else {
    if (value >= goodThreshold) return 100;
    if (value <= badThreshold) return 0;
    return clamp(
      (100 * (value - badThreshold)) / (goodThreshold - badThreshold),
      0,
      100
    );
  }
}

interface SARTData {
  commissionRate: number;
}
interface FocusData {
  firstSkipUrgeTime: number | null;
}
interface StroopData {
  interferenceScore: number;
}
interface PVTData {
  medianRT: number;
  lapseRate: number;
}
interface DelayData {
  medianK: number;
}
interface GoNoGoData {
  commissionErrorRate: number;
}

interface DecodedPayload {
  sart?: SARTData;
  focus?: FocusData;
  stroop?: StroopData;
  pvt?: PVTData;
  delay?: DelayData;
  gonogo?: GoNoGoData;
}

function computeScore(payload: DecodedPayload): number | null {
  const scores: number[] = [];

  if (payload.sart) {
    scores.push(scoreLinear(payload.sart.commissionRate * 100, 11, 30));
  }

  if (payload.focus) {
    const t = payload.focus.firstSkipUrgeTime;
    if (t === null) {
      scores.push(100);
    } else if (t >= 150000) {
      scores.push(100);
    } else if (t <= 40000) {
      scores.push(20);
    } else {
      scores.push(20 + (80 * (t - 40000)) / (150000 - 40000));
    }
  }

  if (payload.stroop) {
    scores.push(scoreLinear(payload.stroop.interferenceScore, 100, 400));
  }

  if (payload.pvt) {
    const rtScore = scoreLinear(payload.pvt.medianRT, 300, 500);
    const lapseScore = scoreLinear(payload.pvt.lapseRate * 100, 5, 25);
    scores.push((rtScore + lapseScore) / 2);
  }

  if (payload.delay) {
    const k = Math.max(payload.delay.medianK, 0.0001);
    const logK = Math.log10(k);
    const logGood = Math.log10(0.01);
    const logBad = Math.log10(0.1);
    scores.push(scoreLinear(logK, logGood, logBad));
  }

  if (payload.gonogo) {
    scores.push(
      scoreLinear(payload.gonogo.commissionErrorRate * 100, 15, 40)
    );
  }

  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function getTierLabel(score: number): string {
  if (score >= 80) return "Untouched";
  if (score >= 60) return "Slightly Cooked";
  if (score >= 40) return "Cooked";
  return "Fully Cooked";
}

function getTierDescription(score: number): string {
  if (score >= 80)
    return "Pre-smartphone focus levels, confirmed by science. Built different. Respect.";
  if (score >= 60)
    return "Signs of digital drift, but not a lost cause. The algorithm has a hold on you — just not a death grip.";
  if (score >= 40)
    return "The feed has done its work. Measurably impacted attention and impulse control. Good news: brains are plastic.";
  return "Peak 2024. Fast-twitch, impulsive, lapse-prone. The endless scroll has done its thing, and the data confirms it.";
}

function buildHtml(
  score: number,
  tier: string,
  description: string,
  r: string,
  fullUrl: string
): string {
  const title = `I scored ${score}/100 — ${tier}`;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=/?r=${r}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${fullUrl}">
<meta property="og:site_name" content="Brainrot Meter">
<meta property="og:type" content="website">
<title>${title}</title>
</head>
<body>
<p>Redirecting...</p>
</body>
</html>`;
}

function buildFallbackHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta property="og:title" content="Brainrot Meter">
<meta property="og:description" content="Find out how fried your attention span really is. Six scientifically-grounded tests. No mercy.">
<meta property="og:site_name" content="Brainrot Meter">
<meta property="og:type" content="website">
<title>Brainrot Meter</title>
</head>
<body>
<p>Redirecting...</p>
</body>
</html>`;
}

export default function handler(request: Request): Response {
  const url = new URL(request.url);
  const r = url.searchParams.get("r");

  if (!r) {
    return new Response(buildFallbackHtml(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  let payload: DecodedPayload;
  try {
    payload = JSON.parse(atob(r)) as DecodedPayload;
  } catch {
    return new Response(buildFallbackHtml(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const score = computeScore(payload);
  if (score === null) {
    return new Response(buildFallbackHtml(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const tier = getTierLabel(score);
  const description = getTierDescription(score);
  const fullUrl = `${url.origin}/share?r=${r}`;

  return new Response(buildHtml(score, tier, description, r, fullUrl), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
