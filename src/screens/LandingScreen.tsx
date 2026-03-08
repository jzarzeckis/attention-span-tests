import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Github } from "lucide-react";
import { TEST_LIST } from "@/types";

interface LandingScreenProps {
  onStart: () => void;
  hasProgress: boolean;
  onContinue: () => void;
  onStartOver: () => void;
}

export function LandingScreen({ onStart, hasProgress, onContinue, onStartOver }: LandingScreenProps) {
  const [showAssistance, setShowAssistance] = useState(false);

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
            <p className="text-xs text-muted-foreground text-center">
              ~15-20 min. Put your phone down. Yes, that one. The test won't feel fair if you're half-scrolling.
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
                Check my brainrot
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
      <a
        href="https://github.com/jzarzeckis/attention-span-tests"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 left-4 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
        aria-label="GitHub repository"
      >
        <Github className="h-4 w-4" />
      </a>

      {/* Assistance Button */}
      <button
        onClick={() => setShowAssistance((v) => !v)}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label="Toggle assistance"
      >
        {showAssistance ? "Hide Assistance" : "🏄 Assistance"}
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
