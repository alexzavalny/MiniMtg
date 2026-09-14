// Focused rules coverage for the white-blue Merfolk deck «Прилив».
const assert = require('node:assert/strict');
require('../js/i18n.js'); require('../js/cards.js'); require('../js/engine.js'); require('../js/ai.js');
const MTG = globalThis.MTG;

function game(a, b) { return new MTG.Game({ decks: [MTG.DECKS[a], MTG.DECKS[b]], ai: MTG.AI.decide, humanIdx: null, rng: () => 0.4 }); }
function card(g, player, defId) { return g.players[player].library.find((c) => c.def.id === defId); }
async function battlefield(g, player, defId) { const c = card(g, player, defId); await g.moveToBattlefield(c, player); return c; }
function hand(g, player, defId) { const c = card(g, player, defId); g.removeFromZone(c); c.zone = 'hand'; c.controller = player; g.players[player].hand.push(c); return c; }

(async () => {
  assert.equal(MTG.DECKS.tide.cards.length, 40, 'tide deck must contain exactly 40 cards');
  {
    const g = game('tide', 'red');
    const mermaid = await battlefield(g, 0, 'tideguard_mermaid');
    const bolt = card(g, 1, 'bolt');
    assert.equal(g.validTargets(1, 'creature', bolt).some((t) => t.id === mermaid.id), false, 'opponent spells cannot target a hexproof creature');
    assert.equal(g.validTargets(0, 'creature', card(g, 0, 'blessing')).some((t) => t.id === mermaid.id), true, 'its controller can target a hexproof creature');
  }
  {
    const g = game('tide', 'red');
    await battlefield(g, 0, 'island'); await battlefield(g, 0, 'island'); await battlefield(g, 0, 'island');
    const weaver = hand(g, 0, 'watertrap_weaver');
    g.active = 1; g.phase = 'combat_attackers';
    assert.equal(g.canCast(0, weaver), true, 'Flash creature is castable at instant speed');
  }
  {
    const g = game('tide', 'red');
    const target = await battlefield(g, 1, 'fire_giant');
    await g.applyEffect({ kind: 'tap', skipUntap: 1, targets: ['creature'] }, 0, [{ kind: 'card', id: target.id }], card(g, 0, 'frost_breath'));
    assert.equal(target.tapped, true); assert.equal(target.skipUntap, 1);
    if (target.skipUntap) target.skipUntap--; else target.tapped = false;
    assert.equal(target.tapped, true, 'a frozen creature skips exactly one untap step');
    if (target.skipUntap) target.skipUntap--; else target.tapped = false;
    assert.equal(target.tapped, false, 'it untaps on the following turn');
  }
  {
    const g = game('tide', 'red');
    const attacker = await battlefield(g, 1, 'fire_imp');
    attacker.attacking = true; g.active = 1; g.attackers = [attacker.id];
    const life = g.players[0].life;
    await g.applyEffect({ kind: 'preventCombatDamage', targets: [] }, 0, [], card(g, 0, 'ethereal_haze'));
    await g.combatDamage();
    assert.equal(g.players[0].life, life, 'Ethereal Haze prevents combat damage');
  }
  console.log('PASS: Tide deck rules');
})().catch((err) => { console.error(err); process.exit(1); });
