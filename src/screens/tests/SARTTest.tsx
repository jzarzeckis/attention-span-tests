import { useState, useRef, useEffect, useCallback } from "react";
import { resultsStore } from "@/utils/resultsStore";
import type { SARTStats } from "@/types";
export type { SARTStats };
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ReadySetGo } from "@/components/ReadySetGo";

const STIMULUS_MS = 250;
const TRIAL_MS = 1150;
const TARGET_DIGIT = 3;
const IS_DEV = process.env.NODE_ENV !== "production";
const PRACTICE_CYCLES = 1; // 9 trials
const MAIN_CYCLES = IS_DEV ? 1 : 25; // dev: 9 trials, prod: 225 trials

type Phase = "instructions" | "countdown" | "practice" | "practice-done" | "complete" | "main";

interface TrialRecord {
  digit: number;
  tapped: boolean;
  rt: number | null;
}


function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = temp;
  }
  return a;
}

function makeSequence(cycles: number): number[] {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const seq: number[] = [];
  for (let i = 0; i < cycles; i++) seq.push(...shuffle(digits));
  return seq;
}

function calcStats(records: TrialRecord[]): SARTStats {
  const targets = records.filter((r) => r.digit === TARGET_DIGIT);
  const nonTargets = records.filter((r) => r.digit !== TARGET_DIGIT);
  const commissionErrors = targets.filter((r) => r.tapped).length;
  const omissionErrors = nonTargets.filter((r) => !r.tapped).length;
  const correctRTs = nonTargets
    .filter((r) => r.tapped && r.rt !== null)
    .map((r) => r.rt as number);
  const meanRT =
    correctRTs.length > 0
      ? correctRTs.reduce((a, b) => a + b, 0) / correctRTs.length
      : 0;
  const variance =
    correctRTs.length > 1
      ? correctRTs.reduce((sum, rt) => sum + (rt - meanRT) ** 2, 0) /
        (correctRTs.length - 1)
      : 0;
  const sd = Math.sqrt(variance);
  return {
    commissionErrors,
    commissionRate: targets.length > 0 ? commissionErrors / targets.length : 0,
    omissionErrors,
    omissionRate: nonTargets.length > 0 ? omissionErrors / nonTargets.length : 0,
    meanRT: Math.round(meanRT),
    rtCV: meanRT > 0 ? Math.round((sd / meanRT) * 100) / 100 : 0,
    totalTrials: records.length,
  };
}

interface Props {
  onComplete: () => void;
}

export function SARTTest({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("instructions");
  const pendingPhase = useRef<"practice" | "main">("practice");
  const [trialIdx, setTrialIdx] = useState(0);
  const [totalTrials, setTotalTrials] = useState(0);
  const [digitVisible, setDigitVisible] = useState(false);
  const [currentDigit, setCurrentDigit] = useState<number | null>(null);
  const [lastFeedback, setLastFeedback] = useState<"correct" | "error" | null>(null);
  const [practiceStats, setPracticeStats] = useState<SARTStats | null>(null);

  // Refs for mutable trial state (safe to use in setTimeout callbacks)
  const phaseRef = useRef<Phase>("instructions");
  const seqRef = useRef<number[]>([]);
  const recordsRef = useRef<TrialRecord[]>([]);
  const tappedRef = useRef(false);
  const tapRTRef = useRef<number | null>(null);
  const rtStartRef = useRef(0);
  const activeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    activeTimers.current.forEach((t) => clearTimeout(t));
    activeTimers.current = [];
  }, []);

  // runTrial is stored in a ref so recursive setTimeout calls always use the
  // latest closure without stale captures.
  const runTrialRef = useRef<((idx: number) => void) | undefined>(undefined);

  runTrialRef.current = (idx: number) => {
    const seq = seqRef.current;
    const currentPhase = phaseRef.current;

    if (idx >= seq.length) {
      const stats = calcStats(recordsRef.current);
      if (currentPhase === "practice") {
        setPracticeStats(stats);
        setPhase("practice-done");
        phaseRef.current = "practice-done";
      } else {
        resultsStore.setItem("sart", stats);
        setPhase("complete");
        phaseRef.current = "complete";
      }
      return;
    }

    const digit = seq[idx] as number;
    tappedRef.current = false;
    tapRTRef.current = null;
    rtStartRef.current = performance.now();

    setCurrentDigit(digit);
    setDigitVisible(true);
    setTrialIdx(idx);
    if (currentPhase === "practice") setLastFeedback(null);

    const t1 = setTimeout(() => {
      setDigitVisible(false);
    }, STIMULUS_MS);

    const t2 = setTimeout(() => {
      const record: TrialRecord = {
        digit,
        tapped: tappedRef.current,
        rt: tapRTRef.current,
      };
      recordsRef.current = [...recordsRef.current, record];

      if (phaseRef.current === "practice") {
        const isTarget = digit === TARGET_DIGIT;
        const correct = isTarget ? !tappedRef.current : tappedRef.current;
        setLastFeedback(correct ? "correct" : "error");
      }

      runTrialRef.current!(idx + 1);
    }, TRIAL_MS);

    activeTimers.current = [t1, t2];
  };

  const startPhase = useCallback(
    (newPhase: "practice" | "main") => {
      clearTimers();
      const cycles = newPhase === "practice" ? PRACTICE_CYCLES : MAIN_CYCLES;
      const seq = makeSequence(cycles);
      seqRef.current = seq;
      recordsRef.current = [];
      phaseRef.current = newPhase;
      setTotalTrials(seq.length);
      setPhase(newPhase);
      setLastFeedback(null);
      setTrialIdx(0);
      runTrialRef.current!(0);
    },
    [clearTimers]
  );

  const handleTap = useCallback(() => {
    if (phaseRef.current !== "practice" && phaseRef.current !== "main") return;
    if (tappedRef.current) return;
    tappedRef.current = true;
    tapRTRef.current = performance.now() - rtStartRef.current;
  }, []);

  useEffect(() => {
    if (phase === "complete") {
      const t = setTimeout(onComplete, 1500);
      return () => clearTimeout(t);
    }
  }, [phase, onComplete]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        handleTap();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleTap]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  if (phase === "instructions") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sustained Attention (SART)</CardTitle>
          <CardDescription>~5 minutes · 225 trials</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Digits 1–9 will flash on screen one at a time.</p>
          <p>
            <strong>
              Tap or press <kbd className="font-mono bg-muted px-1 rounded text-xs">Space</kbd> for every digit EXCEPT{" "}
              <span className="text-3xl font-bold">{TARGET_DIGIT}</span>.
            </strong>
          </p>
          <p>
            When you see a <strong>{TARGET_DIGIT}</strong>, do{" "}
            <strong>NOT</strong> respond — hold back.
          </p>
          <p>Respond as quickly as possible. Each digit appears briefly.</p>
          <p className="text-muted-foreground">
            First, we'll do a short 9-trial practice round.
          </p>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            size="lg"
            onClick={() => { pendingPhase.current = "practice"; setPhase("countdown"); }}
          >
            Start Practice
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (phase === "countdown") {
    return <ReadySetGo onDone={() => startPhase(pendingPhase.current)} />;
  }

  if (phase === "practice" || phase === "main") {
    const isPractice = phase === "practice";
    const progress = totalTrials > 0 ? (trialIdx / totalTrials) * 100 : 0;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground min-h-[1.5rem]">
          <span>
            {isPractice ? "Practice" : `Trial ${trialIdx + 1} / ${totalTrials}`}
          </span>
          {isPractice && lastFeedback && (
            <Badge
              variant={lastFeedback === "correct" ? "default" : "destructive"}
            >
              {lastFeedback === "correct" ? "✓ Correct" : "✗ Error"}
            </Badge>
          )}
        </div>

        {!isPractice && <Progress value={progress} />}

        {/* Tap zone — entire area is interactive */}
        <button
          onClick={handleTap}
          className="w-full h-64 rounded-xl bg-muted flex items-center justify-center select-none focus:outline-none active:scale-95 transition-transform cursor-pointer"
          aria-label="Tap here when you see a non-3 digit"
        >
          {digitVisible && currentDigit !== null ? (
            <span className="text-9xl font-bold tabular-nums leading-none">
              {currentDigit}
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">
              Tap / Space for every digit except 3
            </span>
          )}
        </button>

        {isPractice && (
          <p className="text-center text-xs text-muted-foreground">
            Tap for every digit except <strong>3</strong>
          </p>
        )}
      </div>
    );
  }

  if (phase === "practice-done") {
    const errors = practiceStats
      ? practiceStats.commissionErrors + practiceStats.omissionErrors
      : 0;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Practice Complete!</CardTitle>
          <CardDescription>
            {errors === 0
              ? "Great job! You got them all right."
              : `You made ${errors} error${errors !== 1 ? "s" : ""}. Keep your focus!`}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            The real test is <strong>225 trials</strong>. No feedback will be
            shown during the test.
          </p>
          <p>
            Remember: tap or press Space for <strong>all digits except {TARGET_DIGIT}</strong>.
          </p>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            size="lg"
            onClick={() => { pendingPhase.current = "main"; setPhase("countdown"); }}
          >
            Begin Test
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (phase === "complete") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SART Complete!</CardTitle>
          <CardDescription>Your results have been saved.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Moving to the next test…
          </p>
        </CardContent>
      </Card>
    );
  }

  return null;
}
