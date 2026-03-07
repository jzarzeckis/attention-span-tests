import { resultsStore } from "./resultsStore";

const TEST_KEYS = ["sart", "stroop", "pvt", "gonogo"] as const;

export function buildShareUrl(): string {
  return `${window.location.origin}/?r=${resultsStore.encode()}`;
}

export function countCompletedTests(): number {
  return TEST_KEYS.filter((id) => resultsStore.hasItem(id)).length;
}

export function hasAnyTestResults(): boolean {
  return TEST_KEYS.some((id) => resultsStore.hasItem(id));
}
