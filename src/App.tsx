import { useState } from "react";
import { LandingScreen } from "./screens/LandingScreen";
import { ResultsScreen } from "./screens/ResultsScreen";
import { TestScreen } from "./screens/TestScreen";
import type { Screen } from "./types";
import { TEST_LIST } from "./types";
import "./index.css";

export function App() {
  const [screen, setScreen] = useState<Screen>({ type: "landing" });

  switch (screen.type) {
    case "landing":
      return <LandingScreen onStart={() => setScreen({ type: "test", testIndex: 0 })} />;

    case "test":
      return (
        <TestScreen
          testIndex={screen.testIndex}
          onComplete={() => {
            const nextIndex = screen.testIndex + 1;
            if (nextIndex < TEST_LIST.length) {
              setScreen({ type: "test", testIndex: nextIndex });
            } else {
              setScreen({ type: "results" });
            }
          }}
        />
      );

    case "results":
      return <ResultsScreen onRestart={() => setScreen({ type: "landing" })} />;
  }
}

export default App;
