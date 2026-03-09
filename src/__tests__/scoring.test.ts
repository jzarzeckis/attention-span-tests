import { test, expect, describe, beforeEach } from "bun:test";
import { resultsStore } from "@/utils/resultsStore";
import { calculateScores, compositeScore, getRank } from "@/screens/ResultsScreen";
import type { SARTStats, StroopStats, PVTStats, GoNoGoStats } from "@/types";

// Helper: populate store with stats
function setTestData(overrides: {
  sart?: SARTStats | { skipped: true };
  stroop?: StroopStats | { skipped: true };
  pvt?: PVTStats | { skipped: true };
  gonogo?: GoNoGoStats | { skipped: true };
}) {
  if (overrides.sart) resultsStore.setItem("sart", overrides.sart);
  if (overrides.stroop) resultsStore.setItem("stroop", overrides.stroop);
  if (overrides.pvt) resultsStore.setItem("pvt", overrides.pvt);
  if (overrides.gonogo) resultsStore.setItem("gonogo", overrides.gonogo);
}

// Baseline "good" stats for each test
const goodSart: SARTStats = {
  commissionErrors: 2,
  commissionRate: 0.08, // 8% — under 11% threshold
  omissionErrors: 3,
  omissionRate: 0.015, // 1.5% — under 5% threshold
  meanRT: 350,
  rtCV: 0.2,
  totalTrials: 225,
};

const goodStroop: StroopStats = {
  condition1: { accuracy: 100, meanRT: 500 },
  condition2: { accuracy: 100, meanRT: 600 },
  condition3: { accuracy: 90, meanRT: 680 },
  interferenceScore: 80, // 680 - 600 = 80ms — under 100ms threshold
};

const goodPvt: PVTStats = {
  medianRT: 260,
  meanRT: 280,
  lapses: 1,
  lapseRate: 0.033, // 3.3% — under 5% threshold
  falseStarts: 0,
  totalTrials: 30,
  rts: [250, 260, 270],
};

const goodGonogo: GoNoGoStats = {
  commissionErrors: 2,
  commissionErrorRate: 0.1, // 10% — under 15% threshold
  omissionErrors: 1,
  omissionErrorRate: 0.0125,
  meanRT: 300,
  rtCV: 0.15,
  totalTrials: 100,
  goTrials: 80,
  nogoTrials: 20,
};

// "Bad" stats
const badSart: SARTStats = {
  commissionErrors: 10,
  commissionRate: 0.4, // 40% — well above 30%
  omissionErrors: 50,
  omissionRate: 0.25, // 25% — well above 30%? actually 25% is between 5 and 30
  meanRT: 450,
  rtCV: 0.5,
  totalTrials: 225,
};

const badStroop: StroopStats = {
  condition1: { accuracy: 80, meanRT: 600 },
  condition2: { accuracy: 85, meanRT: 700 },
  condition3: { accuracy: 40, meanRT: 1200 },
  interferenceScore: 500, // 1200 - 700 = 500ms — above 400ms
};

const badPvt: PVTStats = {
  medianRT: 550,
  meanRT: 600,
  lapses: 10,
  lapseRate: 0.333,
  falseStarts: 3,
  totalTrials: 30,
  rts: [400, 500, 600, 700, 800],
};

const badGonogo: GoNoGoStats = {
  commissionErrors: 10,
  commissionErrorRate: 0.5, // 50% — well above 40%
  omissionErrors: 5,
  omissionErrorRate: 0.0625,
  meanRT: 400,
  rtCV: 0.3,
  totalTrials: 100,
  goTrials: 80,
  nogoTrials: 20,
};

describe("calculateScores", () => {
  beforeEach(() => {
    resultsStore.clearAll();
  });

  test("returns all null when no data", () => {
    const scores = calculateScores();
    expect(scores.sart).toBeNull();
    expect(scores.stroop).toBeNull();
    expect(scores.pvt).toBeNull();
    expect(scores.gonogo).toBeNull();
  });

  test("skipped tests return null scores", () => {
    setTestData({
      sart: { skipped: true },
      stroop: { skipped: true },
      pvt: { skipped: true },
      gonogo: { skipped: true },
    });
    const scores = calculateScores();
    expect(scores.sart).toBeNull();
    expect(scores.stroop).toBeNull();
    expect(scores.pvt).toBeNull();
    expect(scores.gonogo).toBeNull();
  });

  test("good SART performance yields high score", () => {
    setTestData({ sart: goodSart });
    const scores = calculateScores();
    expect(scores.sart).not.toBeNull();
    expect(scores.sart!).toBeGreaterThanOrEqual(80);
  });

  test("bad SART performance yields low score", () => {
    setTestData({ sart: badSart });
    const scores = calculateScores();
    expect(scores.sart).not.toBeNull();
    expect(scores.sart!).toBeLessThan(30);
  });

  test("SART uses harmonic mean — 0 in one component means 0 overall", () => {
    // 100% commission rate (always tapped on 3) = commission score 0
    const sart: SARTStats = {
      ...goodSart,
      commissionRate: 1.0,
      commissionErrors: 25,
    };
    setTestData({ sart });
    const scores = calculateScores();
    expect(scores.sart).toBe(0);
  });

  test("good Stroop performance yields high score", () => {
    setTestData({ stroop: goodStroop });
    const scores = calculateScores();
    expect(scores.stroop).not.toBeNull();
    expect(scores.stroop!).toBeGreaterThanOrEqual(70);
  });

  test("bad Stroop performance yields low score", () => {
    setTestData({ stroop: badStroop });
    const scores = calculateScores();
    expect(scores.stroop).not.toBeNull();
    expect(scores.stroop!).toBeLessThanOrEqual(10);
  });

  test("good PVT performance yields high score", () => {
    setTestData({ pvt: goodPvt });
    const scores = calculateScores();
    expect(scores.pvt).not.toBeNull();
    expect(scores.pvt!).toBeGreaterThanOrEqual(80);
  });

  test("bad PVT performance yields low score", () => {
    setTestData({ pvt: badPvt });
    const scores = calculateScores();
    expect(scores.pvt).not.toBeNull();
    expect(scores.pvt!).toBeLessThan(20);
  });

  test("PVT score is arithmetic mean of RT and lapse scores", () => {
    // medianRT = 300 → RT score = 100 (at good threshold)
    // lapseRate = 0.25 → lapse score = scoreLinear(25, 5, 25) = 0
    const pvt: PVTStats = {
      medianRT: 300,
      meanRT: 320,
      lapses: 7,
      lapseRate: 0.25,
      falseStarts: 0,
      totalTrials: 28,
      rts: [],
    };
    setTestData({ pvt });
    const scores = calculateScores();
    // RT score = 100, lapse score = 0 → average = 50
    expect(scores.pvt).toBeCloseTo(50, 0);
  });

  test("good GoNoGo performance yields high score", () => {
    setTestData({ gonogo: goodGonogo });
    const scores = calculateScores();
    expect(scores.gonogo).not.toBeNull();
    expect(scores.gonogo!).toBeGreaterThanOrEqual(80);
  });

  test("bad GoNoGo performance yields low score", () => {
    setTestData({ gonogo: badGonogo });
    const scores = calculateScores();
    expect(scores.gonogo).not.toBeNull();
    expect(scores.gonogo!).toBe(0);
  });

  test("GoNoGo score is linear from commissionErrorRate", () => {
    // commissionErrorRate = 0.15 → 15% → scoreLinear(15, 15, 40) = 100
    const gonogo: GoNoGoStats = { ...goodGonogo, commissionErrorRate: 0.15 };
    setTestData({ gonogo });
    const scores = calculateScores();
    expect(scores.gonogo).toBe(100);
  });
});

describe("scoring matches research definitions", () => {
  beforeEach(() => {
    resultsStore.clearAll();
  });

  // Robertson et al. (1997): SART commission errors reflect failures of
  // inhibitory control; doing nothing (no taps) should NOT yield a good score
  // because omission errors are equally important.
  test("SART: never tapping gives score 0 (Robertson 1997 — omissions matter)", () => {
    // 0% commission but 100% omission → harmonic mean = 0
    const neverTapped: SARTStats = {
      commissionErrors: 0,
      commissionRate: 0, // perfect commission
      omissionErrors: 200,
      omissionRate: 1.0, // 100% omission (missed every go trial)
      meanRT: 0,
      rtCV: 0,
      totalTrials: 225,
    };
    setTestData({ sart: neverTapped });
    const scores = calculateScores();
    expect(scores.sart).toBe(0);
  });

  // Robertson et al. (1997): always tapping means commission rate = 100%
  test("SART: always tapping gives score 0 (100% commission rate)", () => {
    const alwaysTapped: SARTStats = {
      commissionErrors: 25,
      commissionRate: 1.0, // tapped on every target
      omissionErrors: 0,
      omissionRate: 0, // never missed a go
      meanRT: 300,
      rtCV: 0.2,
      totalTrials: 225,
    };
    setTestData({ sart: alwaysTapped });
    const scores = calculateScores();
    expect(scores.sart).toBe(0);
  });

  // Robertson et al. (1997): good SART = low commission + low omission
  test("SART: low commission + low omission → high score", () => {
    setTestData({ sart: goodSart });
    const scores = calculateScores();
    expect(scores.sart!).toBeGreaterThanOrEqual(80);
  });

  // Basner & Dinges (2011): PVT lapses (RT ≥ 500ms) are the gold standard
  // biomarker for attentional failures
  test("PVT: 0% lapse rate + fast RT → 100 score", () => {
    const perfect: PVTStats = {
      medianRT: 250, // well under 300ms threshold
      meanRT: 260,
      lapses: 0,
      lapseRate: 0,
      falseStarts: 0,
      totalTrials: 30,
      rts: [250, 260, 240],
    };
    setTestData({ pvt: perfect });
    const scores = calculateScores();
    expect(scores.pvt).toBe(100);
  });

  // Basner & Dinges (2011): high lapse rate indicates severe attentional impairment
  test("PVT: high lapse rate → low score", () => {
    const impaired: PVTStats = {
      medianRT: 550, // above 500ms bad threshold
      meanRT: 600,
      lapses: 20,
      lapseRate: 0.667, // 67% — way above 25% bad threshold
      falseStarts: 2,
      totalTrials: 30,
      rts: [550, 600, 650],
    };
    setTestData({ pvt: impaired });
    const scores = calculateScores();
    expect(scores.pvt).toBe(0);
  });

  // Chamberlain et al. (2011): commission errors index impulsivity
  // at the neurological level
  test("GoNoGo: 0% commission rate → perfect score", () => {
    const perfect: GoNoGoStats = {
      ...goodGonogo,
      commissionErrors: 0,
      commissionErrorRate: 0, // under 15% threshold → 100
    };
    setTestData({ gonogo: perfect });
    const scores = calculateScores();
    expect(scores.gonogo).toBe(100);
  });

  test("GoNoGo: commission rate > 40% → score 0", () => {
    const impulsive: GoNoGoStats = {
      ...goodGonogo,
      commissionErrors: 15,
      commissionErrorRate: 0.75, // 75% — above 40% bad threshold
    };
    setTestData({ gonogo: impulsive });
    const scores = calculateScores();
    expect(scores.gonogo).toBe(0);
  });

  // Stroop (1935): interference score = C3 RT - C2 RT
  // Random clicking gives ~25% accuracy (4 choices) which should score poorly
  test("Stroop: random clicking (25% C3 accuracy) → score 0", () => {
    const random: StroopStats = {
      condition1: { accuracy: 25, meanRT: 200 },
      condition2: { accuracy: 25, meanRT: 200 },
      condition3: { accuracy: 25, meanRT: 200 },
      interferenceScore: 0, // fast but random
    };
    setTestData({ stroop: random });
    const scores = calculateScores();
    // C3 accuracy 25% is below 45% bad threshold → c3AccScore = 0
    // interferenceScore 0 is under 100ms → interfScore = 100
    // Harmonic mean of 0 and 100 = 0
    expect(scores.stroop).toBe(0);
  });

  // Stroop: high accuracy but huge interference → poor executive control
  test("Stroop: high accuracy but large interference → moderate score", () => {
    const slow: StroopStats = {
      condition1: { accuracy: 100, meanRT: 500 },
      condition2: { accuracy: 100, meanRT: 500 },
      condition3: { accuracy: 100, meanRT: 1000 },
      interferenceScore: 500, // 1000 - 500 = 500ms — above 400ms bad threshold
    };
    setTestData({ stroop: slow });
    const scores = calculateScores();
    // C3 accuracy 100% → c3AccScore = 100
    // interferenceScore 500 → interfScore = 0
    // Harmonic mean of 100 and 0 = 0
    expect(scores.stroop).toBe(0);
  });
});

describe("compositeScore", () => {
  test("returns null when no scores", () => {
    expect(compositeScore({ sart: null, stroop: null, pvt: null, gonogo: null })).toBeNull();
  });

  test("averages available scores", () => {
    expect(compositeScore({ sart: 80, stroop: 60, pvt: null, gonogo: null })).toBe(70);
  });

  test("averages all four scores", () => {
    expect(compositeScore({ sart: 80, stroop: 60, pvt: 40, gonogo: 100 })).toBe(70);
  });

  test("rounds to integer", () => {
    expect(compositeScore({ sart: 33, stroop: 33, pvt: 34, gonogo: null })).toBe(33);
  });

  test("single score returns that score", () => {
    expect(compositeScore({ sart: null, stroop: null, pvt: 75, gonogo: null })).toBe(75);
  });
});

describe("getRank", () => {
  test("score 95 → Functional Human", () => {
    expect(getRank(95).badge).toBe("Functional Human");
  });

  test("score 85 → Mildly Internet-Poisoned", () => {
    expect(getRank(85).badge).toBe("Mildly Internet-Poisoned");
  });

  test("score 75 → Chronic Scroller", () => {
    expect(getRank(75).badge).toBe("Chronic Scroller");
  });

  test("score 55 → TikTok Attention Span", () => {
    expect(getRank(55).badge).toBe("TikTok Attention Span");
  });

  test("score 5 → NPC of the Algorithm", () => {
    expect(getRank(5).badge).toBe("NPC of the Algorithm");
  });

  test("score 0 → NPC of the Algorithm", () => {
    expect(getRank(0).badge).toBe("NPC of the Algorithm");
  });

  test("score 100 → Functional Human", () => {
    expect(getRank(100).badge).toBe("Functional Human");
  });

  test("score 91 → Functional Human (threshold)", () => {
    expect(getRank(91).badge).toBe("Functional Human");
  });

  test("score 90 → Mildly Internet-Poisoned (just below 91)", () => {
    expect(getRank(90).badge).toBe("Mildly Internet-Poisoned");
  });

  test("each rank has required fields", () => {
    const rank = getRank(50);
    expect(rank).toHaveProperty("badge");
    expect(rank).toHaveProperty("label");
    expect(rank).toHaveProperty("summary");
    expect(rank).toHaveProperty("variant");
  });

  test("rank variants are valid", () => {
    const validVariants = ["default", "secondary", "destructive", "outline"];
    for (let score = 0; score <= 100; score += 10) {
      const rank = getRank(score);
      expect(validVariants).toContain(rank.variant);
    }
  });
});
