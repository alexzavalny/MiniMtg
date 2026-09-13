require('../js/cards.js'); require('../js/engine.js'); require('../js/ai.js');
const MTG = globalThis.MTG;
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
(async () => {
  const ids = Object.keys(MTG.DECKS);
  for (const a of ids) { let row = a.padEnd(6);
    for (const b of ids) { let w = 0; const N = 60;
      for (let i = 0; i < N; i++) { const g = new MTG.Game({ decks: [MTG.DECKS[a], MTG.DECKS[b]], ai: MTG.AI.decide, humanIdx: null, rng: seeded(i * 7 + 1) }); await g.start(); if (g.winner === 0) w++; }
      row += ' ' + String(Math.round(100 * w / N)).padStart(4); }
    console.log(row); }
})();
