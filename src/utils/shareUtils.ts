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

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export async function generateScoreImage(
  score: number,
  badge: string,
  summary: string,
  testScores?: { sart: number | null; stroop: number | null; pvt: number | null; gonogo: number | null },
): Promise<Blob | null> {
  const W = 1080;
  const H = 1300;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const pad = 80;
  const inner = W - pad * 2;
  const font = "system-ui, -apple-system, Arial, sans-serif";

  // Background
  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, W, H);

  // App title with pill highlight
  const titleText = "BRAINROToMETER";
  ctx.font = `700 52px ${font}`;
  ctx.textAlign = "center";
  const titleWidth = ctx.measureText(titleText).width;
  const titlePillPadX = 28;
  const titlePillPadY = 16;
  const titlePillH = 52 + titlePillPadY * 2;
  const titlePillY = 60;
  ctx.fillStyle = "#3f3f46";
  roundedRect(ctx, W / 2 - titleWidth / 2 - titlePillPadX, titlePillY, titleWidth + titlePillPadX * 2, titlePillH, titlePillH / 2);
  ctx.fill();
  ctx.fillStyle = "#fafafa";
  ctx.font = `700 52px ${font}`;
  ctx.fillText(titleText, W / 2, titlePillY + titlePillH - titlePillPadY - 4);

  // Top separator
  ctx.strokeStyle = "#27272a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, 148);
  ctx.lineTo(W - pad, 148);
  ctx.stroke();

  // Score number
  ctx.fillStyle = "#fafafa";
  ctx.font = `bold 240px ${font}`;
  ctx.textAlign = "center";
  ctx.fillText(String(score), W / 2, 430);

  // "/ 100"
  ctx.fillStyle = "#71717a";
  ctx.font = `600 52px ${font}`;
  ctx.fillText("/ 100", W / 2, 500);

  // Progress bar background
  const barY = 540;
  const barH = 30;
  ctx.fillStyle = "#27272a";
  roundedRect(ctx, pad, barY, inner, barH, barH / 2);
  ctx.fill();

  // Progress bar fill
  const barColor = score >= 80 ? "#22c55e" : score >= 60 ? "#60a5fa" : "#ef4444";
  const fillW = Math.max(barH, inner * (score / 100));
  ctx.fillStyle = barColor;
  roundedRect(ctx, pad, barY, fillW, barH, barH / 2);
  ctx.fill();

  // Rank badge
  ctx.fillStyle = barColor;
  ctx.font = `bold 52px ${font}`;
  ctx.textAlign = "center";
  ctx.fillText(badge, W / 2, 650);

  // Summary text
  ctx.fillStyle = "#a1a1aa";
  ctx.font = `32px ${font}`;
  const lines = wrapText(ctx, summary, inner);
  const lineH = 48;
  let ty = 720;
  for (const line of lines) {
    ctx.fillText(line, W / 2, ty);
    ty += lineH;
  }

  // Test breakdown section
  const breakdownTests = [
    { label: "Sustained Attention (SART)", score: testScores?.sart ?? null },
    { label: "Stroop Color-Word", score: testScores?.stroop ?? null },
    { label: "Psychomotor Vigilance (PVT)", score: testScores?.pvt ?? null },
    { label: "Go / No-Go", score: testScores?.gonogo ?? null },
  ];

  // Section header with side lines
  const sectionHeaderY = 820;
  ctx.font = `600 24px ${font}`;
  ctx.textAlign = "center";
  const headerLabel = "TEST BREAKDOWN";
  const headerLabelW = ctx.measureText(headerLabel).width;
  const lineGap = 24;
  ctx.strokeStyle = "#27272a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, sectionHeaderY - 8);
  ctx.lineTo(W / 2 - headerLabelW / 2 - lineGap, sectionHeaderY - 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W / 2 + headerLabelW / 2 + lineGap, sectionHeaderY - 8);
  ctx.lineTo(W - pad, sectionHeaderY - 8);
  ctx.stroke();
  ctx.fillStyle = "#52525b";
  ctx.fillText(headerLabel, W / 2, sectionHeaderY);

  // Individual test bars
  const testBarH = 12;
  const rowPitch = 60;
  let rowY = 865;

  for (const t of breakdownTests) {
    const testScore = t.score;
    const testBarColor = testScore === null
      ? "#3f3f46"
      : testScore >= 80 ? "#22c55e" : testScore >= 60 ? "#60a5fa" : "#ef4444";
    const scoreLabel = testScore === null ? "—" : `${Math.round(testScore)}%`;

    // Label (left)
    ctx.fillStyle = "#a1a1aa";
    ctx.font = `500 26px ${font}`;
    ctx.textAlign = "left";
    ctx.fillText(t.label, pad, rowY);

    // Score (right)
    ctx.fillStyle = testScore === null ? "#52525b" : "#fafafa";
    ctx.font = `700 26px ${font}`;
    ctx.textAlign = "right";
    ctx.fillText(scoreLabel, W - pad, rowY);

    // Bar track
    ctx.fillStyle = "#27272a";
    roundedRect(ctx, pad, rowY + 12, inner, testBarH, testBarH / 2);
    ctx.fill();

    // Bar fill
    if (testScore !== null) {
      const tFillW = Math.max(testBarH, inner * (testScore / 100));
      ctx.fillStyle = testBarColor;
      roundedRect(ctx, pad, rowY + 12, tFillW, testBarH, testBarH / 2);
      ctx.fill();
    }

    rowY += rowPitch;
  }

  // Bottom separator
  ctx.strokeStyle = "#27272a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, 1095);
  ctx.lineTo(W - pad, 1095);
  ctx.stroke();

  // CTA line 1 — gradient "test your own attention span"
  ctx.font = `700 54px ${font}`;
  ctx.textAlign = "center";
  const ctaGrad = ctx.createLinearGradient(W / 2 - 320, 0, W / 2 + 320, 0);
  ctaGrad.addColorStop(0, "#ef4444");
  ctaGrad.addColorStop(0.5, "#1e1b4b");
  ctaGrad.addColorStop(1, "#3b82f6");
  ctx.fillStyle = ctaGrad;
  ctx.fillText("test your own attention span", W / 2, 1185);

  // CTA line 2 — URL in gradient pill
  const ctaUrl = "brainrot-meter.vercel.app";
  ctx.font = `700 40px ${font}`;
  const ctaUrlW = ctx.measureText(ctaUrl).width;
  const uPadX = 40;
  const uPillH = 72;
  const uPillW = ctaUrlW + uPadX * 2;
  const uPillX = W / 2 - uPillW / 2;
  const uPillY = 1225;
  const pillGrad = ctx.createLinearGradient(uPillX, 0, uPillX + uPillW, 0);
  pillGrad.addColorStop(0, "#dc2626");
  pillGrad.addColorStop(0.5, "#1e1b4b");
  pillGrad.addColorStop(1, "#3b82f6");
  ctx.fillStyle = pillGrad;
  roundedRect(ctx, uPillX, uPillY, uPillW, uPillH, uPillH / 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(ctaUrl, W / 2, uPillY + uPillH / 2);
  ctx.textBaseline = "alphabetic";

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}
