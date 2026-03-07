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

// ── Result types ────────────────────────────────────────────────────────────

export interface SelfReportData {
  age: string;
  shortFormUsage: string;
  restlessness: string;
  selfRatedAttention: number;
  screenTime: string;
}

export interface SARTStats {
  commissionErrors: number;
  commissionRate: number;
  omissionErrors: number;
  omissionRate: number;
  meanRT: number;
  rtCV: number;
  totalTrials: number;
}

export interface StroopStats {
  condition1: { accuracy: number; meanRT: number };
  condition2: { accuracy: number; meanRT: number };
  condition3: { accuracy: number; meanRT: number };
  interferenceScore: number;
}

export interface PVTStats {
  medianRT: number;
  meanRT: number;
  lapses: number;
  lapseRate: number;
  falseStarts: number;
  totalTrials: number;
  rts: number[];
}

export interface GoNoGoStats {
  commissionErrors: number;
  commissionErrorRate: number;
  omissionErrors: number;
  omissionErrorRate: number;
  meanRT: number;
  rtCV: number;
  totalTrials: number;
  goTrials: number;
  nogoTrials: number;
}

export type SkippedResult = { skipped: true };

export interface StoreData {
  sart: SARTStats | SkippedResult;
  stroop: StroopStats | SkippedResult;
  pvt: PVTStats | SkippedResult;
  gonogo: GoNoGoStats | SkippedResult;
  selfReport: SelfReportData;
}
