import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ResultsScreenProps {
  onRestart: () => void;
}

export function ResultsScreen({ onRestart }: ResultsScreenProps) {
  return (
    <div className="flex flex-col items-center min-h-svh px-4 py-8 sm:px-6">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Your Results</h1>
          <p className="text-muted-foreground">
            Detailed results will appear here once tests are implemented.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Digital Attention Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Results and scoring coming soon.
            </p>
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full" onClick={onRestart}>
          Start Over
        </Button>
      </div>
    </div>
  );
}
