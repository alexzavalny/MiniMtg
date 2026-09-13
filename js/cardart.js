/* Procedural card rendering on <canvas>. Cards: 512x716. */
(function (root) {
  'use strict';
  const MTG = root.MTG || (root.MTG = {});
  const W = 512, H = 716;

  const PALETTE = {
    R: { a: '#5a140c', b: '#e8602f', frame: '#b8371f', frame2: '#f08a5a', box: '#f6e2d3', ink: '#2b0f08', glow: '#ff7a3c' },
    G: { a: '#0d3316', b: '#4cb35a', frame: '#2d7a3a', frame2: '#7ed08a', box: '#e0efd6', ink: '#0d2a12', glow: '#7dff8a' },
    W: { a: '#8b8360', b: '#fff6d6', frame: '#e3d8a8', frame2: '#fff9e0', box: '#fbf8ec', ink: '#3a3320', glow: '#fff2a8' },
    U: { a: '#0a1f4d', b: '#4a90e8', frame: '#2b5cb0', frame2: '#7fb2f5', box: '#dbe7fa', ink: '#0a1a3a', glow: '#6cc6ff' },
    B: { a: '#111', b: '#555', frame: '#333', frame2: '#777', box: '#ddd', ink: '#111', glow: '#b48cff' },
  };
  const MANA_FILL = { W: '#fff7d0', U: '#a9dcff', B: '#b9b0c6', R: '#ffb59a', G: '#a6e2b6', C: '#d9d2ce' };
  const MANA_EMOJI = { W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌳' };
  const FONT = '"Arial Rounded MT Bold", "Helvetica Neue", "Segoe UI", Roboto, Arial, sans-serif';
  const ART_PATH = 'assets/card-art/';
  const artImages = {};

  // Art comes from assets/card-art-data.js (data URIs) when available: a file:// <img> drawn onto a
  // canvas taints it, and WebGL then refuses the texture (cards render blank). Falls back to PNG files
  // when served over http.
  function preloadArt() {
    const defs = Object.values(MTG.DEFS || {});
    const data = MTG.ART_DATA || {};
    const viaFile = location.protocol === 'file:';
    return Promise.all(defs.map((def) => new Promise((resolve) => {
      const src = data[def.id] || (viaFile ? null : ART_PATH + def.id + '.png');
      if (!src) return resolve();
      const image = new Image();
      image.onload = () => { artImages[def.id] = image; resolve(); };
      image.onerror = () => resolve();
      image.src = src;
    })));
  }

  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function seeded(seed) { let s = seed || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function wrap(ctx, text, maxW) {
    const words = text.split(' '); const lines = []; let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }
  function fitText(ctx, text, maxW, size, weight) {
    let s = size;
    do { ctx.font = `${weight} ${s}px ${FONT}`; s -= 1; } while (ctx.measureText(text).width > maxW && s > 12);
  }

  function drawManaCost(ctx, cost, right, cy) {
    const parsed = MTG.parseCost(cost);
    const syms = [];
    if (parsed.generic) syms.push({ t: 'generic', n: parsed.generic });
    for (const c of ['W', 'U', 'B', 'R', 'G']) for (let i = 0; i < parsed[c]; i++) syms.push({ t: c });
    let x = right - 20;
    for (let i = syms.length - 1; i >= 0; i--) {
      const s = syms[i];
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
      ctx.fillStyle = s.t === 'generic' ? MANA_FILL.C : MANA_FILL[s.t];
      ctx.beginPath(); ctx.arc(x, cy, 19, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (s.t === 'generic') { ctx.fillStyle = '#222'; ctx.font = `bold 26px ${FONT}`; ctx.fillText(String(s.n), x, cy + 1); }
      else { ctx.font = `22px ${FONT}`; ctx.fillText(MANA_EMOJI[s.t], x, cy + 2); }
      x -= 42;
    }
    return x + 42 - 20; // left edge of cost block
  }

  function drawArt(ctx, def, x, y, w, h, pal) {
    const art = artImages[def.id];
    if (art) {
      ctx.save();
      rr(ctx, x, y, w, h, 14); ctx.clip();
      const scale = Math.max(w / art.width, h / art.height);
      const drawW = art.width * scale, drawH = art.height * scale;
      ctx.drawImage(art, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
      const shade = ctx.createLinearGradient(x, y, x, y + h);
      shade.addColorStop(0, 'rgba(0,0,0,0.03)');
      shade.addColorStop(0.68, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0,0,0,0.32)');
      ctx.fillStyle = shade; ctx.fillRect(x, y, w, h);
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 3; rr(ctx, x, y, w, h, 14); ctx.stroke();
      return;
    }
    const rnd = seeded(hash(def.id));
    ctx.save();
    rr(ctx, x, y, w, h, 14); ctx.clip();
    const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
    g.addColorStop(0, pal.a); g.addColorStop(1, pal.b);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    // soft blobs
    for (let i = 0; i < 6; i++) {
      const bx = x + rnd() * w, by = y + rnd() * h, br = 60 + rnd() * 160;
      const rg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      rg.addColorStop(0, `rgba(255,255,255,${0.10 + rnd() * 0.15})`); rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg; ctx.fillRect(x, y, w, h);
    }
    // ground / horizon
    const hg = ctx.createLinearGradient(0, y + h * 0.65, 0, y + h);
    hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = hg; ctx.fillRect(x, y, w, h);
    // sparkles
    for (let i = 0; i < 40; i++) {
      const sx = x + rnd() * w, sy = y + rnd() * h, sr = rnd() * 2.2 + 0.4;
      ctx.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.6})`;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }
    // glow behind emoji
    const cx = x + w / 2, cy = y + h * 0.52;
    const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 0.42);
    glow.addColorStop(0, pal.glow + 'cc'); glow.addColorStop(0.6, pal.glow + '33'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(x, y, w, h);
    // emoji
    const size = def.type === 'land' ? Math.min(w, h) * 0.55 : Math.min(w, h) * 0.62;
    ctx.font = `${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
    ctx.fillText(def.emoji || '❔', cx, cy + size * 0.06);
    ctx.restore();
    // frame line
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 3; rr(ctx, x, y, w, h, 14); ctx.stroke();
  }

  function typeLine(def) {
    let t = MTG.TYPE_NAMES_RU[def.type] || def.type;
    if (def.subtype && def.type !== 'land') t += ' — ' + def.subtype;
    if (def.type === 'land') t = 'Базовая земля — ' + def.subtype;
    return t;
  }

  function rulesText(def) {
    const parts = [];
    if (def.keywords && def.keywords.length) parts.push(def.keywords.map((k) => MTG.KEYWORDS_RU[k]).join(', '));
    if (def.text) parts.push(def.text);
    return parts;
  }

  /**
   * Render a card front. state: { power, toughness, damage } (optional, for battlefield).
   */
  function renderCard(def, state, canvas) {
    canvas = canvas || document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const pal = PALETTE[def.color] || PALETTE.B;
    ctx.clearRect(0, 0, W, H);
    // outer black rounded
    ctx.fillStyle = '#0b0b0d'; rr(ctx, 0, 0, W, H, 28); ctx.fill();
    // frame gradient
    const fg = ctx.createLinearGradient(0, 0, W, H);
    fg.addColorStop(0, pal.frame2); fg.addColorStop(0.5, pal.frame); fg.addColorStop(1, pal.frame2);
    ctx.fillStyle = fg; rr(ctx, 12, 12, W - 24, H - 24, 20); ctx.fill();
    // subtle texture on frame
    const rnd = seeded(hash(def.id + 'f'));
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i < 300; i++) ctx.fillRect(12 + rnd() * (W - 24), 12 + rnd() * (H - 24), 2, 2);

    const isLand = def.type === 'land';
    // name bar
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    const nb = ctx.createLinearGradient(0, 26, 0, 82);
    nb.addColorStop(0, 'rgba(20,20,26,0.92)'); nb.addColorStop(1, 'rgba(45,45,55,0.92)');
    ctx.fillStyle = nb; rr(ctx, 26, 26, W - 52, 56, 14); ctx.fill();
    ctx.restore();
    const costLeft = isLand ? W - 40 : drawManaCost(ctx, def.cost, W - 34, 54);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    fitText(ctx, def.name, costLeft - 44 - 8, 32, 'bold');
    ctx.fillText(def.name, 42, 55);

    // art
    const artTop = 94, artH = isLand ? 440 : 306;
    drawArt(ctx, def, 30, artTop, W - 60, artH, pal);

    // type line
    const ty = artTop + artH + 10;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.fillStyle = 'rgba(25,25,32,0.9)'; rr(ctx, 26, ty, W - 52, 42, 12); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#f2f2f2'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    fitText(ctx, typeLine(def), W - 90, 24, 'bold');
    ctx.fillText(typeLine(def), 42, ty + 22);

    // text box
    const tb = ty + 52, tbH = H - 26 - tb;
    ctx.fillStyle = pal.box; rr(ctx, 26, tb, W - 52, tbH, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; rr(ctx, 26, tb, W - 52, tbH, 14); ctx.stroke();
    ctx.fillStyle = pal.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const parts = rulesText(def);
    let yy = tb + 14;
    const maxW = W - 52 - 32 - (def.type === 'creature' ? 0 : 0);
    parts.forEach((ptxt, i) => {
      const isKw = i === 0 && def.keywords && def.keywords.length;
      let size = parts.join(' ').length > 120 ? 21 : 24;
      ctx.font = `${isKw ? 'bold' : 'normal'} ${size}px ${FONT}`;
      for (const line of wrap(ctx, ptxt, maxW)) { ctx.fillText(line, 42, yy); yy += size * 1.25; }
      yy += 6;
    });
    if (def.flavor && yy < tb + tbH - 60) {
      ctx.font = `italic 20px ${FONT}`; ctx.fillStyle = pal.ink + 'aa';
      for (const line of wrap(ctx, def.flavor, maxW)) { ctx.fillText(line, 42, yy); yy += 25; }
    }
    if (isLand) {
      // big mana symbol
      ctx.font = `64px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = MANA_FILL[def.produces];
      ctx.beginPath(); ctx.arc(W - 90, tb + tbH - 60, 44, 0, Math.PI * 2); ctx.fill();
      ctx.fillText(MANA_EMOJI[def.produces], W - 90, tb + tbH - 56);
    }
    // P/T
    if (def.type === 'creature') {
      const pw = state && state.power !== undefined ? state.power : def.power;
      const tg = state && state.toughness !== undefined ? state.toughness : def.toughness;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
      const pg = ctx.createLinearGradient(0, H - 82, 0, H - 22);
      pg.addColorStop(0, '#2a2a33'); pg.addColorStop(1, '#101014');
      ctx.fillStyle = pg; rr(ctx, W - 150, H - 84, 124, 62, 16); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = pal.frame2; ctx.lineWidth = 3; rr(ctx, W - 150, H - 84, 124, 62, 16); ctx.stroke();
      let color = '#fff';
      if (pw > def.power || tg > def.toughness) color = '#7dff8a';
      if (pw < def.power || tg < def.toughness) color = '#ff8a7d';
      ctx.fillStyle = color; ctx.font = `bold 40px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${pw}/${tg}`, W - 88, H - 51);
      if (state && state.damage) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8;
        ctx.fillStyle = '#d3261a'; ctx.beginPath(); ctx.arc(W - 176, H - 52, 26, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#fff'; ctx.font = `bold 28px ${FONT}`;
        ctx.fillText('-' + state.damage, W - 176, H - 51);
      }
    }
    return canvas;
  }

  function renderBack(canvas) {
    canvas = canvas || document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0b0b0d'; rr(ctx, 0, 0, W, H, 28); ctx.fill();
    const g = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, H * 0.7);
    g.addColorStop(0, '#3b2a6b'); g.addColorStop(0.6, '#1b1440'); g.addColorStop(1, '#0d0a20');
    ctx.fillStyle = g; rr(ctx, 12, 12, W - 24, H - 24, 20); ctx.fill();
    const rnd = seeded(77);
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.5})`;
      ctx.beginPath(); ctx.arc(12 + rnd() * (W - 24), 12 + rnd() * (H - 24), rnd() * 1.8 + 0.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,215,120,0.7)'; ctx.lineWidth = 4; rr(ctx, 30, 30, W - 60, H - 60, 16); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,215,120,0.35)'; ctx.lineWidth = 2; rr(ctx, 44, 44, W - 88, H - 88, 12); ctx.stroke();
    // five color pentagon
    const cx = W / 2, cy = H / 2, R = 120;
    ctx.strokeStyle = 'rgba(255,215,120,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, R + 40, 0, Math.PI * 2); ctx.stroke();
    const cols = ['W', 'U', 'B', 'R', 'G'];
    cols.forEach((c, i) => {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      ctx.save(); ctx.shadowColor = MANA_FILL[c]; ctx.shadowBlur = 30;
      ctx.fillStyle = MANA_FILL[c]; ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.font = `36px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(MANA_EMOJI[c], x, y + 3);
    });
    ctx.save(); ctx.shadowColor = '#ffd77a'; ctx.shadowBlur = 40;
    ctx.fillStyle = '#ffd77a'; ctx.font = `bold 70px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✦', cx, cy + 4);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,215,120,0.8)'; ctx.font = `bold 34px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('МАГИЯ', cx, H - 80);
    return canvas;
  }

  function renderTable(canvas) {
    const TW = 2048, TH = 1408;
    canvas = canvas || document.createElement('canvas');
    canvas.width = TW; canvas.height = TH;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(TW / 2, TH / 2, 100, TW / 2, TH / 2, TW * 0.7);
    g.addColorStop(0, '#173a3a'); g.addColorStop(0.7, '#0e2426'); g.addColorStop(1, '#06100f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, TW, TH);
    const rnd = seeded(1234);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 12000; i++) ctx.fillRect(rnd() * TW, rnd() * TH, 2, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let i = 0; i < 12000; i++) ctx.fillRect(rnd() * TW, rnd() * TH, 2, 2);
    // center line
    const cl = ctx.createLinearGradient(0, TH / 2, TW, TH / 2);
    cl.addColorStop(0, 'rgba(120,220,255,0)'); cl.addColorStop(0.5, 'rgba(120,220,255,0.5)'); cl.addColorStop(1, 'rgba(120,220,255,0)');
    ctx.fillStyle = cl; ctx.fillRect(0, TH / 2 - 3, TW, 6);
    // zone rectangles (world 26 x 18 -> px)
    const sx = TW / 26, sz = TH / 18;
    const zone = (zc, label, dim) => {
      const y = TH / 2 + zc * sz;
      ctx.strokeStyle = `rgba(255,255,255,${dim ? 0.08 : 0.13})`; ctx.lineWidth = 3; ctx.setLineDash([18, 14]);
      rr(ctx, TW / 2 - 6.9 * sx, y - 1.25 * sz, 13.8 * sx, 2.5 * sz, 30); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.font = `bold 44px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label, TW / 2 - 6.9 * sx + 30, y - 1.25 * sz + 40);
    };
    zone(4.2, 'ВАШИ ЗЕМЛИ');
    zone(1.6, 'ВАШИ СУЩЕСТВА');
    zone(-1.9, 'СУЩЕСТВА ПРОТИВНИКА', true);
    zone(-4.5, 'ЗЕМЛИ ПРОТИВНИКА', true);
    const slot = (xc, zc, label) => {
      const x = TW / 2 + xc * sx, y = TH / 2 + zc * sz;
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 3; ctx.setLineDash([10, 10]);
      rr(ctx, x - 0.8 * sx, y - 1.1 * sz, 1.6 * sx, 2.2 * sz, 16); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.font = `bold 30px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText(label, x, y);
    };
    slot(9.3, 4.2, 'БИБЛИОТЕКА'); slot(9.3, 1.6, 'КЛАДБИЩЕ');
    slot(9.3, -4.5, 'БИБЛИОТЕКА'); slot(9.3, -1.9, 'КЛАДБИЩЕ');
    return canvas;
  }

  MTG.CardArt = { renderCard, renderBack, renderTable, preloadArt, W, H, PALETTE, MANA_EMOJI, MANA_FILL };
})(typeof window !== 'undefined' ? window : globalThis);
