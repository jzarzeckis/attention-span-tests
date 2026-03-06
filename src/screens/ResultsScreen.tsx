import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { SARTStats } from "./tests/SARTTest";
import type { FocusStats } from "./tests/FocusDurationTest";
import type { StroopStats } from "./tests/StroopTest";
import type { PVTStats } from "./tests/PVTTest";
import type { DelayDiscountingStats } from "./tests/DelayDiscountingTest";
import type { GoNoGoStats } from "./tests/GoNoGoTest";

interface ResultsScreenProps {
  onRestart: () => void;
}

interface TestScores {
  sart: number | null;
  focus: number | null;
  stroop: number | null;
  pvt: number | null;
  delay: number | null;
  gonogo: number | null;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function scoreLinear(value: number, goodThreshold: number, badThreshold: number): number {
  // goodThreshold = 100 pts, badThreshold = 0 pts, linear between
  if (goodThreshold < badThreshold) {
    // lower is better
    if (value <= goodThreshold) return 100;
    if (value >= badThreshold) return 0;
    return clamp(100 * (1 - (value - goodThreshold) / (badThreshold - goodThreshold)), 0, 100);
  } else {
    // higher is better
    if (value >= goodThreshold) return 100;
    if (value <= badThreshold) return 0;
    return clamp(100 * (value - badThreshold) / (goodThreshold - badThreshold), 0, 100);
  }
}

function calculateScores(): TestScores {
  const scores: TestScores = { sart: null, focus: null, stroop: null, pvt: null, delay: null, gonogo: null };

  // SART: commission rate baseline 8-11%; good <= 11%, poor >= 30%
  const sartRaw = sessionStorage.getItem("sart");
  if (sartRaw) {
    const s = JSON.parse(sartRaw) as SARTStats;
    const commissionPct = s.commissionRate * 100;
    scores.sart = scoreLinear(commissionPct, 11, 30);
  }

  // Focus: firstSkipUrgeTime in ms; pre-digital 2.5min=150000ms; modern ~40s=40000ms
  const focusRaw = sessionStorage.getItem("focus");
  if (focusRaw) {
    const f = JSON.parse(focusRaw) as FocusStats;
    if (f.firstSkipUrgeTime === null) {
      scores.focus = 100; // never felt urge to skip
    } else {
      // higher is better: >= 150000ms = 100, <= 40000ms = 20
      const t = f.firstSkipUrgeTime;
      if (t >= 150000) scores.focus = 100;
      else if (t <= 40000) scores.focus = 20;
      else scores.focus = 20 + 80 * (t - 40000) / (150000 - 40000);
    }
  }

  // Stroop: interferenceScore (RT diff ms); <= 100ms = 100, >= 400ms = 0
  const stroopRaw = sessionStorage.getItem("stroop");
  if (stroopRaw) {
    const s = JSON.parse(stroopRaw) as StroopStats;
    scores.stroop = scoreLinear(s.interferenceScore, 100, 400);
  }

  // PVT: medianRT baseline ~250ms; lapseRate < 5%
  const pvtRaw = sessionStorage.getItem("pvt");
  if (pvtRaw) {
    const p = JSON.parse(pvtRaw) as PVTStats;
    const rtScore = scoreLinear(p.medianRT, 300, 500);
    const lapseScore = scoreLinear(p.lapseRate * 100, 5, 25);
    scores.pvt = (rtScore + lapseScore) / 2;
  }

  // Delay discounting: medianK; lower = more patient = better
  // k <= 0.01 = 100, k >= 0.10 = 0
  const delayRaw = sessionStorage.getItem("delay");
  if (delayRaw) {
    const d = JSON.parse(delayRaw) as DelayDiscountingStats;
    // Log scale: map log(k) from log(0.001) to log(0.20)
    const k = Math.max(d.medianK, 0.0001);
    const logK = Math.log10(k);
    const logGood = Math.log10(0.01);  // 100 pts
    const logBad = Math.log10(0.10);   // 0 pts
    scores.delay = scoreLinear(logK, logGood, logBad);
  }

  // Go/No-Go: commissionErrorRate baseline; good <= 15%, poor >= 40%
  const gonogoRaw = sessionStorage.getItem("gonogo");
  if (gonogoRaw) {
    const g = JSON.parse(gonogoRaw) as GoNoGoStats;
    const ratePct = g.commissionErrorRate * 100;
    scores.gonogo = scoreLinear(ratePct, 15, 40);
  }

  return scores;
}

function compositeScore(scores: TestScores): number | null {
  const values = Object.values(scores).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function getLabel(score: number): string {
  if (score >= 80) return "Your attention is in the pre-digital healthy range";
  if (score >= 60) return "Your attention shows moderate digital-age effects";
  if (score >= 40) return "Your attention profile leans toward heavy social media patterns";
  return "Your attention profile matches a typical heavy social media user";
}

function getSummary(score: number): string {
  if (score >= 80) {
    return "You're rocking pre-smartphone focus levels. Either you barely use social media, or your brain is unusually resilient. Respect.";
  }
  if (score >= 60) {
    return "Your attention is holding up okay, but there are some signs of digital drift. A little less scrolling could go a long way.";
  }
  if (score >= 40) {
    return "Your results suggest social media is taking a toll on your focus. The good news: brains are plastic — attention can be trained back.";
  }
  return "The endless scroll has done its thing. Your attention profile is the most common pattern in 2024. You're in good (bad?) company.";
}

function getBadgeVariant(score: number): "default" | "secondary" | "destructive" | "outline" {
  if (score >= 80) return "default";      // green-ish (primary)
  if (score >= 60) return "secondary";    // yellow-ish (secondary)
  return "destructive";                   // red
}

function getBadgeLabel(score: number): string {
  if (score >= 80) return "Pre-digital range";
  if (score >= 60) return "Moderate deviation";
  return "Significant deviation";
}

interface TestDetail {
  key: keyof TestScores;
  name: string;
  score: number | null;
  metric: string;
  baseline: string;
}

function buildDetails(scores: TestScores): TestDetail[] {
  const sartRaw = sessionStorage.getItem("sart");
  const focusRaw = sessionStorage.getItem("focus");
  const stroopRaw = sessionStorage.getItem("stroop");
  const pvtRaw = sessionStorage.getItem("pvt");
  const delayRaw = sessionStorage.getItem("delay");
  const gonogoRaw = sessionStorage.getItem("gonogo");

  const details: TestDetail[] = [];

  if (sartRaw) {
    const s = JSON.parse(sartRaw) as SARTStats;
    details.push({
      key: "sart",
      name: "Sustained Attention (SART)",
      score: scores.sart,
      metric: `Commission error rate: ${(s.commissionRate * 100).toFixed(1)}% | Mean RT: ${s.meanRT.toFixed(0)}ms`,
      baseline: "Healthy adults: 8–11% commission errors, ~332–375ms RT",
    });
  }

  if (focusRaw) {
    const f = JSON.parse(focusRaw) as FocusStats;
    const skipTime = f.firstSkipUrgeTime;
    details.push({
      key: "focus",
      name: "Focus Duration",
      score: scores.focus,
      metric: skipTime === null
        ? "First skip urge: never (read the whole passage!)"
        : `First skip urge: ${(skipTime / 1000).toFixed(1)}s`,
      baseline: "Pre-digital baseline: ~2.5 min | 2020s median: ~40s",
    });
  }

  if (stroopRaw) {
    const s = JSON.parse(stroopRaw) as StroopStats;
    details.push({
      key: "stroop",
      name: "Stroop Color-Word",
      score: scores.stroop,
      metric: `Interference effect: ${s.interferenceScore.toFixed(0)}ms (C3 vs C2 RT difference)`,
      baseline: "Typical healthy interference: ~100ms",
    });
  }

  if (pvtRaw) {
    const p = JSON.parse(pvtRaw) as PVTStats;
    details.push({
      key: "pvt",
      name: "Psychomotor Vigilance (PVT)",
      score: scores.pvt,
      metric: `Median RT: ${p.medianRT.toFixed(0)}ms | Lapses (>500ms): ${p.lapses} (${(p.lapseRate * 100).toFixed(1)}%)`,
      baseline: "Healthy adults: ~250ms median RT, <5% lapse rate",
    });
  }

  if (delayRaw) {
    const d = JSON.parse(delayRaw) as DelayDiscountingStats;
    details.push({
      key: "delay",
      name: "Delay Discounting",
      score: scores.delay,
      metric: `Discount rate (k): ${d.medianK.toFixed(4)} (lower = more patient)`,
      baseline: "Patient adults: k < 0.01 | Impulsive: k > 0.10",
    });
  }

  if (gonogoRaw) {
    const g = JSON.parse(gonogoRaw) as GoNoGoStats;
    details.push({
      key: "gonogo",
      name: "Go/No-Go",
      score: scores.gonogo,
      metric: `Commission error rate: ${(g.commissionErrorRate * 100).toFixed(1)}% | Mean RT: ${g.meanRT.toFixed(0)}ms`,
      baseline: "Healthy adolescents: commission error rate decreases with age (~15–20%)",
    });
  }

  return details;
}

function ScoreGauge({ score }: { score: number }) {
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const DURATION = 1200;

  useEffect(() => {
    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / DURATION, 1);
      // Ease out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplayed(Math.round(eased * score));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [score]);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">Overall Score</span>
        <span className="text-2xl font-bold tabular-nums">{displayed} / 100</span>
      </div>
      <Progress value={displayed} className="h-4" />
    </div>
  );
}

export function ResultsScreen({ onRestart }: ResultsScreenProps) {
  const scores = calculateScores();
  const composite = compositeScore(scores);
  const details = buildDetails(scores);
  const [showDetails, setShowDetails] = useState(false);
  const testsCompleted = Object.values(scores).filter((v) => v !== null).length;

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
              {composite !== null ? (
                <Badge variant={getBadgeVariant(composite)}>
                  {getBadgeLabel(composite)}
                </Badge>
              ) : (
                <Badge variant="outline">No results yet</Badge>
              )}
            </div>
            {composite !== null && (
              <CardDescription className="font-medium text-foreground">
                {getLabel(composite)}
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {composite !== null ? (
              <>
                <ScoreGauge score={composite} />
                <p className="text-sm text-muted-foreground">
                  {getSummary(composite)}
                </p>
                <p className="text-xs text-muted-foreground text-right">
                  Based on {testsCompleted} of 6 tests
                </p>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Overall Score</span>
                    <span className="font-medium">— / 100</span>
                  </div>
                  <Progress value={0} className="h-4" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Take the tests to see how your attention compares to pre-social-media baselines from published research.
                </p>
              </>
            )}
          </CardContent>

          <CardFooter className="flex-col gap-3">
            {composite !== null && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowDetails((v) => !v)}
              >
                {showDetails ? "Hide detailed results" : "See detailed results"}
              </Button>
            )}
            <Button className="w-full" size="lg" onClick={onRestart}>
              Take Test Again
            </Button>
          </CardFooter>
        </Card>

        {showDetails && details.length > 0 && (
          <div className="space-y-3">
            {details.map((d) => (
              <Card key={d.key}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{d.name}</CardTitle>
                    {d.score !== null && (
                      <Badge
                        variant={
                          d.score >= 80
                            ? "default"
                            : d.score >= 60
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {Math.round(d.score)} / 100
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {d.score !== null && (
                    <Progress value={d.score} className="h-2" />
                  )}
                  <p className="text-sm text-foreground">{d.metric}</p>
                  <p className="text-xs text-muted-foreground">{d.baseline}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
