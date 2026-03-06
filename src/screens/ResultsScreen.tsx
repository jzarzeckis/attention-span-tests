import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
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
  if (goodThreshold < badThreshold) {
    if (value <= goodThreshold) return 100;
    if (value >= badThreshold) return 0;
    return clamp(100 * (1 - (value - goodThreshold) / (badThreshold - goodThreshold)), 0, 100);
  } else {
    if (value >= goodThreshold) return 100;
    if (value <= badThreshold) return 0;
    return clamp(100 * (value - badThreshold) / (goodThreshold - badThreshold), 0, 100);
  }
}

function calculateScores(): TestScores {
  const scores: TestScores = { sart: null, focus: null, stroop: null, pvt: null, delay: null, gonogo: null };

  const sartRaw = sessionStorage.getItem("sart");
  if (sartRaw) {
    const s = JSON.parse(sartRaw) as SARTStats;
    scores.sart = scoreLinear(s.commissionRate * 100, 11, 30);
  }

  const focusRaw = sessionStorage.getItem("focus");
  if (focusRaw) {
    const f = JSON.parse(focusRaw) as FocusStats;
    if (f.firstSkipUrgeTime === null) {
      scores.focus = 100;
    } else {
      const t = f.firstSkipUrgeTime;
      if (t >= 150000) scores.focus = 100;
      else if (t <= 40000) scores.focus = 20;
      else scores.focus = 20 + 80 * (t - 40000) / (150000 - 40000);
    }
  }

  const stroopRaw = sessionStorage.getItem("stroop");
  if (stroopRaw) {
    const s = JSON.parse(stroopRaw) as StroopStats;
    scores.stroop = scoreLinear(s.interferenceScore, 100, 400);
  }

  const pvtRaw = sessionStorage.getItem("pvt");
  if (pvtRaw) {
    const p = JSON.parse(pvtRaw) as PVTStats;
    const rtScore = scoreLinear(p.medianRT, 300, 500);
    const lapseScore = scoreLinear(p.lapseRate * 100, 5, 25);
    scores.pvt = (rtScore + lapseScore) / 2;
  }

  const delayRaw = sessionStorage.getItem("delay");
  if (delayRaw) {
    const d = JSON.parse(delayRaw) as DelayDiscountingStats;
    const k = Math.max(d.medianK, 0.0001);
    const logK = Math.log10(k);
    const logGood = Math.log10(0.01);
    const logBad = Math.log10(0.10);
    scores.delay = scoreLinear(logK, logGood, logBad);
  }

  const gonogoRaw = sessionStorage.getItem("gonogo");
  if (gonogoRaw) {
    const g = JSON.parse(gonogoRaw) as GoNoGoStats;
    scores.gonogo = scoreLinear(g.commissionErrorRate * 100, 15, 40);
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
  if (score >= 80) return "default";
  if (score >= 60) return "secondary";
  return "destructive";
}

function getBadgeLabel(score: number): string {
  if (score >= 80) return "Pre-digital range";
  if (score >= 60) return "Moderate deviation";
  return "Significant deviation";
}

function getDeviationLabel(score: number): string {
  if (score >= 80) return "Within healthy baseline";
  if (score >= 60) return "Mild deviation from baseline";
  if (score >= 40) return "Moderate deviation from baseline";
  return "Significant deviation from baseline";
}

interface LearnMore {
  whatItMeasures: string;
  whyItMatters: string;
  citation: string;
  citationUrl: string;
}

interface TestDetail {
  key: keyof TestScores;
  name: string;
  score: number | null;
  metric: string;
  baseline: string;
  learnMore: LearnMore;
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
      metric: `Commission error rate: ${(s.commissionRate * 100).toFixed(1)}% | Mean RT: ${s.meanRT.toFixed(0)}ms | RT variability (CV): ${s.rtCV.toFixed(2)}`,
      baseline: "Healthy adults: 8–11% commission errors, ~332–375ms mean RT (Robertson et al., 1997)",
      learnMore: {
        whatItMeasures: "The Sustained Attention to Response Task (SART) measures your ability to maintain focus and suppress automatic responses over time. You must respond to almost every digit but withhold for the rare target — this sustained vigilance taxes both attention and impulse control.",
        whyItMatters: "Commission errors (responding to the target) reflect failures of inhibitory control and sustained attention. Higher variability in reaction time (CV) is a marker of attentional lapses, even when accuracy seems acceptable. These metrics predict real-world risks like distracted driving.",
        citation: "Robertson, I. H., Manly, T., Andrade, J., Baddeley, B. T., & Yiend, J. (1997). 'Oops!': Performance correlates of everyday attentional failures in traumatic brain injured and normal subjects. Neuropsychologia, 35(6), 747–758.",
        citationUrl: "https://doi.org/10.1016/S0028-3932(97)00084-3",
      },
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
        : `First skip urge at: ${(skipTime / 1000).toFixed(1)}s | Chose to ${f.choseToStop ? "stop" : "continue"}`,
      baseline: "Pre-digital (2004): ~2.5 min median focus span | 2020s: ~40 seconds (Mark, 2023)",
      learnMore: {
        whatItMeasures: "This test captures the time until you first feel the urge to switch away from a single piece of content — your natural attention span before external distraction. It's adapted from Gloria Mark's workplace attention research at UC Irvine.",
        whyItMatters: "The collapse of sustained attention is one of the most documented consequences of heavy social media use. Short-form video (TikTok, Reels, Shorts) trains the brain to expect rapid context switches, eroding the ability to remain with a single stimulus. The 2.5-minute pre-digital baseline has dropped to ~40 seconds in modern populations.",
        citation: "Mark, G. (2023). Attention Span: A Groundbreaking Way to Restore Balance, Happiness and Productivity. Hanover Square Press. Original research: Mark, G., Gudith, D., & Klocke, U. (2008). The cost of interrupted work: More speed and stress. CHI '08.",
        citationUrl: "https://doi.org/10.1145/1357054.1357072",
      },
    });
  }

  if (stroopRaw) {
    const s = JSON.parse(stroopRaw) as StroopStats;
    details.push({
      key: "stroop",
      name: "Stroop Color-Word",
      score: scores.stroop,
      metric: `Interference effect: ${s.interferenceScore.toFixed(0)}ms | C1 (word reading): ${s.condition1.meanRT.toFixed(0)}ms (${(s.condition1.accuracy * 100).toFixed(0)}%) | C2 (color naming): ${s.condition2.meanRT.toFixed(0)}ms (${(s.condition2.accuracy * 100).toFixed(0)}%) | C3 (incongruent): ${s.condition3.meanRT.toFixed(0)}ms (${(s.condition3.accuracy * 100).toFixed(0)}%)`,
      baseline: "Typical interference effect: ~100ms; larger = weaker executive control",
      learnMore: {
        whatItMeasures: "The Stroop test measures executive control — specifically your ability to suppress an automatic response (reading the word) in favor of a controlled one (naming the ink color). The interference score (how much slower you are on incongruent trials) indexes the efficiency of your prefrontal inhibitory systems.",
        whyItMatters: "Executive control is the gateway to all higher cognitive functions. Chronic distraction from social media has been linked to reduced gray matter in the anterior cingulate cortex — the brain region most associated with Stroop-type conflict resolution — in heavy users.",
        citation: "Stroop, J. R. (1935). Studies of interference in serial verbal reactions. Journal of Experimental Psychology, 18(6), 643–662.",
        citationUrl: "https://doi.org/10.1037/h0054651",
      },
    });
  }

  if (pvtRaw) {
    const p = JSON.parse(pvtRaw) as PVTStats;
    details.push({
      key: "pvt",
      name: "Psychomotor Vigilance (PVT)",
      score: scores.pvt,
      metric: `Median RT: ${p.medianRT.toFixed(0)}ms | Lapses (>500ms): ${p.lapses} (${(p.lapseRate * 100).toFixed(1)}%) | False starts: ${p.falseStarts}`,
      baseline: "Healthy rested adults: ~250ms median RT, <5% lapse rate (Basner & Dinges, 2011)",
      learnMore: {
        whatItMeasures: "The Psychomotor Vigilance Task (PVT) measures sustained alertness and reaction time vigilance. Lapses — reactions slower than 500ms — are the gold-standard biomarker for sleepiness and attentional failures in both sleep research and occupational health.",
        whyItMatters: "PVT lapse rate is more sensitive to cumulative sleep loss and attentional impairment than subjective sleepiness ratings. People severely impaired by sleep deprivation often don't feel impaired — but the lapses appear. Heavy social media use (especially late-night) is strongly associated with disrupted sleep and elevated PVT lapse rates.",
        citation: "Basner, M., & Dinges, D. F. (2011). Maximizing sensitivity of the psychomotor vigilance test (PVT) to sleep loss. Sleep, 34(5), 581–591.",
        citationUrl: "https://doi.org/10.1093/sleep/34.5.581",
      },
    });
  }

  if (delayRaw) {
    const d = JSON.parse(delayRaw) as DelayDiscountingStats;
    details.push({
      key: "delay",
      name: "Delay Discounting",
      score: scores.delay,
      metric: `Discount rate (k): ${d.medianK.toFixed(4)} (lower = more patient) | Indifference points across delays from 1 to 365 days`,
      baseline: "Patient adults: k < 0.01 | Average: k ≈ 0.02–0.05 | Highly impulsive: k > 0.10",
      learnMore: {
        whatItMeasures: "Delay discounting measures how steeply you devalue rewards as they become more distant in time. The hyperbolic discount rate k captures your preference for instant gratification: higher k means future rewards feel nearly worthless compared to immediate ones.",
        whyItMatters: "High discount rates (impulsive choice) are associated with addiction, poor financial decisions, and difficulty pursuing long-term goals. Adolescents naturally discount more steeply than adults, but social media — with its instant dopamine hits — may steepen this further. k is one of the most robust quantitative predictors of self-control across domains.",
        citation: "Mazur, J. E. (1987). An adjusting procedure for studying delayed reinforcement. In M. L. Commons et al. (Eds.), Quantitative analyses of behavior: Vol. 5. The effect of delay and of intervening events on reinforcement value (pp. 55–73). Erlbaum.",
        citationUrl: "https://doi.org/10.1007/s40614-014-0011-4",
      },
    });
  }

  if (gonogoRaw) {
    const g = JSON.parse(gonogoRaw) as GoNoGoStats;
    details.push({
      key: "gonogo",
      name: "Go/No-Go",
      score: scores.gonogo,
      metric: `Commission errors: ${(g.commissionErrorRate * 100).toFixed(1)}% | Omission errors: ${(g.omissionErrorRate * 100).toFixed(1)}% | Mean RT (Go hits): ${g.meanRT.toFixed(0)}ms | RT CV: ${g.rtCV.toFixed(2)}`,
      baseline: "Healthy adolescents/adults: commission error rate ~15–20% (decreases with age through ~16)",
      learnMore: {
        whatItMeasures: "The Go/No-Go task is one of the simplest and most reliable measures of response inhibition. When 80% of stimuli require action, your brain builds a strong prepotent 'go' response — successfully withholding on No-Go trials reflects the efficiency of your prefrontal braking system.",
        whyItMatters: "Commission errors on No-Go trials index impulsivity at the neurological level. The prefrontal cortex matures through adolescence (~16 years), with commission rates declining steadily. Poor inhibitory control correlates with ADHD, substance use risk, and the compulsive checking behavior associated with social media addiction.",
        citation: "Chamberlain, S. R., Robbins, T. W., Winder-Rhodes, S., et al. (2011). Translational approaches to frontostriatal dysfunction in attention-deficit/hyperactivity disorder using a computerized neuropsychological battery. Biological Psychiatry, 69(12), 1192–1203.",
        citationUrl: "https://doi.org/10.1016/j.biopsych.2010.08.019",
      },
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

function TestDetailCard({ detail }: { detail: TestDetail }) {
  const [open, setOpen] = useState(false);
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <CardTitle className="text-base truncate">{detail.name}</CardTitle>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {detail.score !== null && (
                  <Badge variant={getBadgeVariant(detail.score)}>
                    {Math.round(detail.score)} / 100
                  </Badge>
                )}
                {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>
            {detail.score !== null && (
              <Progress value={detail.score} className="h-1.5 mt-1" />
            )}
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Score & deviation */}
            {detail.score !== null && (
              <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</span>
                <Badge variant={getBadgeVariant(detail.score)} className="text-xs">
                  {getDeviationLabel(detail.score)}
                </Badge>
              </div>
            )}

            {/* Your metrics */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Your Results</p>
              <p className="text-sm text-foreground">{detail.metric}</p>
            </div>

            {/* Baseline norm */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Baseline Norm</p>
              <p className="text-sm text-muted-foreground">{detail.baseline}</p>
            </div>

            {/* Learn more collapsible */}
            <Collapsible open={learnMoreOpen} onOpenChange={setLearnMoreOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8">
                  <span>Learn more about this test</span>
                  {learnMoreOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-3 rounded-md border bg-muted/30 p-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">What it measures</p>
                    <p className="text-xs text-foreground leading-relaxed">{detail.learnMore.whatItMeasures}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Why it matters</p>
                    <p className="text-xs text-foreground leading-relaxed">{detail.learnMore.whyItMatters}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Source</p>
                    <p className="text-xs text-muted-foreground leading-relaxed italic">{detail.learnMore.citation}</p>
                    <a
                      href={detail.learnMore.citationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 break-all"
                    >
                      View paper (DOI)
                    </a>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
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
            <p className="text-sm font-medium text-muted-foreground text-center">
              Tap any test to expand results and learn more
            </p>
            {details.map((d) => (
              <TestDetailCard key={d.key} detail={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
