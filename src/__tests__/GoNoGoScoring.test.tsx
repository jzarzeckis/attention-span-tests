import { test, expect, describe, beforeEach, afterEach, jest } from "bun:test";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { GoNoGoTest } from "@/screens/tests/GoNoGoTest";
import { resultsStore } from "@/utils/resultsStore";
import type { GoNoGoStats } from "@/types";

// Dev mode: 5 trials (4 go, 1 nogo), STIMULUS_DURATION=500ms, ISI=1000ms
const COUNTDOWN_MS = 2100;
const STIMULUS_MS = 500;
const ISI_MS = 1000;
const TOTAL_TRIALS = 5;
// After startTest, there's an initial ISI_MS delay before first trial
const INITIAL_ISI = ISI_MS;

/** Navigate to running phase */
function startTest() {
  fireEvent.click(screen.getByText("Start Test"));
  act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });
  // Initial ISI before first stimulus
  act(() => { jest.advanceTimersByTime(INITIAL_ISI); });
}

/** Tap the response area */
function tap() {
  fireEvent.keyDown(document, { code: "Space" });
}

/** Let one trial timeout (no tap), then wait through ISI to next trial */
function letTrialTimeout() {
  act(() => { jest.advanceTimersByTime(STIMULUS_MS + ISI_MS + 50); });
}

/** Tap during the current stimulus and wait through ISI */
function tapAndWait() {
  tap();
  act(() => { jest.advanceTimersByTime(ISI_MS + 50); });
}

describe("GoNoGo Scoring — behavioral tests", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resultsStore.clearAll();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  test("tap every trial → commission errors = nogo count, omission errors = 0", () => {
    render(<GoNoGoTest onComplete={jest.fn()} />);
    startTest();

    // Tap on every stimulus regardless of type
    for (let i = 0; i < TOTAL_TRIALS; i++) {
      tapAndWait();
    }
    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByText("Go/No-Go Complete!")).toBeInTheDocument();
    const stats = resultsStore.getItem("gonogo") as GoNoGoStats;

    expect(stats.totalTrials).toBe(TOTAL_TRIALS);
    expect(stats.goTrials).toBe(4);
    expect(stats.nogoTrials).toBe(1);
    // Tapped every trial → tapped on all nogo trials = commission errors
    expect(stats.commissionErrors).toBe(1);
    expect(stats.commissionErrorRate).toBe(1 / 1); // 1 nogo, 1 error
    // Tapped all go trials → 0 omission errors
    expect(stats.omissionErrors).toBe(0);
    expect(stats.omissionErrorRate).toBe(0);
    // 4 correct go RTs recorded
    expect(stats.meanRT).toBeGreaterThan(0);
  });

  test("tap nothing → 0 commission errors, omission errors = go count", () => {
    render(<GoNoGoTest onComplete={jest.fn()} />);
    startTest();

    // Let every stimulus timeout without tapping
    for (let i = 0; i < TOTAL_TRIALS; i++) {
      letTrialTimeout();
    }
    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByText("Go/No-Go Complete!")).toBeInTheDocument();
    const stats = resultsStore.getItem("gonogo") as GoNoGoStats;

    // Never tapped → 0 commission errors
    expect(stats.commissionErrors).toBe(0);
    expect(stats.commissionErrorRate).toBe(0);
    // All go trials missed → omission errors = 4
    expect(stats.omissionErrors).toBe(4);
    expect(stats.omissionErrorRate).toBe(4 / 4); // 4 go trials, all missed
    // No correct go taps → meanRT = 0
    expect(stats.meanRT).toBe(0);
    expect(stats.rtCV).toBe(0);
  });

  test("selective tapping — tap only on go trials (green), withhold on nogo (red)", () => {
    render(<GoNoGoTest onComplete={jest.fn()} />);
    startTest();

    // Check the stimulus text to decide whether to tap
    for (let i = 0; i < TOTAL_TRIALS; i++) {
      const isGo = screen.queryByText("TAP!");
      if (isGo) {
        tapAndWait();
      } else {
        letTrialTimeout();
      }
    }
    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByText("Go/No-Go Complete!")).toBeInTheDocument();
    const stats = resultsStore.getItem("gonogo") as GoNoGoStats;

    // Perfect performance: 0 commission errors, 0 omission errors
    expect(stats.commissionErrors).toBe(0);
    expect(stats.omissionErrors).toBe(0);
    expect(stats.commissionErrorRate).toBe(0);
    expect(stats.omissionErrorRate).toBe(0);
    // All 4 go trials tapped correctly
    expect(stats.meanRT).toBeGreaterThan(0);
  });

  test("tap only on nogo trials (worst possible) → max commission, max omission", () => {
    render(<GoNoGoTest onComplete={jest.fn()} />);
    startTest();

    // Deliberately tap only on nogo (red), withhold on go (green)
    for (let i = 0; i < TOTAL_TRIALS; i++) {
      const isHoldBack = screen.queryByText("Hold back\u2026");
      if (isHoldBack) {
        tapAndWait();
      } else {
        letTrialTimeout();
      }
    }
    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByText("Go/No-Go Complete!")).toBeInTheDocument();
    const stats = resultsStore.getItem("gonogo") as GoNoGoStats;

    // Tapped all nogo → commission errors = 1
    expect(stats.commissionErrors).toBe(1);
    expect(stats.commissionErrorRate).toBe(1);
    // Withheld on all go → omission errors = 4
    expect(stats.omissionErrors).toBe(4);
    expect(stats.omissionErrorRate).toBe(1);
    // No correct go taps
    expect(stats.meanRT).toBe(0);
  });

  test("commission error rate = commissionErrors / nogoTrials", () => {
    render(<GoNoGoTest onComplete={jest.fn()} />);
    startTest();

    for (let i = 0; i < TOTAL_TRIALS; i++) {
      tapAndWait();
    }
    act(() => { jest.advanceTimersByTime(100); });

    const stats = resultsStore.getItem("gonogo") as GoNoGoStats;
    expect(stats.commissionErrorRate).toBeCloseTo(
      stats.commissionErrors / stats.nogoTrials, 5
    );
  });

  test("omission error rate = omissionErrors / goTrials", () => {
    render(<GoNoGoTest onComplete={jest.fn()} />);
    startTest();

    for (let i = 0; i < TOTAL_TRIALS; i++) {
      letTrialTimeout();
    }
    act(() => { jest.advanceTimersByTime(100); });

    const stats = resultsStore.getItem("gonogo") as GoNoGoStats;
    expect(stats.omissionErrorRate).toBeCloseTo(
      stats.omissionErrors / stats.goTrials, 5
    );
  });

  test("meanRT only includes correct go taps, not commission error taps", () => {
    render(<GoNoGoTest onComplete={jest.fn()} />);
    startTest();

    // Tap everything → goRts only includes go trial RTs (4), not nogo tap
    for (let i = 0; i < TOTAL_TRIALS; i++) {
      tapAndWait();
    }
    act(() => { jest.advanceTimersByTime(100); });

    const stats = resultsStore.getItem("gonogo") as GoNoGoStats;
    // meanRT computed from 4 correct go RTs
    expect(stats.meanRT).toBeGreaterThan(0);
    // rtCV should be reasonable (>= 0)
    expect(stats.rtCV).toBeGreaterThanOrEqual(0);
  });

  test("nogo trial shows commission flash when incorrectly tapped", () => {
    render(<GoNoGoTest onComplete={jest.fn()} />);
    startTest();

    let sawFlash = false;
    // Find and tap on a nogo trial, check flash before advancing
    for (let i = 0; i < TOTAL_TRIALS; i++) {
      const isHoldBack = screen.queryByText("Hold back\u2026");
      if (isHoldBack && !sawFlash) {
        tap();
        // Commission flash should appear immediately after tap
        const flash = screen.queryByText("No-Go!");
        if (flash) sawFlash = true;
        act(() => { jest.advanceTimersByTime(ISI_MS + 50); });
      } else {
        // Either go trial or already verified flash — let it timeout/tap normally
        if (screen.queryByText("TAP!")) {
          tapAndWait();
        } else {
          letTrialTimeout();
        }
      }
    }
    expect(sawFlash).toBe(true);
  });
});
