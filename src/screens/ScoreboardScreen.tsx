import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Trophy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

interface LeaderboardEntry {
  name: string;
  score: number;
}

interface Tier {
  min: number;
  max: number;
  badge: string;
  variant: "default" | "secondary" | "destructive" | "outline";
}

const TIERS: Tier[] = [
  { min: 91, max: 100, badge: "Functional Human", variant: "default" },
  { min: 81, max: 90, badge: "Mildly Internet-Poisoned", variant: "default" },
  { min: 71, max: 80, badge: "Chronic Scroller", variant: "secondary" },
  { min: 61, max: 70, badge: "Meme Consumer", variant: "secondary" },
  { min: 51, max: 60, badge: "TikTok Attention Span", variant: "secondary" },
  { min: 41, max: 50, badge: "Dopamine Goblin", variant: "destructive" },
  { min: 31, max: 40, badge: "Algorithm's Favourite Idiot", variant: "destructive" },
  { min: 21, max: 30, badge: "Certified Brain-Rot Victim", variant: "destructive" },
  { min: 11, max: 20, badge: "Skull Full of Reels", variant: "destructive" },
  { min: 0, max: 10, badge: "NPC of the Algorithm", variant: "destructive" },
];

function getTierForScore(score: number): Tier {
  return TIERS.find((t) => score >= t.min && score <= t.max) ?? TIERS[TIERS.length - 1]!;
}

function TierCard({
  tier,
  entries,
  globalOffset,
  defaultOpen,
}: {
  tier: Tier;
  entries: LeaderboardEntry[];
  globalOffset: number;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (entries.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none py-3 px-4 hover:bg-muted/30 rounded-t-xl transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={tier.variant} className="text-xs">
                  {tier.badge}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {tier.min}–{tier.max} pts · {entries.length} {entries.length === 1 ? "player" : "players"}
                </span>
              </div>
              {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-2 px-4">
            <div className="divide-y divide-border">
              {entries.map((entry, idx) => {
                const rank = globalOffset + idx + 1;
                return (
                  <div key={`${entry.name}-${idx}`} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs font-mono font-bold tabular-nums shrink-0 w-6 text-right ${rank <= 3 ? "text-amber-500" : "text-muted-foreground"}`}>
                        #{rank}
                      </span>
                      {rank === 1 && <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                      <span className="text-sm font-medium truncate">{entry.name}</span>
                    </div>
                    <span className="text-sm font-bold tabular-nums ml-4 shrink-0">{entry.score}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface ScoreboardScreenProps {
  onBack: () => void;
}

export function ScoreboardScreen({ onBack }: ScoreboardScreenProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leaderboard");
      if (!res.ok) throw new Error("Failed to load leaderboard");
      const data = await res.json() as LeaderboardEntry[];
      setEntries(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  // Group entries by tier (entries already sorted high→low from API)
  const tierGroups = TIERS.map((tier) => ({
    tier,
    entries: entries.filter((e) => e.score >= tier.min && e.score <= tier.max),
  }));

  // Compute global offset for each tier (so global rank is continuous)
  let offset = 0;
  const tiersWithOffset = tierGroups.map((group) => {
    const result = { ...group, offset };
    offset += group.entries.length;
    return result;
  });

  return (
    <div className="flex min-h-svh flex-col items-center pt-16 px-4 pb-24">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
            ← Back
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchLeaderboard} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Scoreboard</h1>
          <p className="text-muted-foreground text-sm">
            {entries.length > 0
              ? `${entries.length} ${entries.length === 1 ? "player" : "players"} ranked`
              : "Be the first to submit your score"}
          </p>
        </div>

        {loading && (
          <Card>
            <CardContent className="pt-6 pb-6 text-center">
              <p className="text-sm text-muted-foreground">Loading scoreboard…</p>
            </CardContent>
          </Card>
        )}

        {!loading && error && (
          <Card className="border-destructive/40">
            <CardContent className="pt-4 pb-4 text-center space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button size="sm" variant="outline" onClick={fetchLeaderboard}>
                Try again
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !error && entries.length === 0 && (
          <Card>
            <CardContent className="pt-6 pb-6 text-center">
              <p className="text-sm text-muted-foreground">No scores yet. Take the test and submit your score!</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="space-y-2">
            {tiersWithOffset.map((group, i) => (
              <TierCard
                key={group.tier.badge}
                tier={group.tier}
                entries={group.entries}
                globalOffset={group.offset}
                defaultOpen={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
