import "./index.css";
import { useState, useCallback } from "react";
import { Share2, Check } from "lucide-react";
import { type Screen, TEST_LIST } from "@/types";
import { LandingScreen } from "@/screens/LandingScreen";
import { QuestionnaireScreen } from "@/screens/QuestionnaireScreen";
import { TestScreen } from "@/screens/TestScreen";
import { ResultsScreen } from "@/screens/ResultsScreen";
import { Button } from "@/components/ui/button";
import { buildShareUrl, hasAnyTestResults, countCompletedTests } from "@/utils/shareUtils";

function getResumeIndex(): number | null {
  for (let i = 0; i < TEST_LIST.length; i++) {
    const test = TEST_LIST[i];
    if (!test) continue;
    if (!sessionStorage.getItem(test.id)) return i;
  }
  return null; // all tests completed
}

function hasAnyProgress(): boolean {
  return TEST_LIST.some((test) => sessionStorage.getItem(test.id) !== null);
}

function decodeSharedResults(encoded: string): boolean {
  try {
    const data = JSON.parse(atob(encoded)) as Record<string, unknown>;
    let loaded = false;
    for (const test of TEST_LIST) {
      if (test.id in data) {
        sessionStorage.setItem(test.id, JSON.stringify(data[test.id]));
        loaded = true;
      }
    }
    if ("selfReport" in data) {
      sessionStorage.setItem("selfReport", JSON.stringify(data["selfReport"]));
    }
    return loaded;
  } catch {
    return false;
  }
}

// Dev escape hatch: window.__devGoToTest(1) skips to a specific test by index
if (typeof window !== "undefined") {
  (window as Record<string, unknown>).__devGoToTest = (index: number) => {
    sessionStorage.setItem("__devStartAt", String(index));
    location.reload();
  };
}

function initScreen(): Screen {
  // Dev shortcut: sessionStorage.__devStartAt
  const devStart = sessionStorage.getItem("__devStartAt");
  if (devStart !== null) {
    sessionStorage.removeItem("__devStartAt");
    return { type: "test", testIndex: parseInt(devStart, 10) };
  }
  // New format: ?r= query param
  const params = new URLSearchParams(window.location.search);
  const rParam = params.get("r");
  if (rParam) {
    if (decodeSharedResults(rParam)) {
      history.replaceState(null, "", window.location.pathname);
      return { type: "results", isShared: true };
    }
  }
  // Fallback: legacy hash format (#r=BASE64)
  const hash = window.location.hash;
  if (hash.startsWith("#r=")) {
    const encoded = hash.slice(3);
    if (decodeSharedResults(encoded)) {
      return { type: "results", isShared: true };
    }
  }
  return { type: "landing" };
}

function ShareFAB() {
  const [copied, setCopied] = useState(false);
  const [labelText, setLabelText] = useState("");
  const [labelVisible, setLabelVisible] = useState(false);
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
      const text =
        count < 4
          ? `Sharing ${count} of 4 tests — finish the rest for your full score!`
          : "Link copied!";
      setLabelText(text);
      setCopied(true);
      setLabelVisible(true);
      setTimeout(() => setLabelVisible(false), 2200);
      setTimeout(() => setCopied(false), 2500);
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
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2" style={{ bottom: "max(1.5rem, calc(env(safe-area-inset-bottom) + 1rem))" }}>
      <span
        className={`text-xs bg-background border rounded px-2 py-1 shadow text-muted-foreground whitespace-nowrap transition-opacity duration-300 pointer-events-none ${labelVisible ? "opacity-100" : "opacity-0"}`}
      >
        {labelText}
      </span>
      <Button
        className="rounded-full shadow-lg h-12 px-5 gap-2 font-semibold"
        onClick={handleShare}
        aria-label="Share results"
        style={{ touchAction: "manipulation" }}
      >
        {copied ? <Check className="h-5 w-5 shrink-0" /> : <Share2 className="h-5 w-5 shrink-0" />}
        <span className="pointer-events-none">
          {copied ? "Link copied!" : "Flex my score"}
        </span>
      </Button>
    </div>
  );
}

export function App() {
  const [screen, setScreen] = useState<Screen>(initScreen);

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
    TEST_LIST.forEach((test) => sessionStorage.removeItem(test.id));
    sessionStorage.removeItem("selfReport");
    setScreen({ type: "landing" });
  };

  if (screen.type === "landing") {
    return (
      <>
        <LandingScreen
          onStart={handleStart}
          hasProgress={hasAnyProgress()}
          onContinue={handleContinue}
          onStartOver={handleRestart}
        />
        <ShareFAB />
      </>
    );
  }

  if (screen.type === "questionnaire") {
    return (
      <>
        <QuestionnaireScreen onComplete={handleQuestionnaireComplete} onSkip={handleQuestionnaireComplete} />
        <ShareFAB />
      </>
    );
  }

  if (screen.type === "test") {
    return (
      <>
        <TestScreen testIndex={screen.testIndex} onNext={handleNext} />
        <ShareFAB />
      </>
    );
  }

  return (
    <>
      <ResultsScreen onRestart={handleRestart} isShared={screen.type === "results" && !!screen.isShared} />
      <ShareFAB />
    </>
  );
}

export default App;
