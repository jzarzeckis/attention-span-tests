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

export function App() {
  const [screen, setScreen] = useState<Screen>({ type: "landing" });

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

  return <ResultsScreen onRestart={handleRestart} />;
}

export default App;
