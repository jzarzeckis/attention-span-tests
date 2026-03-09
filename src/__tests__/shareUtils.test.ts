import { test, expect, describe, beforeEach } from "bun:test";
import { resultsStore } from "@/utils/resultsStore";
import { buildShareUrl, countCompletedTests, hasAnyTestResults } from "@/utils/shareUtils";
import type { SARTStats, StroopStats, PVTStats, GoNoGoStats } from "@/types";

const sartStats: SARTStats = {
  commissionErrors: 5,
  commissionRate: 0.2,
  omissionErrors: 3,
  omissionRate: 0.015,
  meanRT: 350,
  rtCV: 0.25,
  totalTrials: 225,
};

const pvtStats: PVTStats = {
  medianRT: 280,
  meanRT: 300,
  lapses: 2,
  lapseRate: 0.067,
  falseStarts: 1,
  totalTrials: 30,
  rts: [250, 280, 310],
};

describe("shareUtils", () => {
  beforeEach(() => {
    resultsStore.clearAll();
  });

  describe("countCompletedTests", () => {
    test("returns 0 when no tests completed", () => {
      expect(countCompletedTests()).toBe(0);
    });

    test("returns 1 when one test completed", () => {
      resultsStore.setItem("sart", sartStats);
      expect(countCompletedTests()).toBe(1);
    });

    test("counts skipped tests as completed", () => {
      resultsStore.setItem("sart", { skipped: true });
      expect(countCompletedTests()).toBe(1);
    });

    test("returns 4 when all tests completed", () => {
      resultsStore.setItem("sart", sartStats);
      resultsStore.setItem("stroop", { skipped: true });
      resultsStore.setItem("pvt", pvtStats);
      resultsStore.setItem("gonogo", { skipped: true });
      expect(countCompletedTests()).toBe(4);
    });

    test("does not count selfReport as a test", () => {
      resultsStore.setItem("selfReport", {
        age: "21+",
        shortFormUsage: "1–3 hrs",
        restlessness: "Sometimes",
        selfRatedAttention: 3,
        screenTime: "2–4 hrs",
      });
      expect(countCompletedTests()).toBe(0);
    });
  });

  describe("hasAnyTestResults", () => {
    test("returns false when no tests completed", () => {
      expect(hasAnyTestResults()).toBe(false);
    });

    test("returns true when at least one test completed", () => {
      resultsStore.setItem("pvt", pvtStats);
      expect(hasAnyTestResults()).toBe(true);
    });

    test("returns true for skipped tests", () => {
      resultsStore.setItem("gonogo", { skipped: true });
      expect(hasAnyTestResults()).toBe(true);
    });
  });

  describe("buildShareUrl", () => {
    test("builds URL with encoded results", () => {
      resultsStore.setItem("sart", sartStats);
      const url = buildShareUrl();
      expect(url).toContain("/?r=");
      // Should be decodable
      const rParam = url.split("/?r=")[1]!;
      const decoded = JSON.parse(atob(rParam));
      expect(decoded.sart).toEqual(sartStats);
    });

    test("appends theme param when not default", () => {
      resultsStore.setItem("sart", sartStats);
      const url = buildShareUrl("kawaii");
      expect(url).toContain("&theme=kawaii");
    });

    test("omits theme param when default", () => {
      resultsStore.setItem("sart", sartStats);
      const url = buildShareUrl("default");
      expect(url).not.toContain("&theme=");
    });

    test("URL contains ?r= param with encoded data", () => {
      resultsStore.setItem("sart", sartStats);
      const url = buildShareUrl();
      expect(typeof url).toBe("string");
      expect(url).toContain("?r=");
    });

    test("round-trip: buildShareUrl → loadEncoded recovers all test results", () => {
      const stroopStats: StroopStats = {
        condition1: { accuracy: 100, meanRT: 500 },
        condition2: { accuracy: 100, meanRT: 600 },
        condition3: { accuracy: 90, meanRT: 700 },
        interferenceScore: 100,
      };
      const gonogoStats: GoNoGoStats = {
        commissionErrors: 2, commissionErrorRate: 0.1,
        omissionErrors: 1, omissionErrorRate: 0.0125,
        meanRT: 300, rtCV: 0.15,
        totalTrials: 100, goTrials: 80, nogoTrials: 20,
      };

      // Populate store with all 4 test results
      resultsStore.setItem("sart", sartStats);
      resultsStore.setItem("stroop", stroopStats);
      resultsStore.setItem("pvt", pvtStats);
      resultsStore.setItem("gonogo", gonogoStats);

      // Generate share URL
      const url = buildShareUrl();
      const rParam = url.split("?r=")[1]!.split("&")[0]!;
      expect(rParam.length).toBeGreaterThan(0);

      // Clear store and reload from encoded param
      resultsStore.clearAll();
      expect(resultsStore.hasItem("sart")).toBe(false);

      const loaded = resultsStore.loadEncoded(rParam);
      expect(loaded).toBe(true);

      // All 4 tests recovered exactly
      expect(resultsStore.getItem("sart")).toEqual(sartStats);
      expect(resultsStore.getItem("stroop")).toEqual(stroopStats);
      expect(resultsStore.getItem("pvt")).toEqual(pvtStats);
      expect(resultsStore.getItem("gonogo")).toEqual(gonogoStats);
    });

    test("share URL with empty store produces valid but empty encoded data", () => {
      // No test results in store
      const url = buildShareUrl();
      expect(url).toContain("?r=");

      const rParam = url.split("?r=")[1]!.split("&")[0]!;
      const decoded = JSON.parse(atob(rParam));
      // Should be empty object — no test keys
      expect(Object.keys(decoded)).toHaveLength(0);
    });

    test("encoded data does not lose precision on numeric fields", () => {
      resultsStore.setItem("sart", sartStats);
      const url = buildShareUrl();
      const rParam = url.split("?r=")[1]!.split("&")[0]!;

      resultsStore.clearAll();
      resultsStore.loadEncoded(rParam);

      const recovered = resultsStore.getItem("sart") as SARTStats;
      // Exact numeric equality — no floating point drift from encode/decode
      expect(recovered.commissionRate).toBe(sartStats.commissionRate);
      expect(recovered.omissionRate).toBe(sartStats.omissionRate);
      expect(recovered.meanRT).toBe(sartStats.meanRT);
      expect(recovered.rtCV).toBe(sartStats.rtCV);
    });

    test("loadEncoded returns false for invalid base64", () => {
      expect(resultsStore.loadEncoded("not-valid-base64!!!")).toBe(false);
    });

    test("loadEncoded returns false for valid base64 but invalid JSON", () => {
      expect(resultsStore.loadEncoded(btoa("not json"))).toBe(false);
    });
  });
});
