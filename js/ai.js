/* Heuristic computer opponent. decide(game, p, request) -> response (sync). */
(function (root) {
  'use strict';
  const MTG = root.MTG || (root.MTG = {});

  function value(g, c) {
    let v = g.getPower(c) + g.getToughness(c);
    if (g.hasKw(c, 'flying')) v += 2;
    if (g.hasKw(c, 'trample')) v += 1;
    if (g.hasKw(c, 'first_strike')) v += 1;
    if (g.hasKw(c, 'lifelink')) v += 1;
    if (g.hasKw(c, 'deathtouch')) v += 2;
    if (g.hasKw(c, 'vigilance')) v += 0.5;
    if (g.hasKw(c, 'haste')) v += 0.5;
    return v;
  }
  function defValue(d) {
    return (d.power || 0) + (d.toughness || 0) + (d.keywords || []).length;
  }
  // does x deal lethal damage to y in combat (ignoring other combatants)?
  function baseKills(g, x, y, extraP) {
    const p = g.getPower(x) + (extraP || 0);
    if (p <= 0) return false;
    if (g.hasKw(x, 'deathtouch')) return true;
    return p >= g.getToughness(y) - y.damage;
  }
  function kills(g, x, y) {
    if (!baseKills(g, x, y)) return false;
    // y strikes first and kills x before x deals damage
    if (g.hasKw(y, 'first_strike') && !g.hasKw(x, 'first_strike') && baseKills(g, y, x)) return false;
    return true;
  }

  function cast(card, targets) { return { action: 'cast', cardId: card.id, targets: targets || [] }; }
  const T = { card: (c) => ({ kind: 'card', id: c.id }), player: (i) => ({ kind: 'player', idx: i }), stack: (it) => ({ kind: 'stack', id: it.id }) };

  function decidePriority(g, p, req) {
    const me = g.players[p], opp = g.players[1 - p];
    const castable = req.castable.map((id) => g.cardById(id));
    const byKind = (k) => castable.filter((c) => c.def.effect && c.def.effect.kind === k);
    const myCreatures = g.creatures(p), oppCreatures = g.creatures(1 - p);
    const pass = { action: 'pass' };

    // ---------- responding to the stack ----------
    if (g.stack.length) {
      const top = g.stack[g.stack.length - 1];
      if (top.controller !== p && top.type === 'spell') {
        const d = top.card.def;
        const counters = byKind('counter');
        if (counters.length) {
          const worth = d.type === 'creature' ? MTG.cmc(d) >= 3 || defValue(d) >= 6
            : (d.effect && (d.effect.kind === 'damage' || d.effect.kind === 'destroy' || d.effect.kind === 'bite' || d.effect.kind === 'counter'))
              || (d.effect && d.effect.kind === 'draw');
          if (worth) return cast(counters[0], [T.stack(top)]);
        }
        // spell threatens my creature?
        const tgt = top.targets && top.targets[0];
        const eff = d.effect;
        if (tgt && tgt.kind === 'card' && eff) {
          const c = g.cardById(tgt.id);
          if (c && c.controller === p && c.zone === 'battlefield') {
            if (eff.kind === 'damage') {
              const pumps = byKind('pump');
              for (const pu of pumps) {
                if (c.damage + eff.amount < g.getToughness(c) + pu.def.effect.toughness && value(g, c) >= 3) return cast(pu, [T.card(c)]);
              }
            }
            if (eff.kind === 'damage' || eff.kind === 'destroy' || eff.kind === 'bite') {
              const b = byKind('bounce')[0];
              const lethal = eff.kind !== 'damage' || c.damage + eff.amount >= g.getToughness(c);
              if (b && lethal && value(g, c) >= 5) return cast(b, [T.card(c)]);
            }
          }
        }
      }
      return pass;
    }

    // ---------- empty stack ----------
    const ph = g.phase;
    const myTurn = g.active === p;
    const burns = byKind('damage').filter((c) => c.def.effect.targets[0] === 'any');
    const faceBurn = byKind('damage');
    const removals = byKind('destroy');
    const rituals = byKind('addMana');
    const taps = byKind('tap');
    const lifeGains = byKind('gainLife');
    const fogs = byKind('preventCombatDamage');
    const flashCreatures = castable.filter((c) => c.def.type === 'creature' && g.hasKw(c, 'flash')).sort((a, b) => MTG.cmc(b.def) - MTG.cmc(a.def));
      const artifacts = castable.filter((c) => c.def.type === 'artifact').sort((a, b) => MTG.cmc(a.def) - MTG.cmc(b.def));
    const bestKillable = (amount, minValue) => {
      const cands = oppCreatures.filter((c) => g.getToughness(c) - c.damage <= amount);
      cands.sort((a, b) => value(g, b) - value(g, a));
      return cands.length && value(g, cands[0]) >= minValue ? cands[0] : null;
    };
    const oppThreat = oppCreatures.reduce((s, c) => s + g.getPower(c), 0);

    // lethal burn to face (any time we have priority and stack is empty)
    {
      const dmg = faceBurn.reduce((s, c) => s + c.def.effect.amount, 0);
      if (faceBurn.length && dmg >= opp.life) {
        // mana check is per-spell; cast the biggest first
        faceBurn.sort((a, b) => b.def.effect.amount - a.def.effect.amount);
        return cast(faceBurn[0], [T.player(1 - p)]);
      }
    }

    if (myTurn && (ph === 'main1' || ph === 'main2')) {
      if (req.lands.length) return { action: 'land', cardId: req.lands[0] };
      for (const removal of removals) {
        const spec = removal.def.effect.targets[0];
        const targets = g.validTargets(p, spec, removal).filter((t) => t.kind === 'card').map((t) => g.cardById(t.id)).filter((c) => c.controller === 1 - p);
        targets.sort((a, b) => value(g, b) - value(g, a));
        if (targets.length && value(g, targets[0]) >= (me.life <= 10 ? 2 : 4)) return cast(removal, [T.card(targets[0])]);
      }
      // removal on threats
      for (const b of burns.sort((a, c) => c.def.effect.amount - a.def.effect.amount)) {
        const t = bestKillable(b.def.effect.amount, me.life <= 10 ? 2 : 3.5);
        if (t) return cast(b, [T.card(t)]);
      }
      const bites = byKind('bite');
      if (bites.length && myCreatures.length && oppCreatures.length) {
        const src = myCreatures.slice().sort((a, b) => g.getPower(b) - g.getPower(a))[0];
        const t = bestKillable(g.getPower(src), 3);
        if (t) return cast(bites[0], [T.card(src), T.card(t)]);
      }
      const draws = byKind('draw');
      if (draws.length && me.hand.length < 6) return cast(draws[0]);
      if (lifeGains.length && me.life <= 11) return cast(lifeGains[0]);
      if (taps.length && oppCreatures.length) {
        const target = oppCreatures.slice().sort((a, b) => value(g, b) - value(g, a))[0];
        if (target && value(g, target) >= 3) return cast(taps[0], [T.card(target)]);
      }
      // creatures: haste in main1, everything in main2 (or main1 if it's the biggest we can do)
      const creatures = castable.filter((c) => c.def.type === 'creature').sort((a, b) => MTG.cmc(b.def) - MTG.cmc(a.def));
      if (rituals.length && me.hand.some((c) => c !== rituals[0] && c.def.color === 'B' && c.def.type !== 'land' && !g.canPay(p, c.def.cost))) return cast(rituals[0]);
      if (creatures.length) {
        if (ph === 'main2') return cast(creatures[0]);
        const haste = creatures.find((c) => g.hasKw(c, 'haste'));
        if (haste) return cast(haste);
        // no attackers anyway -> just play it now so the kid sees things happen
        if (!myCreatures.some((c) => g.canAttack(c))) return cast(creatures[0]);
      }
      if (artifacts.length) return cast(artifacts[0]);
      if (ph === 'main2') {
        const axe = faceBurn.find((c) => c.def.effect.targets[0] === 'player');
        if (axe && (opp.life <= 12 || creatures.length === 0)) return cast(axe, [T.player(1 - p)]);
        // spare burn at end of my turn: face if opponent low, otherwise hold
        if (burns.length && opp.life <= 6) return cast(burns[0], [T.player(1 - p)]);
      }
      return pass;
    }

    // combat tricks on my turn after blocks
    if (myTurn && ph === 'combat_blockers') {
      const pumps = byKind('pump');
      for (const id of g.attackers) {
        const a = g.cardById(id);
        if (a.zone !== 'battlefield' || !a.blocked) continue;
        const blockers = a.blockedBy.map((b) => g.cardById(b));
        for (const b of blockers) {
          for (const pu of pumps) {
            const e = pu.def.effect;
            const winsNow = kills(g, a, b) && !kills(g, b, a);
            const pw = g.getPower(a) + e.power, tg = g.getToughness(a) + e.toughness;
            const winsAfter = (pw >= g.getToughness(b) - b.damage) && (g.getPower(b) < tg - a.damage);
            if (!winsNow && winsAfter) return cast(pu, [T.card(a)]);
          }
        }
        // burn the blocker so my attacker survives/tramples
        for (const bu of burns) {
          const b = blockers[0];
          if (b && kills(g, b, a) && g.getToughness(b) - b.damage <= bu.def.effect.amount && value(g, a) >= 4) return cast(bu, [T.card(b)]);
        }
      }
      const smite = byKind('destroy')[0];
      if (smite) {
        const blockers = oppCreatures.filter((c) => c.blocking).sort((a, b) => value(g, b) - value(g, a));
        if (blockers.length && value(g, blockers[0]) >= 4) return cast(smite, [T.card(blockers[0])]);
      }
      return pass;
    }

    // defending: opponent's combat
    if (!myTurn && (ph === 'combat_attackers' || ph === 'combat_blockers')) {
      const attackers = g.attackers.map((id) => g.cardById(id)).filter((a) => a.zone === 'battlefield');
      if (ph === 'combat_attackers' && flashCreatures.length && attackers.length) {
        const flash = flashCreatures.find((c) => attackers.some((a) => g.canBlock(c, a)));
        if (flash && (attackers.reduce((s, a) => s + g.getPower(a), 0) >= 4 || me.life <= 12)) return cast(flash);
      }
      const smite = byKind('destroy')[0];
      if (smite && attackers.length) {
        const best = attackers.slice().sort((a, b) => value(g, b) - value(g, a))[0];
        if (value(g, best) >= 4 || ph === 'combat_blockers') return cast(smite, [T.card(best)]);
      }
      if (ph === 'combat_blockers') {
        const pumps = byKind('pump');
        for (const b of myCreatures.filter((c) => c.blocking)) {
          const a = g.cardById(b.blocking);
          if (!a) continue;
          for (const pu of pumps) {
            const e = pu.def.effect;
            const dies = kills(g, a, b);
            const survivesAfter = g.getPower(a) < g.getToughness(b) + e.toughness - b.damage;
            const killsAfter = g.getPower(b) + e.power >= g.getToughness(a) - a.damage;
            if (dies && survivesAfter) return cast(pu, [T.card(b)]);
            if (!kills(g, b, a) && killsAfter && !dies) return cast(pu, [T.card(b)]);
          }
        }
        // incoming lethal? burn or bounce unblocked attackers
        const unblocked = attackers.filter((a) => !a.blocked);
        const incoming = unblocked.reduce((s, a) => s + g.getPower(a), 0);
        if (fogs.length && (incoming >= me.life || incoming >= 5)) return cast(fogs[0]);
        if (incoming >= me.life || incoming >= 6) {
          const big = unblocked.slice().sort((a, b) => g.getPower(b) - g.getPower(a))[0];
          if (big) {
            const bounce = byKind('bounce')[0];
            if (bounce) return cast(bounce, [T.card(big)]);
            for (const bu of burns) if (g.getToughness(big) - big.damage <= bu.def.effect.amount) return cast(bu, [T.card(big)]);
          }
        }
        // burn a blocked attacker that would kill my blocker
        for (const b of myCreatures.filter((c) => c.blocking)) {
          const a = g.cardById(b.blocking);
          if (a && kills(g, a, b) && !kills(g, b, a)) {
            for (const bu of burns) if (g.getToughness(a) - a.damage <= bu.def.effect.amount) return cast(bu, [T.card(a)]);
          }
        }
      }
      return pass;
    }

    // opponent's end step: use spare mana on burn
    if (!myTurn && ph === 'end') {
      if (lifeGains.length && me.life <= 8) return cast(lifeGains[0]);
      for (const b of burns.sort((a, c) => c.def.effect.amount - a.def.effect.amount)) {
        const t = bestKillable(b.def.effect.amount, 3);
        if (t) return cast(b, [T.card(t)]);
        if (opp.life <= 8) return cast(b, [T.player(1 - p)]);
      }
      const bounce = byKind('bounce')[0];
      if (bounce && oppCreatures.length && oppThreat >= me.life) {
        const big = oppCreatures.slice().sort((a, b) => value(g, b) - value(g, a))[0];
        return cast(bounce, [T.card(big)]);
      }
      return pass;
    }
    return pass;
  }

  // Simulate the opponent's likely blocks for a proposed attack and score the outcome.
  function evalAttack(g, p, set, blockersAvail) {
    const me = g.players[p], opp = g.players[1 - p];
    if (!set.length) return 0;
    const blocks = simulateBlocks(g, 1 - p, set, blockersAvail);
    let face = 0, gained = 0, lost = 0;
    const byAttacker = {};
    for (const [bid, aid] of Object.entries(blocks)) (byAttacker[aid] || (byAttacker[aid] = [])).push(g.cardById(Number(bid)));
    for (const a of set) {
      const bl = byAttacker[a.id] || [];
      if (!bl.length) { face += g.getPower(a); continue; }
      let remaining = g.getPower(a);
      let aDies = false;
      for (const b of bl) {
        const need = g.hasKw(a, 'deathtouch') ? 1 : g.getToughness(b) - b.damage;
        if (remaining >= need && !(g.hasKw(b, 'first_strike') && !g.hasKw(a, 'first_strike') && baseKills(g, b, a))) { gained += value(g, b); remaining -= need; }
        if (kills(g, b, a)) aDies = true;
      }
      if (g.hasKw(a, 'trample') && remaining > 0) face += remaining;
      if (aDies) lost += value(g, a);
    }
    const lethal = face >= opp.life;
    if (lethal) return 1000;
    let score = face * (opp.life <= 10 ? 1.6 : 1) + gained - lost * 1.15;
    // counter-attack risk: attackers without vigilance are tapped on the opponent's turn
    const oppPower = g.creatures(1 - p).reduce((s, c) => s + g.getPower(c), 0);
    const myBlockersLeft = g.creatures(p).filter((c) => !set.includes(c) || g.hasKw(c, 'vigilance'));
    const canAbsorb = myBlockersLeft.reduce((s, c) => s + Math.max(g.getToughness(c), 2), 0);
    if (oppPower - canAbsorb >= me.life) score -= 50;
    return score;
  }
  function simulateBlocks(g, p, attackers, avail) {
    return decideBlockers(g, p, { attackers: attackers.map((a) => a.id), candidates: avail.map((b) => b.id) }).blocks;
  }

  function decideAttackers(g, p, req) {
    const cands = req.candidates.map((id) => g.cardById(id)).sort((a, b) => g.getPower(b) - g.getPower(a));
    const blockers = g.creatures(1 - p).filter((c) => !c.tapped);
    const sets = [[], cands.slice()];
    for (let i = 1; i < cands.length; i++) sets.push(cands.slice(0, i));
    // "safe" set: attackers no available blocker can kill
    sets.push(cands.filter((a) => !blockers.some((b) => g.canBlock(b, a) && kills(g, b, a))));
    // evasive set
    sets.push(cands.filter((a) => !blockers.some((b) => g.canBlock(b, a))));
    let best = [], bestScore = 0.01;
    for (const set of sets) {
      if (!set.length) continue;
      const sc = evalAttack(g, p, set, blockers);
      if (sc > bestScore) { bestScore = sc; best = set; }
    }
    return { attackers: best.map((c) => c.id) };
  }

  function decideBlockers(g, p, req) {
    const me = g.players[p];
    const attackers = req.attackers.map((id) => g.cardById(id)).sort((a, b) => g.getPower(b) - g.getPower(a));
    let avail = req.candidates.map((id) => g.cardById(id));
    const blocks = {};
    const take = (b, a) => { blocks[b.id] = a.id; avail = avail.filter((x) => x !== b); };
    for (const a of attackers) {
      const cands = avail.filter((b) => g.canBlock(b, a));
      if (!cands.length) continue;
      const byValue = (x, y) => value(g, x) - value(g, y);
      const good = cands.filter((b) => kills(g, b, a) && !kills(g, a, b)).sort(byValue);
      if (good.length) { take(good[0], a); continue; }
      const trade = cands.filter((b) => kills(g, b, a) && value(g, b) <= value(g, a) + 0.5).sort(byValue);
      if (trade.length) { take(trade[0], a); continue; }
      const safe = cands.filter((b) => !kills(g, a, b)).sort(byValue);
      if (safe.length && !g.hasKw(a, 'trample')) { take(safe[0], a); continue; }
    }
    // chump if lethal incoming
    const incoming = () => attackers.filter((a) => !Object.values(blocks).includes(a.id)).reduce((s, a) => s + g.getPower(a), 0);
    if (incoming() >= me.life) {
      for (const a of attackers) {
        if (incoming() < me.life) break;
        if (Object.values(blocks).includes(a.id)) continue;
        const cands = avail.filter((b) => g.canBlock(b, a)).sort((x, y) => value(g, x) - value(g, y));
        if (cands.length) take(cands[0], a);
      }
    }
    return { blocks };
  }

  function decideDiscard(g, p, req) {
    const hand = req.hand.map((id) => g.cardById(id));
    const landsOnField = g.lands(p).length;
    const score = (c) => {
      if (c.def.type === 'land') return landsOnField >= 6 ? -10 : 5 - landsOnField;
      return MTG.cmc(c.def) > landsOnField + 2 ? -MTG.cmc(c.def) : defValue(c.def) + MTG.cmc(c.def);
    };
    hand.sort((a, b) => score(a) - score(b));
    return { cards: hand.slice(0, req.count).map((c) => c.id) };
  }

  function decideTriggerTargets(g, p, req) {
    const source = g.cardById(req.cardId);
    const targets = [];
    for (const spec of req.specs) {
      const valid = g.validTargets(p, spec, source).filter((t) => !targets.some((x) => x.kind === t.kind && x.id === t.id && x.idx === t.idx));
      const cards = valid.filter((t) => t.kind === 'card').map((t) => g.cardById(t.id));
      cards.sort((a, b) => {
        if (req.effect && req.effect.kind === 'tap' && a.controller !== b.controller) return a.controller === p ? 1 : -1;
        return value(g, b) - value(g, a);
      });
      if (cards.length) targets.push(T.card(cards[0]));
      else if (valid.length) targets.push(valid[0]);
    }
    return { targets };
  }

  function decide(game, p, req) {
    switch (req.type) {
      case 'priority': return decidePriority(game, p, req);
      case 'attackers': return decideAttackers(game, p, req);
      case 'blockers': return decideBlockers(game, p, req);
      case 'discard': return decideDiscard(game, p, req);
      case 'triggerTargets': return decideTriggerTargets(game, p, req);
      default: return { action: 'pass' };
    }
  }

  MTG.AI = { decide, value, kills };
})(typeof window !== 'undefined' ? window : globalThis);
