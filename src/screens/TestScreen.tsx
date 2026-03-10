import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TEST_LIST } from "@/types";
import { resultsStore } from "@/utils/resultsStore";
import { getOrCreateVisitorId } from "@/utils/visitorId";
import { track } from "@/utils/analytics";
import { SARTTest } from "./tests/SARTTest";
import { StroopTest } from "./tests/StroopTest";
import { PVTTest } from "./tests/PVTTest";
import { GoNoGoTest } from "./tests/GoNoGoTest";

function trackTestEvent(testId: string, action: "start" | "finish", extra?: { results?: unknown; skipped?: boolean }) {
  const visitorId = getOrCreateVisitorId();
  fetch("/api/test-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, visitorId, testId, ...extra }),
  }).catch(() => {});
}

interface TestScreenProps {
  testIndex: number;
  onNext: () => void;
}

function PlaceholderTest({ name, onNext, isLastTest }: { name: string; onNext: () => void; isLastTest: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>
          This test is coming soon. Click below to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-40 items-center justify-center rounded-lg bg-muted text-muted-foreground text-sm">
          Test content will appear here
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" size="lg" onClick={onNext}>
          {isLastTest ? "See Results" : "Next Test"}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function TestScreen({ testIndex, onNext }: TestScreenProps) {
  const test = TEST_LIST[testIndex];
  const totalTests = TEST_LIST.length;
  const progressPercent = (testIndex / totalTests) * 100;
  const isLastTest = testIndex === totalTests - 1;
  const [showAssistance, setShowAssistance] = useState(false);

  // Prevent double-advancing (skip + test completion racing)
  const doneRef = useRef(false);
  // Track whether user completed/skipped this test (vs. abandoning the page)
  const completedRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    completedRef.current = false;
    // Track test start
    if (test?.id) {
      trackTestEvent(test.id, "start");
      track("test_start", { test_id: test.id, test_index: testIndex });
    }
  }, [testIndex, test?.id]);

  const safeNext = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    completedRef.current = true;
    // Track test finish with results
    if (test?.id) {
      const results = resultsStore.getItem(test.id);
      const isSkipped = results && "skipped" in results && results.skipped === true;
      trackTestEvent(test.id, "finish", {
        results: isSkipped ? undefined : results ?? undefined,
        skipped: !!isSkipped,
      });
      track("test_complete", { test_id: test.id, test_index: testIndex });
    }
    onNext();
  }, [onNext, test?.id, testIndex]);

  const handleSkip = () => {
    const testId = test?.id;
    if (testId && !resultsStore.hasItem(testId)) {
      resultsStore.setItem(testId, { skipped: true });
    }
    if (testId) {
      trackTestEvent(testId, "finish", { skipped: true });
      track("test_skip", { test_id: testId, test_index: testIndex });
    }
    safeNext();
  };

  const renderTest = () => {
    if (test?.id === "sart") {
      return <SARTTest onComplete={safeNext} />;
    }
    if (test?.id === "stroop") {
      return <StroopTest onComplete={safeNext} />;
    }
    if (test?.id === "pvt") {
      return <PVTTest onComplete={safeNext} />;
    }
    if (test?.id === "gonogo") {
      return <GoNoGoTest onComplete={safeNext} />;
    }
    return (
      <PlaceholderTest
        name={(test as { name: string } | undefined)?.name ?? ""}
        onNext={safeNext}
        isLastTest={isLastTest}
      />
    );
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Test {testIndex + 1} of {totalTests}</span>
            <span>{test?.name}</span>
          </div>
          <Progress value={progressPercent} />
        </div>

        {renderTest()}

        <div className="flex justify-center pt-1">
          <button
            onClick={handleSkip}
            className="text-xs text-muted-foreground/40 hover:text-muted-foreground/70 underline underline-offset-2 transition-colors"
          >
            Skip this test
          </button>
        </div>
      </div>

      {/* Assistance Button */}
      <button
        onClick={() => setShowAssistance((v) => !v)}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground/80 hover:bg-muted/80 transition-all active:scale-95"
        aria-label="Toggle assistance"
      >
        {showAssistance ? "✕ Hide assistance" : "🏄 Assistance"}
      </button>

      {/* Subway Surfers Assistance Overlay */}
      {showAssistance && (
        <div className="fixed bottom-20 right-5 z-40 overflow-hidden rounded-2xl shadow-2xl border border-border bg-black"
          style={{ width: 200, height: 356 }}>
          <iframe
            src="https://www.youtube.com/embed/xm3YgoEiEDc?autoplay=1&mute=0&loop=1&playlist=xm3YgoEiEDc&controls=0&modestbranding=1"
            allow="autoplay; encrypted-media"
            allowFullScreen
            className="h-full w-full"
            title="Subway Surfers Gameplay"
          />
        </div>
      )}
    </div>
  );
}
