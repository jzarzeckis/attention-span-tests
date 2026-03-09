import { useEffect, useState } from "react";
import { ArrowLeft, Users, ClipboardList, BarChart2, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StatsScreenProps {
  onBack: () => void;
}

interface FunnelStep {
  label: string;
  count: number;
}

interface DistributionBucket {
  bucket: string;
  count: number;
}

interface DemographicRow {
  label: string;
  count: number;
  avgSartCommission?: number | null;
  avgPvtRT?: number | null;
  avgStroopInterference?: number | null;
  avgPvtLapse?: number | null;
}

interface StatsData {
  configured: boolean;
  funnel: FunnelStep[];
  scoreDistribution: DistributionBucket[];
  byAge: DemographicRow[];
  byScreenTime: DemographicRow[];
  byShortFormUsage: DemographicRow[];
  byRestlessness: DemographicRow[];
  bySelfRatedAttention: DemographicRow[];
  pvtMedianRTs: DistributionBucket[];
  sartCommissionRates: DistributionBucket[];
  stroopInterference: DistributionBucket[];
  gonogoCommissionRates: DistributionBucket[];
  totalVisitors: number;
  totalSurveys: number;
}

// ── Chart primitives ─────────────────────────────────────────────────────────

function HBar({ value, max, color = "bg-primary" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{value.toLocaleString()}</span>
    </div>
  );
}

function VBar({
  value,
  max,
  label,
  color = "bg-primary",
  tooltip,
}: {
  value: number;
  max: number;
  label: string;
  color?: string;
  tooltip?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0" title={tooltip}>
      <span className="text-xs font-medium tabular-nums text-foreground">{value}</span>
      <div className="w-full bg-muted rounded-t-sm overflow-hidden" style={{ height: 80 }}>
        <div
          className={`w-full rounded-t-sm transition-all duration-700 ${color}`}
          style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground text-center leading-tight break-words w-full">{label}</span>
    </div>
  );
}

// ── Funnel Chart ──────────────────────────────────────────────────────────────

function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  if (steps.length === 0 || steps[0]?.count === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No data yet. Share the link and come back when participants start taking the test!
      </p>
    );
  }

  const maxCount = steps[0]?.count ?? 1;

  return (
    <div className="space-y-1.5">
      {steps.map((step, i) => {
        const pct = maxCount > 0 ? Math.round((step.count / maxCount) * 100) : 0;
        const dropPct =
          i > 0 && steps[i - 1] && steps[i - 1]!.count > 0
            ? Math.round((1 - step.count / steps[i - 1]!.count) * 100)
            : null;

        return (
          <div key={step.label}>
            {dropPct !== null && dropPct > 0 && (
              <div className="flex items-center gap-1 pl-2 py-0.5">
                <TrendingDown className="h-3 w-3 text-destructive/60 shrink-0" />
                <span className="text-[10px] text-destructive/70">{dropPct}% dropped off</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-28 shrink-0 text-right">{step.label}</span>
              <div className="flex-1 bg-muted/40 rounded overflow-hidden" style={{ height: 28 }}>
                <div
                  className="h-full bg-primary/70 rounded flex items-center justify-end pr-2 transition-all duration-700"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                >
                  <span className="text-[10px] font-semibold text-primary-foreground whitespace-nowrap">
                    {step.count.toLocaleString()} ({pct}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Histogram ─────────────────────────────────────────────────────────────────

function Histogram({
  data,
  color = "bg-primary",
  emptyMessage = "No data yet",
}: {
  data: DistributionBucket[];
  color?: string;
  emptyMessage?: string;
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">{emptyMessage}</p>;
  }

  const max = Math.max(...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d) => (
        <VBar
          key={d.bucket}
          value={d.count}
          max={max}
          label={d.bucket}
          color={color}
          tooltip={`${d.bucket}: ${d.count} (${total > 0 ? Math.round((d.count / total) * 100) : 0}%)`}
        />
      ))}
    </div>
  );
}

// ── Demographic Bar Chart ─────────────────────────────────────────────────────

function DemographicChart({
  data,
  metricKey,
  metricLabel,
  unit = "",
  lowerIsBetter = false,
  color = "bg-primary",
  emptyMessage = "No data yet",
}: {
  data: DemographicRow[];
  metricKey: keyof DemographicRow;
  metricLabel: string;
  unit?: string;
  lowerIsBetter?: boolean;
  color?: string;
  emptyMessage?: string;
}) {
  const values = data
    .map((r) => ({ label: r.label, count: r.count, value: r[metricKey] as number | null | undefined }))
    .filter((r) => r.value != null);

  if (values.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">{emptyMessage}</p>;
  }

  const maxVal = Math.max(...values.map((v) => v.value!));
  const minVal = Math.min(...values.map((v) => v.value!));
  const range = maxVal - minVal || 1;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span>{metricLabel}</span>
        {lowerIsBetter && <span className="text-[10px] italic">lower = better</span>}
      </div>
      {values.map((row) => {
        const barPct = ((row.value! - minVal) / range) * 100;
        const isWorst = lowerIsBetter
          ? row.value === maxVal
          : row.value === minVal;
        const isBest = lowerIsBetter
          ? row.value === minVal
          : row.value === maxVal;

        return (
          <div key={row.label} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-36 shrink-0 truncate">{row.label}</span>
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${isWorst ? "bg-destructive/70" : isBest ? "bg-green-500/70" : color}`}
                style={{ width: `${Math.max(barPct, 3)}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-foreground w-16 text-right">
              {row.value!.toFixed(0)}{unit}
            </span>
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
              n={row.count}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 flex flex-col items-center text-center gap-1">
        <Icon className="h-5 w-5 text-muted-foreground mb-1" />
        <p className="text-2xl font-bold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</p>
        <p className="text-xs font-medium">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Self-Rated vs Actual ──────────────────────────────────────────────────────

function SelfRatedVsActual({ data }: { data: DemographicRow[] }) {
  const filteredData = data
    .filter((r) => r.avgSartCommission != null || r.avgPvtRT != null)
    .sort((a, b) => Number(a.label) - Number(b.label));

  if (filteredData.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No data yet</p>;
  }

  const labels = ["1 – Very poor", "2", "3", "4", "5 – Excellent"];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Comparing self-rated attention (1–5) vs objective test metrics.
        If self-perception matched reality, these bars would decrease as rating increases.
      </p>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium mb-2">SART Commission Rate (lower = better impulse control)</p>
          {filteredData.map((row, i) => {
            const val = row.avgSartCommission;
            if (val == null) return null;
            return (
              <div key={row.label} className="flex items-center gap-2 mb-1.5">
                <span className="text-xs text-muted-foreground w-24 shrink-0">{labels[Number(row.label) - 1] ?? row.label}</span>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-orange-500/70 transition-all duration-700"
                    style={{ width: `${Math.min(val * 2.5, 100)}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums w-12 text-right">{val.toFixed(1)}%</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">n={row.count}</Badge>
              </div>
            );
          })}
        </div>
        <div>
          <p className="text-xs font-medium mb-2">PVT Median Reaction Time (lower = better vigilance)</p>
          {filteredData.map((row) => {
            const val = row.avgPvtRT;
            if (val == null) return null;
            return (
              <div key={row.label} className="flex items-center gap-2 mb-1.5">
                <span className="text-xs text-muted-foreground w-24 shrink-0">{labels[Number(row.label) - 1] ?? row.label}</span>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500/70 transition-all duration-700"
                    style={{ width: `${Math.min(((val - 200) / 400) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums w-12 text-right">{val.toFixed(0)}ms</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">n={row.count}</Badge>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function StatsScreen({ onBack }: StatsScreenProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data: StatsData) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load statistics.");
        setLoading(false);
      });
  }, []);

  const totalCompleted = stats
    ? stats.funnel.find((f) => f.label === "GoNoGo done")?.count ?? 0
    : 0;

  return (
    <div className="flex min-h-svh flex-col items-center pt-16 px-4 pb-24">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <Button variant="ghost" size="sm" className="gap-1 -ml-2 mb-4" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Human Behaviour Data</h1>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Aggregated results from all visitors — anonymised, cross-referenced with demographics.
              A live study of attention in the age of short-form content.
            </p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-muted-foreground text-sm">Loading statistics…</div>
          </div>
        )}

        {error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="pt-4 pb-4 text-center text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        {stats && !stats.configured && (
          <Card className="border-muted">
            <CardContent className="pt-4 pb-4 text-center text-sm text-muted-foreground">
              Statistics are not available in this environment (no database configured).
            </CardContent>
          </Card>
        )}

        {stats && stats.configured && (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                icon={Users}
                label="Visitors"
                value={stats.totalVisitors}
                sub="unique visitors tracked"
              />
              <StatCard
                icon={ClipboardList}
                label="Surveys"
                value={stats.totalSurveys}
                sub="demographics collected"
              />
              <StatCard
                icon={BarChart2}
                label="All tests done"
                value={totalCompleted}
                sub="completed all 4 tests"
              />
            </div>

            {/* Funnel */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">User Funnel — Where People Drop Off</CardTitle>
                <CardDescription className="text-xs">
                  Tracks the journey from first visit through completing all four tests. NULL finish times = abandoned.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FunnelChart steps={stats.funnel} />
              </CardContent>
            </Card>

            {/* Score distribution */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Composite Score Distribution</CardTitle>
                <CardDescription className="text-xs">
                  Distribution of overall attention scores for visitors who completed all 4 tests (0 = fully cooked, 100 = untouched).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Histogram
                  data={stats.scoreDistribution}
                  color="bg-primary"
                  emptyMessage="No completed sessions yet"
                />
                <p className="text-[11px] text-muted-foreground mt-3 text-center">
                  Score buckets (10-point intervals). Most people cluster in the 40–70 range.
                </p>
              </CardContent>
            </Card>

            {/* SART Commission Rate Distribution */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">SART: Commission Error Rate Distribution</CardTitle>
                <CardDescription className="text-xs">
                  How often people pressed Space on the forbidden digit "3". Healthy baseline: 8–11%.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Histogram
                  data={stats.sartCommissionRates}
                  color="bg-orange-500/70"
                  emptyMessage="No SART data yet"
                />
              </CardContent>
            </Card>

            {/* PVT Median RT Distribution */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">PVT: Median Reaction Time Distribution</CardTitle>
                <CardDescription className="text-xs">
                  Psychomotor vigilance reaction times. Healthy rested adults: ~250ms. Lapses = &gt;500ms.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Histogram
                  data={stats.pvtMedianRTs}
                  color="bg-blue-500/70"
                  emptyMessage="No PVT data yet"
                />
              </CardContent>
            </Card>

            {/* Stroop Interference Distribution */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Stroop: Interference Effect Distribution</CardTitle>
                <CardDescription className="text-xs">
                  How much slower people are on incongruent (color-word conflict) trials. Typical: ~100ms. Larger = weaker executive control.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Histogram
                  data={stats.stroopInterference}
                  color="bg-purple-500/70"
                  emptyMessage="No Stroop data yet"
                />
              </CardContent>
            </Card>

            {/* Go/No-Go Commission Rate Distribution */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Go/No-Go: Commission Error Rate Distribution</CardTitle>
                <CardDescription className="text-xs">
                  Pressing when you shouldn't. Healthy adults: ~15–20%.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Histogram
                  data={stats.gonogoCommissionRates}
                  color="bg-rose-500/70"
                  emptyMessage="No Go/No-Go data yet"
                />
              </CardContent>
            </Card>

            {/* Short-form usage vs SART */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Short-Form Video Usage vs Attention</CardTitle>
                <CardDescription className="text-xs">
                  Does TikTok time correlate with worse attention? SART commission rate by daily short-form usage.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <DemographicChart
                  data={stats.byShortFormUsage}
                  metricKey="avgSartCommission"
                  metricLabel="Avg SART commission rate (%)"
                  unit="%"
                  lowerIsBetter
                  color="bg-orange-500/70"
                  emptyMessage="No data yet"
                />
                <DemographicChart
                  data={stats.byShortFormUsage}
                  metricKey="avgPvtLapse"
                  metricLabel="Avg PVT lapse rate (%)"
                  unit="%"
                  lowerIsBetter
                  color="bg-blue-500/70"
                  emptyMessage="No data yet"
                />
              </CardContent>
            </Card>

            {/* Age vs SART */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Age vs Impulse Control</CardTitle>
                <CardDescription className="text-xs">
                  SART commission rate by age group. Prefrontal cortex development continues until ~25 years.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DemographicChart
                  data={stats.byAge}
                  metricKey="avgSartCommission"
                  metricLabel="Avg SART commission rate (%)"
                  unit="%"
                  lowerIsBetter
                  color="bg-primary/70"
                  emptyMessage="No data yet"
                />
              </CardContent>
            </Card>

            {/* Screen time vs PVT */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Total Screen Time vs Vigilance</CardTitle>
                <CardDescription className="text-xs">
                  PVT median reaction time by total daily screen time. More screen time often means more sleep disruption.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DemographicChart
                  data={stats.byScreenTime}
                  metricKey="avgPvtRT"
                  metricLabel="Avg PVT median reaction time (ms)"
                  unit="ms"
                  lowerIsBetter
                  color="bg-sky-500/70"
                  emptyMessage="No data yet"
                />
              </CardContent>
            </Card>

            {/* Restlessness vs Stroop */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Restlessness vs Executive Control</CardTitle>
                <CardDescription className="text-xs">
                  Stroop interference score by self-reported restlessness when watching long videos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DemographicChart
                  data={stats.byRestlessness}
                  metricKey="avgStroopInterference"
                  metricLabel="Avg Stroop interference (ms)"
                  unit="ms"
                  lowerIsBetter
                  color="bg-purple-500/70"
                  emptyMessage="No data yet"
                />
              </CardContent>
            </Card>

            {/* Self-rated attention vs actual performance */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Self-Perception vs Objective Performance</CardTitle>
                <CardDescription className="text-xs">
                  How well does your self-rated attention match your actual test results?
                  Research shows that heavy social media users often overestimate their attention.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SelfRatedVsActual data={stats.bySelfRatedAttention} />
              </CardContent>
            </Card>

            {/* Data note */}
            <Card className="border-muted bg-muted/30">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Privacy note:</strong> All data is anonymous.
                  Visitors are tracked via a UUID stored in a browser cookie — no personally identifiable information is collected.
                  Survey answers are voluntary. You can take the test without completing the survey.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
