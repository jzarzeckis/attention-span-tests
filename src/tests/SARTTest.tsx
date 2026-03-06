import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TARGET_DIGIT = 3;
const STIMULUS_DURATION = 250; // ms digit is shown
const MASK_DURATION = 900; // ms mask/blank between digits
const TRIAL_INTERVAL = STIMULUS_DURATION + MASK_DURATION; // ~1150ms total per trial
const CYCLES = 25;
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const TOTAL_TRIALS = CYCLES * DIGITS.length; // 225
const PRACTICE_TRIALS = 9; // 1 cycle

export interface SARTResult {
  commissionErrors: number; // tapping on 3
  omissionErrors: number; // missing a non-3 digit
  totalTrials: number;
  targetTrials: number; // how many times 3 appeared
  nonTargetTrials: number;
  reactionTimes: number[]; // RTs for correct Go responses
  meanRT: number;
  rtVariability: number; // coefficient of variation (SD/mean)
  commissionErrorRate: number;
  omissionErrorRate: number;
}

type Phase = "instructions" | "practice" | "practice-feedback" | "ready" | "running" | "done";

interface TrialData {
  digit: number;
  responded: boolean;
  rt: number | null; // ms, null if no response
  correct: boolean;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

function generateTrials(cycles: number): number[] {
  const trials: number[] = [];
  for (let c = 0; c < cycles; c++) {
    trials.push(...shuffleArray(DIGITS));
  }
  return trials;
}

function computeResults(trialData: TrialData[]): SARTResult {
  const targetTrials = trialData.filter((t) => t.digit === TARGET_DIGIT);
  const nonTargetTrials = trialData.filter((t) => t.digit !== TARGET_DIGIT);

  const commissionErrors = targetTrials.filter((t) => t.responded).length;
  const omissionErrors = nonTargetTrials.filter((t) => !t.responded).length;

  const correctGoRTs = nonTargetTrials
    .filter((t) => t.responded && t.rt !== null)
    .map((t) => t.rt!);

  const meanRT = correctGoRTs.length > 0
    ? correctGoRTs.reduce((a, b) => a + b, 0) / correctGoRTs.length
    : 0;

  const rtSD = correctGoRTs.length > 1
    ? Math.sqrt(
        correctGoRTs.reduce((sum, rt) => sum + (rt - meanRT) ** 2, 0) /
          (correctGoRTs.length - 1)
      )
    : 0;

  const rtVariability = meanRT > 0 ? rtSD / meanRT : 0;

  return {
    commissionErrors,
    omissionErrors,
    totalTrials: trialData.length,
    targetTrials: targetTrials.length,
    nonTargetTrials: nonTargetTrials.length,
    reactionTimes: correctGoRTs,
    meanRT: Math.round(meanRT),
    rtVariability: Math.round(rtVariability * 1000) / 1000,
    commissionErrorRate:
      Math.round((commissionErrors / targetTrials.length) * 1000) / 10,
    omissionErrorRate:
      Math.round((omissionErrors / nonTargetTrials.length) * 1000) / 10,
  };
}

interface SARTTestProps {
  onComplete: (result: SARTResult) => void;
}

export function SARTTest({ onComplete }: SARTTestProps) {
  const [phase, setPhase] = useState<Phase>("instructions");
  const [trials, setTrials] = useState<number[]>([]);
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [showDigit, setShowDigit] = useState(false);
  const [trialData, setTrialData] = useState<TrialData[]>([]);
  const [practiceData, setPracticeData] = useState<TrialData[]>([]);
  const [responded, setResponded] = useState(false);

  const trialStartTime = useRef(0);
  const responseRef = useRef(false);
  const rtRef = useRef<number | null>(null);

  // Generate trials when phase changes
  useEffect(() => {
    if (phase === "practice") {
      setTrials(generateTrials(1));
      setCurrentTrialIndex(0);
      setTrialData([]);
      setPracticeData([]);
      setResponded(false);
    } else if (phase === "running") {
      setTrials(generateTrials(CYCLES));
      setCurrentTrialIndex(0);
      setTrialData([]);
      setResponded(false);
    }
  }, [phase]);

  // Trial loop
  useEffect(() => {
    if (phase !== "practice" && phase !== "running") return;
    const maxTrials = phase === "practice" ? PRACTICE_TRIALS : TOTAL_TRIALS;
    if (currentTrialIndex >= maxTrials || currentTrialIndex >= trials.length) return;

    responseRef.current = false;
    rtRef.current = null;
    setResponded(false);
    setShowDigit(true);
    trialStartTime.current = performance.now();

    // Hide digit after stimulus duration
    const hideTimer = setTimeout(() => {
      setShowDigit(false);
    }, STIMULUS_DURATION);

    // Move to next trial after full interval
    const nextTimer = setTimeout(() => {
      const digit = trials[currentTrialIndex]!;
      const trial: TrialData = {
        digit,
        responded: responseRef.current,
        rt: rtRef.current,
        correct: digit === TARGET_DIGIT ? !responseRef.current : responseRef.current,
      };

      if (phase === "practice") {
        setPracticeData((prev) => [...prev, trial]);
      } else {
        setTrialData((prev) => [...prev, trial]);
      }

      const nextIndex = currentTrialIndex + 1;
      if (nextIndex >= maxTrials) {
        if (phase === "practice") {
          setPhase("practice-feedback");
        } else {
          setPhase("done");
        }
      } else {
        setCurrentTrialIndex(nextIndex);
      }
    }, TRIAL_INTERVAL);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(nextTimer);
    };
  }, [phase, currentTrialIndex, trials]);

  // Handle response
  const handleTap = useCallback(() => {
    if (phase !== "practice" && phase !== "running") return;
    if (responseRef.current) return; // already responded this trial

    responseRef.current = true;
    rtRef.current = performance.now() - trialStartTime.current;
    setResponded(true);
  }, [phase]);

  // Compute and store results when done
  useEffect(() => {
    if (phase === "done" && trialData.length === TOTAL_TRIALS) {
      const result = computeResults(trialData);
      onComplete(result);
    }
  }, [phase, trialData, onComplete]);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleTap]);

  if (phase === "instructions") {
    return (
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle className="text-2xl">Sustained Attention (SART)</CardTitle>
          <CardDescription>Test your ability to maintain focus</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center space-y-6">
          <div className="space-y-4 text-sm sm:text-base">
            <p>
              Digits from <strong>1 to 9</strong> will appear one at a time on screen.
            </p>
            <p>
              <strong>Tap the screen</strong> (or press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Space</kbd>) for{" "}
              <strong>every digit EXCEPT 3</strong>.
            </p>
            <p>
              When you see <span className="text-2xl font-bold text-destructive">3</span>,{" "}
              <strong>do NOT tap</strong>. Try to resist the urge!
            </p>
            <p className="text-muted-foreground text-sm">
              The test has 225 trials and takes about 4-5 minutes. We'll start with a quick 9-trial practice round.
            </p>
          </div>
          <Button size="lg" className="w-full" onClick={() => setPhase("practice")}>
            Start Practice Round
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === "practice-feedback") {
    const correct = practiceData.filter((t) => t.correct).length;
    return (
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle className="text-xl">Practice Complete</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center space-y-6">
          <div className="text-center space-y-2">
            <p className="text-lg">
              You got <strong>{correct}</strong> out of <strong>{PRACTICE_TRIALS}</strong> correct.
            </p>
            <p className="text-sm text-muted-foreground">
              Remember: tap for every digit <strong>except 3</strong>.
            </p>
          </div>
          <Button size="lg" className="w-full" onClick={() => setPhase("ready")}>
            Start Full Test
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === "ready") {
    return (
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle className="text-xl">Ready?</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center space-y-6">
          <p className="text-center text-muted-foreground">
            The full test has 225 trials. Tap for every digit except <strong>3</strong>.
          </p>
          <Button size="lg" className="w-full" onClick={() => setPhase("running")}>
            Begin
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === "done") {
    return (
      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-lg text-muted-foreground">Processing results...</p>
        </CardContent>
      </Card>
    );
  }

  // Running phase (practice or full test)
  const maxTrials = phase === "practice" ? PRACTICE_TRIALS : TOTAL_TRIALS;
  const currentDigit = trials[currentTrialIndex];

  return (
    <div
      className="flex-1 flex flex-col select-none cursor-pointer"
      onPointerDown={(e) => {
        e.preventDefault();
        handleTap();
      }}
    >
      <div className="text-center text-xs text-muted-foreground py-2">
        {phase === "practice" ? "Practice" : `Trial ${currentTrialIndex + 1} / ${maxTrials}`}
        {" "}&middot; Tap for every digit except 3
      </div>
      <div className="flex-1 flex items-center justify-center">
        {showDigit ? (
          <span
            className={`text-8xl sm:text-9xl font-bold transition-none ${
              responded ? "text-muted-foreground/50" : "text-foreground"
            }`}
          >
            {currentDigit}
          </span>
        ) : (
          <span className="text-6xl text-muted-foreground/30">+</span>
        )}
      </div>
    </div>
  );
}
