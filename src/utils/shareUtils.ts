import { resultsStore } from "./resultsStore";
import { type ThemeId, DEFAULT_THEME } from "@/themes";

const TEST_KEYS = ["sart", "stroop", "pvt", "gonogo"] as const;

export function buildShareUrl(theme: ThemeId = DEFAULT_THEME): string {
  const base = `${window.location.origin}/?r=${resultsStore.encode()}`;
  if (theme !== DEFAULT_THEME) {
    return `${base}&theme=${theme}`;
  }
  return base;
}

export function countCompletedTests(): number {
  return TEST_KEYS.filter((id) => resultsStore.hasItem(id)).length;
}

export function hasAnyTestResults(): boolean {
  return TEST_KEYS.some((id) => resultsStore.hasItem(id));
}
