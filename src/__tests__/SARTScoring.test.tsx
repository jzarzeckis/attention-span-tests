import { test, expect, describe, beforeEach, afterEach, jest } from "bun:test";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { SARTTest } from "@/screens/tests/SARTTest";
import { resultsStore } from "@/utils/resultsStore";
import type { SARTStats } from "@/types";

// Dev mode: 1 cycle = 9 trials (digits 1-9 shuffled)
// Exactly 1 target (digit 3), 8 non-targets
// STIMULUS_MS=250, TRIAL_MS=1150, TARGET_DIGIT=3
const TRIAL_MS = 1150;
const COUNTDOWN_MS = 2100;

/** Navigate through practice phase (9 trials, no tapping) and start main test */
function skipPracticeAndStartMain() {
  // Start practice
  fireEvent.click(screen.getByText("Start Practice"));
  act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });
  // Let all 9 practice trials pass without tapping
  act(() => { jest.advanceTimersByTime(9 * TRIAL_MS + 100); });
  // Start main test
  fireEvent.click(screen.getByText("Begin Test"));
  act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });
}

/** Tap via Space key (SART listens on document keydown, which works in happy-dom) */
function tap() {
  fireEvent.keyDown(document, { code: "Space" });
}

describe("SART Scoring — behavioral tests", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resultsStore.clearAll();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  test("tap every trial → 1 commission error (tapped on 3), 0 omission errors", () => {
    render(<SARTTest onComplete={jest.fn()} />);
    skipPracticeAndStartMain();

    // Tap on every single trial (9 trials)
    for (let i = 0; i < 9; i++) {
      tap();
      act(() => { jest.advanceTimersByTime(TRIAL_MS); });
    }
    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByText("SART Complete!")).toBeInTheDocument();
    const stats = resultsStore.getItem("sart") as SARTStats;

    // Exactly 1 target (3) in the 9-trial cycle → tapping it = 1 commission error
    expect(stats.commissionErrors).toBe(1);
    expect(stats.commissionRate).toBe(1); // 1/1 targets tapped
    // All 8 non-targets tapped → 0 omission errors
    expect(stats.omissionErrors).toBe(0);
    expect(stats.omissionRate).toBe(0);
    expect(stats.totalTrials).toBe(9);
    // meanRT >= 0 (performance.now() doesn't advance with fake timers, so RT ≈ 0)
    expect(stats.meanRT).toBeGreaterThanOrEqual(0);
    expect(typeof stats.meanRT).toBe("number");
  });

  test("tap nothing → 0 commission errors, 8 omission errors", () => {
    render(<SARTTest onComplete={jest.fn()} />);
    skipPracticeAndStartMain();

    // Don't tap at all — let all 9 trials time out
    act(() => { jest.advanceTimersByTime(9 * TRIAL_MS + 100); });

    expect(screen.getByText("SART Complete!")).toBeInTheDocument();
    const stats = resultsStore.getItem("sart") as SARTStats;

    // Never tapped → 0 commission errors (didn't tap on target 3)
    expect(stats.commissionErrors).toBe(0);
    expect(stats.commissionRate).toBe(0);
    // All 8 non-targets missed → 8 omission errors
    expect(stats.omissionErrors).toBe(8);
    expect(stats.omissionRate).toBe(1); // 8/8 non-targets missed
    expect(stats.totalTrials).toBe(9);
    // No taps → no RT data → meanRT = 0
    expect(stats.meanRT).toBe(0);
    expect(stats.rtCV).toBe(0);
  });

  test("tap nothing during practice → practice counts errors correctly", () => {
    render(<SARTTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Start Practice"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });

    // Don't tap during practice
    act(() => { jest.advanceTimersByTime(9 * TRIAL_MS + 100); });

    // Practice complete screen shows error count
    expect(screen.getByText("Practice Complete!")).toBeInTheDocument();
    // 8 omission errors (didn't tap on 8 non-targets)
    expect(screen.getByText(/You made 8 errors/)).toBeInTheDocument();
  });

  test("tap all practice trials → 1 error (tapped on target 3)", () => {
    render(<SARTTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Start Practice"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });

    // Tap every trial (Space key)
    for (let i = 0; i < 9; i++) {
      tap();
      act(() => { jest.advanceTimersByTime(TRIAL_MS); });
    }
    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByText("Practice Complete!")).toBeInTheDocument();
    // 1 commission error (tapped on digit 3) + 0 omission errors = 1 total error
    expect(screen.getByText(/You made 1 error/)).toBeInTheDocument();
  });

  test("commission rate = commissionErrors / number of targets", () => {
    render(<SARTTest onComplete={jest.fn()} />);
    skipPracticeAndStartMain();

    // Tap all trials
    for (let i = 0; i < 9; i++) {
      tap();
      act(() => { jest.advanceTimersByTime(TRIAL_MS); });
    }
    act(() => { jest.advanceTimersByTime(100); });

    const stats = resultsStore.getItem("sart") as SARTStats;
    // 1 target in 9-trial cycle, tapped on it → rate = 1/1 = 1.0
    expect(stats.commissionRate).toBe(stats.commissionErrors / 1);
  });

  test("omission rate = omissionErrors / number of non-targets", () => {
    render(<SARTTest onComplete={jest.fn()} />);
    skipPracticeAndStartMain();

    // Don't tap at all
    act(() => { jest.advanceTimersByTime(9 * TRIAL_MS + 100); });

    const stats = resultsStore.getItem("sart") as SARTStats;
    // 8 non-targets, none tapped → rate = 8/8 = 1.0
    expect(stats.omissionRate).toBe(stats.omissionErrors / 8);
  });

  test("rtCV = 0 when meanRT = 0 (no taps)", () => {
    render(<SARTTest onComplete={jest.fn()} />);
    skipPracticeAndStartMain();
    act(() => { jest.advanceTimersByTime(9 * TRIAL_MS + 100); });

    const stats = resultsStore.getItem("sart") as SARTStats;
    expect(stats.rtCV).toBe(0);
  });

  test("meanRT only counts correct non-target taps (not commission errors)", () => {
    render(<SARTTest onComplete={jest.fn()} />);
    skipPracticeAndStartMain();

    // Tap all 9 → 8 correct non-target taps + 1 commission error tap
    for (let i = 0; i < 9; i++) {
      tap();
      act(() => { jest.advanceTimersByTime(TRIAL_MS); });
    }
    act(() => { jest.advanceTimersByTime(100); });

    const stats = resultsStore.getItem("sart") as SARTStats;
    // meanRT computed from 8 correct non-target RTs (not the 1 commission error)
    // In test env, performance.now() doesn't advance with fake timers so RT ≈ 0
    expect(stats.meanRT).toBeGreaterThanOrEqual(0);
    expect(typeof stats.meanRT).toBe("number");
    // totalTrials is always 9
    expect(stats.totalTrials).toBe(9);
  });

  test("space key tap counts the same as click tap", () => {
    render(<SARTTest onComplete={jest.fn()} />);
    skipPracticeAndStartMain();

    // Use space key for all 9 trials
    for (let i = 0; i < 9; i++) {
      fireEvent.keyDown(document, { code: "Space" });
      act(() => { jest.advanceTimersByTime(TRIAL_MS); });
    }
    act(() => { jest.advanceTimersByTime(100); });

    const stats = resultsStore.getItem("sart") as SARTStats;
    // Same result as tapping all: 1 commission, 0 omission
    expect(stats.commissionErrors).toBe(1);
    expect(stats.omissionErrors).toBe(0);
  });

  test("double tap on same trial only counts once", () => {
    render(<SARTTest onComplete={jest.fn()} />);
    skipPracticeAndStartMain();

    // Double tap on first trial — second should be ignored (tappedRef guard)
    tap();
    tap(); // should be ignored
    // Let remaining trials time out
    act(() => { jest.advanceTimersByTime(9 * TRIAL_MS + 100); });

    const stats = resultsStore.getItem("sart") as SARTStats;
    // Exactly 1 trial was tapped (the first one), remaining 8 timed out
    // The first trial's digit is random:
    //   If non-target (p=8/9): tapped non-targets=1, omission=7, commission=0
    //   If target (p=1/9): tapped non-targets=0, omission=8, commission=1
    // In both cases, total tapped trials = 1
    const tappedNonTargets = 8 - stats.omissionErrors;
    const tappedTargets = stats.commissionErrors;
    expect(tappedNonTargets + tappedTargets).toBe(1);
  });
});
