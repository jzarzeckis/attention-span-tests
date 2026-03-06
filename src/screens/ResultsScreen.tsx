import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface ResultsScreenProps {
  onRestart: () => void;
}

export function ResultsScreen({ onRestart }: ResultsScreenProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Your Results</h1>
          <p className="text-muted-foreground">Your Digital Attention Profile</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Attention Score</CardTitle>
              <Badge variant="secondary">Pending tests</Badge>
            </div>
            <CardDescription>
              Complete the tests to see your full attention profile compared to pre-digital norms.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Score</span>
                <span className="font-medium">— / 100</span>
              </div>
              <Progress value={0} className="h-3" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Take the tests to see how your attention compares to pre-social-media baselines from published research.
            </p>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button className="w-full" size="lg" onClick={onRestart}>
              Take Test Again
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
