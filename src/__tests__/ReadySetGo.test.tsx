import { test, expect, describe, beforeEach, afterEach, jest } from "bun:test";
import { render, screen, act, cleanup } from "@testing-library/react";
import { ReadySetGo } from "@/components/ReadySetGo";

describe("ReadySetGo", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  test("shows 'Ready' initially", () => {
    const onDone = jest.fn();
    render(<ReadySetGo onDone={onDone} />);
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  test("shows 'Set' after 800ms", () => {
    const onDone = jest.fn();
    render(<ReadySetGo onDone={onDone} />);

    act(() => { jest.advanceTimersByTime(800); });
    expect(screen.getByText("Set")).toBeInTheDocument();
  });

  test("shows 'Go!' after 1500ms", () => {
    const onDone = jest.fn();
    render(<ReadySetGo onDone={onDone} />);

    act(() => { jest.advanceTimersByTime(1500); });
    expect(screen.getByText("Go!")).toBeInTheDocument();
  });

  test("calls onDone after 2100ms", () => {
    const onDone = jest.fn();
    render(<ReadySetGo onDone={onDone} />);

    expect(onDone).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(2100); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test("full sequence: Ready → Set → Go! → onDone", () => {
    const onDone = jest.fn();
    render(<ReadySetGo onDone={onDone} />);

    expect(screen.getByText("Ready")).toBeInTheDocument();

    act(() => { jest.advanceTimersByTime(800); });
    expect(screen.getByText("Set")).toBeInTheDocument();

    act(() => { jest.advanceTimersByTime(700); }); // 1500 total
    expect(screen.getByText("Go!")).toBeInTheDocument();

    act(() => { jest.advanceTimersByTime(600); }); // 2100 total
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
