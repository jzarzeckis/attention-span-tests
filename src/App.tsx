import "./index.css";
import { useState, useCallback, useEffect } from "react";
import { Share2, Link, Palette } from "lucide-react";
import { toast } from "sonner";
import { type Screen, TEST_LIST } from "@/types";
import { LandingScreen } from "@/screens/LandingScreen";
import { QuestionnaireScreen } from "@/screens/QuestionnaireScreen";
import { TestScreen } from "@/screens/TestScreen";
import { ResultsScreen, calculateScores, compositeScore, getRank } from "@/screens/ResultsScreen";
import { ScoreboardScreen } from "@/screens/ScoreboardScreen";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateScoreImage, buildShareUrl, hasAnyTestResults, countCompletedTests } from "@/utils/shareUtils";
import { resultsStore } from "@/utils/resultsStore";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { THEMES, type ThemeId } from "@/themes";

const IS_DEV = process.env.NODE_ENV !== "production";

function loadSharedResults(encoded: string): boolean {
  return resultsStore.loadEncoded(encoded);
}

function getResumeIndex(): number | null {
  for (let i = 0; i < TEST_LIST.length; i++) {
    const test = TEST_LIST[i];
    if (!test) continue;
    if (!resultsStore.hasItem(test.id)) return i;
  }
  return null; // all tests completed
}

function hasAnyProgress(): boolean {
  return TEST_LIST.some((test) => resultsStore.hasItem(test.id));
}

function initTheme(): ThemeId {
  const params = new URLSearchParams(window.location.search);
  const themeParam = params.get("theme") as ThemeId | null;
  if (themeParam && THEMES.some((t) => t.id === themeParam)) {
    return themeParam;
  }
  return "default";
}

function initScreen(): Screen {
  const params = new URLSearchParams(window.location.search);

  // Dev shortcut: ?devStart=N
  if (IS_DEV) {
    const devStart = params.get("devStart");
    if (devStart !== null) {
      return { type: "test", testIndex: parseInt(devStart, 10) };
    }
  }

  // Shared results: ?r=BASE64
  const rParam = params.get("r");
  if (rParam) {
    if (loadSharedResults(rParam)) {
      return { type: "results", isShared: true };
    }
  }

  // Legacy hash format: #r=BASE64
  const hash = window.location.hash;
  if (hash.startsWith("#r=")) {
    if (loadSharedResults(hash.slice(3))) {
      return { type: "results", isShared: true };
    }
  }

  return { type: "landing" };
}

function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="fixed top-4 right-4 z-50">
      <Select value={theme} onValueChange={(v) => setTheme(v as ThemeId)}>
        <SelectTrigger
          size="sm"
          className="h-8 gap-1.5 bg-background/80 backdrop-blur-sm border-border/60 text-xs"
          aria-label="Choose theme"
        >
          <Palette className="h-3.5 w-3.5 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" side="bottom" align="end">
          {THEMES.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              <span className="mr-1">{t.emoji}</span>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ShareFAB() {
  const showFAB = hasAnyTestResults();
  const { theme } = useTheme();

  const handleShareImage = useCallback(async () => {
    const scores = calculateScores();
    const composite = compositeScore(scores);

    if (composite === null) {
      toast.error("Complete at least one test to share your score.");
      return;
    }

    const rank = getRank(composite);
    const blob = await generateScoreImage(composite, rank.badge, rank.summary, scores);

    if (!blob) {
      toast.error("Could not generate image.");
      return;
    }

    const file = new File([blob], "brainrot-score.png", { type: "image/png" });

    // Mobile: Web Share API with file support (iOS and Android Chrome 86+)
    // Skip on Windows — the native share UI is poor; download instead
    const isWindows = /Windows/i.test(navigator.userAgent);
    if (navigator.share && !isWindows) {
      try {
        await navigator.share({ title: "My Brainrot Score", files: [file] });
        return;
      } catch (err) {
        // User cancelled — stop here
        if (err instanceof Error && err.name === "AbortError") return;
        // File sharing not supported by this browser — fall through to download
      }
    }

    // Fallback: download the image so user can share manually
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = "brainrot-score.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
    toast.success("Score image saved — share it on social media!");
  }, []);

  const handleShareLink = useCallback(() => {
    const count = countCompletedTests();
    const url = buildShareUrl(theme);

    const afterCopy = () => {
      const message =
        count < 4
          ? `Link copied! (${count} of 4 tests — finish the rest for your full score)`
          : "Results link copied!";
      toast.success(message);
    };

    // Always copy to clipboard — don't use navigator.share here because
    // dismissing the share sheet silently swallows the action (noop).
    // The "Flex my score" image button already handles native sharing.
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(afterCopy).catch(afterCopy);
      return;
    }

    // Final fallback: execCommand
    try {
      const el = document.createElement("textarea");
      el.value = url;
      el.style.cssText = "position:fixed;opacity:0;pointer-events:none;";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      afterCopy();
    } catch {
      afterCopy();
    }
  }, [theme]);

  if (!showFAB) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2" style={{ bottom: "max(1.5rem, calc(env(safe-area-inset-bottom) + 1rem))" }}>
      <Button
        className="rounded-full shadow-lg h-12 px-5 gap-2 font-semibold"
        onClick={handleShareImage}
        aria-label="Share score image"
        style={{ touchAction: "manipulation" }}
      >
        <Share2 className="h-5 w-5 shrink-0" />
        <span className="pointer-events-none">Flex my score</span>
      </Button>
      <Button
        variant="secondary"
        className="rounded-full shadow-lg h-9 px-4 gap-2 text-sm"
        onClick={handleShareLink}
        aria-label="Copy results link"
        style={{ touchAction: "manipulation" }}
      >
        <Link className="h-4 w-4 shrink-0" />
        <span className="pointer-events-none">Copy results link</span>
      </Button>
    </div>
  );
}

function AppInner() {
  const [screen, setScreen] = useState<Screen>(initScreen);

  // Dev escape hatch: window.__devGoToTest(index) jumps to a test without reload
  useEffect(() => {
    if (IS_DEV) {
      (window as unknown as Record<string, unknown>).__devGoToTest = (index: number) => {
        setScreen({ type: "test", testIndex: index });
      };
    }
  }, []);

  const handleStart = () => setScreen({ type: "questionnaire" });

  const handleQuestionnaireComplete = () => setScreen({ type: "test", testIndex: 0 });

  const handleContinue = () => {
    const resumeIndex = getResumeIndex();
    if (resumeIndex === null) {
      setScreen({ type: "results" });
    } else {
      setScreen({ type: "test", testIndex: resumeIndex });
    }
  };

  const handleNext = () => {
    if (screen.type !== "test") return;
    const nextIndex = screen.testIndex + 1;
    if (nextIndex >= TEST_LIST.length) {
      setScreen({ type: "results" });
    } else {
      setScreen({ type: "test", testIndex: nextIndex });
    }
  };

  const handleRestart = () => {
    resultsStore.clearAll();
    setScreen({ type: "landing" });
  };

  const handleViewScoreboard = () => setScreen({ type: "scoreboard" });
  const handleBackFromScoreboard = () => setScreen({ type: "results" });

  return (
    <>
      {screen.type === "landing" && (
        <LandingScreen
          onStart={handleStart}
          hasProgress={hasAnyProgress()}
          onContinue={handleContinue}
          onStartOver={handleRestart}
        />
      )}
      {screen.type === "questionnaire" && (
        <QuestionnaireScreen onComplete={handleQuestionnaireComplete} onSkip={handleQuestionnaireComplete} />
      )}
      {screen.type === "test" && (
        <TestScreen testIndex={screen.testIndex} onNext={handleNext} />
      )}
      {screen.type === "results" && (
        <ResultsScreen onRestart={handleRestart} onViewScoreboard={handleViewScoreboard} isShared={!!screen.isShared} />
      )}
      {screen.type === "scoreboard" && (
        <ScoreboardScreen onBack={handleBackFromScoreboard} />
      )}
      <ThemePicker />
      {screen.type !== "test" && <ShareFAB />}
      <Toaster position="bottom-center" />
    </>
  );
}

export function App() {
  return (
    <ThemeProvider initialTheme={initTheme()}>
      <AppInner />
    </ThemeProvider>
  );
}

export default App;
