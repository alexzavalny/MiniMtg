require('../js/i18n.js'); require('../js/cards.js'); require('../js/engine.js'); require('../js/ai.js');
const MTG = globalThis.MTG;
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
(async () => {
  const ids = Object.keys(MTG.DECKS);
  const rows = process.env.MATCHUP_ONLY ? ids.filter((id) => process.env.MATCHUP_ONLY.split(',').includes(id)) : ids;
  for (const a of rows) { let row = a.padEnd(6);
    for (const b of ids) { let w = 0; const N = Number(process.env.MATCHUP_GAMES || 60);
      for (let i = 0; i < N; i++) {
        const g = new MTG.Game({ decks: [MTG.DECKS[a], MTG.DECKS[b]], ai: MTG.AI.decide, humanIdx: null, rng: seeded(i * 7 + 1) });
        let phases = 0;
        g.on('phase', () => { if (++phases > 5000) throw new Error(`stuck matchup ${a} vs ${b}, seed ${i}`); });
        await g.start(); if (g.winner === 0) w++;
      }
      row += ' ' + String(Math.round(100 * w / N)).padStart(4); }
    console.log(row); }
})();
