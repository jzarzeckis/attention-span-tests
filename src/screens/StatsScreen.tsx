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

// ── D3-style Sankey layout ────────────────────────────────────────────────────
// Implements the same iterative-relaxation algorithm used by d3-sankey
// (https://github.com/d3/d3-sankey, MIT licence) without adding a dependency.
// Key trick: the dropout sink node is forced into the rightmost column via a
// custom alignment function, so it shares a column with the score buckets and
// D3's relaxation keeps them separated automatically.

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

interface SNode {
  id: string;
  label: string;
  value: number;
  depth: number;
  layer: number;
  x0: number; x1: number;
  y0: number; y1: number;
  color: string;
  sourceLinks: SLink[];
  targetLinks: SLink[];
}

interface SLink {
  source: SNode;
  target: SNode;
  value: number;
  width: number;
  y0: number;  // y-centre at source end
  y1: number;  // y-centre at target end
  color: string;
}

function bucketColor(bucket: string): string {
  const lo = parseInt(bucket.split("–")[0] ?? "0", 10);
  return lo < 40 ? "#f87171" : lo < 70 ? "#fbbf24" : "#34d399";
}

// ── Core layout functions (adapted from d3-sankey) ────────────────────────────

function assignDepths(nodes: SNode[]) {
  // BFS from source nodes to assign depth
  let current = new Set(nodes.filter((n) => n.targetLinks.length === 0));
  let depth = 0;
  while (current.size > 0) {
    for (const n of current) n.depth = depth;
    const next = new Set<SNode>();
    for (const n of current) for (const l of n.sourceLinks) next.add(l.target);
    current = next;
    depth++;
    if (depth > nodes.length) break; // cycle guard
  }
}

function assignLayers(nodes: SNode[], cols: number) {
  // Like sankeyLeft but force "dropout" to last column
  for (const n of nodes) {
    n.layer = n.id === "dropout"
      ? cols - 1
      : Math.max(0, Math.min(cols - 1, n.depth));
  }
}

function initY(columnNodes: SNode[][], innerH: number, nodePad: number, scale: number) {
  // Use a uniform scale so node heights match link widths exactly.
  // Each column is centred vertically within innerH.
  for (const col of columnNodes) {
    if (col.length === 0) continue;
    const totalH = col.reduce((s, n) => s + Math.max(n.value * scale, 2), 0);
    const gaps   = (col.length - 1) * nodePad;
    const blockH = totalH + gaps;
    let y = (innerH - blockH) / 2;  // centre the block
    for (const n of col) {
      const h = Math.max(n.value * scale, 2);
      n.y0 = y;
      n.y1 = y + h;
      y += h + nodePad;
    }
  }
}

// Pull each node toward the weighted centre of the nodes it flows INTO (rightward pass)
function relaxTopDown(columnNodes: SNode[][], nodePad: number) {
  for (const col of columnNodes) {
    for (const n of col) {
      if (n.sourceLinks.length === 0) continue; // sinks have no outgoing links
      const total = n.sourceLinks.reduce((s, l) => s + l.value, 0);
      if (total === 0) continue;
      const weighted = n.sourceLinks.reduce((s, l) => {
        // l.target is the downstream node this link flows INTO
        return s + l.value * ((l.target.y0 + l.target.y1) / 2);
      }, 0);
      const dy = weighted / total - (n.y0 + n.y1) / 2;
      n.y0 += dy;
      n.y1 += dy;
    }
    resolveCollisions(col, nodePad);
  }
}

// Pull each node toward the weighted centre of the nodes it receives FROM (leftward pass)
function relaxBottomUp(columnNodes: SNode[][], nodePad: number) {
  for (let c = columnNodes.length - 1; c >= 0; c--) {
    const col = columnNodes[c]!;
    for (const n of col) {
      if (n.targetLinks.length === 0) continue; // sources have no incoming links
      const total = n.targetLinks.reduce((s, l) => s + l.value, 0);
      if (total === 0) continue;
      const weighted = n.targetLinks.reduce((s, l) => {
        // l.source is the upstream node this link flows FROM
        return s + l.value * ((l.source.y0 + l.source.y1) / 2);
      }, 0);
      const dy = weighted / total - (n.y0 + n.y1) / 2;
      n.y0 += dy;
      n.y1 += dy;
    }
    resolveCollisions(col, nodePad);
  }
}

function resolveCollisions(col: SNode[], nodePad: number) {
  // Sort by current y position (preserves dropout-last order via stable sort in most engines)
  col.sort((a, b) => a.y0 - b.y0);
  // Push overlapping nodes downward
  for (let i = 1; i < col.length; i++) {
    const prev = col[i - 1]!;
    const curr = col[i]!;
    const gap  = curr.y0 - prev.y1;
    if (gap < nodePad) {
      const shift = nodePad - gap;
      curr.y0 += shift;
      curr.y1 += shift;
    }
  }
  // Then push back upward from the bottom so nodes don't run off the canvas
  for (let i = col.length - 2; i >= 0; i--) {
    const curr = col[i]!;
    const next = col[i + 1]!;
    const gap  = next.y0 - curr.y1;
    if (gap < nodePad) {
      const shift = nodePad - gap;
      curr.y0 -= shift;
      curr.y1 -= shift;
    }
  }
}

function assignLinkY(nodes: SNode[], scale: number) {
  for (const n of nodes) {
    // Order outgoing links top-to-bottom by target centre
    n.sourceLinks.sort((a, b) => (a.target.y0 + a.target.y1) - (b.target.y0 + b.target.y1));
    // Order incoming links top-to-bottom by source centre
    n.targetLinks.sort((a, b) => (a.source.y0 + a.source.y1) - (b.source.y0 + b.source.y1));
  }
  for (const n of nodes) {
    let sy = n.y0;
    for (const l of n.sourceLinks) {
      l.width = Math.max(l.value * scale, 1.5);
      l.y0 = sy + l.width / 2;
      sy += l.width;
    }
    let ty = n.y0;
    for (const l of n.targetLinks) {
      l.width = Math.max(l.value * scale, 1.5);
      l.y1 = ty + l.width / 2;
      ty += l.width;
    }
  }
}

// SVG cubic bezier for a Sankey link (same formula as sankeyLinkHorizontal)
function sankeyPath(link: SLink): string {
  const x0 = link.source.x1;
  const x1 = link.target.x0;
  const cp  = (x1 - x0) / 2;
  const w2  = link.width / 2;
  return [
    `M${x0},${link.y0 - w2}`,
    `C${x0 + cp},${link.y0 - w2} ${x1 - cp},${link.y1 - w2} ${x1},${link.y1 - w2}`,
    `L${x1},${link.y1 + w2}`,
    `C${x1 - cp},${link.y1 + w2} ${x0 + cp},${link.y0 + w2} ${x0},${link.y0 + w2}Z`,
  ].join(" ");
}

// ── Full sankey build ─────────────────────────────────────────────────────────

function buildSankey(
  funnel: FunnelStep[],
  scoreDistribution: DistributionBucket[],
  innerW: number,
  innerH: number,
  nodeW: number,
  nodePad: number,
  iters: number,
): { nodes: SNode[]; links: SLink[] } | null {
  const fm    = Object.fromEntries(funnel.map((s) => [s.label, s.count]));
  const vis   = fm["Visited"]     ?? 0;
  const sur   = fm["Survey done"] ?? 0;
  const sar   = fm["SART done"]   ?? 0;
  const str   = fm["Stroop done"] ?? 0;
  const pvt   = fm["PVT done"]    ?? 0;
  const gng   = fm["GoNoGo done"] ?? 0;
  if (vis === 0) return null;

  const buckets = scoreDistribution.filter((b) => b.count > 0);
  const dropped = vis - gng;

  // Columns: 0=Visitors … 5=GoNoGo | 6=ScoreBuckets + dropout
  const NUM_COLS = 7;

  const makeNode = (id: string, label: string, value: number, color: string): SNode => ({
    id, label, value, color,
    depth: 0, layer: 0,
    x0: 0, x1: 0, y0: 0, y1: 0,
    sourceLinks: [], targetLinks: [],
  });

  const stageLabels = ["Visitors", "Survey", "SART", "Stroop", "PVT", "GoNoGo"];
  const stageCounts = [vis, sur, sar, str, pvt, gng];
  const stageColors = Array(6).fill("#818cf8") as string[];

  const nodes: SNode[] = [
    ...stageLabels.map((l, i) => makeNode(`s${i}`, l, stageCounts[i] ?? 0, stageColors[i] ?? "#818cf8")),
    ...buckets.map((b) => makeNode(`b_${b.bucket}`, b.bucket, b.count, bucketColor(b.bucket))),
    ...(dropped > 0 ? [makeNode("dropout", "🪦 Skill Issue", dropped, "#f87171")] : []),
  ];

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Funnel continuation links (blue)
  const linkDefs: Array<[string, string, number, string]> = [
    ["s0","s1", sur, "#818cf8"],
    ["s1","s2", sar, "#818cf8"],
    ["s2","s3", str, "#818cf8"],
    ["s3","s4", pvt, "#818cf8"],
    ["s4","s5", gng, "#818cf8"],
  ];
  // Dropout links (red, from each stage that lost people)
  const dropAmts = [vis-sur, sur-sar, sar-str, str-pvt, pvt-gng];
  for (let i = 0; i < dropAmts.length; i++) {
    if ((dropAmts[i] ?? 0) > 0) linkDefs.push([`s${i}`, "dropout", dropAmts[i] ?? 0, "#f87171"]);
  }
  // Score bucket links (from GoNoGo)
  for (const b of buckets) linkDefs.push(["s5", `b_${b.bucket}`, b.count, bucketColor(b.bucket)]);

  const links: SLink[] = linkDefs
    .filter(([, , v]) => v > 0)
    .map(([srcId, tgtId, value, color]) => {
      const source = nodeMap.get(srcId)!;
      const target = nodeMap.get(tgtId)!;
      const link: SLink = { source, target, value, color, width: 0, y0: 0, y1: 0 };
      source.sourceLinks.push(link);
      target.targetLinks.push(link);
      return link;
    });

  // ── Layout ────────────────────────────────────────────────────────────────
  assignDepths(nodes);
  assignLayers(nodes, NUM_COLS);

  // x positions
  const colW = (innerW - nodeW) / (NUM_COLS - 1);
  for (const n of nodes) {
    n.x0 = n.layer * colW;
    n.x1 = n.x0 + nodeW;
  }

  // Group nodes by column
  const columnNodes: SNode[][] = Array.from({ length: NUM_COLS }, () => []);
  for (const n of nodes) {
    // Keep dropout below score buckets in the final column
    if (n.id === "dropout") columnNodes[NUM_COLS - 1]!.push(n);
    else columnNodes[n.layer]!.push(n);
  }
  // Keep dropout at the bottom of the last column
  for (const col of columnNodes) {
    col.sort((a, b) => {
      if (a.id === "dropout") return 1;
      if (b.id === "dropout") return -1;
      return 0;
    });
  }

  // Compute a uniform scale so all columns fit within innerH.
  // The tightest column is the one where (nodeCount-1)*pad takes the most space.
  const scale = columnNodes.reduce((minScale, col) => {
    if (col.length === 0) return minScale;
    const totalVal = col.reduce((s, n) => s + n.value, 0);
    const gaps     = (col.length - 1) * nodePad;
    const s        = (innerH - gaps) / Math.max(totalVal, 1);
    return Math.min(minScale, s);
  }, Infinity);
  const safeScale = scale === Infinity ? 1 : scale;

  initY(columnNodes, innerH, nodePad, safeScale);

  // Iterative relaxation
  for (let iter = 0; iter < iters; iter++) {
    relaxTopDown(columnNodes, nodePad);
    relaxBottomUp(columnNodes, nodePad);
  }

  assignLinkY(nodes, safeScale);

  return { nodes, links };
}

// ── React component ───────────────────────────────────────────────────────────

function VisitorFlowSankey({
  funnel,
  scoreDistribution,
}: {
  funnel: FunnelStep[];
  scoreDistribution: DistributionBucket[];
}) {
  const SVG_W  = 720;
  const SVG_H  = 480;
  const ML = 5, MR = 175, MT = 16, MB = 36;
  const innerW = SVG_W - ML - MR;
  const innerH = SVG_H - MT - MB;
  const NODE_W  = 14;
  const NODE_PAD = 10;
  const ITERS   = 8;

  const result = buildSankey(funnel, scoreDistribution, innerW, innerH, NODE_W, NODE_PAD, ITERS);

  if (!result) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No data yet. Share the link and come back when participants start taking the test!
      </p>
    );
  }

  const { nodes, links } = result;

  const stageNodes  = nodes.filter((n) => n.id.startsWith("s"));
  const bucketNodes = nodes.filter((n) => n.id.startsWith("b_"));
  const dropNode    = nodes.find((n) => n.id === "dropout");

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ width: "100%", height: "auto", minHeight: 240 }}
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform={`translate(${ML},${MT})`}>
          {/* Links — drawn behind nodes */}
          {links.map((link, i) => (
            <path
              key={i}
              d={sankeyPath(link)}
              fill={link.color}
              fillOpacity={0.25}
              stroke="none"
            />
          ))}

          {/* Stage nodes — labels below */}
          {stageNodes.map((n) => (
            <g key={n.id}>
              <rect
                x={n.x0} y={n.y0}
                width={n.x1 - n.x0} height={Math.max(n.y1 - n.y0, 2)}
                fill={n.color} fillOpacity={0.9} rx={2}
              />
              <text
                x={(n.x0 + n.x1) / 2} y={innerH + 8}
                textAnchor="middle"
                style={{ fontSize: "10px", fill: "#9ca3af", fontFamily: "inherit" }}
              >
                {n.label}
              </text>
              <text
                x={(n.x0 + n.x1) / 2} y={innerH + 20}
                textAnchor="middle"
                style={{ fontSize: "9px", fill: "#6b7280", fontFamily: "inherit" }}
              >
                {n.value.toLocaleString()}
              </text>
            </g>
          ))}

          {/* Score bucket nodes — labels to the right */}
          {bucketNodes.map((n) => (
            <g key={n.id}>
              <rect
                x={n.x0} y={n.y0}
                width={n.x1 - n.x0} height={Math.max(n.y1 - n.y0, 2)}
                fill={n.color} fillOpacity={0.9} rx={2}
              />
              <text
                x={n.x1 + 5} y={(n.y0 + n.y1) / 2}
                textAnchor="start" dominantBaseline="middle"
                style={{ fontSize: "10px", fill: "#9ca3af", fontFamily: "inherit" }}
              >
                {n.label} ({n.value.toLocaleString()})
              </text>
            </g>
          ))}

          {/* Single dropout sink — label to the right in red */}
          {dropNode && (
            <g>
              <rect
                x={dropNode.x0} y={dropNode.y0}
                width={dropNode.x1 - dropNode.x0} height={Math.max(dropNode.y1 - dropNode.y0, 2)}
                fill={dropNode.color} fillOpacity={0.9} rx={2}
              />
              <text
                x={dropNode.x1 + 5} y={(dropNode.y0 + dropNode.y1) / 2}
                textAnchor="start" dominantBaseline="middle"
                style={{ fontSize: "10px", fill: "#f87171", fontFamily: "inherit" }}
              >
                {dropNode.label} ({dropNode.value.toLocaleString()})
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
