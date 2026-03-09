import "./index.css";
import { useState, useCallback, useEffect } from "react";
import { Share2, Link, Palette } from "lucide-react";
import { toast } from "sonner";
import { type Screen, type SelfReportData, TEST_LIST } from "@/types";
import { LandingScreen } from "@/screens/LandingScreen";
import { QuestionnaireScreen } from "@/screens/QuestionnaireScreen";
import { TestScreen } from "@/screens/TestScreen";
import { ResultsScreen, calculateScores, compositeScore, getRank } from "@/screens/ResultsScreen";
import { ScoreboardScreen } from "@/screens/ScoreboardScreen";
import { StatsScreen } from "@/screens/StatsScreen";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateScoreImage, buildShareUrl, hasAnyTestResults, countCompletedTests } from "@/utils/shareUtils";
import { resultsStore } from "@/utils/resultsStore";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { THEMES, type ThemeId } from "@/themes";
import { getOrCreateVisitorId } from "@/utils/visitorId";

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

function getScreenPath(screen: Screen): string | null {
  switch (screen.type) {
    case "landing": return "/";
    case "results": return "/results";
    case "scoreboard": return "/scoreboard";
    case "stats": return "/stats";
    default: return null; // questionnaire, test — no URL change (continuous flow)
  }
}

function screenFromPath(path: string): Screen | null {
  switch (path) {
    case "/scoreboard": return { type: "scoreboard" };
    case "/stats": return { type: "stats" };
    case "/results": return { type: "results" };
    case "/": return { type: "landing" };
    default: return null;
  }
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
  const path = window.location.pathname;

  if (path === "/stats") return { type: "stats" };
  if (path === "/scoreboard") return { type: "scoreboard" };
  if (path === "/results") {
    // Only show results if there's something stored; otherwise fall back to landing
    if (hasAnyProgress()) return { type: "results" };
    return { type: "landing" };
  }

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
  // null = not yet checked, undefined = no survey, object = has survey
  const [returningSurvey, setReturningSurvey] = useState<SelfReportData | null | undefined>(null);

  // Navigate to a screen, pushing a new browser history entry for "page" screens
  const navigate = useCallback((newScreen: Screen) => {
    const path = getScreenPath(newScreen);
    if (path !== null && path !== window.location.pathname) {
      window.history.pushState({}, "", path);
    }
    setScreen(newScreen);
  }, []);

  // Sync URL with initial screen on mount (e.g. /results with no data falls back to /)
  useEffect(() => {
    const path = getScreenPath(screen);
    if (path !== null && path !== window.location.pathname) {
      window.history.replaceState({}, "", path);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const newScreen = screenFromPath(window.location.pathname);
      if (newScreen) setScreen(newScreen);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // On mount: register visitor UUID cookie and check if they've done the survey before
  useEffect(() => {
    const visitorId = getOrCreateVisitorId();

    // Register visitor in DB (fire and forget)
    fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "register", visitorId }),
    }).catch(() => {});

    // Check if they have survey data from a previous session
    fetch(`/api/session?visitor_id=${encodeURIComponent(visitorId)}`)
      .then((r) => r.json())
      .then((data: { hasSurvey: boolean; surveyData?: SelfReportData }) => {
        if (data.hasSurvey && data.surveyData) {
          setReturningSurvey(data.surveyData);
          // Pre-populate results store so they skip the questionnaire
          resultsStore.setItem("selfReport", data.surveyData);
        } else {
          setReturningSurvey(undefined);
        }
      })
      .catch(() => {
        setReturningSurvey(undefined);
      });
  }, []);

  // Dev escape hatch: window.__devGoToTest(index) jumps to a test without reload
  useEffect(() => {
    if (IS_DEV) {
      (window as unknown as Record<string, unknown>).__devGoToTest = (index: number) => {
        setScreen({ type: "test", testIndex: index });
      };
    }
  }, []);

  const handleStart = () => {
    // If returning visitor with survey data, skip questionnaire
    if (returningSurvey) {
      setScreen({ type: "test", testIndex: 0 });
    } else {
      setScreen({ type: "questionnaire" });
    }
  };

  const handleQuestionnaireComplete = (data?: SelfReportData) => {
    if (data) {
      // Persist survey data to DB
      const visitorId = getOrCreateVisitorId();
      fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "survey", visitorId, surveyData: data }),
      }).catch(() => {});
    }
    setScreen({ type: "test", testIndex: 0 });
  };

  const handleContinue = () => {
    const resumeIndex = getResumeIndex();
    if (resumeIndex === null) {
      navigate({ type: "results" });
    } else {
      setScreen({ type: "test", testIndex: resumeIndex });
    }
  };

  const handleNext = () => {
    if (screen.type !== "test") return;
    const nextIndex = screen.testIndex + 1;
    if (nextIndex >= TEST_LIST.length) {
      navigate({ type: "results" });
    } else {
      setScreen({ type: "test", testIndex: nextIndex });
    }
  };

  const handleRestart = () => {
    resultsStore.clearAll();
    window.history.pushState({}, "", "/");
    setScreen({ type: "landing" });
  };

  const handleViewScoreboard = () => navigate({ type: "scoreboard", from: "results" });
  const handleViewScoreboardFromLanding = () => navigate({ type: "scoreboard", from: "landing" });
  const handleBackFromScoreboard = () => history.back();

  const handleViewStats = () => navigate({ type: "stats" });
  const handleBackFromStats = () => history.back();

  return (
    <>
      {screen.type === "landing" && (
        <LandingScreen
          onStart={handleStart}
          hasProgress={hasAnyProgress()}
          onContinue={handleContinue}
          onStartOver={handleRestart}
          onViewScoreboard={handleViewScoreboardFromLanding}
          onViewStats={handleViewStats}
          isReturningVisitor={!!returningSurvey}
        />
      )}
      {screen.type === "questionnaire" && (
        <QuestionnaireScreen onComplete={handleQuestionnaireComplete} onSkip={() => handleQuestionnaireComplete()} />
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
      {screen.type === "stats" && (
        <StatsScreen onBack={handleBackFromStats} />
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
