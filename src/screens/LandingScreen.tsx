import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, Trophy, BarChart2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TEST_LIST } from "@/types";

interface LandingScreenProps {
  onStart: () => void;
  hasProgress: boolean;
  onContinue: () => void;
  onStartOver: () => void;
  isReturningVisitor?: boolean;
}

export function LandingScreen({ onStart, hasProgress, onContinue, onStartOver, isReturningVisitor }: LandingScreenProps) {
  const [giveUpCount, setGiveUpCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/giveupcounter")
      .then((res) => res.json())
      .then((data: { count?: number }) => {
        if (typeof data.count === "number") setGiveUpCount(data.count);
      })
      .catch(() => {});
  }, []);

  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center p-4"
      style={{ backgroundImage: 'radial-gradient(ellipse 90% 50% at 50% -10%, oklch(0.25 0.10 142 / 0.5) 0%, transparent 70%)' }}
    >
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black tracking-tight bg-gradient-to-br from-primary to-[oklch(0.78_0.20_100)] bg-clip-text text-transparent">Brainrot Meter</h1>
          <p className="text-muted-foreground text-lg">
            Find out how fried your attention span really is.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Four tests. No mercy.</CardTitle>
            <CardDescription>
              {TEST_LIST.length} scientifically-grounded cognitive tests measuring your attention, impulse control, and focus duration. ~15-20 minutes. Results may be humbling.
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
            <div className="w-full rounded-lg border border-muted-foreground/20 bg-muted/40 px-4 py-3 text-center">
              {giveUpCount === null ? (
                <div className="flex flex-col items-center gap-1.5">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-44" />
                </div>
              ) : (
                <>
                  <p className="text-2xl font-black text-foreground/70">
                    {giveUpCount.toLocaleString()}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">
                    people have given up on this test
                  </p>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              ~15-20 min. Put your phone down. Yes, that one. The test won't feel fair if you're half-scrolling.
            </p>
            {isReturningVisitor && !hasProgress && (
              <p className="text-xs text-primary/80 text-center bg-primary/5 rounded-md px-3 py-2">
                Welcome back! Your survey answers are saved — you'll go straight to the tests.
              </p>
            )}
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
                Check my brainrot
              </Button>
            )}
            <Button asChild className="w-full gap-2" size="sm" variant="ghost">
              <Link href="/scoreboard">
                <Trophy className="h-4 w-4" />
                Scoreboard
              </Link>
            </Button>
            <Button asChild className="w-full gap-2" size="sm" variant="ghost">
              <Link href="/stats">
                <BarChart2 className="h-4 w-4" />
                Stats
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
      <a
        href="https://github.com/jzarzeckis/attention-span-tests"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
        aria-label="GitHub repository"
      >
        <Github className="h-4 w-4" />
      </a>
    </div>
  );
}
