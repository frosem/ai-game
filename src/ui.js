// HUD and full-screen states. All drawing is in virtual coordinates (1600x900);
// the renderer's hudBegin() sets the letterbox transform.

import { CONFIG, clamp } from './config.js';
import { STRINGS } from './strings.js?v=leaderboard-3';
import { drawSprite } from './assets.js';

const W = CONFIG.VIRTUAL_W;
const H = CONFIG.VIRTUAL_H;

export class UI {
  constructor() {
    this.startRect = { x: 120, y: 532, w: 330, h: 56 };
    this.storyRect = { x: 120, y: 598, w: 330, h: 44 };
    this.leaderboardRect = { x: 120, y: 652, w: 330, h: 44 };
    this.muteRect = { x: W - 190, y: 24, w: 166, h: 44 };
  }

  drawHUD(ctx, world) {
    const { player, convoy, score, state } = world;
    this._text(ctx, STRINGS.hud.score, 40, 52, 20, 'rgba(200,220,255,0.75)', 'left');
    this._text(ctx, String(score.score).padStart(6, '0'), 40, 96, 46, '#ffffff', 'left');

    this._text(
      ctx,
      `${STRINGS.hud.best} ${score.best}`,
      40,
      128,
      18,
      'rgba(180,200,230,0.7)',
      'left'
    );

    // combo + decay bar
    if (score.combo > 1.001) {
      const cx = 40;
      const cy = 158;
      this._text(
        ctx,
        `${STRINGS.hud.combo} x${score.combo.toFixed(1)}`,
        cx,
        cy,
        22,
        '#ffd166',
        'left'
      );
      const frac =
        score.linger > 0
          ? clamp(score.linger / CONFIG.score.comboLingerSeconds, 0, 1)
          : 0;
      this._bar(ctx, cx, cy + 12, 180, 8, frac, '#ffd166', 'rgba(255,209,102,0.18)');
    }

    // hyperdrive + timer (top center)
    const hdFrac = clamp(state.elapsed / CONFIG.MATCH_SECONDS, 0, 1);
    const remaining = Math.max(0, Math.ceil(CONFIG.MATCH_SECONDS - state.elapsed));
    const pulse = state.finalSurge
      ? 1 + Math.sin(state.elapsed * 8) * 0.05
      : 1;
    this._text(ctx, STRINGS.hud.hyperdrive, W / 2, 40, 20, 'rgba(200,220,255,0.8)', 'center');
    const barW = 420 * pulse;
    this._bar(
      ctx,
      W / 2 - barW / 2,
      52,
      barW,
      18,
      hdFrac,
      state.finalSurge ? '#ff7a5a' : '#66d0ff',
      'rgba(255,255,255,0.12)'
    );
    this._text(ctx, `${remaining}s`, W / 2, 104, 34, '#ffffff', 'center');

    // mute button
    const m = this.muteRect;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    this._roundRect(ctx, m.x, m.y, m.w, m.h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    this._text(
      ctx,
      world.audio && !world.audio.isMuted() ? STRINGS.unmuteLabel : STRINGS.muteLabel,
      m.x + m.w / 2,
      m.y + m.h / 2 + 1,
      17,
      '#dfe8ff',
      'center'
    );

    // player hearts (bottom left)
    drawSprite('portrait_luke', ctx, 52, H - 126, 0, 0.55);
    this._text(ctx, STRINGS.characters.luke.toUpperCase(), 40, H - 84, 20, '#9fd0ff', 'left');
    for (let i = 0; i < player.maxHearts; i++) {
      this._heart(ctx, 52 + i * 42, H - 44, 16, i < player.hearts ? '#ff5b6e' : 'rgba(255,90,110,0.2)');
    }

    // Grogu portrait + hearts (bottom right)
    const px = W - 110;
    const py = H - 92;
    const key =
      state.groguSpent
        ? 'portrait_grogu_spent'
        : state.groguTired
        ? 'portrait_grogu_tired'
        : 'portrait_grogu';
    drawSprite(key, ctx, px, py, 0, 0.85);
    ctx.strokeStyle = state.groguTired ? 'rgba(255,90,90,0.8)' : 'rgba(140,255,180,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, py, 52, 0, Math.PI * 2);
    ctx.stroke();
    this._text(ctx, STRINGS.characters.grogu.toUpperCase(), px, H - 26, 18, '#8fe3a0', 'center');
    for (let i = 0; i < convoy.maxHearts; i++) {
      this._heart(
        ctx,
        px - 150 + i * 40,
        H - 92,
        15,
        i < convoy.hearts ? '#5bd47a' : 'rgba(90,212,122,0.2)'
      );
    }

    // force meter (bottom center)
    const fFrac = clamp(player.forceCharge / CONFIG.force.capacity, 0, 1);
    const fw = 360;
    const fx = W / 2 - fw / 2;
    const fy = H - 46;
    this._text(ctx, STRINGS.hud.force, W / 2, fy - 22, 18, 'rgba(180,230,255,0.8)', 'center');
    const locked = player.forceLockout > 0;
    const flashing = locked && Math.floor(player.forceLockout * 8) % 2 === 0;
    this._bar(
      ctx,
      fx,
      fy,
      fw,
      16,
      fFrac,
      flashing ? '#ff5b6e' : '#8fe3ff',
      'rgba(143,227,255,0.15)'
    );
    if (player.forceActive) {
      ctx.strokeStyle = 'rgba(190,245,255,0.9)';
      ctx.lineWidth = 2;
      this._roundRect(ctx, fx - 2, fy - 2, fw + 4, 20, 6);
      ctx.stroke();
    }
  }

  drawTitle(ctx, world) {
    ctx.fillStyle = 'rgba(4,8,18,0.92)';
    ctx.fillRect(0, 0, W, H);
    this._starTitle(ctx);

    // Mission card: asymmetric layout gives the title a clear focal area while
    // the ship silhouettes explain the objective before the player starts.
    const card = ctx.createLinearGradient(0, 0, 0, H);
    card.addColorStop(0, 'rgba(9,20,38,0.94)');
    card.addColorStop(1, 'rgba(4,8,18,0.46)');
    ctx.fillStyle = card;
    ctx.fillRect(72, 86, 620, 650);
    ctx.strokeStyle = 'rgba(143,227,255,0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(72, 86, 620, 650);
    ctx.fillStyle = 'rgba(143,227,255,0.75)';
    ctx.fillRect(72, 86, 8, 650);

    this._text(ctx, STRINGS.title, 120, 174, 82, '#ffffff', 'left');
    this._textFit(ctx, STRINGS.titleTarget, 120, 250, 47, 32, 520, '#8fe3ff', 'left');
    this._text(ctx, STRINGS.subtitle, 124, 312, 23, '#ffd166', 'left');
    this._text(ctx, STRINGS.tagline, 124, 358, 21, 'rgba(220,232,250,0.88)', 'left');
    this._text(ctx, STRINGS.thisIsTheWay, 124, 398, 18, 'rgba(180,205,235,0.72)', 'left');
    this._text(ctx, STRINGS.missionTitle, 124, 438, 16, '#8fe3ff', 'left');
    this._textFit(ctx, STRINGS.missionLine1, 124, 464, 18, 15, 520, '#ffffff', 'left');
    this._textFit(ctx, STRINGS.missionLine2, 124, 490, 18, 14, 520, 'rgba(220,232,250,0.82)', 'left');

    // The action is shown spatially: convoy behind, player in front, threats
    // approaching from the upper-right.
    ctx.strokeStyle = 'rgba(143,227,255,0.18)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(760, 690);
    ctx.lineTo(1360, 170);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,91,110,0.28)';
    ctx.beginPath();
    ctx.moveTo(1030, 120);
    ctx.lineTo(1420, 520);
    ctx.stroke();

    drawSprite('convoy_ship', ctx, 1040, 420, -0.12, 2.25);
    drawSprite('player_xwing', ctx, 1250, 620, -0.48, 2.25);
    drawSprite('enemy_interceptor', ctx, 1040, 150, 0.18, 1.7);
    drawSprite('enemy_interceptor', ctx, 1280, 112, 0.28, 1.45);
    drawSprite('enemy_gunship', ctx, 1450, 260, 0.38, 1.25);
    drawSprite('portrait_grogu', ctx, 830, 690, 0, 0.62);
    drawSprite('portrait_mando', ctx, 900, 690, 0, 0.62);

    this._button(ctx, this.startRect, STRINGS.startButton, '#8fe3ff', true);
    this._button(ctx, this.storyRect, STRINGS.storyButton, '#ffd166', false);
    this._button(ctx, this.leaderboardRect, STRINGS.leaderboardButton, '#8fe3a0', false);

    // Compact control strip instead of four lines of instructional copy.
    ctx.fillStyle = 'rgba(5,12,24,0.88)';
    this._roundRect(ctx, 760, 760, 760, 58, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    this._text(ctx, '[WASD] / [ARROWS] MOVE', 790, 789, 18, '#8fe3ff', 'left');
    this._text(ctx, '[CLICK] FIRE', 1080, 789, 18, '#ffd166', 'left');
    this._text(ctx, '[SPACE] FORCE', 1250, 789, 18, '#8fe3a0', 'left');
    this._text(ctx, 'R RESTART  ·  ESC PAUSE', 1210, 846, 16, 'rgba(180,200,230,0.72)', 'center');

    this._text(
      ctx,
      `${STRINGS.hud.best}: ${world.score.best}`,
      285,
      716,
      18,
      'rgba(255,209,102,0.9)',
      'center'
    );
  }

  drawPaused(ctx, world) {
    ctx.fillStyle = 'rgba(4,8,18,0.72)';
    ctx.fillRect(0, 0, W, H);
    this._text(ctx, STRINGS.pausedTitle, W / 2, H / 2 - 30, 64, '#ffffff', 'center');
    this._text(ctx, STRINGS.pausedHint, W / 2, H / 2 + 40, 24, 'rgba(200,215,240,0.9)', 'center');
    void world;
  }

  drawGameOver(ctx, world, kind) {
    ctx.fillStyle = 'rgba(4,8,18,0.86)';
    ctx.fillRect(0, 0, W, H);
    const g = STRINGS.gameover;
    let title;
    let body;
    let color;
    if (kind === 'player') {
      title = g.playerTitle;
      body = g.playerBody;
      color = '#ff7a6a';
    } else if (kind === 'convoy') {
      title = g.convoyTitle;
      body = g.convoyBody;
      color = '#8fe3a0';
    } else {
      title = g.victoryTitle;
      body = g.victoryBody;
      color = '#8fe3ff';
    }
    this._text(ctx, title, W / 2, 250, 74, color, 'center');
    this._text(ctx, body, W / 2, 316, 26, 'rgba(220,230,250,0.9)', 'center');

    this._text(ctx, g.score, W / 2 - 160, 430, 24, 'rgba(190,205,230,0.8)', 'center');
    this._text(ctx, String(world.score.score), W / 2 - 160, 486, 52, '#ffffff', 'center');

    this._text(ctx, g.best, W / 2 + 160, 430, 24, 'rgba(190,205,230,0.8)', 'center');
    this._text(ctx, String(world.score.best), W / 2 + 160, 486, 52, '#ffffff', 'center');

    if (world.score.newBest) {
      this._text(ctx, g.newBest, W / 2, 552, 30, '#ffd166', 'center');
    }

    const result = world.leaderboard?.lastResult;
    this._text(
      ctx,
      result?.rank ? `${g.rank}: #${result.rank}` : g.submitting,
      W / 2,
      590,
      24,
      result?.rank ? '#8fe3a0' : 'rgba(180,200,230,0.8)',
      'center'
    );

    this._text(ctx, g.pressR, W / 2, 690, 34, '#ffffff', 'center');
    this._text(ctx, g.pressRClick, W / 2, 732, 20, 'rgba(180,200,230,0.8)', 'center');
    this._text(ctx, g.pressM, W / 2, 774, 20, '#8fe3ff', 'center');
  }

  drawCountdown(ctx, state) {
    if (state.countdown <= 0) return;
    const a = clamp(state.countdown / 1.2, 0, 1);
    ctx.globalAlpha = a;
    this._text(ctx, STRINGS.countdown, W / 2, H / 2 - 40, 72, '#ffffff', 'center');
    ctx.globalAlpha = 1;
  }

  // --- helpers ---

  _text(ctx, text, x, y, size, color, align) {
    ctx.font = `bold ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(text, x + 2, y + 2);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  _textFit(ctx, text, x, y, size, minSize, maxWidth, color, align) {
    let fitted = size;
    ctx.font = `bold ${fitted}px system-ui, -apple-system, Segoe UI, sans-serif`;
    while (fitted > minSize && ctx.measureText(text).width > maxWidth) {
      fitted -= 1;
      ctx.font = `bold ${fitted}px system-ui, -apple-system, Segoe UI, sans-serif`;
    }
    this._text(ctx, text, x, y, fitted, color, align);
  }

  _bar(ctx, x, y, w, h, frac, color, bg) {
    ctx.fillStyle = bg;
    this._roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    if (frac > 0) {
      ctx.fillStyle = color;
      this._roundRect(ctx, x, y, Math.max(h, w * frac), h, h / 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, x, y, w, h, h / 2);
    ctx.stroke();
  }

  _heart(ctx, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.7);
    ctx.bezierCurveTo(-r * 1.3, -r * 0.3, -r * 0.5, -r * 1.2, 0, -r * 0.35);
    ctx.bezierCurveTo(r * 0.5, -r * 1.2, r * 1.3, -r * 0.3, 0, r * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _button(ctx, rect, label, color, primary) {
    ctx.fillStyle = primary ? 'rgba(143,227,255,0.16)' : 'rgba(255,209,102,0.10)';
    this._roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    this._roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
    ctx.stroke();
    this._text(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1, 30, color, 'center');
  }

  _roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  _starTitle(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 80; i++) {
      const x = (i * 137.5) % W;
      const y = (i * 91.3) % H;
      const s = (i % 3) + 1;
      ctx.fillStyle = i % 5 === 0 ? '#8fe3ff' : '#cfe3ff';
      ctx.fillRect(x, y, s, s);
    }
    ctx.restore();
  }

  hit(rect, mx, my) {
    return mx >= rect.x && mx <= rect.x + rect.w && my >= rect.y && my <= rect.y + rect.h;
  }
}
