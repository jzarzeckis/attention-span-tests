import { test, expect, describe, beforeEach, afterEach, jest } from "bun:test";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { LandingScreen } from "@/screens/LandingScreen";
import { QuestionnaireScreen } from "@/screens/QuestionnaireScreen";
import { TestScreen } from "@/screens/TestScreen";
import { ResultsScreen } from "@/screens/ResultsScreen";
import { resultsStore } from "@/utils/resultsStore";
import type { SARTStats, StroopStats, PVTStats, GoNoGoStats } from "@/types";

// Good stats for populating the store
const goodSart: SARTStats = {
  commissionErrors: 2, commissionRate: 0.08, omissionErrors: 3,
  omissionRate: 0.015, meanRT: 350, rtCV: 0.2, totalTrials: 225,
};
const goodStroop: StroopStats = {
  condition1: { accuracy: 100, meanRT: 500 },
  condition2: { accuracy: 100, meanRT: 600 },
  condition3: { accuracy: 90, meanRT: 680 },
  interferenceScore: 80,
};
const goodPvt: PVTStats = {
  medianRT: 260, meanRT: 280, lapses: 1, lapseRate: 0.033,
  falseStarts: 0, totalTrials: 30, rts: [250, 260, 270],
};
const goodGonogo: GoNoGoStats = {
  commissionErrors: 2, commissionErrorRate: 0.1, omissionErrors: 1,
  omissionErrorRate: 0.0125, meanRT: 300, rtCV: 0.15,
  totalTrials: 100, goTrials: 80, nogoTrials: 20,
};

describe("LandingScreen", () => {
  afterEach(() => { cleanup(); });

  test("shows title and start button", () => {
    render(<LandingScreen onStart={jest.fn()} hasProgress={false} onContinue={jest.fn()} onStartOver={jest.fn()} onViewScoreboard={jest.fn()} />);
    expect(screen.getByText("Brainrot Meter")).toBeInTheDocument();
    expect(screen.getByText("Check my brainrot")).toBeInTheDocument();
  });

  test("shows test list", () => {
    render(<LandingScreen onStart={jest.fn()} hasProgress={false} onContinue={jest.fn()} onStartOver={jest.fn()} onViewScoreboard={jest.fn()} />);
    expect(screen.getByText("Sustained Attention (SART)")).toBeInTheDocument();
    expect(screen.getByText("Stroop Color-Word")).toBeInTheDocument();
    expect(screen.getByText("Psychomotor Vigilance (PVT)")).toBeInTheDocument();
    expect(screen.getByText("Go/No-Go")).toBeInTheDocument();
  });

  test("calls onStart when clicking start button", () => {
    const onStart = jest.fn();
    render(<LandingScreen onStart={onStart} hasProgress={false} onContinue={jest.fn()} onStartOver={jest.fn()} onViewScoreboard={jest.fn()} />);
    fireEvent.click(screen.getByText("Check my brainrot"));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  test("shows continue and start over buttons when has progress", () => {
    render(<LandingScreen onStart={jest.fn()} hasProgress={true} onContinue={jest.fn()} onStartOver={jest.fn()} onViewScoreboard={jest.fn()} />);
    expect(screen.getByText("Continue where you left off")).toBeInTheDocument();
    expect(screen.getByText("Start over")).toBeInTheDocument();
  });

  test("calls onContinue and onStartOver correctly", () => {
    const onContinue = jest.fn();
    const onStartOver = jest.fn();
    render(<LandingScreen onStart={jest.fn()} hasProgress={true} onContinue={onContinue} onStartOver={onStartOver} onViewScoreboard={jest.fn()} />);

    fireEvent.click(screen.getByText("Continue where you left off"));
    expect(onContinue).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Start over"));
    expect(onStartOver).toHaveBeenCalledTimes(1);
  });
});

describe("QuestionnaireScreen", () => {
  afterEach(() => { cleanup(); });

  test("shows all questions including nickname field", () => {
    render(<QuestionnaireScreen onComplete={jest.fn()} onSkip={jest.fn()} />);
    expect(screen.getByText("How old are you?")).toBeInTheDocument();
    expect(screen.getByText(/Daily TikTok/)).toBeInTheDocument();
    expect(screen.getByText(/restless/)).toBeInTheDocument();
    expect(screen.getByText(/rate your own attention/)).toBeInTheDocument();
    expect(screen.getByText(/Total daily screen time/)).toBeInTheDocument();
    expect(screen.getByText("Leaderboard nickname")).toBeInTheDocument();
  });

  test("Start Tests button is disabled until all required fields filled", () => {
    render(<QuestionnaireScreen onComplete={jest.fn()} onSkip={jest.fn()} />);
    const startBtn = screen.getByText("Start Tests");
    expect(startBtn).toBeDisabled();
  });

  test("skip link calls onSkip", () => {
    const onSkip = jest.fn();
    render(<QuestionnaireScreen onComplete={jest.fn()} onSkip={onSkip} />);
    fireEvent.click(screen.getByText("Skip survey and go straight to tests"));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  test("filling all fields enables Start Tests and submits data", () => {
    const onComplete = jest.fn();
    render(<QuestionnaireScreen onComplete={onComplete} onSkip={jest.fn()} />);

    // Select age
    fireEvent.click(screen.getByText("21+"));
    // Select short form usage
    fireEvent.click(screen.getByText("Less than 30 min"));
    // Select restlessness
    fireEvent.click(screen.getByText("Rarely"));
    // Select screen time
    fireEvent.click(screen.getByText("Less than 2 hrs"));

    const startBtn = screen.getByText("Start Tests");
    expect(startBtn).not.toBeDisabled();
    fireEvent.click(startBtn);
    expect(onComplete).toHaveBeenCalledTimes(1);

    // Self-report saved
    expect(resultsStore.hasItem("selfReport")).toBe(true);
  });

  test("nickname is saved in selfReport when provided", () => {
    const onComplete = jest.fn();
    render(<QuestionnaireScreen onComplete={onComplete} onSkip={jest.fn()} />);

    fireEvent.click(screen.getByText("21+"));
    fireEvent.click(screen.getByText("Less than 30 min"));
    fireEvent.click(screen.getByText("Rarely"));
    fireEvent.click(screen.getByText("Less than 2 hrs"));

    const nicknameInput = screen.getByPlaceholderText(/BrainrotKing99/);
    fireEvent.change(nicknameInput, { target: { value: "TestPlayer" } });

    fireEvent.click(screen.getByText("Start Tests"));

    const saved = resultsStore.getItem("selfReport");
    expect(saved?.nickname).toBe("TestPlayer");
  });

  test("nickname is optional — submits without it and selfReport has no nickname", () => {
    const onComplete = jest.fn();
    render(<QuestionnaireScreen onComplete={onComplete} onSkip={jest.fn()} />);

    fireEvent.click(screen.getByText("21+"));
    fireEvent.click(screen.getByText("Less than 30 min"));
    fireEvent.click(screen.getByText("Rarely"));
    fireEvent.click(screen.getByText("Less than 2 hrs"));

    fireEvent.click(screen.getByText("Start Tests"));

    const saved = resultsStore.getItem("selfReport");
    expect(saved?.nickname).toBeUndefined();
  });
});

describe("TestScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resultsStore.clearAll();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  test("shows test progress indicator", () => {
    render(<TestScreen testIndex={0} onNext={jest.fn()} />);
    expect(screen.getByText("Test 1 of 4")).toBeInTheDocument();
  });

  test("shows skip button", () => {
    render(<TestScreen testIndex={0} onNext={jest.fn()} />);
    expect(screen.getByText("Skip this test")).toBeInTheDocument();
  });

  test("skipping stores skipped result and calls onNext", () => {
    const onNext = jest.fn();
    render(<TestScreen testIndex={0} onNext={onNext} />);

    fireEvent.click(screen.getByText("Skip this test"));

    expect(resultsStore.hasItem("sart")).toBe(true);
    expect(resultsStore.getItem("sart")).toEqual({ skipped: true });
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  test("renders correct test component based on index", () => {
    render(<TestScreen testIndex={0} onNext={jest.fn()} />);
    // SART title appears both in progress bar and card title
    expect(screen.getAllByText("Sustained Attention (SART)").length).toBeGreaterThanOrEqual(1);
  });

  test("renders Stroop for index 1", () => {
    render(<TestScreen testIndex={1} onNext={jest.fn()} />);
    expect(screen.getByText("Stroop Color-Word Test")).toBeInTheDocument();
  });

  test("renders PVT for index 2", () => {
    render(<TestScreen testIndex={2} onNext={jest.fn()} />);
    expect(screen.getAllByText("Psychomotor Vigilance (PVT)").length).toBeGreaterThanOrEqual(1);
  });

  test("renders GoNoGo for index 3", () => {
    render(<TestScreen testIndex={3} onNext={jest.fn()} />);
    expect(screen.getByText("Go/No-Go Task")).toBeInTheDocument();
  });

  test("shows assistance toggle button", () => {
    render(<TestScreen testIndex={0} onNext={jest.fn()} />);
    expect(screen.getByLabelText("Toggle assistance")).toBeInTheDocument();
  });

  test("skip does not overwrite existing results", () => {
    resultsStore.setItem("sart", goodSart);
    const onNext = jest.fn();
    render(<TestScreen testIndex={0} onNext={onNext} />);

    fireEvent.click(screen.getByText("Skip this test"));
    // Should still have original stats, not skipped
    expect(resultsStore.getItem("sart")).toEqual(goodSart);
  });
});

describe("ResultsScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resultsStore.clearAll();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  test("shows 'No results yet' when no tests completed", () => {
    render(<ResultsScreen onRestart={jest.fn()} onViewScoreboard={jest.fn()} />);
    expect(screen.getByText("No results yet")).toBeInTheDocument();
  });

  test("shows composite score and rank with completed tests", () => {
    resultsStore.setItem("sart", goodSart);
    resultsStore.setItem("stroop", goodStroop);
    resultsStore.setItem("pvt", goodPvt);
    resultsStore.setItem("gonogo", goodGonogo);

    render(<ResultsScreen onRestart={jest.fn()} onViewScoreboard={jest.fn()} />);

    expect(screen.getByText("Attention Score")).toBeInTheDocument();
    expect(screen.getByText("Based on 4 of 4 tests")).toBeInTheDocument();
  });

  test("shows test detail cards for completed tests", () => {
    resultsStore.setItem("sart", goodSart);
    render(<ResultsScreen onRestart={jest.fn()} onViewScoreboard={jest.fn()} />);
    expect(screen.getByText("Sustained Attention (SART)")).toBeInTheDocument();
  });

  test("shows skipped card for skipped tests", () => {
    resultsStore.setItem("sart", { skipped: true });
    render(<ResultsScreen onRestart={jest.fn()} onViewScoreboard={jest.fn()} />);
    expect(screen.getByText("Skipped")).toBeInTheDocument();
  });

  test("shows shared results banner when isShared", () => {
    resultsStore.setItem("sart", goodSart);
    render(<ResultsScreen onRestart={jest.fn()} onViewScoreboard={jest.fn()} isShared={true} />);
    expect(screen.getByText("You're viewing someone else's results")).toBeInTheDocument();
    expect(screen.getByText("Take the test yourself →")).toBeInTheDocument();
  });

  test("restart button calls onRestart", () => {
    resultsStore.setItem("sart", goodSart);
    const onRestart = jest.fn();
    render(<ResultsScreen onRestart={onRestart} onViewScoreboard={jest.fn()} />);
    fireEvent.click(screen.getByText("Take Test Again"));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  test("scoreboard button calls onViewScoreboard", () => {
    resultsStore.setItem("sart", goodSart);
    const onViewScoreboard = jest.fn();
    render(<ResultsScreen onRestart={jest.fn()} onViewScoreboard={onViewScoreboard} />);
    fireEvent.click(screen.getByText("View Scoreboard"));
    expect(onViewScoreboard).toHaveBeenCalledTimes(1);
  });

  test("shows self-report context when selfReport and composite exist", () => {
    resultsStore.setItem("sart", goodSart);
    resultsStore.setItem("selfReport", {
      age: "21+",
      shortFormUsage: "Less than 30 min",
      restlessness: "Rarely",
      selfRatedAttention: 4,
      screenTime: "Less than 2 hrs",
    });
    render(<ResultsScreen onRestart={jest.fn()} onViewScoreboard={jest.fn()} />);
    expect(screen.getByText("Your self-report context")).toBeInTheDocument();
  });

  test("shows leaderboard submit when all 4 tests completed and not shared", () => {
    resultsStore.setItem("sart", goodSart);
    resultsStore.setItem("stroop", goodStroop);
    resultsStore.setItem("pvt", goodPvt);
    resultsStore.setItem("gonogo", goodGonogo);
    render(<ResultsScreen onRestart={jest.fn()} onViewScoreboard={jest.fn()} isShared={false} />);
    expect(screen.getByText("Submit to Scoreboard")).toBeInTheDocument();
  });

  test("shows auto-submitting message when selfReport has nickname and all 4 tests done", () => {
    resultsStore.setItem("sart", goodSart);
    resultsStore.setItem("stroop", goodStroop);
    resultsStore.setItem("pvt", goodPvt);
    resultsStore.setItem("gonogo", goodGonogo);
    resultsStore.setItem("selfReport", {
      age: "21+",
      shortFormUsage: "Less than 30 min",
      restlessness: "Rarely",
      selfRatedAttention: 4,
      screenTime: "Less than 2 hrs",
      nickname: "AutoPlayer",
    });

    // Mock fetch to keep it pending so we can observe the "submitting" state
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;

    render(<ResultsScreen onRestart={jest.fn()} onViewScoreboard={jest.fn()} isShared={false} />);

    // Should show auto-submitting message with the nickname
    expect(screen.getByText(/AutoPlayer/)).toBeInTheDocument();
    // Manual form should not be visible when auto-submitting
    expect(screen.queryByText("Submit to Scoreboard")).not.toBeInTheDocument();

    global.fetch = originalFetch;
  });

  test("shows mini leaderboard loading state when all 4 tests completed", () => {
    resultsStore.setItem("sart", goodSart);
    resultsStore.setItem("stroop", goodStroop);
    resultsStore.setItem("pvt", goodPvt);
    resultsStore.setItem("gonogo", goodGonogo);

    // Mock fetch to stay pending so we stay in loading state
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;

    render(<ResultsScreen onRestart={jest.fn()} onViewScoreboard={jest.fn()} isShared={false} />);

    expect(screen.getByText("Loading leaderboard...")).toBeInTheDocument();

    global.fetch = originalFetch;
  });

  test("mini leaderboard not shown for shared results", () => {
    resultsStore.setItem("sart", goodSart);
    resultsStore.setItem("stroop", goodStroop);
    resultsStore.setItem("pvt", goodPvt);
    resultsStore.setItem("gonogo", goodGonogo);

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;

    render(<ResultsScreen onRestart={jest.fn()} onViewScoreboard={jest.fn()} isShared={true} />);

    expect(screen.queryByText("Loading leaderboard...")).not.toBeInTheDocument();

    global.fetch = originalFetch;
  });

  test("does not show leaderboard submit for shared results", () => {
    resultsStore.setItem("sart", goodSart);
    resultsStore.setItem("stroop", goodStroop);
    resultsStore.setItem("pvt", goodPvt);
    resultsStore.setItem("gonogo", goodGonogo);
    render(<ResultsScreen onRestart={jest.fn()} onViewScoreboard={jest.fn()} isShared={true} />);
    expect(screen.queryByText("Submit to Scoreboard")).not.toBeInTheDocument();
  });

  test("shows partial results message when not all tests completed", () => {
    resultsStore.setItem("sart", goodSart);
    resultsStore.setItem("stroop", { skipped: true });
    render(<ResultsScreen onRestart={jest.fn()} onViewScoreboard={jest.fn()} />);
    expect(screen.getByText(/Complete all 4 tests/)).toBeInTheDocument();
  });
});
