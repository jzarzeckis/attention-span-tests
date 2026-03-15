import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface BlogScreenProps {
  onBack: () => void;
}

export function BlogScreen({ onBack }: BlogScreenProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black tracking-tight bg-gradient-to-br from-primary to-[oklch(0.78_0.20_100)] bg-clip-text text-transparent">
            Blog
          </h1>
          <p className="text-muted-foreground text-lg">Placeholder page</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Latest Posts</CardTitle>
            <CardDescription>Articles and updates — coming soon.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              This is a placeholder blog page. Real posts will appear here.
            </p>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua.
            </p>
            <p>
              Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
              nisi ut aliquip ex ea commodo consequat.
            </p>
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full" onClick={onBack}>
          ← Back
        </Button>
      </div>
    </div>
  );
}
