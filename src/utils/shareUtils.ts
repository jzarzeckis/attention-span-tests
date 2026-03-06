const TEST_KEYS = ["sart", "focus", "stroop", "pvt", "delay", "gonogo"] as const;

export function encodeResults(): string {
  const data: Record<string, unknown> = {};
  for (const id of TEST_KEYS) {
    const raw = sessionStorage.getItem(id);
    if (raw) data[id] = JSON.parse(raw);
  }
  const selfReportRaw = sessionStorage.getItem("selfReport");
  if (selfReportRaw) data["selfReport"] = JSON.parse(selfReportRaw);
  return btoa(JSON.stringify(data));
}

export function buildShareUrl(): string {
  const encoded = encodeResults();
  return `${window.location.origin}/share?r=${encoded}`;
}

export function countCompletedTests(): number {
  return TEST_KEYS.filter((id) => sessionStorage.getItem(id) !== null).length;
}

export function hasAnyTestResults(): boolean {
  return TEST_KEYS.some((id) => sessionStorage.getItem(id) !== null);
}
