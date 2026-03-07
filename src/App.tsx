import "./index.css";
import { useState, useCallback, useEffect } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { type Screen, TEST_LIST } from "@/types";
import { LandingScreen } from "@/screens/LandingScreen";
import { QuestionnaireScreen } from "@/screens/QuestionnaireScreen";
import { TestScreen } from "@/screens/TestScreen";
import { ResultsScreen } from "@/screens/ResultsScreen";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { buildShareUrl, hasAnyTestResults, countCompletedTests } from "@/utils/shareUtils";
import { resultsStore } from "@/utils/resultsStore";

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

function ShareFAB({ subtle = false }: { subtle?: boolean }) {
  const showFAB = hasAnyTestResults();

  const handleShare = useCallback(() => {
    const count = countCompletedTests();
    const url = buildShareUrl();

    // Use native share sheet on mobile (iOS/Android) — most reliable
    if (navigator.share) {
      navigator.share({ title: "Brainrot Meter Results", url }).catch(() => {});
      return;
    }

    const afterCopy = () => {
      const message =
        count < 4
          ? `Sharing ${count} of 4 tests — finish the rest for your full score!`
          : "Link copied!";
      toast.success(message);
    };

    // Clipboard API (requires secure context)
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(afterCopy).catch(afterCopy);
      return;
    }

    // Final fallback: execCommand (works in non-HTTPS contexts)
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
  }, []);

  if (!showFAB) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50" style={{ bottom: "max(1.5rem, calc(env(safe-area-inset-bottom) + 1rem))" }}>
      {subtle ? (
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full h-9 w-9 text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-background/60"
          onClick={handleShare}
          aria-label="Share results"
          style={{ touchAction: "manipulation" }}
        >
          <Share2 className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          className="rounded-full shadow-lg h-12 px-5 gap-2 font-semibold"
          onClick={handleShare}
          aria-label="Share results"
          style={{ touchAction: "manipulation" }}
        >
          <Share2 className="h-5 w-5 shrink-0" />
          <span className="pointer-events-none">Flex my score</span>
        </Button>
      )}
    </div>
  );
}

export function App() {
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
        <ResultsScreen onRestart={handleRestart} isShared={!!screen.isShared} />
      )}
      <ShareFAB subtle={screen.type === "test"} />
      <Toaster position="bottom-center" />
    </>
  );
}

export default App;
