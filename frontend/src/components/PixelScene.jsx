// PixelScene.jsx — Pixel-art office renderer for OpenClaw Mission Control
// Phase 2: draws agents, stations, budget HUD on a canvas using the same
// WebSocket state object the card view already consumes.

import { useRef, useEffect } from 'react';

// ── Canvas constants ────────────────────────────────────────────
const S     = 3;      // CSS pixels per game pixel
const GW    = 480;    // game width  (px)
const GH    = 280;    // game height (px)
const FLOOR = 188;    // y of floor line
const HUD_Y = GH - 22;

// ── Colour palette ──────────────────────────────────────────────
const C = {
  bg:      '#08080f',
  wall:    '#0d0d1c',
  wallHi:  '#16162e',
  tile1:   '#0b0b16',
  tile2:   '#0e0e1d',
  wline:   '#14142a',
  green:   '#00ff88',
  amber:   '#ffaa00',
  red:     '#ff4444',
  blue:    '#4488ff',
  teal:    '#00ccff',
  dim:     '#1a1a30',
  dimHi:   '#222240',
  textDim: '#333355',
  skin:    '#c4865a',
  hair0:   '#2a1808',
  hair1:   '#5a5500',
  shirt0:  '#1e3a6e',
  shirt1:  '#6e1e1e',
  shirt2:  '#1e5e2a',
  pants0:  '#152038',
  pants1:  '#38150f',
  pants2:  '#153820',
  shoes:   '#0a0a14',
  deskTop: '#1c1c38',
  desk:    '#10102a',
  monitor: '#060610',
  chair:   '#0e0e22',
};

// ── Station definitions ─────────────────────────────────────────
// x positions spread across GW; pattern matches bridge config.js featuredTools
const STATIONS = [
  { pattern: /youtube|yt_scraper|yt-scraper/i, label: 'YT SCRAPER', color: C.red,   glyph: '▶', x: 52  },
  { pattern: /perplexity|web_search|sonar/i,   label: 'WEB SEARCH', color: C.blue,  glyph: '◉', x: 128 },
  { pattern: /google_sheets|gsheet/i,          label: 'SHEETS',     color: C.green, glyph: '⊞', x: 204 },
  { pattern: /telegram|tg_send|tg_post/i,      label: 'TELEGRAM',   color: C.teal,  glyph: '✈', x: 280 },
  { pattern: /read|write|file/i,               label: 'FILES',      color: C.amber, glyph: '▬', x: 356 },
  { pattern: /.*/,                             label: 'GENERIC',    color: '#555577', glyph: '◆', x: 432 },
];

function findStation(toolName) {
  if (!toolName) return null;
  return STATIONS.find(s => s.pattern.test(toolName)) ?? STATIONS[STATIONS.length - 1];
}

// ── Primitive helpers ───────────────────────────────────────────
function fillRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * S, y * S, w * S, h * S);
}
function hline(ctx, x, y, w, color) { fillRect(ctx, x, y, w, 1, color); }

// ── Background ──────────────────────────────────────────────────
function drawBackground(ctx) {
  // Sky
  fillRect(ctx, 0, 0, GW, GH, C.bg);

  // Back wall
  fillRect(ctx, 0, 36, GW, FLOOR - 36 - 14, C.wall);
  hline(ctx, 0, 36, GW, C.wallHi);
  hline(ctx, 0, FLOOR - 14, GW, C.wline);

  // Subtle wall grid
  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let x = 0; x < GW; x += 40) {
    fillRect(ctx, x, 36, 1, FLOOR - 50, C.wallHi);
  }
  for (let y = 60; y < FLOOR - 14; y += 28) {
    hline(ctx, 0, y, GW, C.wallHi);
  }
  ctx.restore();

  // Floor tiles (two-tone checkerboard)
  for (let ty = FLOOR - 14; ty < HUD_Y; ty += 10) {
    for (let tx = 0; tx < GW; tx += 20) {
      const alt = ((tx / 20 + ty / 10) % 2 === 0);
      fillRect(ctx, tx, ty, 20, 10, alt ? C.tile1 : C.tile2);
    }
  }
  hline(ctx, 0, FLOOR - 14, GW, C.wline);
}

// ── Station (desk + monitor + chair) ───────────────────────────
function drawStation(ctx, station, active, frame) {
  const { x, color, label, glyph } = station;
  const DW    = 30;
  const deskY = FLOOR - 52;
  const monW  = 18;
  const monH  = 12;
  const monX  = x - monW / 2;
  const monY  = deskY - monH - 1;

  // Desk shadow
  ctx.save();
  ctx.globalAlpha = 0.25;
  fillRect(ctx, x - DW / 2 + 2, deskY + 11, DW, 3, '#000000');
  ctx.restore();

  // Desk top + body
  fillRect(ctx, x - DW / 2, deskY,     DW, 3,  C.deskTop);
  fillRect(ctx, x - DW / 2, deskY + 3, DW, 10, C.desk);
  hline(ctx, x - DW / 2, deskY, DW, C.wline + 'aa');

  // Monitor casing
  fillRect(ctx, monX,     monY,     monW, monH, C.monitor);
  // Screen
  fillRect(ctx, monX + 1, monY + 1, monW - 2, monH - 3, active ? color + '33' : '#0a0a18');
  if (active) {
    // Scanline sweep
    const scan = Math.floor(frame / 4) % (monH - 3);
    fillRect(ctx, monX + 1, monY + 1 + scan, monW - 2, 1, color + '99');
    // Glyph
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `bold ${4 * S}px monospace`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(glyph, (monX + 4) * S, (monY + 2) * S);
    ctx.restore();
  }
  // Monitor border
  hline(ctx, monX, monY,          monW, C.dimHi);
  hline(ctx, monX, monY + monH - 1, monW, C.dimHi);
  fillRect(ctx, monX, monY, 1, monH, C.dimHi);
  fillRect(ctx, monX + monW - 1, monY, 1, monH, C.dimHi);
  // Stand
  fillRect(ctx, x - 1, deskY - 1, 2, 2, C.monitor);
  hline(ctx, x - 4, deskY, 8, C.monitor);

  // Chair
  const cy = deskY + 13;
  fillRect(ctx, x - 5, cy - 7, 10, 6,  C.chair);  // back
  fillRect(ctx, x - 5, cy,     10, 5,  C.chair);  // seat
  hline(ctx, x - 5, cy - 7, 10, C.wline);

  // Label
  ctx.save();
  ctx.fillStyle = active ? color : C.textDim;
  ctx.font      = `bold ${3 * S}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x * S, (deskY + 14) * S);
  ctx.restore();

  // Active halo
  if (active) {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 18 * S;
    ctx.fillStyle   = color;
    ctx.fillRect((x - DW / 2 - 4) * S, (monY - 2) * S, (DW + 8) * S, (deskY + 17 - monY + 4) * S);
    ctx.restore();
  }
}

// ── Character sprite ────────────────────────────────────────────
// 8 × 16 pixel grid, drawn with fillRect per pixel

function drawAgent(ctx, agent, gx, gy, frame, idx) {
  const isActive = agent.status === 'working' || agent.status === 'tool_use';
  const isError  = agent.status === 'error';
  const walkStep = isActive ? Math.floor(frame / 7) % 4 : 0;

  // Per-agent colour set
  const sets = [
    { shirt: C.shirt0, pants: C.pants0, hair: C.hair0 },
    { shirt: C.shirt1, pants: C.pants1, hair: C.hair1 },
    { shirt: C.shirt2, pants: C.pants2, hair: C.hair1 },
  ];
  const pal = sets[idx % sets.length];
  const _ = null, sk = C.skin, hr = pal.hair, sh = pal.shirt, pt = pal.pants, bk = C.shoes;

  // Sprite rows: head (0-4), torso (5-9), legs (10-15)
  const head = [
    [_,_,hr,hr,hr,hr,_,_],
    [_,hr,hr,hr,hr,hr,hr,_],
    [_,sk,sk,sk,sk,sk,_,_],
    [_,sk,sk,sk,sk,sk,_,_],
    [_,_,sk,sk,sk,_,_,_],
  ];
  const torso = [
    [_,sh,sh,sh,sh,sh,_,_],
    [sh,sh,sh,sh,sh,sh,sh,_],
    [_,sh,sh,sh,sh,sh,_,_],
    [_,sh,sh,sh,sh,sh,_,_],
    [_,_,sh,sh,sh,_,_,_],
  ];
  const legFrames = [
    [[_,_,pt,pt,pt,pt,_,_],[_,_,pt,pt,pt,pt,_,_],[_,bk,bk,_,_,bk,bk,_]],
    [[_,_,pt,pt,pt,_,_,_],[_,_,_,pt,pt,pt,_,_],[_,_,_,bk,bk,bk,_,_]],
    [[_,_,pt,pt,pt,pt,_,_],[_,_,pt,pt,pt,pt,_,_],[_,bk,bk,_,_,bk,bk,_]],
    [[_,_,_,pt,pt,pt,_,_],[_,_,pt,pt,pt,_,_,_],[_,_,bk,bk,bk,_,_,_]],
  ];
  const rows = [...head, ...torso, ...legFrames[walkStep]];
  const H = rows.length; // 13 rows

  if (isError) {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(frame * 0.25);
  }

  for (let r = 0; r < H; r++) {
    for (let c = 0; c < 8; c++) {
      const col = rows[r][c];
      if (!col) continue;
      ctx.fillStyle = isError ? C.red : col;
      ctx.fillRect((gx - 4 + c) * S, (gy - H + r) * S, S, S);
    }
  }

  if (isError) ctx.restore();

  // Agent name tag above sprite
  ctx.save();
  ctx.font         = `${3 * S}px "Courier New", monospace`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle    = isActive ? C.amber : '#3a3a55';
  ctx.fillText(agent.name, gx * S, (gy - H - 2) * S);
  ctx.restore();
}

// ── Speech bubble ───────────────────────────────────────────────
function drawBubble(ctx, text, gx, gy, color) {
  if (!text) return;
  const label = text.length > 22 ? text.slice(0, 22) + '…' : text;
  ctx.save();
  ctx.font = `${3 * S}px "Courier New", monospace`;
  const tw = ctx.measureText(label).width;
  const bw = tw + 10 * S;
  const bh = 10 * S;
  const bx = gx * S - bw / 2;
  const by = (gy - 32) * S - bh;

  // Background
  ctx.fillStyle = '#0d0d22ee';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 3 * S);
  ctx.fill();

  // Border
  ctx.strokeStyle = color;
  ctx.lineWidth   = S;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 3 * S);
  ctx.stroke();

  // Tail
  ctx.fillStyle = '#0d0d22ee';
  ctx.beginPath();
  ctx.moveTo(gx * S - 2 * S, by + bh);
  ctx.lineTo(gx * S + 2 * S, by + bh);
  ctx.lineTo(gx * S,         by + bh + 4 * S);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth   = S;
  ctx.beginPath();
  ctx.moveTo(gx * S - 2 * S, by + bh);
  ctx.lineTo(gx * S,         by + bh + 4 * S);
  ctx.lineTo(gx * S + 2 * S, by + bh);
  ctx.stroke();

  // Text
  ctx.fillStyle    = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'center';
  ctx.fillText(label, gx * S, by + bh / 2);
  ctx.restore();
}

// ── HUD strip at bottom ─────────────────────────────────────────
function drawHUD(ctx, state) {
  fillRect(ctx, 0, HUD_Y, GW, GH - HUD_Y, C.bg);
  hline(ctx, 0, HUD_Y, GW, C.wline);

  // Gateway
  const gw      = state?.gateway;
  const gwOk    = gw?.status === 'running';
  const gwColor = gwOk ? C.green : C.red;
  ctx.save();
  ctx.font         = `bold ${4 * S}px "Courier New", monospace`;
  ctx.fillStyle    = gwColor;
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'left';
  ctx.fillText(`GW: ${(gw?.status || 'UNKNOWN').toUpperCase()}`, 4 * S, (HUD_Y + 5) * S);
  ctx.restore();

  // Budget bars
  const providers = Object.values(state?.budget || {});
  let bx = 88;
  for (const b of providers.slice(0, 4)) {
    const pct      = b.limits?.monthlyTokens ? Math.min(1, b.tokensUsed / b.limits.monthlyTokens) : 0;
    const barW     = 48;
    const barColor = pct > 0.85 ? C.red : pct > 0.6 ? C.amber : C.green;

    ctx.save();
    ctx.font         = `${3 * S}px "Courier New", monospace`;
    ctx.fillStyle    = '#3a3a55';
    ctx.textBaseline = 'top';
    ctx.textAlign    = 'left';
    ctx.fillText(b.provider.slice(0, 9), bx * S, (HUD_Y + 3) * S);
    ctx.restore();

    fillRect(ctx, bx, HUD_Y + 9, barW, 4, C.dimHi);
    if (pct > 0) fillRect(ctx, bx, HUD_Y + 9, Math.max(1, Math.round(barW * pct)), 4, barColor);

    bx += barW + 14;
    if (bx > GW - 60) break;
  }

  // Clock
  const t = new Date().toLocaleTimeString('en-US', { hour12: false });
  ctx.save();
  ctx.font         = `${3 * S}px "Courier New", monospace`;
  ctx.fillStyle    = C.textDim;
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'right';
  ctx.fillText(t, (GW - 4) * S, (HUD_Y + 6) * S);
  ctx.restore();
}

// ── Scanline CRT overlay ────────────────────────────────────────
function drawScanlines(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.fillStyle   = '#000000';
  for (let y = 0; y < GH; y += 2) {
    ctx.fillRect(0, y * S, GW * S, S);
  }
  ctx.restore();
}

// ── Main export ─────────────────────────────────────────────────
export function PixelScene({ state }) {
  const canvasRef = useRef(null);
  const posRef    = useRef({});   // { agentId: { x, targetX } }
  const animRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let frame = 0;

    const render = () => {
      frame++;
      const agents = Object.values(state?.agents ?? {});

      // Update positions
      agents.forEach((agent, i) => {
        const homeX = 60 + i * Math.min(80, (GW - 80) / Math.max(agents.length - 1, 1));
        if (!posRef.current[agent.id]) {
          posRef.current[agent.id] = { x: homeX, targetX: homeX };
        }
        const pos = posRef.current[agent.id];
        const toolName = agent.currentTool?.name ?? agent.currentTool?.station?.name;
        const station  = toolName ? findStation(toolName) : null;
        pos.targetX    = station ? station.x : homeX;
        const dx       = pos.targetX - pos.x;
        pos.x          = Math.abs(dx) > 0.4 ? pos.x + dx * 0.06 : pos.targetX;
      });

      // ── Draw ──
      drawBackground(ctx);

      // Which stations are currently active?
      const activeLabels = new Set(
        agents
          .filter(a => a.currentTool)
          .map(a => findStation(a.currentTool?.name)?.label)
          .filter(Boolean)
      );

      STATIONS.forEach(st => drawStation(ctx, st, activeLabels.has(st.label), frame));

      // Agents (back to front — higher y = in front)
      [...agents]
        .sort((a, b) => (posRef.current[a.id]?.x ?? 0) - (posRef.current[b.id]?.x ?? 0))
        .forEach((agent, i) => {
          const pos = posRef.current[agent.id];
          if (!pos) return;
          const gx = Math.round(pos.x);
          const gy = FLOOR + 5;

          drawAgent(ctx, agent, gx, gy, frame, i);

          const bubbleText =
            agent.status === 'tool_use'  ? agent.currentTool?.name :
            agent.status === 'working'   ? agent.taskPreview :
            null;
          if (bubbleText) {
            const stColor = agent.currentTool?.name
              ? (findStation(agent.currentTool.name)?.color ?? C.amber)
              : C.amber;
            drawBubble(ctx, bubbleText, gx, gy, stColor);
          }
        });

      drawHUD(ctx, state);
      drawScanlines(ctx);

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [state]);

  return (
    <canvas
      ref={canvasRef}
      width={GW * S}
      height={GH * S}
      style={{
        width: '100%',
        imageRendering: 'pixelated',
        display: 'block',
        borderRadius: '8px',
        border: '1px solid #1a1a2e',
        background: '#08080f',
      }}
    />
  );
}
