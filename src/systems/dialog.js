// Persona 3 Reload-idiom dialogue panel: blue/cyan glass, diagonal cuts, a sheared
// name chip and a character bust bleeding above the top edge. Anchored to the
// very bottom of the screen, covering the HUD chrome under it while it's up.
// Kept non-blocking — gameplay never pauses for it — by drawing it fixed on the
// HUD layer and having lines auto-advance on a timer instead of waiting for
// input. One speaker shows at a time; a short queue lets Grogu's reaction play
// before Mando's line follows it, which reads far clearer mid-combat than two
// floating bubbles at once. `drawPanel` is exported so the intro cinematic can
// reuse the exact same panel for its own captions.

import { STRINGS } from '../strings.js';
import { drawSprite } from '../assets.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

const SPEAKERS = {
  grogu: { name: 'GROGU', accent: '#8fe3a0', glow: '143,227,160', chip: 'rgba(18,42,30,0.94)' },
  mando: { name: 'MANDO', accent: '#8fe3ff', glow: '143,227,255', chip: 'rgba(14,30,46,0.94)' },
  luke: { name: 'LUKE', accent: '#ffb066', glow: '255,176,102', chip: 'rgba(46,30,14,0.94)' },
};

// Rendered height (native px * BASE_SCALE from assets.js) used to seat each bust's
// feet on the box's top edge instead of centering it blindly.
const PORTRAIT_H = {
  portrait_grogu: 63,
  portrait_grogu_tired: 67,
  portrait_grogu_spent: 63,
  portrait_mando: 63,
  portrait_luke: 49,
};

// Anchored to the very bottom of the 1600x900 virtual canvas, Persona-idiom:
// the panel is meant to sit on the floor of the screen and cover whatever HUD
// chrome is under it while it's up.
const BOX = {
  x0: 140,
  x1: 1460,
  y0: 704,
  y1: 888,
  cornerCut: 44,
  shear: 29,
  portraitScale: 3.1,
  portraitCx: 232,
  chipX: 300,
  chipOffsetY: -40,
  chipW: 280,
  chipH: 52,
  textX: 420,
  textOffsetY: 50,
  lineHeight: 34,
};

const INTRO_SECONDS = 0.16;
const OUTRO_SECONDS = 0.22;

export class DialogSystem {
  constructor() {
    this.queue = [];
    this.current = null;
  }

  reset() {
    this.queue.length = 0;
    this.current = null;
  }

  push(speaker, text, opts = {}) {
    this.queue.push({
      speaker,
      text,
      duration: opts.seconds ?? autoDuration(text),
      portrait:
        opts.portrait ??
        (speaker === 'grogu' ? 'portrait_grogu' : speaker === 'luke' ? 'portrait_luke' : 'portrait_mando'),
    });
  }

  // Fires Grogu's and Mando's lines for the given save index (0..2), one after the other.
  saveBark(index) {
    const save = STRINGS.saves[index];
    if (!save) return;
    const finalSave = index === 2;
    const groguPortrait =
      index === 2 ? 'portrait_grogu_spent' : index === 1 ? 'portrait_grogu_tired' : 'portrait_grogu';
    this.push('grogu', save.grogu, { portrait: groguPortrait, seconds: finalSave ? 2.2 : undefined });
    this.push('mando', save.mando, { portrait: 'portrait_mando', seconds: finalSave ? 2.8 : undefined });
  }

  update(dt) {
    if (!this.current) {
      if (this.queue.length) this.current = { ...this.queue.shift(), t: 0 };
      return;
    }
    this.current.t += dt;
    if (this.current.t >= this.current.duration) this.current = null;
  }

  draw(ctx) {
    if (!this.current) return;
    drawPanel(ctx, this.current);
  }
}

function autoDuration(text) {
  return Math.min(3.2, Math.max(1.4, 1.3 + text.length * 0.035));
}

// Exported so the intro cinematic can render the same Persona-idiom panel for
// its own captions instead of a plain text overlay — one dialogue language
// for the whole game. `cur` is {speaker, text, portrait, t, duration}.
export function drawPanel(ctx, cur) {
  const sp = SPEAKERS[cur.speaker] || SPEAKERS.mando;

  let alpha = 1;
  let lift = 0;
  if (cur.t < INTRO_SECONDS) {
    const p = cur.t / INTRO_SECONDS;
    alpha = p;
    lift = (1 - p) * 18;
  } else if (cur.t > cur.duration - OUTRO_SECONDS) {
    alpha = Math.max(0, (cur.duration - cur.t) / OUTRO_SECONDS);
  }

  const { x0, x1, y0, y1, cornerCut, shear } = BOX;
  const poly = [
    [x0, y0],
    [x1 - cornerCut, y0],
    [x1, y0 + cornerCut],
    [x1, y1],
    [x0 + shear, y1],
  ];

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(0, lift);

  // glass fill, clipped to the sheared silhouette
  pathPoly(ctx, poly);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(6,12,24,0.94)';
  ctx.fillRect(x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20);
  const sheen = ctx.createLinearGradient(0, y0, 0, y0 + 80);
  sheen.addColorStop(0, `rgba(${sp.glow},0.22)`);
  sheen.addColorStop(1, `rgba(${sp.glow},0)`);
  ctx.fillStyle = sheen;
  ctx.fillRect(x0 - 10, y0, x1 - x0 + 20, 80);
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let y = y0; y < y1; y += 4) ctx.fillRect(x0 - 10, y, x1 - x0 + 20, 1);
  ctx.restore();

  // glow border + top highlight, "underwater glass" idiom
  ctx.shadowColor = sp.accent;
  ctx.shadowBlur = 18;
  ctx.strokeStyle = sp.accent;
  ctx.lineWidth = 3;
  pathPoly(ctx, poly);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0 + 3, y0 + 2);
  ctx.lineTo(x1 - cornerCut - 3, y0 + 2);
  ctx.stroke();

  // character bust, feet seated just inside the top edge, bulk bleeding above it
  if (cur.portrait) {
    const portraitH = (PORTRAIT_H[cur.portrait] || 63) * BOX.portraitScale;
    const feetY = y0 + 24;
    drawSprite(cur.portrait, ctx, BOX.portraitCx, feetY - portraitH / 2, 0, BOX.portraitScale);
  }

  // sheared name chip, overlapping the box's top edge and the bust's shoulder
  const chipShear = 8;
  const chipY = y0 + BOX.chipOffsetY;
  const chipPoly = [
    [BOX.chipX, chipY],
    [BOX.chipX + BOX.chipW, chipY],
    [BOX.chipX + BOX.chipW + chipShear, chipY + BOX.chipH],
    [BOX.chipX + chipShear, chipY + BOX.chipH],
  ];
  pathPoly(ctx, chipPoly);
  ctx.fillStyle = sp.chip;
  ctx.fill();
  ctx.strokeStyle = sp.accent;
  ctx.lineWidth = 2;
  ctx.stroke();
  drawText(ctx, sp.name, BOX.chipX + 22, chipY + BOX.chipH / 2 + 2, 24, '#ffffff', 'left', true);

  // body text, wrapped and typed on with a short reveal window
  const textTopY = y0 + BOX.textOffsetY;
  const maxW = x1 - 40 - BOX.textX;
  ctx.font = `bold 27px ${FONT}`;
  const lines = wrapText(ctx, cur.text, maxW).slice(0, 3);
  const total = lines.reduce((a, l) => a + l.length, 0);
  const revealFrac = Math.min(1, cur.t / Math.max(0.4, cur.duration * 0.4));
  let budget = Math.round(total * revealFrac);
  lines.forEach((line, i) => {
    const shown = line.slice(0, Math.max(0, budget));
    budget -= line.length;
    drawText(ctx, shown, BOX.textX, textTopY + i * BOX.lineHeight, 27, '#ffffff', 'left', false);
  });

  // slim auto-advance bar: transparent about the fact this line will dismiss itself
  const barX0 = BOX.textX;
  const barX1 = x1 - 40;
  const barY = y1 - 18;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(barX0, barY, barX1 - barX0, 4);
  const remain = Math.max(0, 1 - cur.t / cur.duration);
  ctx.fillStyle = sp.accent;
  ctx.fillRect(barX0, barY, (barX1 - barX0) * remain, 4);

  ctx.restore();
}

function pathPoly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(test).width > maxW) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawText(ctx, text, x, y, size, color, align, oblique) {
  if (!text) return;
  ctx.save();
  ctx.font = `${oblique ? 'italic bold' : 'bold'} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(text, x + 2, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}
