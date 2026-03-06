import { useState, useEffect } from "react";
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

// Delays in days to test
const DELAYS = [1, 7, 30, 180, 365];
const DELAYED_AMOUNT = 100; // always $100 delayed
const ROUNDS_PER_DELAY = 5; // bisection rounds per delay
const TOTAL_TRIALS = DELAYS.length * ROUNDS_PER_DELAY; // 25

type Phase = "instructions" | "testing" | "complete";

export interface DelayDiscountingStats {
  indifferencePoints: { delay: number; amount: number; k: number }[];
  medianK: number;
  totalTrials: number;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
    : (sorted[mid] as number);
}

function formatDelay(days: number): string {
  if (days === 1) return "1 day";
  if (days < 7) return `${days} days`;
  if (days === 7) return "1 week";
  if (days < 30) return `${days} days`;
  if (days === 30) return "1 month";
  if (days < 365) return `${days} days`;
  return "1 year";
}

interface Props {
  onComplete: () => void;
}

export function DelayDiscountingTest({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("instructions");
  const [delayIndex, setDelayIndex] = useState(0);
  const [round, setRound] = useState(0);
  const [lo, setLo] = useState(1);
  const [hi, setHi] = useState(99);
  const [results, setResults] = useState<
    { delay: number; amount: number; k: number }[]
  >([]);

  const trialsComplete = delayIndex * ROUNDS_PER_DELAY + round;
  const currentDelay = DELAYS[delayIndex] as number;
  const immediateAmount = Math.round((lo + hi) / 2);
  const progressPercent = (trialsComplete / TOTAL_TRIALS) * 100;

  const handleChoice = (choseNow: boolean) => {
    let newLo = lo;
    let newHi = hi;

    if (choseNow) {
      // User accepted this immediate amount — indifference might be lower
      newHi = immediateAmount;
    } else {
      // User preferred to wait — immediate amount wasn't enough
      newLo = immediateAmount;
    }

    const nextRound = round + 1;

    if (nextRound >= ROUNDS_PER_DELAY) {
      // Finished bisection for this delay
      const indifference = (newLo + newHi) / 2;
      // Hyperbolic model: V = A / (1 + k*D) => k = (A/V - 1) / D
      const k =
        indifference > 0
          ? (DELAYED_AMOUNT / indifference - 1) / currentDelay
          : 999;

      const newResults = [
        ...results,
        { delay: currentDelay, amount: Math.round(indifference), k },
      ];

      const nextDelayIndex = delayIndex + 1;

      if (nextDelayIndex >= DELAYS.length) {
        // All delays complete
        const ks = newResults.map((r) => r.k);
        const stats: DelayDiscountingStats = {
          indifferencePoints: newResults,
          medianK: median(ks),
          totalTrials: TOTAL_TRIALS,
        };
        sessionStorage.setItem("delay", JSON.stringify(stats));
        setResults(newResults);
        setPhase("complete");
      } else {
        setResults(newResults);
        setDelayIndex(nextDelayIndex);
        setRound(0);
        setLo(1);
        setHi(99);
      }
    } else {
      setRound(nextRound);
      setLo(newLo);
      setHi(newHi);
    }
  };

  useEffect(() => {
    if (phase === "complete") {
      const t = setTimeout(onComplete, 1500);
      return () => clearTimeout(t);
    }
  }, [phase, onComplete]);

  if (phase === "instructions") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Delay Discounting</CardTitle>
          <CardDescription>~3 minutes · 25 choices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            You'll be asked to choose between two options:{" "}
            <strong>a smaller amount of money now</strong> or{" "}
            <strong>$100 at some point in the future</strong>.
          </p>
          <p>
            There's no right or wrong answer — just pick whichever option{" "}
            <strong>you would genuinely prefer</strong>.
          </p>
          <p className="text-muted-foreground">
            This test measures how your brain weighs immediate vs. delayed
            rewards — a key marker of impulse control.
          </p>
        </CardContent>
        <CardFooter>
          <Button className="w-full" size="lg" onClick={() => setPhase("testing")}>
            Start Test
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (phase === "testing") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Choice {trialsComplete + 1} / {TOTAL_TRIALS}</span>
          <span>Delay: {formatDelay(currentDelay)}</span>
        </div>

        <Progress value={progressPercent} />

        <p className="text-center text-sm text-muted-foreground pt-1">
          Which would you rather have?
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleChoice(true)}
            className="cursor-pointer focus:outline-none"
          >
            <Card className="h-full hover:bg-accent transition-colors border-2 hover:border-primary">
              <CardContent className="flex flex-col items-center justify-center gap-2 py-8 px-4">
                <span className="text-3xl font-bold">${immediateAmount}</span>
                <span className="text-sm text-muted-foreground font-medium">right now</span>
              </CardContent>
            </Card>
          </button>

          <button
            onClick={() => handleChoice(false)}
            className="cursor-pointer focus:outline-none"
          >
            <Card className="h-full hover:bg-accent transition-colors border-2 hover:border-primary">
              <CardContent className="flex flex-col items-center justify-center gap-2 py-8 px-4">
                <span className="text-3xl font-bold">${DELAYED_AMOUNT}</span>
                <span className="text-sm text-muted-foreground font-medium">
                  in {formatDelay(currentDelay)}
                </span>
              </CardContent>
            </Card>
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Tap the option you'd genuinely prefer
        </p>
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Delay Discounting Complete!</CardTitle>
          <CardDescription>Your results have been saved.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Moving to the next test…</p>
        </CardContent>
      </Card>
    );
  }

  return null;
}
