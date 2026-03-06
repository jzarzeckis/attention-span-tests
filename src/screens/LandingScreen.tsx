import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TEST_LIST } from "@/types";

interface LandingScreenProps {
  onStart: () => void;
  hasProgress: boolean;
  onContinue: () => void;
  onStartOver: () => void;
}

export function LandingScreen({ onStart, hasProgress, onContinue, onStartOver }: LandingScreenProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Attention Span Test</h1>
          <p className="text-muted-foreground text-lg">
            Discover how your focus compares to pre-social-media norms
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>What to expect</CardTitle>
            <CardDescription>
              A battery of {TEST_LIST.length} scientifically-grounded cognitive tests measuring your attention, impulse control, and focus duration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {TEST_LIST.map((test, i) => (
                <li key={test.id} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    {i + 1}
                  </span>
                  {test.name}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <p className="text-xs text-muted-foreground text-center">
              Takes approximately 15-20 minutes. Find a quiet place and give it your full attention.
            </p>
            {hasProgress ? (
              <>
                <Button className="w-full" size="lg" onClick={onContinue}>
                  Continue where you left off
                </Button>
                <Button className="w-full" size="lg" variant="outline" onClick={onStartOver}>
                  Start over
                </Button>
              </>
            ) : (
              <Button className="w-full" size="lg" onClick={onStart}>
                Start Test
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
