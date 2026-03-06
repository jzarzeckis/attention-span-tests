export const TEST_LIST = [
  { id: "sart", name: "Sustained Attention (SART)" },
  { id: "stroop", name: "Stroop Color-Word" },
  { id: "pvt", name: "Psychomotor Vigilance (PVT)" },
  { id: "gonogo", name: "Go/No-Go" },
] as const;

export type TestId = (typeof TEST_LIST)[number]["id"];

export type Screen =
  | { type: "landing" }
  | { type: "questionnaire" }
  | { type: "test"; testIndex: number }
  | { type: "results"; isShared?: boolean };
