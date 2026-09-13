// Focused rules coverage for the classic mono-black deck.
const assert = require('node:assert/strict');
require('../js/i18n.js'); require('../js/cards.js'); require('../js/engine.js'); require('../js/ai.js');
const MTG = globalThis.MTG;

function game(a, b) { return new MTG.Game({ decks: [MTG.DECKS[a], MTG.DECKS[b]], ai: MTG.AI.decide, humanIdx: null, rng: () => 0.4 }); }
function card(g, player, defId) { return g.players[player].library.find((c) => c.def.id === defId); }
async function battlefield(g, player, defId) { const c = card(g, player, defId); await g.moveToBattlefield(c, player); return c; }
function hand(g, player, defId) { const c = card(g, player, defId); g.removeFromZone(c); c.zone = 'hand'; c.controller = player; g.players[player].hand.push(c); return c; }

(async () => {
  assert.equal(MTG.DECKS.black.cards.length, 40, 'black deck must contain exactly 40 cards');

  {
    const g = game('black', 'white');
    const knight = await battlefield(g, 0, 'black_knight');
    const soldier = await battlefield(g, 1, 'soldier');
    assert.equal(g.canBlock(soldier, knight), false, 'white creatures cannot block Black Knight');
    assert.equal(g.validTargets(1, 'creature', card(g, 1, 'blessing')).some((t) => t.id === knight.id), false, 'white spells cannot target Black Knight');
  }

  {
    const g = game('black', 'red');
    const swamp = await battlefield(g, 0, 'swamp');
    const ritual = hand(g, 0, 'dark_ritual');
    g.active = 0; g.phase = 'main1';
    assert.equal(await g.castSpell(0, ritual.id, []), true);
    assert.equal(swamp.tapped, true);
    await g.resolveTop();
    assert.equal(g.players[0].pool.B, 3, 'Dark Ritual leaves three black mana after paying for itself');
  }

  {
    const g = game('black', 'red');
    const specter = await battlefield(g, 0, 'hypnotic_specter');
    const discarded = hand(g, 1, 'mountain');
    await g.dealDamage(specter, { kind: 'player', idx: 1 }, 2, true, true);
    assert.equal(g.stack.length, 1, 'combat damage from Hypnotic Specter creates a trigger');
    await g.resolveTop();
    assert.equal(discarded.zone, 'graveyard', 'Hypnotic Specter discards a random card');
  }

  {
    const g = game('black', 'red');
    const vampire = await battlefield(g, 0, 'sengir_vampire');
    const victim = await battlefield(g, 1, 'fire_imp');
    await g.dealDamage(vampire, { kind: 'card', id: victim.id }, 4, true, true);
    await g.checkSBA();
    assert.equal(victim.zone, 'graveyard');
    await g.resolveTop();
    assert.equal(g.getPower(vampire), 5, 'Sengir Vampire keeps its +1/+1 counter');
  }

  {
    const g = game('black', 'red');
    const nekrataal = card(g, 0, 'nekrataal');
    const victim = await battlefield(g, 1, 'fire_giant');
    await g.queueTrigger(nekrataal, 0, nekrataal.def.etb);
    await g.resolveTop();
    assert.equal(victim.zone, 'graveyard', 'Nekrataal chooses and destroys a nonblack creature');
  }

  console.log('PASS: classic black deck rules');
})().catch((err) => { console.error(err); process.exit(1); });
