import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Phase = "instructions" | "test" | "skip-prompted" | "complete";

export interface FocusStats {
  firstSkipUrgeTime: number | null; // ms from start, null if never triggered
  choseToStop: boolean;
  totalTime: number; // ms
}

// Mildly engaging passage — interesting but not gripping
const SENTENCES = [
  "The ocean covers more than 70% of our planet's surface, yet more than 80% of it remains unexplored.",
  "In the deepest parts of the sea, where sunlight never reaches, entire ecosystems thrive in complete darkness.",
  "Creatures like the anglerfish carry their own light — a bioluminescent lure that dangles from their head to attract prey.",
  "The pressure at the bottom of the Mariana Trench is over 1,000 times greater than at sea level.",
  "Despite these crushing conditions, life finds a way: tube worms, sea cucumbers, and ghostly fish inhabit the hadal zone.",
  "Some deep-sea creatures live for centuries — the Greenland shark may live over 400 years.",
  "These sharks grow less than a centimeter per year and reach sexual maturity only around age 150.",
  "The deep ocean also holds clues to Earth's past: sediment cores record climate changes over millions of years.",
  "Hydrothermal vents on the seafloor release superheated water rich in minerals, sustaining life without sunlight.",
  "Instead of photosynthesis, these ecosystems run on chemosynthesis — bacteria converting chemical energy into food.",
  "Octopuses, among the most intelligent invertebrates, can solve puzzles, open jars, and appear to dream.",
  "Researchers have observed sleeping octopuses rapidly changing color — perhaps replaying experiences from their day.",
  "The blue whale, the largest animal ever known on Earth, makes calls so low humans can barely perceive them.",
  "These calls travel thousands of miles through the ocean, letting whales coordinate across entire ocean basins.",
  "Much of what we know about deep-sea life has been discovered only in the last few decades.",
  "Each new expedition reveals species that challenge our understanding of what conditions life can tolerate.",
  "Scientists estimate there may be millions of undiscovered species in the ocean — more than in any other environment.",
  "The sea remains, in many ways, our planet's final frontier.",
];

// Reveal one sentence every 5 seconds (~90 seconds for full passage)
const REVEAL_INTERVAL_MS = 5000;

interface Props {
  onComplete: () => void;
}

export function FocusDurationTest({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("instructions");
  const [revealedCount, setRevealedCount] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  const startTimeRef = useRef(0);
  const firstSkipUrgeRef = useRef<number | null>(null);
  const revealedCountRef = useRef(0);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const phaseRef = useRef<Phase>("instructions");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [revealedCount]);

  const stopReveal = useCallback(() => {
    if (revealTimerRef.current !== undefined) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = undefined;
    }
  }, []);

  const startReveal = useCallback((fromCount: number) => {
    stopReveal();
    let count = fromCount;
    revealTimerRef.current = setInterval(() => {
      count++;
      revealedCountRef.current = count;
      setRevealedCount(count);
      if (count >= SENTENCES.length) {
        stopReveal();
      }
    }, REVEAL_INTERVAL_MS);
  }, [stopReveal]);

  const startTest = useCallback(() => {
    startTimeRef.current = performance.now();
    firstSkipUrgeRef.current = null;
    revealedCountRef.current = 1;
    phaseRef.current = "test";
    setPhase("test");
    setRevealedCount(1);
    startReveal(1);
  }, [startReveal]);

  const handleSkipUrge = useCallback(() => {
    if (phaseRef.current !== "test") return;
    const elapsed = performance.now() - startTimeRef.current;
    if (firstSkipUrgeRef.current === null) {
      firstSkipUrgeRef.current = elapsed;
    }
    stopReveal();
    phaseRef.current = "skip-prompted";
    setPhase("skip-prompted");
  }, [stopReveal]);

  const handleContinue = useCallback(() => {
    if (phaseRef.current !== "skip-prompted") return;
    phaseRef.current = "test";
    setPhase("test");
    startReveal(revealedCountRef.current);
  }, [startReveal]);

  const finishTest = useCallback((choseToStop: boolean) => {
    stopReveal();
    const totalTime = Math.round(performance.now() - startTimeRef.current);
    const stats: FocusStats = {
      firstSkipUrgeTime: firstSkipUrgeRef.current !== null
        ? Math.round(firstSkipUrgeRef.current)
        : null,
      choseToStop,
      totalTime,
    };
    sessionStorage.setItem("focus", JSON.stringify(stats));
    setElapsedSec(Math.round(totalTime / 1000));
    phaseRef.current = "complete";
    setPhase("complete");
  }, [stopReveal]);

  const handleStop = useCallback(() => finishTest(true), [finishTest]);

  const handleFinishReading = useCallback(() => finishTest(false), [finishTest]);

  if (phase === "instructions") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Focus Duration Test</CardTitle>
          <CardDescription>~2 minutes · Stay with the content</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            A short passage will appear on screen, revealing one sentence at a
            time.
          </p>
          <p>
            <strong>Read naturally.</strong> There's no quiz — just try to stay
            engaged with the content.
          </p>
          <p>
            Whenever you feel the urge to move on or check something else, press{" "}
            <strong>"I want to skip"</strong>. You can then choose to continue or
            stop the test.
          </p>
          <p className="text-muted-foreground">
            The timer is hidden during the test so it doesn't influence you.
          </p>
        </CardContent>
        <CardFooter>
          <Button className="w-full" size="lg" onClick={startTest}>
            Start Reading
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (phase === "test") {
    const sentences = SENTENCES.slice(0, revealedCount);
    const isFullyRevealed = revealedCount >= SENTENCES.length;
    return (
      <div className="space-y-4">
        <Card>
          <CardContent ref={scrollContainerRef} className="pt-6 space-y-3 text-sm leading-relaxed max-h-96 overflow-y-auto">
            {sentences.map((sentence, i) => (
              <p
                key={i}
                className={i === sentences.length - 1 ? "font-medium" : "text-muted-foreground"}
              >
                {sentence}
              </p>
            ))}
          </CardContent>
        </Card>

        {isFullyRevealed ? (
          <Button className="w-full" size="lg" onClick={handleFinishReading}>
            I finished reading
          </Button>
        ) : (
          <Button
            className="w-full"
            size="lg"
            variant="outline"
            onClick={handleSkipUrge}
          >
            I want to skip
          </Button>
        )}
      </div>
    );
  }

  if (phase === "skip-prompted") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Feeling the urge to move on?</CardTitle>
          <CardDescription>That's completely normal. What would you like to do?</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>You can continue reading or stop here and see your results.</p>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button className="flex-1" variant="outline" onClick={handleContinue}>
            Keep reading
          </Button>
          <Button className="flex-1" onClick={handleStop}>
            Stop &amp; see results
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (phase === "complete") {
    const firstSkipSec = firstSkipUrgeRef.current !== null
      ? Math.round(firstSkipUrgeRef.current / 1000)
      : null;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Focus Test Complete!</CardTitle>
          <CardDescription>Your results have been saved.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            You stayed with the content for{" "}
            <strong>
              {elapsedSec >= 60
                ? `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`
                : `${elapsedSec}s`}
            </strong>
            .
          </p>
          {firstSkipSec !== null && (
            <p className="text-muted-foreground">
              You first felt the urge to skip after{" "}
              <strong>
                {firstSkipSec >= 60
                  ? `${Math.floor(firstSkipSec / 60)}m ${firstSkipSec % 60}s`
                  : `${firstSkipSec}s`}
              </strong>
              .
            </p>
          )}
          <p className="text-muted-foreground">
            Pre-digital median: ~2.5 minutes. Current median: ~40 seconds.
          </p>
        </CardContent>
        <CardFooter>
          <Button className="w-full" size="lg" onClick={onComplete}>
            Next Test
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return null;
}
