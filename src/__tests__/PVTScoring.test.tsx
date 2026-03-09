import { test, expect, describe, beforeEach, afterEach, jest } from "bun:test";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { PVTTest } from "@/screens/tests/PVTTest";
import { resultsStore } from "@/utils/resultsStore";
import type { PVTStats } from "@/types";

// Dev mode: 1 trial, ISI 500-1000ms, LAPSE_THRESHOLD=500ms
const COUNTDOWN_MS = 2100;
const MIN_ISI_DEV = 500;
const MAX_ISI_DEV = 1000;

// Fix ISI to MIN so we know exactly when the stimulus appears.
// randomISI() = MIN_ISI + Math.random() * (MAX_ISI - MIN_ISI)
// With Math.random() = 0, ISI = MIN_ISI = 500ms.
const FIXED_ISI = MIN_ISI_DEV;

/** Navigate to running phase */
function startTest() {
  fireEvent.click(screen.getByText("Start Test"));
  act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });
}

/** Tap the response area */
function tap() {
  const tapZone = screen.getByLabelText("Tap when the red circle appears");
  fireEvent.click(tapZone);
}

/**
 * Advance time so the stimulus appears, then tap immediately.
 * Bun's fake timers advance performance.now(), so overshooting the ISI
 * inflates the measured RT. We advance exactly to the ISI so RT ≈ 0.
 */
function waitForStimulusAndTap() {
  act(() => { jest.advanceTimersByTime(FIXED_ISI); });
  tap();
}

describe("PVT Scoring — behavioral tests", () => {
  const origRandom = Math.random;

  beforeEach(() => {
    jest.useFakeTimers();
    resultsStore.clearAll();
    // Pin Math.random to 0 → ISI = MIN_ISI_DEV (500ms), deterministic sequence
    Math.random = () => 0;
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    Math.random = origRandom;
  });

  test("fast response → RT recorded, no lapses, no false starts", () => {
    render(<PVTTest onComplete={jest.fn()} />);
    startTest();
    waitForStimulusAndTap();
    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByText("PVT Complete!")).toBeInTheDocument();
    const stats = resultsStore.getItem("pvt") as PVTStats;

    expect(stats.totalTrials).toBe(1);
    expect(stats.rts).toHaveLength(1);
    expect(stats.rts[0]).toBeGreaterThanOrEqual(0);
    expect(stats.rts[0]!).toBeLessThan(FIXED_ISI); // not a lapse
    expect(stats.falseStarts).toBe(0);
    expect(stats.lapses).toBe(0);
    expect(stats.lapseRate).toBe(0);
    expect(stats.meanRT).toBeGreaterThanOrEqual(0);
    expect(stats.medianRT).toBeGreaterThanOrEqual(0);
  });

  test("false start (tap before stimulus) → counted as false start, trial continues", () => {
    render(<PVTTest onComplete={jest.fn()} />);
    startTest();

    // Tap before stimulus appears → false start
    tap();
    expect(screen.getByText("Too early!")).toBeInTheDocument();

    // Now wait for actual stimulus and tap
    waitForStimulusAndTap();
    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByText("PVT Complete!")).toBeInTheDocument();
    const stats = resultsStore.getItem("pvt") as PVTStats;

    expect(stats.falseStarts).toBe(1);
    expect(stats.totalTrials).toBe(1);
    expect(stats.rts).toHaveLength(1);
  });

  test("multiple false starts before responding → all counted", () => {
    render(<PVTTest onComplete={jest.fn()} />);
    startTest();

    // Multiple false starts
    tap();
    expect(screen.getByText("Too early!")).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(50); });

    tap();
    act(() => { jest.advanceTimersByTime(50); });

    tap();
    act(() => { jest.advanceTimersByTime(50); });

    // Now wait for remaining ISI time and tap
    // Already advanced 150ms of the 500ms ISI
    act(() => { jest.advanceTimersByTime(FIXED_ISI - 150); });
    tap();
    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByText("PVT Complete!")).toBeInTheDocument();
    const stats = resultsStore.getItem("pvt") as PVTStats;

    expect(stats.falseStarts).toBe(3);
    expect(stats.totalTrials).toBe(1);
  });

  test("space key tap works same as click for PVT", () => {
    render(<PVTTest onComplete={jest.fn()} />);
    startTest();
    act(() => { jest.advanceTimersByTime(FIXED_ISI); });

    // Use space bar instead of click
    fireEvent.keyDown(document, { code: "Space" });
    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByText("PVT Complete!")).toBeInTheDocument();
    const stats = resultsStore.getItem("pvt") as PVTStats;
    expect(stats.totalTrials).toBe(1);
    expect(stats.rts).toHaveLength(1);
    expect(stats.falseStarts).toBe(0);
  });

  test("lapseRate = lapses / totalTrials", () => {
    render(<PVTTest onComplete={jest.fn()} />);
    startTest();
    waitForStimulusAndTap();
    act(() => { jest.advanceTimersByTime(100); });

    const stats = resultsStore.getItem("pvt") as PVTStats;
    const expectedLapseRate = stats.lapses / stats.totalTrials;
    expect(stats.lapseRate).toBeCloseTo(expectedLapseRate, 5);
  });

  test("medianRT and meanRT are both rounded integers", () => {
    render(<PVTTest onComplete={jest.fn()} />);
    startTest();
    waitForStimulusAndTap();
    act(() => { jest.advanceTimersByTime(100); });

    const stats = resultsStore.getItem("pvt") as PVTStats;
    expect(Number.isInteger(stats.medianRT)).toBe(true);
    expect(Number.isInteger(stats.meanRT)).toBe(true);
  });

  test("rts array contains reaction times for each completed trial", () => {
    render(<PVTTest onComplete={jest.fn()} />);
    startTest();
    waitForStimulusAndTap();
    act(() => { jest.advanceTimersByTime(100); });

    const stats = resultsStore.getItem("pvt") as PVTStats;
    expect(stats.rts).toHaveLength(stats.totalTrials);
    for (const rt of stats.rts) {
      expect(rt).toBeGreaterThanOrEqual(0);
    }
  });
});
