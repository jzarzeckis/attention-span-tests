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
import { ReadySetGo } from "@/components/ReadySetGo";

const TOTAL_TRIALS = 100;
const NOGO_RATIO = 0.2; // 20% No-Go trials
const STIMULUS_DURATION_MS = 500;
const ISI_MS = 1000;

type Phase = "instructions" | "countdown" | "running" | "complete";
type TrialType = "go" | "nogo";

export interface GoNoGoStats {
  commissionErrors: number;
  commissionErrorRate: number;
  omissionErrors: number;
  omissionErrorRate: number;
  meanRT: number;
  rtCV: number; // coefficient of variation = SD / mean
  totalTrials: number;
  goTrials: number;
  nogoTrials: number;
}

function buildTrialSequence(total: number, nogoRatio: number): TrialType[] {
  const nogoCount = Math.round(total * nogoRatio);
  const goCount = total - nogoCount;
  const seq: TrialType[] = [
    ...Array(goCount).fill("go" as TrialType),
    ...Array(nogoCount).fill("nogo" as TrialType),
  ];
  // Fisher-Yates shuffle
  for (let i = seq.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = seq[i] as TrialType;
    seq[i] = seq[j] as TrialType;
    seq[j] = tmp;
  }
  return seq;
}

function stddev(arr: number[], mean: number): number {
  if (arr.length < 2) return 0;
  const variance = arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

interface Props {
  onComplete: () => void;
}

export function GoNoGoTest({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("instructions");
  const [trialsComplete, setTrialsComplete] = useState(0);
  const [stimulusVisible, setStimulusVisible] = useState(false);
  const [currentTrialType, setCurrentTrialType] = useState<TrialType>("go");
  const [commissionFlash, setCommissionFlash] = useState(false);

  const phaseRef = useRef<Phase>("instructions");
  const stimulusVisibleRef = useRef(false);
  const stimulusStartRef = useRef(0);
  const currentTrialTypeRef = useRef<TrialType>("go");
  const trialsCompleteRef = useRef(0);
  const trialSeqRef = useRef<TrialType[]>([]);
  const goRtsRef = useRef<number[]>([]);
  const commissionErrorsRef = useRef(0);
  const omissionErrorsRef = useRef(0);
  const stimulusTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isiTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearAllTimers = useCallback(() => {
    if (stimulusTimerRef.current !== undefined) clearTimeout(stimulusTimerRef.current);
    if (isiTimerRef.current !== undefined) clearTimeout(isiTimerRef.current);
    stimulusTimerRef.current = undefined;
    isiTimerRef.current = undefined;
  }, []);

  const finishTest = useCallback(() => {
    clearAllTimers();
    const goRts = goRtsRef.current;
    const meanRT = goRts.length > 0 ? goRts.reduce((a, b) => a + b, 0) / goRts.length : 0;
    const sd = stddev(goRts, meanRT);
    const rtCV = meanRT > 0 ? sd / meanRT : 0;
    const nogoCount = trialSeqRef.current.filter((t) => t === "nogo").length;
    const goCount = trialSeqRef.current.length - nogoCount;
    const stats: GoNoGoStats = {
      commissionErrors: commissionErrorsRef.current,
      commissionErrorRate: nogoCount > 0 ? commissionErrorsRef.current / nogoCount : 0,
      omissionErrors: omissionErrorsRef.current,
      omissionErrorRate: goCount > 0 ? omissionErrorsRef.current / goCount : 0,
      meanRT: Math.round(meanRT),
      rtCV: Math.round(rtCV * 1000) / 1000,
      totalTrials: TOTAL_TRIALS,
      goTrials: goCount,
      nogoTrials: nogoCount,
    };
    sessionStorage.setItem("gonogo", JSON.stringify(stats));
    phaseRef.current = "complete";
    setPhase("complete");
  }, [clearAllTimers]);

  const runNextTrial = useCallback(() => {
    const idx = trialsCompleteRef.current;
    if (idx >= TOTAL_TRIALS) {
      finishTest();
      return;
    }
    const trialType = trialSeqRef.current[idx] as TrialType;
    currentTrialTypeRef.current = trialType;
    setCurrentTrialType(trialType);

    // Show stimulus
    stimulusVisibleRef.current = true;
    stimulusStartRef.current = performance.now();
    setStimulusVisible(true);

    // Hide stimulus after STIMULUS_DURATION_MS
    stimulusTimerRef.current = setTimeout(() => {
      // If still visible (user hasn't tapped) — record omission for Go trials
      if (stimulusVisibleRef.current && phaseRef.current === "running") {
        if (currentTrialTypeRef.current === "go") {
          omissionErrorsRef.current += 1;
        }
        stimulusVisibleRef.current = false;
        setStimulusVisible(false);

        // ISI then next trial
        const newCount = trialsCompleteRef.current + 1;
        trialsCompleteRef.current = newCount;
        setTrialsComplete(newCount);

        isiTimerRef.current = setTimeout(() => {
          if (phaseRef.current === "running") runNextTrial();
        }, ISI_MS);
      }
    }, STIMULUS_DURATION_MS);
  }, [finishTest]); // eslint-disable-line react-hooks/exhaustive-deps

  const startTest = useCallback(() => {
    trialSeqRef.current = buildTrialSequence(TOTAL_TRIALS, NOGO_RATIO);
    goRtsRef.current = [];
    commissionErrorsRef.current = 0;
    omissionErrorsRef.current = 0;
    trialsCompleteRef.current = 0;
    phaseRef.current = "running";
    setPhase("running");
    setTrialsComplete(0);
    setStimulusVisible(false);

    isiTimerRef.current = setTimeout(() => {
      if (phaseRef.current === "running") runNextTrial();
    }, ISI_MS);
  }, [runNextTrial]);

  const handleTap = useCallback(() => {
    if (phaseRef.current !== "running") return;

    if (stimulusVisibleRef.current) {
      const rt = Math.round(performance.now() - stimulusStartRef.current);
      stimulusVisibleRef.current = false;
      setStimulusVisible(false);

      if (stimulusTimerRef.current !== undefined) {
        clearTimeout(stimulusTimerRef.current);
        stimulusTimerRef.current = undefined;
      }

      if (currentTrialTypeRef.current === "go") {
        // Correct response
        goRtsRef.current.push(rt);
      } else {
        // Commission error — tapped on No-Go
        commissionErrorsRef.current += 1;
        setCommissionFlash(true);
        setTimeout(() => setCommissionFlash(false), 400);
      }

      const newCount = trialsCompleteRef.current + 1;
      trialsCompleteRef.current = newCount;
      setTrialsComplete(newCount);

      if (newCount >= TOTAL_TRIALS) {
        finishTest();
      } else {
        isiTimerRef.current = setTimeout(() => {
          if (phaseRef.current === "running") runNextTrial();
        }, ISI_MS);
      }
    }
  }, [finishTest, runNextTrial]);

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
          <CardTitle>Go/No-Go Task</CardTitle>
          <CardDescription>~2.5 minutes · 100 trials</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Circles will appear one at a time on the screen.
          </p>
          <p>
            <strong className="text-green-600">Green circle</strong> → <strong>Tap it!</strong> (Go)
          </p>
          <p>
            <strong className="text-red-600">Red circle</strong> → <strong>Do NOT tap.</strong> (No-Go)
          </p>
          <p>
            The green circle appears most of the time. React quickly, but hold back on red!
          </p>
          <p className="text-muted-foreground">
            This test measures impulse control — your ability to withhold automatic responses.
          </p>
        </CardContent>
        <CardFooter>
          <Button className="w-full" size="lg" onClick={() => { phaseRef.current = "countdown"; setPhase("countdown"); }}>
            Start Test
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (phase === "countdown") {
    return <ReadySetGo onDone={startTest} />;
  }

  if (phase === "running") {
    const progress = (trialsComplete / TOTAL_TRIALS) * 100;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Trial {trialsComplete + 1} / {TOTAL_TRIALS}</span>
          {commissionFlash && (
            <span className="text-destructive font-medium">No-Go!</span>
          )}
        </div>

        <Progress value={progress} />

        <button
          onClick={handleTap}
          className="w-full h-72 rounded-xl bg-muted flex items-center justify-center select-none focus:outline-none cursor-pointer"
          aria-label="Tap on green circles only"
        >
          {stimulusVisible ? (
            <div className="flex flex-col items-center gap-3">
              <div
                className={`w-32 h-32 rounded-full shadow-lg ${
                  currentTrialType === "go" ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-sm font-medium text-muted-foreground">
                {currentTrialType === "go" ? "TAP!" : "Hold back…"}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-32 h-32 rounded-full bg-muted-foreground/20" />
              <span className="text-sm text-muted-foreground">Wait…</span>
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
          <CardTitle>Go/No-Go Complete!</CardTitle>
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
