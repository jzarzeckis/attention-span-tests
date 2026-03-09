import { test, expect, describe, beforeEach } from "bun:test";
import { resultsStore } from "@/utils/resultsStore";
import { buildShareUrl, countCompletedTests, hasAnyTestResults } from "@/utils/shareUtils";
import type { SARTStats, PVTStats } from "@/types";

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
  });
});
