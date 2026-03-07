import { useState, useEffect, useRef } from "react";
import { encodeResults, hasAnyTestResults } from "@/utils/shareUtils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import type { SARTStats } from "./tests/SARTTest";
import type { StroopStats } from "./tests/StroopTest";
import type { PVTStats } from "./tests/PVTTest";
import type { GoNoGoStats } from "./tests/GoNoGoTest";
import type { SelfReportData } from "./QuestionnaireScreen";

interface ResultsScreenProps {
  onRestart: () => void;
  isShared?: boolean;
}


interface TestScores {
  sart: number | null;
  stroop: number | null;
  pvt: number | null;
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

function isSkipped(raw: string): boolean {
  try { return !!(JSON.parse(raw) as { skipped?: boolean }).skipped; } catch { return false; }
}

function calculateScores(): TestScores {
  const scores: TestScores = { sart: null, stroop: null, pvt: null, gonogo: null };

  const sartRaw = sessionStorage.getItem("sart");
  if (sartRaw && !isSkipped(sartRaw)) {
    const s = JSON.parse(sartRaw) as SARTStats;
    scores.sart = scoreLinear(s.commissionRate * 100, 11, 30);
  }

  const stroopRaw = sessionStorage.getItem("stroop");
  if (stroopRaw && !isSkipped(stroopRaw)) {
    const s = JSON.parse(stroopRaw) as StroopStats;
    // C3 accuracy (good: ≥85%, bad: ≤45% — chance is 25%)
    const c3AccScore = scoreLinear(s.condition3.accuracy, 85, 45);
    // Interference effect (good: ≤100ms, bad: ≥400ms)
    const interfScore = scoreLinear(s.interferenceScore, 100, 400);
    // Harmonic mean: collapses to 0 if either component is 0,
    // preventing high scores from random clicking (which gives ~0 interference but ~0 C3 accuracy)
    const denom = c3AccScore + interfScore;
    scores.stroop = denom > 0 ? Math.round(2 * c3AccScore * interfScore / denom) : 0;
  }

  const pvtRaw = sessionStorage.getItem("pvt");
  if (pvtRaw && !isSkipped(pvtRaw)) {
    const p = JSON.parse(pvtRaw) as PVTStats;
    const rtScore = scoreLinear(p.medianRT, 300, 500);
    const lapseScore = scoreLinear(p.lapseRate * 100, 5, 25);
    scores.pvt = (rtScore + lapseScore) / 2;
  }

  const gonogoRaw = sessionStorage.getItem("gonogo");
  if (gonogoRaw && !isSkipped(gonogoRaw)) {
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
  if (score >= 80) return "Untouched. Your attention span predates the algorithm.";
  if (score >= 60) return "Slightly cooked. Signs of digital drift, but you're not a lost cause.";
  if (score >= 40) return "Cooked. The feed has done its work on you.";
  return "Fully cooked. Congratulations, you are peak 2024.";
}

function getSummary(score: number): string {
  if (score >= 80) {
    return "Pre-smartphone focus levels, confirmed by science. Either you barely touch social media, or your prefrontal cortex is just built different. Respect. Genuinely.";
  }
  if (score >= 60) {
    return "Your attention is holding — but the drift is real. You're showing classic signs of digital-age distraction: slower inhibitory control, slightly elevated lapse rates. You're not a lost cause. Put the phone down more.";
  }
  if (score >= 40) {
    return "The algorithm has done its homework on you. Your sustained attention and impulse control are measurably impacted — consistent with heavy short-form video exposure. Good news: brains are plastic. Bad news: so is your willpower.";
  }
  return "Peak 2024. Your attention profile is the most common pattern in modern populations — fast-twitch, impulsive, lapse-prone. You're in good (bad?) company. The endless scroll has done its thing, and the data confirms it.";
}

function getBadgeVariant(score: number): "default" | "secondary" | "destructive" | "outline" {
  if (score >= 80) return "default";
  if (score >= 60) return "secondary";
  return "destructive";
}

function getSelfReportContext(selfReport: SelfReportData, score: number): string {
  const { shortFormUsage, selfRatedAttention, age } = selfReport;
  const usageVeryHigh = shortFormUsage === "3+ hrs";
  const usageHigh = shortFormUsage === "1–3 hrs";
  const usageLow = shortFormUsage === "Less than 30 min";
  const usageMid = shortFormUsage === "30 min – 1 hr";
  const attentionLow = selfRatedAttention <= 2;
  const attentionHigh = selfRatedAttention >= 4;
  const isYoung = age === "Under 18" || age === "18–24";

  // Resilient heavy user — statistically unusual
  if ((usageVeryHigh || usageHigh) && score >= 70) {
    return `${shortFormUsage}/day on short-form and still scoring ${score}/100 — that's unusual. Either your brain genuinely resists the scroll effect, you have strong compensating habits (sleep, exercise, deep work), or the self-reported usage is a little low. Either way, don't get complacent.`;
  }

  // Very heavy use + tanked score — clear cause/effect
  if (usageVeryHigh && score < 50) {
    return `${shortFormUsage} of TikTok/Reels/Shorts daily, score of ${score}/100. The data is consistent. The algorithm was literally engineered to hijack your attention pathways — and it worked. Not a moral judgment. Just what the reaction times say.`;
  }

  // Heavy use + below-average score
  if (usageHigh && score < 60) {
    return `${shortFormUsage} on short-form video daily — right in the range where the research shows measurable impact on sustained attention and inhibitory control. Your score of ${score}/100 lines up with that. Not a coincidence.`;
  }

  // Low usage + good score — clean correlation
  if (usageLow && score >= 70) {
    return `Under 30 min of short-form daily. Score: ${score}/100. Clean correlation. Your attention isn't being hammered by the 3-second dopamine loop all day — and the tests confirm that.`;
  }

  // Thinks they're bad at attention but the data says otherwise
  if (attentionLow && score >= 65) {
    return `You rated your attention ${selfRatedAttention}/5 — but scored ${score}/100. Classic metacognitive gap. People who overthink their focus or hold themselves to high standards tend to underrate themselves. Your brain is doing better than your inner critic is reporting.`;
  }

  // Confident they're fine, but objectively not
  if (attentionHigh && score < 50) {
    return `You rated your attention ${selfRatedAttention}/5, but the objective score is ${score}/100. This is actually the most documented pattern: heavy algorithmic exposure tends to reduce awareness of its own effects. The scroll doesn't feel like it's working on you — that's precisely how it works.`;
  }

  // Young + low score — developmental context
  if (isYoung && score < 50) {
    return `Prefrontal cortex development continues until ~25, meaning your inhibitory control is still literally under construction. Combined with ${shortFormUsage}/day of short-form content, a score of ${score}/100 makes neurological sense. The good news: it's also the most plastic phase for rewiring habits.`;
  }

  // Mid usage + moderate score — in-between zone
  if (usageMid && score >= 50 && score < 70) {
    return `${shortFormUsage}/day of short-form — moderate input, moderate impact. Score of ${score}/100 puts you in the "drift is real but not catastrophic" zone. The dose is low enough that recovery is straightforward if you want it.`;
  }

  // Fallback — still personalized
  const alignment = score >= 70 ? "aligns with" : score < 50 ? "diverges significantly from" : "only loosely matches";
  const closer = score >= 70 ? "Your gut check was roughly right." : score < 50 ? "Objective tests catch what introspection misses." : "Worth watching the trend.";
  return `${shortFormUsage}/day on short-form, self-rated attention ${selfRatedAttention}/5. Your test score of ${score}/100 ${alignment} your self-assessment. ${closer}`;
}

function getBadgeLabel(score: number): string {
  if (score >= 80) return "Untouched";
  if (score >= 60) return "Slightly cooked";
  return "Fully cooked";
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
  skipped?: boolean;
}

const LEARN_MORE: Record<keyof TestScores, LearnMore> = {
  sart: {
    whatItMeasures: "The Sustained Attention to Response Task (SART) measures your ability to maintain focus and suppress automatic responses over time. You must respond to almost every digit but withhold for the rare target — this sustained vigilance taxes both attention and impulse control.",
    whyItMatters: "Commission errors (responding to the target) reflect failures of inhibitory control and sustained attention. Higher variability in reaction time (CV) is a marker of attentional lapses, even when accuracy seems acceptable. These metrics predict real-world risks like distracted driving.",
    citation: "Robertson, I. H., Manly, T., Andrade, J., Baddeley, B. T., & Yiend, J. (1997). 'Oops!': Performance correlates of everyday attentional failures in traumatic brain injured and normal subjects. Neuropsychologia, 35(6), 747–758.",
    citationUrl: "https://doi.org/10.1016/S0028-3932(97)00084-3",
  },
  stroop: {
    whatItMeasures: "The Stroop test measures executive control — specifically your ability to suppress an automatic response (reading the word) in favor of a controlled one (naming the ink color). The interference score (how much slower you are on incongruent trials) indexes the efficiency of your prefrontal inhibitory systems.",
    whyItMatters: "Executive control is the gateway to all higher cognitive functions. Chronic distraction from social media has been linked to reduced gray matter in the anterior cingulate cortex — the brain region most associated with Stroop-type conflict resolution — in heavy users.",
    citation: "Stroop, J. R. (1935). Studies of interference in serial verbal reactions. Journal of Experimental Psychology, 18(6), 643–662.",
    citationUrl: "https://doi.org/10.1037/h0054651",
  },
  pvt: {
    whatItMeasures: "The Psychomotor Vigilance Task (PVT) measures sustained alertness and reaction time vigilance. Lapses — reactions slower than 500ms — are the gold-standard biomarker for sleepiness and attentional failures in both sleep research and occupational health.",
    whyItMatters: "PVT lapse rate is more sensitive to cumulative sleep loss and attentional impairment than subjective sleepiness ratings. People severely impaired by sleep deprivation often don't feel impaired — but the lapses appear. Heavy social media use (especially late-night) is strongly associated with disrupted sleep and elevated PVT lapse rates.",
    citation: "Basner, M., & Dinges, D. F. (2011). Maximizing sensitivity of the psychomotor vigilance test (PVT) to sleep loss. Sleep, 34(5), 581–591.",
    citationUrl: "https://doi.org/10.1093/sleep/34.5.581",
  },
  gonogo: {
    whatItMeasures: "The Go/No-Go task is one of the simplest and most reliable measures of response inhibition. When 80% of stimuli require action, your brain builds a strong prepotent 'go' response — successfully withholding on No-Go trials reflects the efficiency of your prefrontal braking system.",
    whyItMatters: "Commission errors on No-Go trials index impulsivity at the neurological level. The prefrontal cortex matures through adolescence (~16 years), with commission rates declining steadily. Poor inhibitory control correlates with ADHD, substance use risk, and the compulsive checking behavior associated with social media addiction.",
    citation: "Chamberlain, S. R., Robbins, T. W., Winder-Rhodes, S., et al. (2011). Translational approaches to frontostriatal dysfunction in attention-deficit/hyperactivity disorder using a computerized neuropsychological battery. Biological Psychiatry, 69(12), 1192–1203.",
    citationUrl: "https://doi.org/10.1016/j.biopsych.2010.08.019",
  },
};

function buildDetails(scores: TestScores): TestDetail[] {
  const details: TestDetail[] = [];

  const sartRaw = sessionStorage.getItem("sart");
  if (sartRaw) {
    if (isSkipped(sartRaw)) {
      details.push({ key: "sart", name: "Sustained Attention (SART)", score: null, metric: "", baseline: "", learnMore: LEARN_MORE.sart, skipped: true });
    } else {
      const s = JSON.parse(sartRaw) as SARTStats;
      details.push({
        key: "sart",
        name: "Sustained Attention (SART)",
        score: scores.sart,
        metric: `Commission error rate: ${(s.commissionRate * 100).toFixed(1)}% | Mean RT: ${s.meanRT.toFixed(0)}ms | RT variability (CV): ${s.rtCV.toFixed(2)}`,
        baseline: "Healthy adults: 8–11% commission errors, ~332–375ms mean RT (Robertson et al., 1997)",
        learnMore: LEARN_MORE.sart,
      });
    }
  }

  const stroopRaw = sessionStorage.getItem("stroop");
  if (stroopRaw) {
    if (isSkipped(stroopRaw)) {
      details.push({ key: "stroop", name: "Stroop Color-Word", score: null, metric: "", baseline: "", learnMore: LEARN_MORE.stroop, skipped: true });
    } else {
      const s = JSON.parse(stroopRaw) as StroopStats;
      details.push({
        key: "stroop",
        name: "Stroop Color-Word",
        score: scores.stroop,
        metric: `Interference effect: ${s.interferenceScore.toFixed(0)}ms | C1 (word reading): ${s.condition1.meanRT.toFixed(0)}ms (${s.condition1.accuracy.toFixed(0)}%) | C2 (color naming): ${s.condition2.meanRT.toFixed(0)}ms (${s.condition2.accuracy.toFixed(0)}%) | C3 (incongruent): ${s.condition3.meanRT.toFixed(0)}ms (${s.condition3.accuracy.toFixed(0)}%)`,
        baseline: "Typical interference effect: ~100ms; larger = weaker executive control",
        learnMore: LEARN_MORE.stroop,
      });
    }
  }

  const pvtRaw = sessionStorage.getItem("pvt");
  if (pvtRaw) {
    if (isSkipped(pvtRaw)) {
      details.push({ key: "pvt", name: "Psychomotor Vigilance (PVT)", score: null, metric: "", baseline: "", learnMore: LEARN_MORE.pvt, skipped: true });
    } else {
      const p = JSON.parse(pvtRaw) as PVTStats;
      details.push({
        key: "pvt",
        name: "Psychomotor Vigilance (PVT)",
        score: scores.pvt,
        metric: `Median RT: ${p.medianRT.toFixed(0)}ms | Lapses (>500ms): ${p.lapses} (${(p.lapseRate * 100).toFixed(1)}%) | False starts: ${p.falseStarts}`,
        baseline: "Healthy rested adults: ~250ms median RT, <5% lapse rate (Basner & Dinges, 2011)",
        learnMore: LEARN_MORE.pvt,
      });
    }
  }

  const gonogoRaw = sessionStorage.getItem("gonogo");
  if (gonogoRaw) {
    if (isSkipped(gonogoRaw)) {
      details.push({ key: "gonogo", name: "Go/No-Go", score: null, metric: "", baseline: "", learnMore: LEARN_MORE.gonogo, skipped: true });
    } else {
      const g = JSON.parse(gonogoRaw) as GoNoGoStats;
      details.push({
        key: "gonogo",
        name: "Go/No-Go",
        score: scores.gonogo,
        metric: `Commission errors: ${(g.commissionErrorRate * 100).toFixed(1)}% | Omission errors: ${(g.omissionErrorRate * 100).toFixed(1)}% | Mean RT (Go hits): ${g.meanRT.toFixed(0)}ms | RT CV: ${g.rtCV.toFixed(2)}`,
        baseline: "Healthy adolescents/adults: commission error rate ~15–20% (decreases with age through ~16)",
        learnMore: LEARN_MORE.gonogo,
      });
    }
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

function SkippedTestCard({ name, learnMore }: { name: string; learnMore: LearnMore }) {
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);

  return (
    <Card className="border-muted">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-muted-foreground">{name}</CardTitle>
          <Badge variant="outline" className="text-muted-foreground text-xs">Skipped</Badge>
        </div>
        <div className="h-1.5 rounded-full mt-1 overflow-hidden bg-muted">
          <div
            className="h-full w-full"
            style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(128,128,128,0.15) 5px, rgba(128,128,128,0.15) 10px)" }}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <p className="text-sm text-muted-foreground italic">
          Couldn't sit through this one. Your attention span couldn't even make it to the test. Fitting, really.
        </p>
        <Collapsible open={learnMoreOpen} onOpenChange={setLearnMoreOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8">
              <span>About this test</span>
              {learnMoreOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-3 rounded-md border bg-muted/30 p-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">What it measures</p>
                <p className="text-xs text-foreground leading-relaxed">{learnMore.whatItMeasures}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Why it matters</p>
                <p className="text-xs text-foreground leading-relaxed">{learnMore.whyItMatters}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Source</p>
                <p className="text-xs text-muted-foreground leading-relaxed italic">{learnMore.citation}</p>
                <a
                  href={learnMore.citationUrl}
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
    </Card>
  );
}

function TestDetailCard({ detail }: { detail: TestDetail }) {
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);

  if (detail.skipped) {
    return <SkippedTestCard name={detail.name} learnMore={detail.learnMore} />;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{detail.name}</CardTitle>
          {detail.score !== null && (
            <Badge variant={getBadgeVariant(detail.score)}>
              {Math.round(detail.score)} / 100
            </Badge>
          )}
        </div>
        {detail.score !== null && (
          <Progress value={detail.score} className="h-1.5 mt-1" />
        )}
      </CardHeader>

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

        {/* Learn more collapsible — science context only */}
        <Collapsible open={learnMoreOpen} onOpenChange={setLearnMoreOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8">
              <span>About this test</span>
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
    </Card>
  );
}

export function ResultsScreen({ onRestart, isShared = false }: ResultsScreenProps) {
  const scores = calculateScores();
  const composite = compositeScore(scores);
  const details = buildDetails(scores);
  const testsCompleted = Object.values(scores).filter((v) => v !== null).length;
  const selfReport: SelfReportData | null = (() => {
    const raw = sessionStorage.getItem("selfReport");
    return raw ? (JSON.parse(raw) as SelfReportData) : null;
  })();

  // Keep browser URL in sync so copy-pasting it works like the share button
  useEffect(() => {
    if (!hasAnyTestResults()) return;
    const encoded = encodeResults();
    history.replaceState(null, "", `?r=${encoded}`);
    return () => {
      history.replaceState(null, "", window.location.pathname);
    };
  }, []);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-4 pb-24">
      <div className="w-full max-w-md space-y-6">
        {isShared && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm font-medium text-center text-primary mb-1">
                You're viewing someone else's results
              </p>
              {testsCompleted < 4 && (
                <p className="text-xs text-center text-muted-foreground mb-2">
                  Heads up: these are partial results — only {testsCompleted} of 4 tests were completed. For the full picture, they should finish the test.
                </p>
              )}
              <Button className={testsCompleted < 4 ? "w-full" : "w-full mt-2"} size="sm" onClick={onRestart}>
                Take the test yourself →
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Your Results</h1>
          <p className="text-muted-foreground">Your Brainrot Report</p>
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
                  Based on {testsCompleted} of 4 tests
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
            <Button className="w-full" size="lg" onClick={onRestart}>
              Take Test Again
            </Button>
          </CardFooter>
        </Card>

        {selfReport && composite !== null && (
          <Card className="border-muted bg-muted/30">
            <CardContent className="pt-4 pb-4 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Your self-report context
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {getSelfReportContext(selfReport, composite)}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                <span className="text-xs text-muted-foreground">Age: <span className="text-foreground">{selfReport.age}</span></span>
                <span className="text-xs text-muted-foreground">Short-form: <span className="text-foreground">{selfReport.shortFormUsage}</span></span>
                <span className="text-xs text-muted-foreground">Screen time: <span className="text-foreground">{selfReport.screenTime}</span></span>
                <span className="text-xs text-muted-foreground">Self-rated attention: <span className="text-foreground">{selfReport.selfRatedAttention}/5</span></span>
              </div>
            </CardContent>
          </Card>
        )}

        {details.length > 0 && (
          <div className="space-y-3">
            {details.map((d) => (
              <TestDetailCard key={d.key} detail={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
