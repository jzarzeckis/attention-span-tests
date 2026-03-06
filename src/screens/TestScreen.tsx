import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TEST_LIST } from "../types";
import { SARTTest } from "../tests/SARTTest";
import type { SARTResult } from "../tests/SARTTest";
import { FocusDurationTest } from "../tests/FocusDurationTest";
import type { FocusDurationResult } from "../tests/FocusDurationTest";

interface TestScreenProps {
  testIndex: number;
  onComplete: () => void;
}

export function TestScreen({ testIndex, onComplete }: TestScreenProps) {
  const test = TEST_LIST[testIndex];
  if (!test) return null;

  const progress = ((testIndex + 1) / TEST_LIST.length) * 100;

  const handleSARTComplete = (result: SARTResult) => {
    sessionStorage.setItem("sart-result", JSON.stringify(result));
    onComplete();
  };

  const handleFocusComplete = (result: FocusDurationResult) => {
    sessionStorage.setItem("focus-result", JSON.stringify(result));
    onComplete();
  };

  const renderTest = () => {
    if (test.id === "sart") {
      return <SARTTest onComplete={handleSARTComplete} />;
    }
    if (test.id === "focus") {
      return <FocusDurationTest onComplete={handleFocusComplete} />;
    }

    // Placeholder for other tests
    return (
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle className="text-2xl">{test.name}</CardTitle>
          <CardDescription>
            This test will be implemented in a future update.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              Test placeholder — coming soon
            </p>
            <Button onClick={onComplete}>
              {testIndex < TEST_LIST.length - 1
                ? "Next Test"
                : "View Results"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col min-h-svh px-4 py-6 sm:px-6">
      <div className="max-w-lg w-full mx-auto flex flex-col flex-1">
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Test {testIndex + 1} of {TEST_LIST.length}
            </span>
            <span>{test.name}</span>
          </div>
          <Progress value={progress} />
        </div>

        {renderTest()}
      </div>
    </div>
  );
}
