import { test, expect, describe, beforeEach, afterEach, jest } from "bun:test";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { PVTTest } from "@/screens/tests/PVTTest";
import { resultsStore } from "@/utils/resultsStore";
import type { PVTStats } from "@/types";

// Dev mode: 1 trial, ISI 500-1000ms, LAPSE_THRESHOLD=500ms
const COUNTDOWN_MS = 2100;
const MAX_ISI_DEV = 1000;

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

/** Wait for stimulus to appear (past max ISI) */
function waitForStimulus() {
  act(() => { jest.advanceTimersByTime(MAX_ISI_DEV + 100); });
}

describe("PVT Scoring — behavioral tests", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resultsStore.clearAll();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  test("fast response → RT recorded, no lapses, no false starts", () => {
    render(<PVTTest onComplete={jest.fn()} />);
    startTest();

    // Wait for stimulus
    waitForStimulus();

    // Tap immediately (fast response)
    tap();
    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByText("PVT Complete!")).toBeInTheDocument();
    const stats = resultsStore.getItem("pvt") as PVTStats;

    expect(stats.totalTrials).toBe(1);
    expect(stats.rts).toHaveLength(1);
    expect(stats.rts[0]).toBeGreaterThan(0);
    expect(stats.falseStarts).toBe(0);
    expect(stats.lapses).toBe(0);
    expect(stats.lapseRate).toBe(0);
    expect(stats.meanRT).toBeGreaterThan(0);
    expect(stats.medianRT).toBeGreaterThan(0);
  });

  test("false start (tap before stimulus) → counted as false start, trial continues", () => {
    render(<PVTTest onComplete={jest.fn()} />);
    startTest();

    // Tap before stimulus appears → false start
    tap();
    expect(screen.getByText("Too early!")).toBeInTheDocument();

    // Stimulus hasn't appeared yet, trial not completed
    // Now wait for actual stimulus
    waitForStimulus();

    // Tap on stimulus
    tap();
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

    // Now wait for stimulus and respond
    waitForStimulus();
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
    waitForStimulus();

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
    waitForStimulus();
    tap();
    act(() => { jest.advanceTimersByTime(100); });

    const stats = resultsStore.getItem("pvt") as PVTStats;
    const expectedLapseRate = stats.lapses / stats.totalTrials;
    expect(stats.lapseRate).toBeCloseTo(expectedLapseRate, 5);
  });

  test("medianRT and meanRT are both rounded integers", () => {
    render(<PVTTest onComplete={jest.fn()} />);
    startTest();
    waitForStimulus();
    tap();
    act(() => { jest.advanceTimersByTime(100); });

    const stats = resultsStore.getItem("pvt") as PVTStats;
    expect(Number.isInteger(stats.medianRT)).toBe(true);
    expect(Number.isInteger(stats.meanRT)).toBe(true);
  });

  test("rts array contains actual reaction times (not zero)", () => {
    render(<PVTTest onComplete={jest.fn()} />);
    startTest();
    waitForStimulus();
    tap();
    act(() => { jest.advanceTimersByTime(100); });

    const stats = resultsStore.getItem("pvt") as PVTStats;
    for (const rt of stats.rts) {
      expect(rt).toBeGreaterThan(0);
    }
  });
});
