import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TEST_LIST } from "@/types";

interface TestScreenProps {
  testIndex: number;
  onNext: () => void;
}

export function TestScreen({ testIndex, onNext }: TestScreenProps) {
  const test = TEST_LIST[testIndex];
  const totalTests = TEST_LIST.length;
  const progressPercent = ((testIndex) / totalTests) * 100;
  const isLastTest = testIndex === totalTests - 1;

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

        <Card>
          <CardHeader>
            <CardTitle>{test?.name}</CardTitle>
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
      </div>
    </div>
  );
}
