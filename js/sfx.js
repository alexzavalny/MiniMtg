/* Tiny synthesized sound effects (WebAudio). */
(function (root) {
  'use strict';
  const MTG = root.MTG || (root.MTG = {});
  let ctx = null;
  const Sfx = { enabled: true, volume: 0.5 };
  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, slideTo, delay) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime((vol || 0.2) * Sfx.volume, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, vol, filterFreq, delay, q) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filterFreq || 1000; f.Q.value = q || 0.8;
    const g = c.createGain(); g.gain.value = (vol || 0.3) * Sfx.volume;
    src.connect(f); f.connect(g); g.connect(c.destination); src.start(t0);
  }
  const S = {
    draw: () => noise(0.12, 0.25, 3000),
    cast: () => { tone(440, 0.25, 'triangle', 0.2, 880); tone(660, 0.3, 'sine', 0.12, 1320, 0.05); },
    zap: () => { noise(0.25, 0.5, 2500, 0, 0.5); tone(1200, 0.2, 'sawtooth', 0.15, 200); },
    grow: () => { tone(300, 0.4, 'sine', 0.2, 700); tone(450, 0.4, 'triangle', 0.1, 900, 0.08); },
    swirl: () => { tone(900, 0.5, 'sine', 0.15, 300); tone(1200, 0.5, 'sine', 0.08, 500, 0.1); },
    holy: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.6, 'sine', 0.12, null, i * 0.06)); },
    enter: () => { tone(120, 0.25, 'sine', 0.35, 60); noise(0.1, 0.2, 400); },
    death: () => { noise(0.5, 0.35, 300, 0, 0.5); tone(200, 0.5, 'sawtooth', 0.1, 50); },
    tap: () => tone(700, 0.06, 'square', 0.06, 500),
    attack: () => { noise(0.3, 0.4, 1200, 0, 0.6); tone(200, 0.3, 'sawtooth', 0.08, 400); },
    block: () => { tone(500, 0.1, 'square', 0.15, 250); noise(0.08, 0.3, 2000); },
    hit: () => { noise(0.2, 0.6, 250, 0, 0.7); tone(90, 0.25, 'sine', 0.4, 40); },
    heal: () => { tone(880, 0.4, 'sine', 0.15, 1320); tone(1320, 0.5, 'sine', 0.1, 1760, 0.1); },
    counter: () => { tone(1000, 0.4, 'square', 0.1, 150); noise(0.3, 0.3, 1500); },
    turn: () => { tone(330, 0.8, 'sine', 0.25, 220); tone(660, 0.8, 'sine', 0.1, 440, 0.02); },
    phase: () => tone(1500, 0.04, 'sine', 0.05),
    click: () => tone(1000, 0.05, 'square', 0.05, 800),
    win: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.5, 'triangle', 0.15, null, i * 0.12)); },
    lose: () => { [400, 350, 300, 200].forEach((f, i) => tone(f, 0.6, 'sawtooth', 0.1, null, i * 0.2)); },
    error: () => tone(200, 0.15, 'square', 0.08, 150),
  };
  Sfx.play = (name) => { if (!Sfx.enabled || !S[name]) return; try { S[name](); } catch (e) { /* ignore */ } };
  Sfx.unlock = () => ac();
  MTG.Sfx = Sfx;
})(typeof window !== 'undefined' ? window : globalThis);
