import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TEST_LIST } from "@/types";
import { SARTTest } from "./tests/SARTTest";
import { StroopTest } from "./tests/StroopTest";
import { PVTTest } from "./tests/PVTTest";
import { GoNoGoTest } from "./tests/GoNoGoTest";

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

  // Prevent double-advancing (skip + test completion racing)
  const doneRef = useRef(false);
  useEffect(() => {
    doneRef.current = false;
  }, [testIndex]);

  const safeNext = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onNext();
  }, [onNext]);

  const handleSkip = () => {
    const testId = test?.id;
    if (testId && !sessionStorage.getItem(testId)) {
      sessionStorage.setItem(testId, JSON.stringify({ skipped: true }));
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
    </div>
  );
}
