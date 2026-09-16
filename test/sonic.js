// Focused rules coverage for the emoji-only Sonic deck and its permanent artifacts.
const assert = require('node:assert/strict');
require('../js/i18n.js'); require('../js/cards.js'); require('../js/engine.js'); require('../js/ai.js');
const MTG = globalThis.MTG;

function game(a, b) { return new MTG.Game({ decks: [MTG.DECKS[a], MTG.DECKS[b]], ai: MTG.AI.decide, humanIdx: null, rng: () => 0.4 }); }
function card(g, player, defId) { return g.players[player].library.find((c) => c.def.id === defId); }
async function battlefield(g, player, defId) { const c = card(g, player, defId); await g.moveToBattlefield(c, player); return c; }
function hand(g, player, defId) { const c = card(g, player, defId); g.removeFromZone(c); c.zone = 'hand'; c.controller = player; g.players[player].hand.push(c); return c; }

(async () => {
  const sonicCards = MTG.DECKS.sonic.cards;
  assert.equal(sonicCards.length, 40, 'Sonic deck must contain exactly 40 cards');
  assert.equal(new Set(sonicCards).size, 21, 'Sonic deck should include its full character-and-gadget roster');
  for (const id of sonicCards) assert.ok(MTG.DEFS[id], `missing definition for ${id}`);

  {
    const g = game('sonic', 'red');
    const sonic = await battlefield(g, 0, 'sonic_the_hedgehog');
    const sneakers = await battlefield(g, 0, 'power_sneakers');
    const monitor = await battlefield(g, 0, 'shield_monitor');
    const emerald = await battlefield(g, 0, 'chaos_emerald');
    assert.equal(g.canAttack(sonic), true, 'Sonic can attack immediately thanks to Haste');
    assert.deepEqual([g.getPower(sonic), g.getToughness(sonic)], [4, 4], 'Sonic receives every applicable artifact bonus');
    await g.moveToGraveyard(sneakers);
    assert.deepEqual([g.getPower(sonic), g.getToughness(sonic)], [3, 4], 'a lost artifact stops granting its static bonus');
    assert.equal(monitor.zone, 'battlefield'); assert.equal(emerald.zone, 'battlefield');
  }

  {
    const g = game('sonic', 'red');
    await battlefield(g, 0, 'green_hill_zone'); await battlefield(g, 0, 'green_hill_zone');
    g.active = 0; g.phase = 'main1';
    const rings = hand(g, 0, 'ring_cache');
    const life = g.players[0].life;
    assert.equal(await g.castSpell(0, rings.id, []), true, 'artifacts can be cast like other nonland cards');
    await g.resolveTop();
    assert.equal(rings.zone, 'battlefield', 'an artifact remains on the battlefield after resolving');
    await g.resolveTop();
    assert.equal(g.players[0].life, life + 3, 'Ring Cache gives its enter-the-battlefield life bonus');
  }

  {
    const g = game('sonic', 'red');
    await battlefield(g, 0, 'green_hill_zone'); await battlefield(g, 0, 'green_hill_zone');
    g.active = 0; g.phase = 'main1';
    const target = await battlefield(g, 1, 'fire_giant');
    const portal = hand(g, 0, 'warp_ring');
    assert.equal(await g.castSpell(0, portal.id, []), true);
    await g.resolveTop(); await g.resolveTop();
    assert.equal(target.zone, 'hand', 'Warp Ring uses its enter-the-battlefield ability to return a creature');
  }

  {
    const g = game('sonic', 'red');
    g.active = 0; g.phase = 'main1';
    g.ai = () => ({ action: 'cast', cardId: -1, targets: [] });
    await g.priorityRound();
    assert.equal(g.stack.length, 0, 'an invalid AI action is treated as a pass instead of spinning forever');
  }

  console.log('PASS: Sonic deck rules');
})().catch((err) => { console.error(err); process.exit(1); });
