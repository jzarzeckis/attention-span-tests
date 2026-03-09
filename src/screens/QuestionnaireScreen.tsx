import { useState } from "react";
import { resultsStore } from "@/utils/resultsStore";
import type { SelfReportData } from "@/types";
export type { SelfReportData };
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Trophy } from "lucide-react";

interface QuestionnaireScreenProps {
  onComplete: (data: SelfReportData) => void;
  onSkip: () => void;
}

function RadioCard({
  value,
  selected,
  onSelect,
  children,
}: {
  value: string;
  selected: boolean;
  onSelect: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
        selected
          ? "border-primary bg-primary/10 font-medium text-foreground"
          : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-4 w-4 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${
            selected ? "border-primary" : "border-muted-foreground/50"
          }`}
        >
          {selected && <div className="h-2 w-2 rounded-full bg-primary" />}
        </div>
        <span>{children}</span>
      </div>
    </button>
  );
}

export function QuestionnaireScreen({ onComplete, onSkip }: QuestionnaireScreenProps) {
  const [age, setAge] = useState("");
  const [shortFormUsage, setShortFormUsage] = useState("");
  const [restlessness, setRestlessness] = useState("");
  const [selfRatedAttention, setSelfRatedAttention] = useState(3);
  const [screenTime, setScreenTime] = useState("");
  const [nickname, setNickname] = useState("");

  const canProceed = age !== "" && shortFormUsage !== "" && restlessness !== "" && screenTime !== "";

  const handleSubmit = () => {
    const data: SelfReportData = {
      age,
      shortFormUsage,
      restlessness,
      selfRatedAttention,
      screenTime,
      nickname: nickname.trim() || undefined,
    };
    resultsStore.setItem("selfReport", data);
    onComplete(data);
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Before You Start</h1>
          <p className="text-sm text-muted-foreground">
            A few quick questions to contextualize your results
          </p>
        </div>

        {/* Q1: Age */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">How old are you?</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={age} onValueChange={setAge} className="gap-2">
              {["13–15", "16–17", "18–20", "21+"].map((opt) => (
                <RadioCard key={opt} value={opt} selected={age === opt} onSelect={setAge}>
                  {opt}
                </RadioCard>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Q2: Short-form usage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Daily TikTok / Reels / Shorts usage?</CardTitle>
            <CardDescription className="text-xs">Estimate your average daily time on short-form video</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={shortFormUsage} onValueChange={setShortFormUsage} className="gap-2">
              {["Less than 30 min", "30 min – 1 hr", "1–3 hrs", "3+ hrs"].map((opt) => (
                <RadioCard key={opt} value={opt} selected={shortFormUsage === opt} onSelect={setShortFormUsage}>
                  {opt}
                </RadioCard>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Q3: Restlessness */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">When watching a long video, how often do you feel restless?</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={restlessness} onValueChange={setRestlessness} className="gap-2">
              {["Rarely", "Sometimes", "Often", "Almost always"].map((opt) => (
                <RadioCard key={opt} value={opt} selected={restlessness === opt} onSelect={setRestlessness}>
                  {opt}
                </RadioCard>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Q4: Self-rated attention */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">How would you rate your own attention span?</CardTitle>
            <CardDescription className="text-xs">1 = very poor, 5 = excellent</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Slider
              min={1}
              max={5}
              step={1}
              value={[selfRatedAttention]}
              onValueChange={(vals) => setSelfRatedAttention(vals[0] ?? 3)}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 – Very poor</span>
              <span className="font-semibold text-foreground text-sm">{selfRatedAttention} / 5</span>
              <span>5 – Excellent</span>
            </div>
          </CardContent>
        </Card>

        {/* Q5: Total screen time */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Total daily screen time (all apps)?</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={screenTime} onValueChange={setScreenTime} className="gap-2">
              {["Less than 2 hrs", "2–4 hrs", "4–6 hrs", "6+ hrs"].map((opt) => (
                <RadioCard key={opt} value={opt} selected={screenTime === opt} onSelect={setScreenTime}>
                  {opt}
                </RadioCard>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Q6: Leaderboard nickname */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              Leaderboard nickname
            </CardTitle>
            <CardDescription className="text-xs">
              Optional — enter a name to be automatically added to the leaderboard after completing the tests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              type="text"
              placeholder="e.g. BrainrotKing99 (leave blank to skip)"
              maxLength={30}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </CardContent>
        </Card>

        <Card>
          <CardFooter className="pt-4 pb-4 flex-col gap-3">
            <Button
              className="w-full"
              size="lg"
              disabled={!canProceed}
              onClick={handleSubmit}
            >
              Start Tests
            </Button>
            <button
              type="button"
              onClick={onSkip}
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
            >
              Skip survey and go straight to tests
            </button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
