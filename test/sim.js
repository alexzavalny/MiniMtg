// Headless AI vs AI simulation to validate engine rules / catch crashes.
require('../js/i18n.js'); require('../js/cards.js'); require('../js/engine.js'); require('../js/ai.js');
const MTG = globalThis.MTG;
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
async function run(seed, verbose) {
  const decks = Object.values(MTG.DECKS);
  const rng = seeded(seed);
  const d0 = decks[Math.floor(rng() * decks.length)], d1 = decks[Math.floor(rng() * decks.length)];
  const game = new MTG.Game({ decks: [d0, d1], ai: MTG.AI.decide, humanIdx: null, rng });
  if (verbose) game.on('log', (e) => console.log(MTG.t(e.key, e.params)));
  let steps = 0;
  game.on('phase', () => { if (++steps > 5000) throw new Error('too many phases: stuck?'); });
  await game.start();
  return { winner: game.winner, turns: game.turn, d0: d0.id, d1: d1.id };
}
(async () => {
  const N = Number(process.argv[2] || 200);
  const stats = {}; let totalTurns = 0;
  for (let i = 1; i <= N; i++) {
    try {
      const r = await run(i, process.argv[3] === 'v');
      totalTurns += r.turns;
      const k = r.winner === null ? 'draw' : (r.winner === 0 ? r.d0 : r.d1);
      stats[k] = (stats[k] || 0) + 1;
    } catch (e) { console.error('seed', i, e); process.exit(1); }
  }
  console.log('games', N, 'avg turns', (totalTurns / N).toFixed(1), stats);
})();
