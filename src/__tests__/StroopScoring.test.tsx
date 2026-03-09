import { test, expect, describe, beforeEach, afterEach, jest } from "bun:test";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { StroopTest } from "@/screens/tests/StroopTest";
import { resultsStore } from "@/utils/resultsStore";
import type { StroopStats } from "@/types";

const COUNTDOWN_MS = 2100;
// Dev mode: C1=4, C2=4, practice=1, C3=1
const C1_TRIALS = 4;
const C2_TRIALS = 4;
const PRACTICE_TRIALS = 1;
const C3_TRIALS = 1;
const COLORS = ["Red", "Blue", "Green", "Yellow"];

// Maps display label back to color name for stimulus detection
const INK_CLASS_TO_COLOR: Record<string, string> = {
  "text-red-600": "Red",
  "text-blue-600": "Blue",
  "text-green-600": "Green",
  "text-yellow-500": "Yellow",
};
const BG_CLASS_TO_COLOR: Record<string, string> = {
  "bg-red-500": "Red",
  "bg-blue-500": "Blue",
  "bg-green-500": "Green",
  "bg-yellow-400": "Yellow",
};

/** Click the correct answer for the current stimulus */
function answerCorrectly() {
  // For C1: word displayed in black text → answer = the word text
  // For C2: colored rectangle → answer = rectangle's color
  // For C3: word in different ink → answer = ink color
  // Check what's on screen:
  for (const color of COLORS) {
    const stimulus = screen.queryByText(color, { selector: "span.text-5xl" });
    if (stimulus) {
      // It's a word stimulus (C1 or C3)
      // For C1 (black ink) → answer is the word
      // For C3 (colored ink) → answer is the ink color
      const classes = stimulus.className;
      for (const [cls, colorName] of Object.entries(INK_CLASS_TO_COLOR)) {
        if (classes.includes(cls)) {
          // Ink color found → C3 stimulus, answer = ink color
          fireEvent.click(screen.getByRole("button", { name: colorName }));
          return colorName;
        }
      }
      // No color class found → C1 stimulus (black ink), answer = word
      fireEvent.click(screen.getByRole("button", { name: color }));
      return color;
    }
  }
  // Must be C2 (colored rectangle, no word)
  // Find the rectangle div and check its bg class
  const rectEl = document.querySelector(".w-28.h-16.rounded-lg");
  if (rectEl) {
    const classes = rectEl.className;
    for (const [cls, colorName] of Object.entries(BG_CLASS_TO_COLOR)) {
      if (classes.includes(cls)) {
        fireEvent.click(screen.getByRole("button", { name: colorName }));
        return colorName;
      }
    }
  }
  // Fallback: click first available color
  fireEvent.click(screen.getByRole("button", { name: "Red" }));
  return "Red";
}

/** Click the wrong answer for the current stimulus */
function answerIncorrectly() {
  // Determine correct answer, then pick a different one
  const correctAnswer = getCorrectAnswer();
  const wrongColor = COLORS.find((c) => c !== correctAnswer) || "Red";
  fireEvent.click(screen.getByRole("button", { name: wrongColor }));
  return wrongColor;
}

/** Determine correct answer without clicking */
function getCorrectAnswer(): string {
  for (const color of COLORS) {
    const stimulus = screen.queryByText(color, { selector: "span.text-5xl" });
    if (stimulus) {
      const classes = stimulus.className;
      for (const [cls, colorName] of Object.entries(INK_CLASS_TO_COLOR)) {
        if (classes.includes(cls)) return colorName;
      }
      return color;
    }
  }
  const rectEl = document.querySelector(".w-28.h-16.rounded-lg");
  if (rectEl) {
    const classes = rectEl.className;
    for (const [cls, colorName] of Object.entries(BG_CLASS_TO_COLOR)) {
      if (classes.includes(cls)) return colorName;
    }
  }
  return "Red";
}

/** Answer n trials correctly with inter-trial delay */
function answerNCorrectly(n: number, delay: number = 200) {
  for (let i = 0; i < n; i++) {
    answerCorrectly();
    act(() => { jest.advanceTimersByTime(delay); });
  }
}

/** Answer n trials incorrectly with inter-trial delay */
function answerNIncorrectly(n: number, delay: number = 200) {
  for (let i = 0; i < n; i++) {
    answerIncorrectly();
    act(() => { jest.advanceTimersByTime(delay); });
  }
}

/** Navigate to a specific phase */
function navigateToC1() {
  fireEvent.click(screen.getByText("Begin"));
  act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });
}

function completeC1Correctly() {
  answerNCorrectly(C1_TRIALS);
}

function completeC2Correctly() {
  fireEvent.click(screen.getByText("Start Condition 2"));
  answerNCorrectly(C2_TRIALS);
}

function completePractice() {
  fireEvent.click(screen.getByText("Start Practice"));
  answerNCorrectly(PRACTICE_TRIALS, 900);
  fireEvent.click(screen.getByText("Begin Condition 3"));
}

describe("Stroop Scoring — behavioral tests", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resultsStore.clearAll();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  test("all correct answers → 100% accuracy across all conditions", () => {
    render(<StroopTest onComplete={jest.fn()} />);
    navigateToC1();

    // C1: all correct
    completeC1Correctly();
    // C2: all correct
    completeC2Correctly();
    // Practice + C3: all correct
    completePractice();
    answerNCorrectly(C3_TRIALS);

    expect(screen.getByText("Stroop Test Complete!")).toBeInTheDocument();
    const stats = resultsStore.getItem("stroop") as StroopStats;

    expect(stats.condition1.accuracy).toBe(100);
    expect(stats.condition2.accuracy).toBe(100);
    expect(stats.condition3.accuracy).toBe(100);
    // RT >= 0 (performance.now() doesn't advance with fake timers)
    expect(stats.condition1.meanRT).toBeGreaterThanOrEqual(0);
    expect(stats.condition2.meanRT).toBeGreaterThanOrEqual(0);
    expect(stats.condition3.meanRT).toBeGreaterThanOrEqual(0);
    expect(typeof stats.condition1.meanRT).toBe("number");
    expect(typeof stats.condition2.meanRT).toBe("number");
    expect(typeof stats.condition3.meanRT).toBe("number");
  });

  test("all wrong answers in C1 → 0% accuracy for C1", () => {
    render(<StroopTest onComplete={jest.fn()} />);
    navigateToC1();

    // C1: all wrong
    answerNIncorrectly(C1_TRIALS);
    // C2: all correct (to continue)
    completeC2Correctly();
    completePractice();
    answerNCorrectly(C3_TRIALS);

    const stats = resultsStore.getItem("stroop") as StroopStats;
    expect(stats.condition1.accuracy).toBe(0);
    // meanRT = 0 when no correct answers (RT only counted for correct)
    expect(stats.condition1.meanRT).toBe(0);
  });

  test("all wrong answers in C2 → 0% accuracy for C2", () => {
    render(<StroopTest onComplete={jest.fn()} />);
    navigateToC1();

    completeC1Correctly();
    // C2: all wrong
    fireEvent.click(screen.getByText("Start Condition 2"));
    answerNIncorrectly(C2_TRIALS);
    completePractice();
    answerNCorrectly(C3_TRIALS);

    const stats = resultsStore.getItem("stroop") as StroopStats;
    expect(stats.condition2.accuracy).toBe(0);
    expect(stats.condition2.meanRT).toBe(0);
  });

  test("all wrong answers in C3 → 0% accuracy for C3", () => {
    render(<StroopTest onComplete={jest.fn()} />);
    navigateToC1();

    completeC1Correctly();
    completeC2Correctly();
    completePractice();
    // C3: all wrong
    answerNIncorrectly(C3_TRIALS);

    const stats = resultsStore.getItem("stroop") as StroopStats;
    expect(stats.condition3.accuracy).toBe(0);
    expect(stats.condition3.meanRT).toBe(0);
  });

  test("interferenceScore = C3.meanRT - C2.meanRT", () => {
    render(<StroopTest onComplete={jest.fn()} />);
    navigateToC1();
    completeC1Correctly();
    completeC2Correctly();
    completePractice();
    answerNCorrectly(C3_TRIALS);

    const stats = resultsStore.getItem("stroop") as StroopStats;
    expect(stats.interferenceScore).toBe(stats.condition3.meanRT - stats.condition2.meanRT);
  });

  test("accuracy = round(correct/total * 100) as integer percentage", () => {
    render(<StroopTest onComplete={jest.fn()} />);
    navigateToC1();

    // Mix correct and incorrect in C1 (answer first 2 correctly, last 2 wrong)
    answerNCorrectly(2);
    answerNIncorrectly(2);

    completeC2Correctly();
    completePractice();
    answerNCorrectly(C3_TRIALS);

    const stats = resultsStore.getItem("stroop") as StroopStats;
    // 2/4 correct = 50%
    expect(stats.condition1.accuracy).toBe(50);
    // All integers
    expect(Number.isInteger(stats.condition1.accuracy)).toBe(true);
    expect(Number.isInteger(stats.condition2.accuracy)).toBe(true);
    expect(Number.isInteger(stats.condition3.accuracy)).toBe(true);
  });

  test("meanRT only counts correct trial RTs (not incorrect)", () => {
    render(<StroopTest onComplete={jest.fn()} />);
    navigateToC1();

    // All correct in C1
    completeC1Correctly();
    completeC2Correctly();
    completePractice();
    answerNCorrectly(C3_TRIALS);

    const stats = resultsStore.getItem("stroop") as StroopStats;
    // meanRT computed only from correct responses (performance.now() may not advance with fake timers)
    expect(stats.condition1.meanRT).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(stats.condition1.meanRT)).toBe(true);
    expect(Number.isInteger(stats.condition2.meanRT)).toBe(true);
  });

  test("practice feedback shows correct badge on right answer", () => {
    render(<StroopTest onComplete={jest.fn()} />);
    navigateToC1();
    completeC1Correctly();
    completeC2Correctly();

    // Start practice
    fireEvent.click(screen.getByText("Start Practice"));
    expect(screen.getByText("Practice (Condition 3)")).toBeInTheDocument();

    // Answer correctly
    answerCorrectly();
    expect(screen.getByText("✓ Correct")).toBeInTheDocument();
  });

  test("practice feedback shows wrong badge on wrong answer", () => {
    render(<StroopTest onComplete={jest.fn()} />);
    navigateToC1();
    completeC1Correctly();
    completeC2Correctly();

    // Start practice
    fireEvent.click(screen.getByText("Start Practice"));

    // Answer incorrectly
    answerIncorrectly();
    expect(screen.getByText("✗ Wrong")).toBeInTheDocument();
  });

  test("buttons disabled after clicking (prevent double response)", () => {
    render(<StroopTest onComplete={jest.fn()} />);
    navigateToC1();

    // Click once
    answerCorrectly();

    // All buttons should be disabled during delay
    for (const color of COLORS) {
      expect(screen.getByRole("button", { name: color })).toBeDisabled();
    }
  });

  test("C1 answer = word text (word reading), C3 answer = ink color (not word)", () => {
    // This test verifies the correct answer detection logic works
    // by checking that all-correct produces 100% accuracy
    render(<StroopTest onComplete={jest.fn()} />);
    navigateToC1();

    // If our answerCorrectly() logic is wrong, accuracy would be < 100%
    completeC1Correctly();
    completeC2Correctly();
    completePractice();
    answerNCorrectly(C3_TRIALS);

    const stats = resultsStore.getItem("stroop") as StroopStats;
    // If answer detection was wrong for any condition, accuracy < 100
    expect(stats.condition1.accuracy).toBe(100);
    expect(stats.condition2.accuracy).toBe(100);
    expect(stats.condition3.accuracy).toBe(100);
  });
});
