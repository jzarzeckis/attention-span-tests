import { useState, useRef, useEffect, useCallback } from "react";
import { resultsStore } from "@/utils/resultsStore";
import type { StroopStats } from "@/types";
export type { StroopStats };
import { ReadySetGo } from "@/components/ReadySetGo";
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

const COLORS = ["red", "blue", "green", "yellow"] as const;
type Color = (typeof COLORS)[number];

const LABEL: Record<Color, string> = {
  red: "Red",
  blue: "Blue",
  green: "Green",
  yellow: "Yellow",
};

const KEY_MAP: Record<string, Color> = {
  r: "red",
  g: "green",
  b: "blue",
  y: "yellow",
};

const KEY_HINT: Record<Color, string> = {
  red: "R",
  blue: "B",
  green: "G",
  yellow: "Y",
};

const TEXT_CLS: Record<Color, string> = {
  red: "text-red-600",
  blue: "text-blue-600",
  green: "text-green-600",
  yellow: "text-yellow-500",
};

const RECT_BG: Record<Color, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-400",
};

const IS_DEV = process.env.NODE_ENV !== "production";
const TRIALS_PER_CONDITION = IS_DEV ? 1 : 20;
const TRIALS_C3 = IS_DEV ? 1 : 40;
const PRACTICE_TRIALS = IS_DEV ? 1 : 3;

interface Stimulus {
  word: Color | null;     // null = show rectangle (condition 2)
  inkColor: Color | null; // null = black ink (condition 1)
  answer: Color;
}

interface TrialResult {
  correct: boolean;
  rt: number;
}


type Phase =
  | "instructions"
  | "countdown"
  | "condition1"
  | "between-1-2"
  | "condition2"
  | "between-2-3"
  | "practice"
  | "practice-done"
  | "condition3"
  | "complete";

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

function makeC1(): Stimulus[] {
  const items: Stimulus[] = [];
  const reps = TRIALS_PER_CONDITION / COLORS.length;
  for (let i = 0; i < reps; i++) {
    for (const c of COLORS) items.push({ word: c, inkColor: null, answer: c });
  }
  return shuffle(items);
}

function makeC2(): Stimulus[] {
  const items: Stimulus[] = [];
  const reps = TRIALS_PER_CONDITION / COLORS.length;
  for (let i = 0; i < reps; i++) {
    for (const c of COLORS) items.push({ word: null, inkColor: c, answer: c });
  }
  return shuffle(items);
}

function makeC3(n: number): Stimulus[] {
  const pairs: Stimulus[] = [];
  for (const word of COLORS) {
    for (const ink of COLORS) {
      if (word !== ink) pairs.push({ word, inkColor: ink, answer: ink });
    }
  }
  const pool: Stimulus[] = [];
  while (pool.length < n) pool.push(...shuffle(pairs));
  return shuffle(pool.slice(0, n));
}

function condStats(results: TrialResult[]): { accuracy: number; meanRT: number } {
  if (!results.length) return { accuracy: 0, meanRT: 0 };
  const correct = results.filter((r) => r.correct);
  const meanRT = correct.length
    ? Math.round(correct.reduce((s, r) => s + r.rt, 0) / correct.length)
    : 0;
  return {
    accuracy: Math.round((correct.length / results.length) * 100),
    meanRT,
  };
}

interface Props {
  onComplete: () => void;
}

export function StroopTest({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("instructions");
  const [stimuli, setStimuli] = useState<Stimulus[]>([]);
  const [trialIdx, setTrialIdx] = useState(0);
  const [trialStart, setTrialStart] = useState(0);
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [awaiting, setAwaiting] = useState(false);

  const c1 = useRef<TrialResult[]>([]);
  const c2 = useRef<TrialResult[]>([]);
  const c3 = useRef<TrialResult[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const ACTIVE_PHASES: Phase[] = ["condition1", "condition2", "practice", "condition3"];
  useEffect(() => {
    if (!ACTIVE_PHASES.includes(phase)) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const color = KEY_MAP[e.key.toLowerCase()];
      if (color) handleAnswer(color);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [phase, handleAnswer]);

  useEffect(() => {
    if (phase === "complete") {
      const t = setTimeout(onComplete, 1500);
      return () => clearTimeout(t);
    }
  }, [phase, onComplete]);

  const startCondition = useCallback(
    (newPhase: "condition1" | "condition2" | "practice" | "condition3") => {
      if (newPhase === "condition1") c1.current = [];
      if (newPhase === "condition2") c2.current = [];
      if (newPhase === "condition3") c3.current = [];
      const stims =
        newPhase === "condition1" ? makeC1() :
        newPhase === "condition2" ? makeC2() :
        newPhase === "practice" ? makeC3(PRACTICE_TRIALS) :
        makeC3(TRIALS_C3);
      setStimuli(stims);
      setTrialIdx(0);
      setFeedback(null);
      setAwaiting(true);
      setPhase(newPhase);
      setTrialStart(performance.now());
    },
    []
  );

  const handleAnswer = useCallback(
    (answer: Color) => {
      if (!awaiting) return;
      setAwaiting(false);

      const rt = performance.now() - trialStart;
      const stim = stimuli[trialIdx];
      if (!stim) return;
      const correct = answer === stim.answer;

      if (phase === "condition1") c1.current.push({ correct, rt });
      else if (phase === "condition2") c2.current.push({ correct, rt });
      else if (phase === "condition3") c3.current.push({ correct, rt });

      const isPractice = phase === "practice";
      if (isPractice) setFeedback(correct);

      const nextIdx = trialIdx + 1;
      const isLast = nextIdx >= stimuli.length;
      const delay = isPractice ? 800 : 150;

      timer.current = setTimeout(() => {
        if (isLast) {
          if (phase === "condition1") {
            setPhase("between-1-2");
          } else if (phase === "condition2") {
            setPhase("between-2-3");
          } else if (phase === "practice") {
            setPhase("practice-done");
          } else if (phase === "condition3") {
            const s1 = condStats(c1.current);
            const s2 = condStats(c2.current);
            const s3 = condStats(c3.current);
            const stats: StroopStats = {
              condition1: s1,
              condition2: s2,
              condition3: s3,
              interferenceScore: s3.meanRT - s2.meanRT,
            };
            resultsStore.setItem("stroop", stats);
            setPhase("complete");
          }
        } else {
          setTrialIdx(nextIdx);
          setFeedback(null);
          setAwaiting(true);
          setTrialStart(performance.now());
        }
      }, delay);
    },
    [awaiting, trialStart, stimuli, trialIdx, phase]
  );

  // ── Instructions ─────────────────────────────────────────────────────────
  if (phase === "instructions") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stroop Color-Word Test</CardTitle>
          <CardDescription>~5 minutes · 3 conditions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>This test measures your ability to suppress automatic responses.</p>
          <p>
            <strong>Condition 1 — Word Reading:</strong> Read the color word shown in black ink.
          </p>
          <p>
            <strong>Condition 2 — Color Naming:</strong> Name the color of the rectangle shown.
          </p>
          <p>
            <strong>Condition 3 — Stroop:</strong> Name the{" "}
            <em>ink color</em> of each word — ignore what the word says.
          </p>
          <p className="text-muted-foreground">
            Choose from: Red, Blue, Green, Yellow.
          </p>
          <p className="text-muted-foreground">
            Use keyboard shortcuts <kbd className="px-1 py-0.5 rounded border text-xs">R</kbd>{" "}
            <kbd className="px-1 py-0.5 rounded border text-xs">G</kbd>{" "}
            <kbd className="px-1 py-0.5 rounded border text-xs">B</kbd>{" "}
            <kbd className="px-1 py-0.5 rounded border text-xs">Y</kbd>{" "}
            or click the buttons.
          </p>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            size="lg"
            onClick={() => setPhase("countdown")}
          >
            Begin
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (phase === "countdown") {
    return <ReadySetGo onDone={() => startCondition("condition1")} />;
  }

  // ── Between condition 1 and 2 ─────────────────────────────────────────────
  if (phase === "between-1-2") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Condition 2: Color Naming</CardTitle>
          <CardDescription>Next up</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            You'll see a <strong>colored rectangle</strong>. Tap the button that names its color.
          </p>
          <p>Respond as quickly and accurately as you can.</p>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            size="lg"
            onClick={() => startCondition("condition2")}
          >
            Start Condition 2
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // ── Between condition 2 and 3 (explains Stroop + practice) ───────────────
  if (phase === "between-2-3") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Condition 3: The Stroop Challenge</CardTitle>
          <CardDescription>The trickiest part</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            You'll see a color <strong>word</strong> printed in a{" "}
            <strong>different ink color</strong>.
          </p>
          <p>
            Your job: name the <strong>ink color</strong>, not the word itself.
          </p>
          <p className="text-muted-foreground">
            Example: if "RED" appears in blue ink, tap <strong>Blue</strong>.
          </p>
          <p>We'll start with a 3-trial practice round with feedback.</p>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            size="lg"
            onClick={() => startCondition("practice")}
          >
            Start Practice
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // ── Practice done ─────────────────────────────────────────────────────────
  if (phase === "practice-done") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Practice Complete!</CardTitle>
          <CardDescription>Ready for the real thing?</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            The real test is <strong>40 trials</strong> with no feedback.
          </p>
          <p>
            Remember: tap the <strong>ink color</strong>, not the word.
          </p>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            size="lg"
            onClick={() => startCondition("condition3")}
          >
            Begin Condition 3
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // ── Complete ──────────────────────────────────────────────────────────────
  if (phase === "complete") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stroop Test Complete!</CardTitle>
          <CardDescription>Your results have been saved.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Moving to the next test…</p>
        </CardContent>
      </Card>
    );
  }

  // ── Trial phases: condition1 | condition2 | practice | condition3 ─────────
  const stim = stimuli[trialIdx];
  const condLabel =
    phase === "condition1" ? "Condition 1: Word Reading" :
    phase === "condition2" ? "Condition 2: Color Naming" :
    phase === "practice"   ? "Practice (Condition 3)" :
                             "Condition 3: Stroop";
  const progress = stimuli.length > 0 ? (trialIdx / stimuli.length) * 100 : 0;
  const isPractice = phase === "practice";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm text-muted-foreground min-h-[1.5rem]">
          <span>{condLabel}</span>
          {!isPractice && (
            <span>
              Trial {trialIdx + 1} / {stimuli.length}
            </span>
          )}
          {isPractice && feedback !== null && (
            <Badge variant={feedback ? "default" : "destructive"}>
              {feedback ? "✓ Correct" : "✗ Wrong"}
            </Badge>
          )}
        </div>
        {!isPractice && <Progress value={progress} />}
      </div>

      {/* Stimulus display */}
      <div className="flex h-36 items-center justify-center rounded-xl bg-muted select-none">
        {stim?.word !== null && stim?.word !== undefined ? (
          <span
            className={`text-5xl font-bold uppercase ${
              stim.inkColor ? TEXT_CLS[stim.inkColor] : stim.word ? TEXT_CLS[stim.word] : "text-foreground"
            }`}
          >
            {LABEL[stim.word]}
          </span>
        ) : stim ? (
          <div className={`w-28 h-16 rounded-lg ${RECT_BG[stim.answer]}`} />
        ) : null}
      </div>

      {/* Color choice buttons */}
      <div className="grid grid-cols-2 gap-3">
        {COLORS.map((color) => (
          <Button
            key={color}
            size="lg"
            variant="outline"
            disabled={!awaiting}
            aria-label={LABEL[color]}
            onClick={() => handleAnswer(color)}
          >
            {LABEL[color]}
            <kbd className="ml-2 text-xs opacity-50 font-sans">{KEY_HINT[color]}</kbd>
          </Button>
        ))}
      </div>
    </div>
  );
}
