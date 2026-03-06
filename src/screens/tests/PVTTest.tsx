import { useState, useRef, useEffect, useCallback } from "react";
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

const TOTAL_TRIALS = 30;
const MIN_ISI_MS = 2000;
const MAX_ISI_MS = 10000;
const LAPSE_THRESHOLD_MS = 500;

type Phase = "instructions" | "running" | "complete";

export interface PVTStats {
  medianRT: number;
  meanRT: number;
  lapses: number;
  lapseRate: number;
  falseStarts: number;
  totalTrials: number;
  rts: number[];
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
    : (sorted[mid] as number);
}

function randomISI(): number {
  return MIN_ISI_MS + Math.random() * (MAX_ISI_MS - MIN_ISI_MS);
}

interface Props {
  onComplete: () => void;
}

export function PVTTest({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("instructions");
  const [trialsComplete, setTrialsComplete] = useState(0);
  const [stimulusVisible, setStimulusVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0); // ms since stimulus appeared
  const [falseStartFlash, setFalseStartFlash] = useState(false);

  const phaseRef = useRef<Phase>("instructions");
  const stimulusVisibleRef = useRef(false);
  const stimulusStartRef = useRef(0);
  const rtsRef = useRef<number[]>([]);
  const falseStartsRef = useRef(0);
  const trialsCompleteRef = useRef(0);
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const clearAllTimers = useCallback(() => {
    if (waitTimerRef.current !== undefined) clearTimeout(waitTimerRef.current);
    if (elapsedTimerRef.current !== undefined) clearInterval(elapsedTimerRef.current);
    waitTimerRef.current = undefined;
    elapsedTimerRef.current = undefined;
  }, []);

  const finishTrial = useCallback((rt: number) => {
    rtsRef.current.push(rt);
    const newCount = trialsCompleteRef.current + 1;
    trialsCompleteRef.current = newCount;
    setTrialsComplete(newCount);

    stimulusVisibleRef.current = false;
    setStimulusVisible(false);
    setElapsed(0);
    if (elapsedTimerRef.current !== undefined) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = undefined;
    }

    if (newCount >= TOTAL_TRIALS) {
      const rts = rtsRef.current;
      const lapses = rts.filter((rt) => rt > LAPSE_THRESHOLD_MS).length;
      const meanRT =
        rts.length > 0 ? rts.reduce((a, b) => a + b, 0) / rts.length : 0;
      const stats: PVTStats = {
        medianRT: Math.round(median(rts)),
        meanRT: Math.round(meanRT),
        lapses,
        lapseRate: rts.length > 0 ? lapses / rts.length : 0,
        falseStarts: falseStartsRef.current,
        totalTrials: rts.length,
        rts,
      };
      sessionStorage.setItem("pvt", JSON.stringify(stats));
      phaseRef.current = "complete";
      setPhase("complete");
    } else {
      scheduleNextStimulus();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleNextStimulus = useCallback(() => {
    const isi = randomISI();
    waitTimerRef.current = setTimeout(() => {
      if (phaseRef.current !== "running") return;
      stimulusVisibleRef.current = true;
      stimulusStartRef.current = performance.now();
      setStimulusVisible(true);
      setElapsed(0);

      elapsedTimerRef.current = setInterval(() => {
        setElapsed(Math.round(performance.now() - stimulusStartRef.current));
      }, 50);
    }, isi);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startTest = useCallback(() => {
    rtsRef.current = [];
    falseStartsRef.current = 0;
    trialsCompleteRef.current = 0;
    phaseRef.current = "running";
    setPhase("running");
    setTrialsComplete(0);
    setStimulusVisible(false);
    setElapsed(0);
    scheduleNextStimulus();
  }, [scheduleNextStimulus]);

  const handleTap = useCallback(() => {
    if (phaseRef.current !== "running") return;

    if (stimulusVisibleRef.current) {
      const rt = Math.round(performance.now() - stimulusStartRef.current);
      finishTrial(rt);
    } else {
      // False start
      falseStartsRef.current += 1;
      setFalseStartFlash(true);
      setTimeout(() => setFalseStartFlash(false), 400);
    }
  }, [finishTrial]);

  useEffect(() => {
    if (phase === "complete") {
      const t = setTimeout(onComplete, 1500);
      return () => clearTimeout(t);
    }
  }, [phase, onComplete]);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  if (phase === "instructions") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Psychomotor Vigilance (PVT)</CardTitle>
          <CardDescription>~3 minutes · 30 trials</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>A red circle will appear on screen at unpredictable times — anywhere from 2 to 10 seconds apart.</p>
          <p>
            <strong>Tap the circle as quickly as possible</strong> when it appears.
          </p>
          <p>
            Do <strong>not</strong> tap before the circle appears — that counts as a false start.
          </p>
          <p className="text-muted-foreground">
            This test measures how alert and vigilant your attention is over time.
          </p>
        </CardContent>
        <CardFooter>
          <Button className="w-full" size="lg" onClick={startTest}>
            Start Test
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (phase === "running") {
    const progress = (trialsComplete / TOTAL_TRIALS) * 100;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Trial {trialsComplete + 1} / {TOTAL_TRIALS}</span>
          {falseStartFlash && (
            <span className="text-destructive font-medium">Too early!</span>
          )}
        </div>

        <Progress value={progress} />

        <button
          onClick={handleTap}
          className="w-full h-72 rounded-xl bg-muted flex items-center justify-center select-none focus:outline-none cursor-pointer"
          aria-label="Tap when the red circle appears"
        >
          {stimulusVisible ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-28 h-28 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl font-bold tabular-nums">
                  {elapsed}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">TAP!</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-28 h-28 rounded-full bg-muted-foreground/20" />
              <span className="text-sm text-muted-foreground">Wait for the red circle…</span>
            </div>
          )}
        </button>
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>PVT Complete!</CardTitle>
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
