import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface FocusDurationResult {
  timeToFirstSkipUrge: number; // ms
  continuedAfterUrge: boolean;
  totalTimeFocused: number; // ms
}

type Phase = "instructions" | "running" | "urged" | "done";

// A mildly engaging passage that reveals word by word
const PASSAGE_PARAGRAPHS = [
  "The ocean has a way of making you feel small. Not in a bad way — more like a gentle reminder that the world is vast and full of things you haven't seen yet. If you've ever stood at the shore and watched the waves roll in, you know that feeling. Each wave is different from the last, shaped by winds that blew thousands of miles away.",
  "Scientists who study the deep ocean say we know more about the surface of Mars than we do about the bottom of our own seas. Down there, in the crushing darkness, creatures glow with their own light. Jellyfish pulse like living lanterns. Anglerfish dangle tiny lures above their jaws. There are worms that thrive near volcanic vents where the water is hot enough to melt lead.",
  "The ocean floor isn't flat, either. There are mountains taller than Everest hidden beneath the waves, and trenches so deep that if you dropped a stone, it would take over an hour to reach the bottom. The Mariana Trench plunges nearly eleven kilometers down. At that depth, the pressure is a thousand times what you feel standing on the beach.",
  "Even the color of the sea holds secrets. Water absorbs red light first, which is why the shallows look turquoise but the deep ocean is ink-blue. Some parts of the Pacific are so clear you can see forty meters down. Others, churned by nutrients and plankton, turn emerald green — a sign of life blooming just beneath the surface.",
  "Sailors have always known the ocean changes mood. A calm morning can turn into a roaring storm by afternoon. Old navigators read the clouds, the swell patterns, the behavior of seabirds to predict what was coming. Today we have satellites and supercomputers, but the ocean still surprises us. Rogue waves appear from nowhere, towering three or four times higher than the seas around them.",
  "Perhaps that's why the ocean has inspired so many stories. Every culture that lived near water has tales of sea monsters, lost cities, and voyages to the edge of the world. The Greeks imagined Poseidon stirring storms with his trident. Polynesian wayfinders crossed thousands of miles of open Pacific using only the stars, the currents, and the feel of the swells beneath their canoes.",
  "There is something meditative about watching water move. Rivers flow, rain falls, tides rise and retreat. The rhythm is older than any human invention. Before clocks, before calendars, the tides kept time. Twice a day, the shore breathes in and out, pulled by the moon's quiet gravity.",
  "If you're still reading this, you might notice that your mind has settled a little. That's normal. Sustained focus, even on something this simple, can be surprisingly calming. The challenge isn't that the content is difficult — it's that part of your brain is always scanning for something new, something more exciting. That urge to switch is natural. Everyone feels it.",
];

const WORDS_PER_REVEAL = 1;
const REVEAL_INTERVAL_MS = 280; // one word every 280ms (~214 wpm, comfortable reading pace)

interface FocusDurationTestProps {
  onComplete: (result: FocusDurationResult) => void;
}

export function FocusDurationTest({ onComplete }: FocusDurationTestProps) {
  const [phase, setPhase] = useState<Phase>("instructions");
  const [revealedWordCount, setRevealedWordCount] = useState(0);
  const startTimeRef = useRef(0);
  const skipUrgeTimeRef = useRef(0);

  // All words flattened
  const allWords = useRef(
    PASSAGE_PARAGRAPHS.flatMap((p, pi) =>
      p.split(/\s+/).map((word, wi) => ({ word, paragraphIndex: pi, wordIndex: wi }))
    )
  ).current;

  // Word reveal timer
  useEffect(() => {
    if (phase !== "running") return;
    if (revealedWordCount >= allWords.length) return;

    const timer = setInterval(() => {
      setRevealedWordCount((prev) => {
        if (prev >= allWords.length) {
          clearInterval(timer);
          return prev;
        }
        return prev + WORDS_PER_REVEAL;
      });
    }, REVEAL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [phase, allWords.length]);

  const handleStart = () => {
    startTimeRef.current = performance.now();
    setRevealedWordCount(1);
    setPhase("running");
  };

  const handleSkipUrge = () => {
    skipUrgeTimeRef.current = performance.now();
    setPhase("urged");
  };

  const handleContinue = () => {
    setPhase("done");
    const now = performance.now();
    const result: FocusDurationResult = {
      timeToFirstSkipUrge: Math.round(skipUrgeTimeRef.current - startTimeRef.current),
      continuedAfterUrge: true,
      totalTimeFocused: Math.round(now - startTimeRef.current),
    };
    sessionStorage.setItem("focus-result", JSON.stringify(result));
    onComplete(result);
  };

  const handleStop = () => {
    setPhase("done");
    const urgeTime = skipUrgeTimeRef.current - startTimeRef.current;
    const result: FocusDurationResult = {
      timeToFirstSkipUrge: Math.round(urgeTime),
      continuedAfterUrge: false,
      totalTimeFocused: Math.round(urgeTime),
    };
    sessionStorage.setItem("focus-result", JSON.stringify(result));
    onComplete(result);
  };

  if (phase === "instructions") {
    return (
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle className="text-2xl">Focus Duration</CardTitle>
          <CardDescription>How long can you sustain your attention?</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center space-y-6">
          <div className="space-y-4 text-sm sm:text-base">
            <p>
              A passage of text will slowly appear on screen, one word at a time.
            </p>
            <p>
              Simply <strong>read along</strong> at the pace it reveals. There's no trick — just follow the words.
            </p>
            <p>
              Whenever you feel the <strong>urge to skip ahead</strong> or do something else, press the{" "}
              <strong>"I want to skip"</strong> button.
            </p>
            <p className="text-muted-foreground text-sm">
              There's no timer visible during the test. Just read naturally and be honest about when the urge hits.
            </p>
          </div>
          <Button size="lg" className="w-full" onClick={handleStart} data-testid="start-focus-test">
            Begin Reading
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === "urged") {
    const elapsedSec = Math.round((skipUrgeTimeRef.current - startTimeRef.current) / 1000);
    const minutes = Math.floor(elapsedSec / 60);
    const seconds = elapsedSec % 60;
    const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    return (
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle className="text-xl">You felt the urge to skip</CardTitle>
          <CardDescription>
            You lasted <strong>{timeStr}</strong> before wanting to move on.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center space-y-6">
          <p className="text-center text-sm text-muted-foreground">
            Would you like to continue reading, or stop here?
          </p>
          <div className="space-y-3">
            <Button
              size="lg"
              className="w-full"
              onClick={handleContinue}
              data-testid="focus-continue"
            >
              I'll keep going
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={handleStop}
              data-testid="focus-stop"
            >
              Stop here
            </Button>
          </div>
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

  // Running phase — reveal text word by word
  // Group revealed words by paragraph
  const revealedWords = allWords.slice(0, revealedWordCount);
  const paragraphs: Map<number, string[]> = new Map();
  for (const w of revealedWords) {
    if (!paragraphs.has(w.paragraphIndex)) {
      paragraphs.set(w.paragraphIndex, []);
    }
    paragraphs.get(w.paragraphIndex)!.push(w.word);
  }

  return (
    <div className="flex-1 flex flex-col" data-testid="focus-running">
      <div className="flex-1 overflow-y-auto px-1 py-4">
        <div className="space-y-4 text-base sm:text-lg leading-relaxed">
          {Array.from(paragraphs.entries()).map(([pi, words]) => (
            <p key={pi}>{words.join(" ")}</p>
          ))}
        </div>
      </div>
      <div className="sticky bottom-0 py-4 bg-background border-t">
        <Button
          size="lg"
          variant="destructive"
          className="w-full"
          onClick={handleSkipUrge}
          data-testid="skip-urge-button"
        >
          I want to skip
        </Button>
      </div>
    </div>
  );
}
