import { useEffect, useState } from "react";
import { ArrowLeft, Users, ClipboardList, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
} from "recharts";

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
  scatterAgeVsScore: Array<{ age: string; score: number }>;
  scatterSelfVsScore: Array<{ selfRated: number; score: number }>;
  totalVisitors: number;
  totalSurveys: number;
}

// ── Custom SVG Funnel / Sankey ────────────────────────────────────────────────
// We render this manually (no recharts Sankey) so that we have full positional
// control. recharts Sankey auto-assigns column depth as max(source_depths)+1,
// which placed any single-sink dropout node in the same column as "All 4 Tests"
// and caused overlap. With a hand-rolled SVG there is no such constraint.

const SCORE_BUCKET_TIER_NAMES: Record<string, string> = {
  "0–9":   "NPC of the Algorithm",
  "10–19": "Skull Full of Reels",
  "20–29": "Certified Brain-Rot Victim",
  "30–39": "Algorithm's Favourite Idiot",
  "40–49": "Dopamine Goblin",
  "50–59": "TikTok Attention Span",
  "60–69": "Meme Consumer",
  "70–79": "Chronic Scroller",
  "80–89": "Mildly Internet-Poisoned",
  "90–99": "Functional Human",
};

const _SVG_W = 720;
const _SVG_H = 480;
const _MARGIN = { top: 20, right: 170, bottom: 20, left: 10 };
const _NODE_W = 12;
const _NPAD = 5;

interface CNode {
  id: string;
  label: string;
  count: number;
  x: number;
  y: number;
  h: number;
  color: string;
  nextOutY: number;
  nextInY: number;
}

interface CLink {
  sourceX: number;
  targetX: number;
  sourceY: number;
  targetY: number;
  w: number;
  color: string;
}

function buildCustomSankey(
  funnel: FunnelStep[],
  scoreDistribution: DistributionBucket[],
): { nodes: CNode[]; links: CLink[] } | null {
  const funnelMap = Object.fromEntries(funnel.map((s) => [s.label, s.count]));
  const visited    = funnelMap["Visited"]     ?? 0;
  const surveyDone = funnelMap["Survey done"] ?? 0;
  const sartDone   = funnelMap["SART done"]   ?? 0;
  const stroopDone = funnelMap["Stroop done"] ?? 0;
  const pvtDone    = funnelMap["PVT done"]    ?? 0;
  const gonogoDone = funnelMap["GoNoGo done"] ?? 0;

  if (visited === 0) return null;

  const W = _SVG_W - _MARGIN.left - _MARGIN.right;
  const H = _SVG_H - _MARGIN.top - _MARGIN.bottom;
  const upperH = H * 0.62; // main flow nodes live in the upper 62%
  const scale = (upperH * 0.85) / visited;

  const mainStages = [
    { shortLabel: "Visitors", count: visited    },
    { shortLabel: "Survey",   count: surveyDone },
    { shortLabel: "SART",     count: sartDone   },
    { shortLabel: "Stroop",   count: stroopDone },
    { shortLabel: "PVT",      count: pvtDone    },
    { shortLabel: "GoNoGo",   count: gonogoDone },
  ];

  const activeBuckets = scoreDistribution.filter((b) => b.count > 0);
  const totalDropped = visited - gonogoDone;

  // 6 main-stage columns + 1 final column for buckets/sink
  const colSpacing = W / 6;
  const finalColX = 6 * colSpacing;

  const makeNode = (
    id: string, label: string, count: number,
    x: number, y: number, color: string,
  ): CNode => {
    const h = Math.max(count * scale, 4);
    return { id, label, count, x, y, h, color, nextOutY: y, nextInY: y };
  };

  // Main flow nodes — each vertically centred in the upper area
  const mainNodes: CNode[] = mainStages.map((s, i) => {
    const h = Math.max(s.count * scale, 4);
    const y = (upperH - h) / 2;
    return makeNode(`stage-${i}`, s.shortLabel, s.count, i * colSpacing, y, "#818cf8");
  });

  // Score bucket nodes — stacked in the upper area of the final column
  let bucketCurY = 0;
  const rawBuckets = activeBuckets.map((b) => {
    const h = Math.max(b.count * scale, 4);
    const pct = parseInt(b.bucket.split("–")[0] ?? "0", 10);
    const color = pct < 40 ? "#f87171" : pct < 70 ? "#fbbf24" : "#34d399";
    const node = makeNode(`bucket-${b.bucket}`, b.bucket, b.count, finalColX, bucketCurY, color);
    bucketCurY += node.h + _NPAD;
    return node;
  });
  const totalBucketH = Math.max(0, bucketCurY - _NPAD);
  const bucketOffsetY = (upperH - totalBucketH) / 2;
  const bucketNodes: CNode[] = rawBuckets.map((n) => ({
    ...n,
    y: n.y + bucketOffsetY,
    nextOutY: n.y + bucketOffsetY,
    nextInY:  n.y + bucketOffsetY,
  }));

  // Single dropout sink — below the upper area
  const dropNode = totalDropped > 0
    ? makeNode("dropout", "🪦 Skill Issue", totalDropped, finalColX, upperH + (H - upperH) * 0.35, "#f87171")
    : null;

  // ── Link builder ─────────────────────────────────────────────────────────
  const links: CLink[] = [];
  const addLink = (src: CNode, tgt: CNode, value: number, color: string) => {
    if (value <= 0) return;
    const w = Math.max(value * scale, 1.5);
    links.push({
      sourceX: src.x + _NODE_W,
      targetX: tgt.x,
      sourceY: src.nextOutY + w / 2,
      targetY: tgt.nextInY  + w / 2,
      w,
      color,
    });
    src.nextOutY += w;
    tgt.nextInY  += w;
  };

  // 1. Main continuation flow (top portion of each node)
  for (let i = 0; i < mainNodes.length - 1; i++) {
    const src = mainNodes[i];
    const tgt = mainNodes[i + 1];
    if (src && tgt) addLink(src, tgt, mainStages[i + 1]?.count ?? 0, "#818cf8");
  }

  // 2. Dropout flows → single sink (below continuation, so they exit from the
  //    bottom of each stage node; added closest-to-sink first to avoid crossings)
  if (dropNode) {
    const dropAmounts = [
      visited    - surveyDone,
      surveyDone - sartDone,
      sartDone   - stroopDone,
      stroopDone - pvtDone,
      pvtDone    - gonogoDone,
    ];
    for (let i = dropAmounts.length - 1; i >= 0; i--) {
      const src = mainNodes[i];
      const amt = dropAmounts[i];
      if (src && amt && amt > 0) addLink(src, dropNode, amt, "#f87171");
    }
  }

  // 3. Score bucket fan-out from final stage
  const lastMain = mainNodes[mainNodes.length - 1];
  activeBuckets.forEach((b, i) => {
    const tgt = bucketNodes[i];
    if (lastMain && tgt) addLink(lastMain, tgt, b.count, "#34d399");
  });

  const allNodes = [...mainNodes, ...bucketNodes, ...(dropNode ? [dropNode] : [])];
  return { nodes: allNodes, links };
}

function VisitorFlowSankey({
  funnel,
  scoreDistribution,
}: {
  funnel: FunnelStep[];
  scoreDistribution: DistributionBucket[];
}) {
  const result = buildCustomSankey(funnel, scoreDistribution);

  if (!result || result.links.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No data yet. Share the link and come back when participants start taking the test!
      </p>
    );
  }

  const { nodes, links } = result;
  const mainNodes   = nodes.filter((n) => n.id.startsWith("stage-"));
  const bucketNodes = nodes.filter((n) => n.id.startsWith("bucket-"));
  const dropNode    = nodes.find((n) => n.id === "dropout");

  const innerH  = _SVG_H - _MARGIN.top - _MARGIN.bottom;
  const upperH  = innerH * 0.62;
  const labelY  = upperH + 6; // label row sits just below the flow bars

  return (
    <div style={{ width: "100%", height: _SVG_H }}>
      <svg
        viewBox={`0 0 ${_SVG_W} ${_SVG_H}`}
        style={{ width: "100%", height: "100%" }}
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform={`translate(${_MARGIN.left},${_MARGIN.top})`}>
          {/* Links — drawn behind nodes */}
          {links.map((link, i) => {
            const cp   = (link.targetX - link.sourceX) / 2;
            const half = link.w / 2;
            return (
              <path
                key={i}
                d={[
                  `M${link.sourceX},${link.sourceY - half}`,
                  `C${link.sourceX + cp},${link.sourceY - half}`,
                  `${link.targetX - cp},${link.targetY - half}`,
                  `${link.targetX},${link.targetY - half}`,
                  `L${link.targetX},${link.targetY + half}`,
                  `C${link.targetX - cp},${link.targetY + half}`,
                  `${link.sourceX + cp},${link.sourceY + half}`,
                  `${link.sourceX},${link.sourceY + half} Z`,
                ].join(" ")}
                fill={link.color}
                fillOpacity={0.25}
              />
            );
          })}

          {/* Main flow nodes — labels below the flow area */}
          {mainNodes.map((node) => (
            <g key={node.id}>
              <rect x={node.x} y={node.y} width={_NODE_W} height={node.h} fill={node.color} fillOpacity={0.9} rx={2} />
              <text x={node.x + _NODE_W / 2} y={labelY} textAnchor="middle"
                style={{ fontSize: "10px", fill: "#9ca3af", fontFamily: "inherit" }}>
                {node.label}
              </text>
              <text x={node.x + _NODE_W / 2} y={labelY + 13} textAnchor="middle"
                style={{ fontSize: "9px", fill: "#6b7280", fontFamily: "inherit" }}>
                {node.count.toLocaleString()}
              </text>
            </g>
          ))}

          {/* Score bucket nodes — labels to the right */}
          {bucketNodes.map((node) => (
            <g key={node.id}>
              <rect x={node.x} y={node.y} width={_NODE_W} height={node.h} fill={node.color} fillOpacity={0.9} rx={2} />
              <text x={node.x + _NODE_W + 5} y={node.y + node.h / 2}
                textAnchor="start" dominantBaseline="middle"
                style={{ fontSize: "10px", fill: "#9ca3af", fontFamily: "inherit" }}>
                {node.label} ({node.count.toLocaleString()})
              </text>
            </g>
          ))}

          {/* Single dropout sink — label to the right */}
          {dropNode && (
            <g>
              <rect x={dropNode.x} y={dropNode.y} width={_NODE_W} height={dropNode.h} fill={dropNode.color} fillOpacity={0.9} rx={2} />
              <text x={dropNode.x + _NODE_W + 5} y={dropNode.y + dropNode.h / 2}
                textAnchor="start" dominantBaseline="middle"
                style={{ fontSize: "10px", fill: "#f87171", fontFamily: "inherit" }}>
                {dropNode.label} ({dropNode.count.toLocaleString()})
              </text>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}

// ── Vertical bar chart (for histograms) ───────────────────────────────────────

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

// ── Scatter Plots ─────────────────────────────────────────────────────────────

const AGE_ORDER = ["13–15", "16–17", "18–20", "21+"];

function scoreColor(score: number): string {
  if (score >= 70) return "#34d399";
  if (score >= 40) return "#fbbf24";
  return "#f87171";
}

function AgeVsScoreScatter({ data }: { data: Array<{ age: string; score: number }> }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No data yet</p>;
  }

  const points = data.map((d, i) => ({
    x: AGE_ORDER.indexOf(d.age) + ((i % 7) - 3) * 0.065,
    y: d.score,
    age: d.age,
    score: d.score,
  }));

  return (
    <div style={{ width: "100%", height: 240 }} className="text-muted-foreground">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="x"
            type="number"
            domain={[-0.6, 3.6]}
            ticks={[0, 1, 2, 3]}
            tickFormatter={(v: number) => AGE_ORDER[Math.round(v)] ?? ""}
            tick={{ fontSize: 11, fill: "currentColor" }}
            stroke="currentColor"
            label={{ value: "Age group", position: "insideBottom", offset: -15, fontSize: 11, fill: "currentColor" }}
          />
          <YAxis
            dataKey="y"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "currentColor" }}
            stroke="currentColor"
            label={{ value: "Score", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: "currentColor" }}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload as { age: string; score: number } | undefined;
              if (!d) return null;
              return (
                <div className="bg-background border rounded px-2 py-1 text-xs shadow-md">
                  <div>Age: {d.age}</div>
                  <div>Score: {d.score}/100</div>
                </div>
              );
            }}
          />
          <Scatter data={points} fillOpacity={0.85}>
            {points.map((p, i) => (
              <Cell key={i} fill={scoreColor(p.score)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function SelfVsScoreScatter({ data }: { data: Array<{ selfRated: number; score: number }> }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No data yet</p>;
  }

  const points = data.map((d, i) => ({
    x: d.selfRated + ((i % 5) - 2) * 0.06,
    y: d.score,
    selfRated: d.selfRated,
    score: d.score,
  }));

  const selfLabels: Record<number, string> = {
    1: "Very poor",
    2: "Poor",
    3: "Average",
    4: "Good",
    5: "Excellent",
  };

  return (
    <div style={{ width: "100%", height: 240 }} className="text-muted-foreground">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0.4, 5.6]}
            ticks={[1, 2, 3, 4, 5]}
            tickFormatter={(v: number) => String(Math.round(v))}
            tick={{ fontSize: 11, fill: "currentColor" }}
            stroke="currentColor"
            label={{ value: "Self-rated attention (1–5)", position: "insideBottom", offset: -15, fontSize: 11, fill: "currentColor" }}
          />
          <YAxis
            dataKey="y"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "currentColor" }}
            stroke="currentColor"
            label={{ value: "Actual score", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: "currentColor" }}
          />
          <ReferenceLine
            segment={[{ x: 1, y: 10 }, { x: 5, y: 90 }]}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 4"
            strokeOpacity={0.4}
            label={{ value: "perfect calibration", position: "insideTopLeft", fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload as { selfRated: number; score: number } | undefined;
              if (!d) return null;
              return (
                <div className="bg-background border rounded px-2 py-1 text-xs shadow-md">
                  <div>Self-rated: {d.selfRated}/5 ({selfLabels[d.selfRated] ?? ""})</div>
                  <div>Actual score: {d.score}/100</div>
                </div>
              );
            }}
          />
          <Scatter data={points} fillOpacity={0.85}>
            {points.map((p, i) => (
              <Cell key={i} fill={scoreColor(p.score)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
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
          {filteredData.map((row) => {
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

            {/* Sankey Funnel */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Visitor Flow — Where People Drop Off</CardTitle>
                <CardDescription className="text-xs">
                  From first visit through all four tests. Blue flows continue right; red flows drop to a single
                  🪦 Skill Issue sink. Completers fan out into score buckets (red = fried, yellow = mid, green = sharp).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VisitorFlowSankey funnel={stats.funnel} scoreDistribution={stats.scoreDistribution} />
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

            {/* Age vs Score scatter */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Age vs Score</CardTitle>
                <CardDescription className="text-xs">
                  Each dot is one person who completed all 4 tests. Colour = performance bucket (red = fried, yellow = mid, green = sharp).
                  Dots are jittered horizontally to reduce overlap.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AgeVsScoreScatter data={stats.scatterAgeVsScore} />
              </CardContent>
            </Card>

            {/* Self-perception vs Performance scatter */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Self-Perception vs Actual Performance</CardTitle>
                <CardDescription className="text-xs">
                  How well does self-rated attention predict real scores? Points above the dashed line = underestimators,
                  below = overestimators. Dashed line = perfect calibration.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SelfVsScoreScatter data={stats.scatterSelfVsScore} />
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
