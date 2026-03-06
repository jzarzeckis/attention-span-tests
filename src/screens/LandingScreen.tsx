import { Button } from "@/components/ui/button";

export function LandingScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-svh px-6 py-12 text-center">
      <div className="max-w-md w-full space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Attention Span Test
          </h1>
          <p className="text-lg text-muted-foreground">
            A battery of scientifically-grounded cognitive tests measuring your
            attention, impulse control, and focus duration — compared against
            pre-social-media-era baselines.
          </p>
        </div>

        <Button size="lg" className="w-full text-lg py-6" onClick={onStart}>
          Start Test
        </Button>

        <p className="text-sm text-muted-foreground">
          6 tests &middot; ~15 minutes &middot; free &amp; private
        </p>
      </div>
    </div>
  );
}
