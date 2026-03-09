import { test, expect, describe, beforeEach, afterEach, jest } from "bun:test";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { PVTTest } from "@/screens/tests/PVTTest";
import { resultsStore } from "@/utils/resultsStore";

// Dev mode: TOTAL_TRIALS=1, MIN_ISI_MS=500, MAX_ISI_MS=1000
const COUNTDOWN_MS = 2100;
const MAX_ISI_DEV = 1000;

describe("PVTTest", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resultsStore.clearAll();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  test("shows instructions screen initially", () => {
    render(<PVTTest onComplete={jest.fn()} />);
    expect(screen.getByText("Psychomotor Vigilance (PVT)")).toBeInTheDocument();
    expect(screen.getByText("Start Test")).toBeInTheDocument();
  });

  test("instructions describe the task", () => {
    render(<PVTTest onComplete={jest.fn()} />);
    expect(screen.getByText(/red circle/)).toBeInTheDocument();
    expect(screen.getByText(/false start/)).toBeInTheDocument();
  });

  test("clicking Start Test transitions to countdown", () => {
    render(<PVTTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Start Test"));
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  test("after countdown, enters running phase", () => {
    render(<PVTTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Start Test"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });

    expect(screen.getByText(/Trial 1/)).toBeInTheDocument();
    expect(screen.getByText(/Wait for the red circle/)).toBeInTheDocument();
  });

  test("tapping before stimulus shows 'Too early!' flash", () => {
    render(<PVTTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Start Test"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });

    // Tap immediately (before stimulus) — false start
    const tapZone = screen.getByLabelText("Tap when the red circle appears");
    fireEvent.click(tapZone);

    expect(screen.getByText("Too early!")).toBeInTheDocument();
  });

  test("stimulus appears after ISI and tapping completes the trial", () => {
    const onComplete = jest.fn();
    render(<PVTTest onComplete={onComplete} />);

    fireEvent.click(screen.getByText("Start Test"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });

    // Advance past max ISI to ensure stimulus appears
    act(() => { jest.advanceTimersByTime(MAX_ISI_DEV + 100); });

    // Tap to record response
    const tapZone = screen.getByLabelText("Tap when the red circle appears");
    fireEvent.click(tapZone);

    // Dev mode: 1 trial → should complete
    act(() => { jest.advanceTimersByTime(100); });
    expect(screen.getByText("PVT Complete!")).toBeInTheDocument();

    // Results saved
    expect(resultsStore.hasItem("pvt")).toBe(true);
    const stats = resultsStore.getItem("pvt");
    expect((stats as { totalTrials: number }).totalTrials).toBe(1);

    // onComplete after 1500ms
    expect(onComplete).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1500); });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test("space key triggers tap during running phase", () => {
    render(<PVTTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Start Test"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });

    // Wait for stimulus
    act(() => { jest.advanceTimersByTime(MAX_ISI_DEV + 100); });

    fireEvent.keyDown(document, { code: "Space" });
    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByText("PVT Complete!")).toBeInTheDocument();
  });

  test("PVT stats include correct fields", () => {
    render(<PVTTest onComplete={jest.fn()} />);
    fireEvent.click(screen.getByText("Start Test"));
    act(() => { jest.advanceTimersByTime(COUNTDOWN_MS); });
    act(() => { jest.advanceTimersByTime(MAX_ISI_DEV + 100); });

    fireEvent.click(screen.getByLabelText("Tap when the red circle appears"));
    act(() => { jest.advanceTimersByTime(100); });

    const stats = resultsStore.getItem("pvt") as Record<string, unknown>;
    expect(stats).toHaveProperty("medianRT");
    expect(stats).toHaveProperty("meanRT");
    expect(stats).toHaveProperty("lapses");
    expect(stats).toHaveProperty("lapseRate");
    expect(stats).toHaveProperty("falseStarts");
    expect(stats).toHaveProperty("rts");
  });
});
