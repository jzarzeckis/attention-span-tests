import { test, expect, describe, beforeEach, afterEach, jest } from "bun:test";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { StroopTest } from "@/screens/tests/StroopTest";
import { resultsStore } from "@/utils/resultsStore";

const COUNTDOWN_MS = 2100;
// Dev mode: TRIALS_PER_CONDITION=1, but makeC1/C2 use reps=1/4=0.25,
// loop runs once → 4 stimuli per C1/C2. Practice=1, C3=1.
const C1_TRIALS = 4;
const C2_TRIALS = 4;
const PRACTICE_TRIALS = 1;
const C3_TRIALS = 1;
const COLORS = ["Red", "Blue", "Green", "Yellow"];

/** Click a random color button and advance past the trial delay */
function answerTrial(delay: number = 200) {
  // Use getByRole to specifically target buttons, not stimulus text
  for (const color of COLORS) {
    const btn = screen.queryByRole("button", { name: color });
    if (btn && !btn.hasAttribute("disabled")) {
      fireEvent.click(btn);
      act(() => { jest.advanceTimersByTime(delay); });
      return;
    }
  }
}

/** Answer n trials */
function answerTrials(n: number, delay: number = 200) {
  for (let i = 0; i < n; i++) {
    answerTrial(delay);
  }
}

describe("StroopTest", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resultsStore.clearAll();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  test("shows instructions screen initially", () => {
    render(<StroopTest onComplete={jest.fn()} />);
    expect(screen.getByText("Stroop Color-Word Test")).toBeInTheDocument();
    expect(screen.getByText("Begin")).toBeInTheDocument();
  });

  test("instructions describe all three conditions", () => {
    render(<StroopTest onComplete={jest.fn()} />);
    expect(screen.getByText(/Condition 1 — Word Reading/)).toBeInTheDocument();
    expect(screen.getByText(/Condition 2 — Color Naming/)).toBeInTheDocument();
    expect(screen.getByText(/Condition 3 — Stroop/)).toBeInTheDocument();
  });

  test("clicking Begin transitions to countdown", () => {
    render(<StroopTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Begin"));
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  test("after countdown, shows condition 1 with color buttons", () => {
    render(<StroopTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Begin"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });

    expect(screen.getByText("Condition 1: Word Reading")).toBeInTheDocument();
    for (const color of COLORS) {
      expect(screen.getByRole("button", { name: color })).toBeInTheDocument();
    }
  });

  test("completing C1 transitions to between-1-2", () => {
    render(<StroopTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Begin"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });

    answerTrials(C1_TRIALS);
    expect(screen.getByText("Condition 2: Color Naming")).toBeInTheDocument();
  });

  test("full flow through all conditions (dev mode)", () => {
    const onComplete = jest.fn();
    render(<StroopTest onComplete={onComplete} />);

    // Start → countdown → C1
    fireEvent.click(screen.getByText("Begin"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });

    // C1: 4 trials
    answerTrials(C1_TRIALS);

    // between-1-2 → Start C2
    expect(screen.getByText("Condition 2: Color Naming")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Start Condition 2"));

    // C2: 4 trials
    answerTrials(C2_TRIALS);

    // between-2-3 → Start Practice
    expect(screen.getByText(/Condition 3: The Stroop Challenge/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Start Practice"));

    // Practice: 1 trial with 800ms delay
    answerTrials(PRACTICE_TRIALS, 900);

    // Practice done → Begin C3
    expect(screen.getByText("Practice Complete!")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Begin Condition 3"));

    // C3: 1 trial
    answerTrials(C3_TRIALS);

    // Complete
    expect(screen.getByText("Stroop Test Complete!")).toBeInTheDocument();

    // Results saved
    expect(resultsStore.hasItem("stroop")).toBe(true);
    const stats = resultsStore.getItem("stroop");
    expect(stats).toHaveProperty("interferenceScore");
    expect(stats).toHaveProperty("condition1");
    expect(stats).toHaveProperty("condition2");
    expect(stats).toHaveProperty("condition3");

    // onComplete after 1500ms
    expect(onComplete).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1500); });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test("practice round shows feedback badge", () => {
    render(<StroopTest onComplete={jest.fn()} />);

    // Navigate to practice round
    fireEvent.click(screen.getByText("Begin"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });
    answerTrials(C1_TRIALS);
    fireEvent.click(screen.getByText("Start Condition 2"));
    answerTrials(C2_TRIALS);
    fireEvent.click(screen.getByText("Start Practice"));

    // Practice round should show condition label
    expect(screen.getByText("Practice (Condition 3)")).toBeInTheDocument();

    // Answer and check for feedback
    answerTrial(100); // short delay to see feedback before it's cleared
    const feedback = screen.queryByText("✓ Correct") || screen.queryByText("✗ Wrong");
    expect(feedback).toBeInTheDocument();
  });

  test("buttons are disabled while not awaiting", () => {
    render(<StroopTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Begin"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });

    // Answer — buttons should become disabled during delay
    fireEvent.click(screen.getByRole("button", { name: "Red" }));
    for (const color of COLORS) {
      expect(screen.getByRole("button", { name: color })).toBeDisabled();
    }
  });
});
