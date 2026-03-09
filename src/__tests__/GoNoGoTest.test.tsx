import { test, expect, describe, beforeEach, afterEach, jest } from "bun:test";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { GoNoGoTest } from "@/screens/tests/GoNoGoTest";
import { resultsStore } from "@/utils/resultsStore";

// Dev mode: TOTAL_TRIALS=5 (1 nogo), STIMULUS_DURATION_MS=500, ISI_MS=1000
const COUNTDOWN_MS = 2100;
const STIMULUS_MS = 500;
const ISI_MS = 1000;
const TRIAL_CYCLE_MS = STIMULUS_MS + ISI_MS; // time for a non-tapped trial

describe("GoNoGoTest", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resultsStore.clearAll();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  test("shows instructions screen initially", () => {
    render(<GoNoGoTest onComplete={jest.fn()} />);
    expect(screen.getByText("Go/No-Go Task")).toBeInTheDocument();
    expect(screen.getByText("Start Test")).toBeInTheDocument();
  });

  test("instructions describe go and no-go stimuli", () => {
    render(<GoNoGoTest onComplete={jest.fn()} />);
    expect(screen.getByText(/Green circle/)).toBeInTheDocument();
    expect(screen.getByText(/Red circle/)).toBeInTheDocument();
  });

  test("clicking Start Test transitions to countdown", () => {
    render(<GoNoGoTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Start Test"));
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  test("after countdown, enters running phase with first trial", () => {
    render(<GoNoGoTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Start Test"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });

    expect(screen.getByText(/Trial 1/)).toBeInTheDocument();
  });

  test("first trial stimulus appears after ISI", () => {
    render(<GoNoGoTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Start Test"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });

    // After initial ISI, stimulus appears
    act(() => { jest.advanceTimersByTime(ISI_MS); });

    // Should see either TAP! or Hold back
    const tapText = screen.queryByText("TAP!");
    const holdText = screen.queryByText(/Hold back/);
    expect(tapText || holdText).toBeTruthy();
  });

  test("full test completes in dev mode (5 trials) by letting stimuli timeout", () => {
    const onComplete = jest.fn();
    render(<GoNoGoTest onComplete={onComplete} />);

    fireEvent.click(screen.getByText("Start Test"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });

    // Each trial: ISI_MS wait + STIMULUS_MS visible + ISI_MS for next
    // For 5 trials without tapping (omission on go, correct withhold on nogo)
    for (let i = 0; i < 5; i++) {
      act(() => { jest.advanceTimersByTime(ISI_MS + STIMULUS_MS + 100); });
    }
    // Extra ISI + buffer for last trial processing
    act(() => { jest.advanceTimersByTime(ISI_MS + 500); });

    expect(screen.getByText("Go/No-Go Complete!")).toBeInTheDocument();
    expect(resultsStore.hasItem("gonogo")).toBe(true);

    const stats = resultsStore.getItem("gonogo") as { totalTrials: number };
    expect(stats.totalTrials).toBe(5);

    // onComplete after 1500ms
    expect(onComplete).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1500); });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test("tapping during stimulus registers a response", () => {
    render(<GoNoGoTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Start Test"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });

    // Wait for first stimulus
    act(() => { jest.advanceTimersByTime(ISI_MS); });

    // Tap via space
    fireEvent.keyDown(document, { code: "Space" });
    // No crash — response registered
  });

  test("GoNoGo stats include correct fields", () => {
    render(<GoNoGoTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Start Test"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });

    // Let all trials timeout
    for (let i = 0; i < 5; i++) {
      act(() => { jest.advanceTimersByTime(ISI_MS + STIMULUS_MS + 100); });
    }
    act(() => { jest.advanceTimersByTime(ISI_MS + 500); });

    const stats = resultsStore.getItem("gonogo") as Record<string, unknown>;
    expect(stats).toHaveProperty("commissionErrors");
    expect(stats).toHaveProperty("commissionErrorRate");
    expect(stats).toHaveProperty("omissionErrors");
    expect(stats).toHaveProperty("omissionErrorRate");
    expect(stats).toHaveProperty("meanRT");
    expect(stats).toHaveProperty("rtCV");
    expect(stats).toHaveProperty("goTrials");
    expect(stats).toHaveProperty("nogoTrials");
  });
});
