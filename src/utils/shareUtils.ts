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
): Promise<Blob | null> {
  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const pad = 80;
  const inner = size - pad * 2;
  const font = "system-ui, -apple-system, Arial, sans-serif";

  // Background
  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, size, size);

  // App title with pill highlight
  const titleText = "BRAINROT METER";
  ctx.font = `700 38px ${font}`;
  ctx.textAlign = "center";
  const titleWidth = ctx.measureText(titleText).width;
  const titlePillPadX = 28;
  const titlePillPadY = 16;
  const titlePillH = 38 + titlePillPadY * 2;
  const titlePillY = 68;
  // Pill background
  ctx.fillStyle = "#3f3f46";
  roundedRect(ctx, size / 2 - titleWidth / 2 - titlePillPadX, titlePillY, titleWidth + titlePillPadX * 2, titlePillH, titlePillH / 2);
  ctx.fill();
  // Title text
  ctx.fillStyle = "#fafafa";
  ctx.fillText(titleText, size / 2, titlePillY + titlePillH - titlePillPadY - 4);

  // Top separator
  ctx.strokeStyle = "#27272a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, 148);
  ctx.lineTo(size - pad, 148);
  ctx.stroke();

  // Score number
  ctx.fillStyle = "#fafafa";
  ctx.font = `bold 240px ${font}`;
  ctx.textAlign = "center";
  ctx.fillText(String(score), size / 2, 430);

  // "/ 100"
  ctx.fillStyle = "#71717a";
  ctx.font = `600 52px ${font}`;
  ctx.fillText("/ 100", size / 2, 500);

  // Progress bar background
  const barY = 540;
  const barH = 30;
  ctx.fillStyle = "#27272a";
  roundedRect(ctx, pad, barY, inner, barH, barH / 2);
  ctx.fill();

  // Progress bar fill
  const barColor = score >= 80 ? "#22c55e" : score >= 60 ? "#60a5fa" : "#ef4444";
  const fillW = Math.max(barH, inner * (score / 100)); // min width = radius so arc works
  ctx.fillStyle = barColor;
  roundedRect(ctx, pad, barY, fillW, barH, barH / 2);
  ctx.fill();

  // Rank badge
  ctx.fillStyle = barColor;
  ctx.font = `bold 52px ${font}`;
  ctx.textAlign = "center";
  ctx.fillText(badge, size / 2, 650);

  // Summary text
  ctx.fillStyle = "#a1a1aa";
  ctx.font = `32px ${font}`;
  const lines = wrapText(ctx, summary, inner);
  const lineH = 48;
  let ty = 720;
  for (const line of lines) {
    ctx.fillText(line, size / 2, ty);
    ty += lineH;
  }

  // Bottom separator
  ctx.strokeStyle = "#27272a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, 940);
  ctx.lineTo(size - pad, 940);
  ctx.stroke();

  // CTA — two-part text with URL highlighted
  const ctaPrefix = "Test your own attention span  →  ";
  const ctaUrl = "brainrot-meter.vercel.app";
  ctx.font = `28px ${font}`;
  const prefixW = ctx.measureText(ctaPrefix).width;
  ctx.font = `700 28px ${font}`;
  const urlW = ctx.measureText(ctaUrl).width;
  const ctaStartX = size / 2 - (prefixW + urlW) / 2;

  ctx.fillStyle = "#71717a";
  ctx.font = `28px ${font}`;
  ctx.textAlign = "left";
  ctx.fillText(ctaPrefix, ctaStartX, 1000);

  ctx.fillStyle = "#e4e4e7";
  ctx.font = `700 28px ${font}`;
  ctx.fillText(ctaUrl, ctaStartX + prefixW, 1000);
  ctx.textAlign = "center";

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}
