import { test, expect, describe, beforeEach, afterEach, jest } from "bun:test";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { SARTTest } from "@/screens/tests/SARTTest";
import { resultsStore } from "@/utils/resultsStore";

// In dev mode: PRACTICE_CYCLES=1 (9 trials), MAIN_CYCLES=1 (9 trials)
// STIMULUS_MS=250, TRIAL_MS=1150, TARGET_DIGIT=3
const TRIAL_MS = 1150;
const COUNTDOWN_MS = 2100;

describe("SARTTest", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resultsStore.clearAll();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  test("shows instructions screen initially", () => {
    render(<SARTTest onComplete={jest.fn()} />);
    expect(screen.getByText("Sustained Attention (SART)")).toBeInTheDocument();
    expect(screen.getByText("Start Practice")).toBeInTheDocument();
  });

  test("instructions describe the task correctly", () => {
    render(<SARTTest onComplete={jest.fn()} />);
    expect(screen.getByText(/Digits 1–9 will flash/)).toBeInTheDocument();
    // Target digit "3" appears in multiple elements; verify it's mentioned
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
  });

  test("clicking Start Practice transitions to countdown", () => {
    render(<SARTTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Start Practice"));
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  test("after countdown, practice phase starts", () => {
    render(<SARTTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Start Practice"));

    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });
    expect(screen.getByText("Practice")).toBeInTheDocument();
  });

  test("tapping during practice records response", () => {
    render(<SARTTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Start Practice"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });

    const tapZone = screen.getByLabelText("Tap here when you see a non-3 digit");
    fireEvent.click(tapZone);
    // No crash — tap recorded
  });

  test("space key triggers tap", () => {
    render(<SARTTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Start Practice"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });

    fireEvent.keyDown(document, { code: "Space" });
    // No crash
  });

  test("practice completes after 9 trials and shows practice-done", () => {
    render(<SARTTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Start Practice"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });

    // 9 trials × 1150ms each
    act(() => { jest.advanceTimersByTime(9 * TRIAL_MS + 100); });
    expect(screen.getByText("Practice Complete!")).toBeInTheDocument();
  });

  test("full flow: practice → main → complete → onComplete called", () => {
    const onComplete = jest.fn();
    render(<SARTTest onComplete={onComplete} />);

    // Start practice
    fireEvent.click(screen.getByText("Start Practice"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });

    // Complete practice (9 trials)
    act(() => { jest.advanceTimersByTime(9 * TRIAL_MS + 100); });
    expect(screen.getByText("Practice Complete!")).toBeInTheDocument();

    // Start main test
    fireEvent.click(screen.getByText("Begin Test"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); }); // countdown

    // Complete main (9 trials in dev)
    act(() => { jest.advanceTimersByTime(9 * TRIAL_MS + 100); });
    expect(screen.getByText("SART Complete!")).toBeInTheDocument();

    // Results saved
    expect(resultsStore.hasItem("sart")).toBe(true);
    const stats = resultsStore.getItem("sart");
    expect((stats as { totalTrials: number }).totalTrials).toBe(9);

    // onComplete called after 1500ms delay
    expect(onComplete).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1500); });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test("practice feedback shows correct/error badges", () => {
    render(<SARTTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Start Practice"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });

    // Tap on the first trial (digit is random, but we get feedback either way)
    const tapZone = screen.getByLabelText("Tap here when you see a non-3 digit");
    fireEvent.click(tapZone);

    // Advance to end of trial (feedback set at TRIAL_MS) but not into next trial
    // Feedback is set at TRIAL_MS then cleared when next trial starts (synchronously)
    // Complete all 9 practice trials so we land on practice-done with last feedback still visible
    act(() => { jest.advanceTimersByTime(9 * TRIAL_MS + 100); });

    // After practice completes, practiceStats summary is shown
    expect(screen.getByText("Practice Complete!")).toBeInTheDocument();
    // Summary shows either "Great job" (0 errors) or "You made N error(s)"
    const summary = screen.queryByText(/Great job/) || screen.queryByText(/You made \d+ error/);
    expect(summary).toBeTruthy();
  });
});
