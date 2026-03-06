import "./index.css";
import { useState } from "react";
import { type Screen, TEST_LIST } from "@/types";
import { LandingScreen } from "@/screens/LandingScreen";
import { TestScreen } from "@/screens/TestScreen";
import { ResultsScreen } from "@/screens/ResultsScreen";

export function App() {
  const [screen, setScreen] = useState<Screen>({ type: "landing" });

  const handleStart = () => setScreen({ type: "test", testIndex: 0 });

  const handleNext = () => {
    if (screen.type !== "test") return;
    const nextIndex = screen.testIndex + 1;
    if (nextIndex >= TEST_LIST.length) {
      setScreen({ type: "results" });
    } else {
      setScreen({ type: "test", testIndex: nextIndex });
    }
  };

  const handleRestart = () => setScreen({ type: "landing" });

  if (screen.type === "landing") {
    return <LandingScreen onStart={handleStart} />;
  }

  if (screen.type === "test") {
    return <TestScreen testIndex={screen.testIndex} onNext={handleNext} />;
  }

  return <ResultsScreen onRestart={handleRestart} />;
}

export default App;
