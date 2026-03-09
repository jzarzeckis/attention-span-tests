import { test, expect, describe, beforeEach } from "bun:test";
import { resultsStore } from "@/utils/resultsStore";
import type { SARTStats, PVTStats, GoNoGoStats, StroopStats } from "@/types";

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

describe("resultsStore", () => {
  beforeEach(() => {
    resultsStore.clearAll();
  });

  test("getItem returns null for missing keys", () => {
    expect(resultsStore.getItem("sart")).toBeNull();
    expect(resultsStore.getItem("pvt")).toBeNull();
  });

  test("setItem + getItem round-trips data", () => {
    resultsStore.setItem("sart", sartStats);
    expect(resultsStore.getItem("sart")).toEqual(sartStats);
  });

  test("hasItem returns false for missing, true for existing", () => {
    expect(resultsStore.hasItem("sart")).toBe(false);
    resultsStore.setItem("sart", sartStats);
    expect(resultsStore.hasItem("sart")).toBe(true);
  });

  test("removeItem deletes the key", () => {
    resultsStore.setItem("sart", sartStats);
    resultsStore.removeItem("sart");
    expect(resultsStore.hasItem("sart")).toBe(false);
    expect(resultsStore.getItem("sart")).toBeNull();
  });

  test("clearAll removes all keys", () => {
    resultsStore.setItem("sart", sartStats);
    resultsStore.setItem("pvt", pvtStats);
    resultsStore.clearAll();
    expect(resultsStore.hasItem("sart")).toBe(false);
    expect(resultsStore.hasItem("pvt")).toBe(false);
  });

  test("setItem with skipped result", () => {
    resultsStore.setItem("sart", { skipped: true });
    expect(resultsStore.getItem("sart")).toEqual({ skipped: true });
    expect(resultsStore.hasItem("sart")).toBe(true);
  });

  test("encode produces valid base64 JSON", () => {
    resultsStore.setItem("sart", sartStats);
    const encoded = resultsStore.encode();
    const decoded = JSON.parse(atob(encoded));
    expect(decoded.sart).toEqual(sartStats);
  });

  test("loadEncoded restores data from base64", () => {
    const data = { sart: sartStats, pvt: pvtStats };
    const encoded = btoa(JSON.stringify(data));
    const result = resultsStore.loadEncoded(encoded);
    expect(result).toBe(true);
    expect(resultsStore.getItem("sart")).toEqual(sartStats);
    expect(resultsStore.getItem("pvt")).toEqual(pvtStats);
  });

  test("loadEncoded returns false on invalid base64", () => {
    expect(resultsStore.loadEncoded("!!!invalid!!!")).toBe(false);
  });

  test("loadEncoded returns false when only selfReport is present", () => {
    const data = { selfReport: { age: "21+", shortFormUsage: "1-3 hrs", restlessness: "Sometimes", selfRatedAttention: 3, screenTime: "2-4 hrs" } };
    const encoded = btoa(JSON.stringify(data));
    const result = resultsStore.loadEncoded(encoded);
    expect(result).toBe(false);
  });

  test("encode + loadEncoded round-trip", () => {
    resultsStore.setItem("sart", sartStats);
    resultsStore.setItem("pvt", pvtStats);
    const encoded = resultsStore.encode();
    resultsStore.clearAll();
    resultsStore.loadEncoded(encoded);
    expect(resultsStore.getItem("sart")).toEqual(sartStats);
    expect(resultsStore.getItem("pvt")).toEqual(pvtStats);
  });
});
