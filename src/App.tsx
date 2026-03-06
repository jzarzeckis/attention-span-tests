import "./index.css";
import { useState } from "react";
import { type Screen, TEST_LIST } from "@/types";
import { LandingScreen } from "@/screens/LandingScreen";
import { TestScreen } from "@/screens/TestScreen";
import { ResultsScreen } from "@/screens/ResultsScreen";

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
    return loaded;
  } catch {
    return false;
  }
}

function initScreen(): Screen {
  const hash = window.location.hash;
  if (hash.startsWith("#r=")) {
    const encoded = hash.slice(3);
    if (decodeSharedResults(encoded)) {
      return { type: "results", isShared: true };
    }
  }
  return { type: "landing" };
}

export function App() {
  const [screen, setScreen] = useState<Screen>(initScreen);

  const handleStart = () => setScreen({ type: "test", testIndex: 0 });

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
    setScreen({ type: "landing" });
  };

  if (screen.type === "landing") {
    return (
      <LandingScreen
        onStart={handleStart}
        hasProgress={hasAnyProgress()}
        onContinue={handleContinue}
        onStartOver={handleRestart}
      />
    );
  }

  if (screen.type === "test") {
    return <TestScreen testIndex={screen.testIndex} onNext={handleNext} />;
  }

  return <ResultsScreen onRestart={handleRestart} isShared={screen.type === "results" && !!screen.isShared} />;
}

export default App;
