import { resultsStore } from "./resultsStore";
import type { SARTStats, StroopStats, PVTStats, GoNoGoStats, SkippedResult } from "@/types";

export interface TestScores {
  sart: number | null;
  stroop: number | null;
  pvt: number | null;
  gonogo: number | null;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function scoreLinear(value: number, goodThreshold: number, badThreshold: number): number {
  if (goodThreshold < badThreshold) {
    if (value <= goodThreshold) return 100;
    if (value >= badThreshold) return 0;
    return clamp(100 * (1 - (value - goodThreshold) / (badThreshold - goodThreshold)), 0, 100);
  } else {
    if (value >= goodThreshold) return 100;
    if (value <= badThreshold) return 0;
    return clamp(100 * (value - badThreshold) / (goodThreshold - badThreshold), 0, 100);
  }
}

function isSkipped(val: SARTStats | StroopStats | PVTStats | GoNoGoStats | SkippedResult): val is SkippedResult {
  return (val as SkippedResult).skipped === true;
}

export function calculateScores(): TestScores {
  const scores: TestScores = { sart: null, stroop: null, pvt: null, gonogo: null };

  const sart = resultsStore.getItem("sart");
  if (sart && !isSkipped(sart)) {
    scores.sart = scoreLinear(sart.commissionRate * 100, 11, 30);
  }

  const stroop = resultsStore.getItem("stroop");
  if (stroop && !isSkipped(stroop)) {
    const c3AccScore = scoreLinear(stroop.condition3.accuracy, 85, 45);
    const interfScore = scoreLinear(stroop.interferenceScore, 100, 400);
    const denom = c3AccScore + interfScore;
    scores.stroop = denom > 0 ? Math.round(2 * c3AccScore * interfScore / denom) : 0;
  }

  const pvt = resultsStore.getItem("pvt");
  if (pvt && !isSkipped(pvt)) {
    const rtScore = scoreLinear(pvt.medianRT, 300, 500);
    const lapseScore = scoreLinear(pvt.lapseRate * 100, 5, 25);
    scores.pvt = (rtScore + lapseScore) / 2;
  }

  const gonogo = resultsStore.getItem("gonogo");
  if (gonogo && !isSkipped(gonogo)) {
    scores.gonogo = scoreLinear(gonogo.commissionErrorRate * 100, 15, 40);
  }

  return scores;
}

export function compositeScore(scores: TestScores): number | null {
  const values = Object.values(scores).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export const RANKS = [
  {
    threshold: 80,
    badge: "Functional Human",
    label: "Functional Human. Your attention span predates the algorithm.",
    summary: "Pre-smartphone focus levels, confirmed by science. Either you barely touch social media, or your prefrontal cortex is just built different. Respect. Genuinely.",
    variant: "default" as const,
  },
  {
    threshold: 60,
    badge: "Mildly Internet-Poisoned",
    label: "Mildly Internet-Poisoned. Signs of digital drift, but you're not a lost cause.",
    summary: "Your attention is holding — but the drift is real. You're showing classic signs of digital-age distraction: slower inhibitory control, slightly elevated lapse rates. You're not a lost cause. Put the phone down more.",
    variant: "secondary" as const,
  },
  {
    threshold: 40,
    badge: "Chronic Scroller",
    label: "Chronic Scroller. The algorithm has done its homework on you.",
    summary: "Your sustained attention and impulse control are measurably impacted — consistent with heavy short-form video exposure. Good news: brains are plastic. Bad news: so is your willpower.",
    variant: "destructive" as const,
  },
  {
    threshold: 0,
    badge: "NPC of the Algorithm",
    label: "NPC of the Algorithm. Congratulations, you are peak 2024.",
    summary: "Your attention profile is the most common pattern in modern populations — fast-twitch, impulsive, lapse-prone. You're in good (bad?) company. The endless scroll has done its thing, and the data confirms it.",
    variant: "destructive" as const,
  },
] satisfies { threshold: number; badge: string; label: string; summary: string; variant: "default" | "secondary" | "destructive" | "outline" }[];

export function getRank(score: number) {
  return RANKS.find((r) => score >= r.threshold) ?? RANKS[RANKS.length - 1]!;
}
