import { resultsStore } from "./resultsStore";
import { calculateScores, compositeScore, getRank } from "./scoring";

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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function generateScoreImage(): Promise<Blob | null> {
  const scores = calculateScores();
  const composite = compositeScore(scores);
  if (composite === null) return null;

  const rank = getRank(composite);

  const W = 1200;
  const H = 630;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background
  ctx.fillStyle = "#100f1e";
  ctx.fillRect(0, 0, W, H);

  // Subtle grid pattern
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Card
  const cardX = 60, cardY = 50, cardW = W - 120, cardH = H - 100;
  ctx.fillStyle = "#1a1830";
  roundRect(ctx, cardX, cardY, cardW, cardH, 24);
  ctx.fill();

  ctx.strokeStyle = "#2a2845";
  ctx.lineWidth = 2;
  roundRect(ctx, cardX, cardY, cardW, cardH, 24);
  ctx.stroke();

  // Left column content
  const leftX = cardX + 56;

  // App name
  ctx.fillStyle = "#a3e635";
  ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("BRAINROT METER", leftX, cardY + 64);

  // Divider line
  ctx.strokeStyle = "#2a2845";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(leftX, cardY + 82);
  ctx.lineTo(leftX + 220, cardY + 82);
  ctx.stroke();

  // "YOUR ATTENTION SCORE" label
  ctx.fillStyle = "#71717a";
  ctx.font = "600 18px system-ui, -apple-system, sans-serif";
  ctx.fillText("YOUR ATTENTION SCORE", leftX, cardY + 115);

  // Large score
  ctx.fillStyle = "#f5f5f5";
  ctx.font = "bold 160px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${composite}`, leftX, cardY + 310);

  // "/ 100"
  ctx.fillStyle = "#52525b";
  ctx.font = "500 52px system-ui, -apple-system, sans-serif";
  const scoreWidth = ctx.measureText(`${composite}`).width;

  // Recalculate score width using the bold font
  ctx.font = "bold 160px system-ui, -apple-system, sans-serif";
  const bigScoreWidth = ctx.measureText(`${composite}`).width;
  ctx.font = "500 52px system-ui, -apple-system, sans-serif";
  ctx.fillText("/ 100", leftX + bigScoreWidth + 16, cardY + 290);

  // Progress bar background
  const barX = leftX;
  const barY = cardY + 340;
  const barW = 480;
  const barH = 14;
  ctx.fillStyle = "#2a2845";
  roundRect(ctx, barX, barY, barW, barH, 7);
  ctx.fill();

  // Progress bar fill
  const progressW = Math.max(barH, barW * (composite / 100));
  const barColor = composite >= 80 ? "#a3e635" : composite >= 60 ? "#a1a1aa" : "#ef4444";
  ctx.fillStyle = barColor;
  roundRect(ctx, barX, barY, progressW, barH, 7);
  ctx.fill();

  // Score labels
  ctx.fillStyle = "#52525b";
  ctx.font = "500 16px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("0", barX, barY + barH + 24);
  ctx.textAlign = "right";
  ctx.fillText("100", barX + barW, barY + barH + 24);

  // Rank badge
  const badgeBg = composite >= 80 ? "#1a3a00" : composite >= 60 ? "#1e1c36" : "#2d0f0f";
  const badgeFg = composite >= 80 ? "#a3e635" : composite >= 60 ? "#a1a1aa" : "#ef4444";
  const badgeBorder = composite >= 80 ? "#4d7c0f" : composite >= 60 ? "#3f3d6e" : "#7f1d1d";

  ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  const badgeTextW = ctx.measureText(rank.badge).width;
  const bPadX = 24, bPadY = 12;
  const bX = leftX;
  const bY = cardY + 400;
  const bW = badgeTextW + bPadX * 2;
  const bH = 28 + bPadY * 2;

  ctx.fillStyle = badgeBg;
  roundRect(ctx, bX, bY, bW, bH, bH / 2);
  ctx.fill();

  ctx.strokeStyle = badgeBorder;
  ctx.lineWidth = 1.5;
  roundRect(ctx, bX, bY, bW, bH, bH / 2);
  ctx.stroke();

  ctx.fillStyle = badgeFg;
  ctx.fillText(rank.badge, bX + bPadX, bY + bH / 2 + 10);

  // Right column — summary text
  const rightX = W / 2 + 20;
  const rightW = cardX + cardW - rightX - 56;

  // "What this means" label
  ctx.fillStyle = "#52525b";
  ctx.font = "600 16px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("WHAT THIS MEANS", rightX, cardY + 115);

  // Summary text word-wrap
  ctx.fillStyle = "#c4c4c8";
  ctx.font = "400 22px system-ui, -apple-system, sans-serif";
  const words = rank.summary.split(" ");
  let line = "";
  let lineY = cardY + 155;
  const lineHeight = 36;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const testW = ctx.measureText(testLine).width;
    if (testW > rightW && line) {
      ctx.fillText(line, rightX, lineY);
      line = word;
      lineY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, rightX, lineY);

  // Bottom footer
  const footerY = cardY + cardH - 32;
  ctx.fillStyle = "#3a3858";
  ctx.font = "500 18px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(window.location.hostname, leftX, footerY);

  ctx.fillStyle = "#a3e635";
  ctx.textAlign = "right";
  ctx.fillText("Test your own attention \u2192", cardX + cardW - 56, footerY);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
