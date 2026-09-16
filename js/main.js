/* Glue: engine events -> animations + UI; human input state machine. */
(function () {
  'use strict';
  const MTG = window.MTG;
  const wait = MTG.wait;
  const HUMAN = 0;

  let ui, scene, game, cardArtReady;
  const input = { mode: 'idle', req: null, spell: null, targetSpecs: null, targetMode: null, targets: [], specIdx: 0, selected: [], blocks: {}, blocker: null };

  function costRu(cost) {
    const p = MTG.parseCost(cost);
    const sym = { W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌳' };
    let s = p.generic ? String(p.generic) : '';
    for (const c of ['W', 'U', 'B', 'R', 'G']) s += sym[c].repeat(p[c]);
    return s || '0';
  }
  // Returns [i18nKey, params] explaining why a hand card can't be played now.
  function whyCannot(card) {
    const p = HUMAN, d = card.def;
    if (d.type === 'land') {
      if (game.landPlayed) return ['why.landOnce'];
      return ['why.landTiming'];
    }
    if (d.type !== 'instant' && !game.sorcerySpeed(p)) {
      if (game.stack.length) return ['why.stack'];
      if (game.active !== p) return ['why.notYourTurn'];
      return ['why.notMain'];
    }
    if (!game.canPay(p, d.cost)) return ['why.mana', { cost: costRu(d.cost) }];
    if (!game.hasTargets(p, card)) return ['why.noTarget'];
    return ['why.generic'];
  }

  // ------------------------------------------------------------ highlights
  function refreshHighlights() {
    const map = {};
    const req = input.req;
    if (input.mode === 'priority' && req) {
      for (const id of req.castable) map[id] = 'castable';
      for (const id of req.lands) map[id] = 'land';
    } else if (input.mode === 'targeting') {
      for (const t of input.validNow) if (t.kind === 'card') map[t.id] = 'targetable';
      for (const t of input.validNow) if (t.kind === 'stack') { const it = game.stack.find((s) => s.id === t.id); if (it) map[it.card.id] = 'targetable'; }
      for (const t of input.targets) if (t.kind === 'card') map[t.id] = 'selected';
      map[input.spell.id] = 'selected';
    } else if (input.mode === 'attackers') {
      for (const id of req.candidates) map[id] = input.selected.includes(id) ? 'chosen' : 'castable';
    } else if (input.mode === 'blockers') {
      for (const id of req.attackers) map[id] = 'attack';
      for (const id of req.candidates) map[id] = input.blocks[id] ? 'chosen' : 'block';
      if (input.blocker) map[input.blocker] = 'selected';
    } else if (input.mode === 'discard') {
      for (const id of input.selected) map[id] = 'selected';
    }
    scene.setHighlights(map);
    const playersTargetable = input.mode === 'targeting' ? input.validNow.filter((t) => t.kind === 'player').map((t) => t.idx) : [];
    ui.setPlayerTargetable('opp', playersTargetable.includes(1 - HUMAN));
    ui.setPlayerTargetable('me', playersTargetable.includes(HUMAN));
  }

  // ---------------------------------------------------------- input modes
  function enterPriority(req) {
    input.mode = 'priority'; input.req = req;
    const ph = game.phase, mine = game.active === HUMAN;
    let hint, params = null, btn = 'btn.next', cls = '';
    if (game.stack.length) {
      const top = game.stack[game.stack.length - 1];
      hint = 'hint.stack';
      params = { who: MTG.i18n.strings[top.controller === HUMAN ? 'hint.who.you' : 'hint.who.opp'], card: top.card.def.name };
      btn = 'btn.pass';
    } else if (mine && ph === 'main1') { hint = 'hint.main1'; btn = 'btn.toCombat'; cls = 'primary'; }
    else if (mine && ph === 'main2') { hint = 'hint.main2'; btn = 'btn.endTurn'; cls = 'primary'; }
    else if (mine && ph === 'combat_begin') hint = 'hint.combat_begin';
    else if (mine && ph === 'combat_attackers') hint = 'hint.myAttackers';
    else if (ph === 'combat_blockers') hint = mine ? 'hint.myBlockers' : 'hint.theirBlockers';
    else if (!mine && ph === 'combat_attackers') hint = 'hint.theirAttackers';
    else if (!mine && ph === 'end') hint = 'hint.theirEnd';
    else { hint = 'hint.generic'; params = { phase: MTG.i18n.strings['phase.' + ph] }; }
    ui.setHint(hint, params);
    ui.setButtons(btn, null, cls);
    ui.onMain = () => submit({ action: 'pass' });
    refreshHighlights();
  }
  function enterTargeting(card, specs, mode) {
    input.mode = 'targeting'; input.spell = card; input.targetSpecs = specs || game.targetSpecs(card.def); input.targetMode = mode || 'cast'; input.targets = []; input.specIdx = 0;
    nextTargetStep();
  }
  function nextTargetStep() {
    const specs = input.targetSpecs;
    if (input.specIdx >= specs.length) {
      const targets = input.targets;
      input.mode = 'idle';
      if (input.targetMode === 'trigger') submit({ targets });
      else submit({ action: 'cast', cardId: input.spell.id, targets });
      return;
    }
    const spec = specs[input.specIdx];
    input.validNow = game.validTargets(HUMAN, spec, input.spell).filter((t) => !input.targets.some((x) => x.kind === t.kind && x.id === t.id && x.idx === t.idx));
    ui.setHint('hint.target', { what: MTG.i18n.strings['target.' + spec], card: input.spell.def.name });
    ui.setButtons(null, input.targetMode === 'cast' ? 'btn.cancel' : null);
    ui.onCancel = () => { input.mode = 'idle'; enterPriority(input.req); };
    refreshHighlights();
  }
  function chooseTarget(t) {
    input.targets.push(t); input.specIdx++;
    MTG.Sfx.play('click');
    nextTargetStep();
  }
  function enterAttackers(req) {
    input.mode = 'attackers'; input.req = req; input.selected = [];
    ui.setHint('hint.attackers');
    updateAttackButtons();
    refreshHighlights();
  }
  function updateAttackButtons() {
    const n = input.selected.length;
    ui.setButtons(n ? 'btn.attack' : 'btn.noAttack', n ? 'btn.reset' : null, n ? 'primary' : '', { n });
    ui.onMain = () => { const s = input.selected.slice(); input.mode = 'idle'; scene.setSelectedOffsets({}); submit({ attackers: s }); };
    ui.onCancel = () => { input.selected = []; scene.setSelectedOffsets({}); updateAttackButtons(); refreshHighlights(); };
    const offs = {}; for (const id of input.selected) offs[id] = 0.7;
    scene.setSelectedOffsets(offs);
  }
  function enterBlockers(req) {
    input.mode = 'blockers'; input.req = req; input.blocks = {}; input.blocker = null;
    ui.setHint('hint.blockers');
    updateBlockButtons();
    refreshHighlights();
  }
  function updateBlockButtons() {
    const n = Object.keys(input.blocks).length;
    ui.setButtons(n ? 'btn.confirmBlock' : 'btn.noBlock', n ? 'btn.reset' : null, n ? 'primary' : '', { n });
    ui.onMain = () => { const b = Object.assign({}, input.blocks); input.mode = 'idle'; scene.clearBlockLines(); submit({ blocks: b }); };
    ui.onCancel = () => { input.blocks = {}; input.blocker = null; scene.clearBlockLines(); updateBlockButtons(); refreshHighlights(); };
    scene.blockLines(Object.entries(input.blocks).map(([b, a]) => ({ blocker: Number(b), attacker: Number(a) })));
  }
  function enterDiscard(req) {
    input.mode = 'discard'; input.req = req; input.selected = [];
    updateDiscardButtons();
  }
  function updateDiscardButtons() {
    const n = input.req.count;
    ui.setHint('hint.discard', { n, k: input.selected.length });
    ui.setButtons(input.selected.length === n ? 'btn.discard' : null, null, 'primary');
    ui.onMain = () => { const s = input.selected.slice(); input.mode = 'idle'; scene.setSelectedOffsets({}); submit({ cards: s }); };
    const offs = {}; for (const id of input.selected) offs[id] = 1;
    scene.setSelectedOffsets(offs);
    refreshHighlights();
  }
  function submit(resp) {
    input.mode = 'idle'; input.req = null;
    scene.setHighlights({});
    ui.setPlayerTargetable('opp', false); ui.setPlayerTargetable('me', false);
    ui.setWaiting(false);
    game.submit(resp);
  }

  // --------------------------------------------------------------- clicks
  function onCardClick(id, button) {
    const card = game.cardById(id);
    if (!card) return;
    if (button === 2) { if (input.mode === 'targeting') ui.onCancel(); return; }
    switch (input.mode) {
      case 'priority': {
        const req = input.req;
        if (card.zone === 'hand' && card.controller === HUMAN) {
          if (req.lands.includes(id)) { submit({ action: 'land', cardId: id }); return; }
          if (req.castable.includes(id)) {
            if (game.targetSpecs(card.def).length) enterTargeting(card);
            else submit({ action: 'cast', cardId: id, targets: [] });
            return;
          }
          MTG.Sfx.play('error');
          const [k, prm] = whyCannot(card);
          ui.setHint(k, prm, 'warn');
          return;
        }
        if (card.zone === 'battlefield' && card.controller === HUMAN && card.def.type === 'land' && !card.tapped) {
          submit({ action: 'tap', cardId: id }); return;
        }
        break;
      }
      case 'targeting': {
        let t = input.validNow.find((v) => v.kind === 'card' && v.id === id);
        if (!t) { const it = game.stack.find((s) => s.card.id === id); if (it) t = input.validNow.find((v) => v.kind === 'stack' && v.id === it.id); }
        if (t) chooseTarget(t); else MTG.Sfx.play('error');
        break;
      }
      case 'attackers': {
        if (!input.req.candidates.includes(id)) { MTG.Sfx.play('error'); return; }
        const i = input.selected.indexOf(id);
        if (i >= 0) input.selected.splice(i, 1); else input.selected.push(id);
        MTG.Sfx.play('click');
        updateAttackButtons(); refreshHighlights();
        break;
      }
      case 'blockers': {
        const req = input.req;
        if (req.candidates.includes(id)) {
          if (input.blocks[id]) { delete input.blocks[id]; input.blocker = null; }
          else input.blocker = input.blocker === id ? null : id;
          MTG.Sfx.play('click');
          updateBlockButtons(); refreshHighlights();
          return;
        }
        if (req.attackers.includes(id)) {
          if (!input.blocker) { ui.setHint('hint.blockFirst', null, 'warn'); MTG.Sfx.play('error'); return; }
          const b = game.cardById(input.blocker);
          if (!game.canBlock(b, card)) {
            ui.setHint('hint.cantBlockFlying', { blocker: b.def.name, attacker: card.def.name }, 'warn');
            MTG.Sfx.play('error'); return;
          }
          input.blocks[input.blocker] = id; input.blocker = null;
          MTG.Sfx.play('block');
          updateBlockButtons(); refreshHighlights();
          ui.setHint('hint.blockSet');
        }
        break;
      }
      case 'discard': {
        if (card.zone !== 'hand' || card.controller !== HUMAN) return;
        const i = input.selected.indexOf(id);
        if (i >= 0) input.selected.splice(i, 1); else if (input.selected.length < input.req.count) input.selected.push(id);
        MTG.Sfx.play('click');
        updateDiscardButtons();
        break;
      }
      default: break;
    }
  }
  function onPlayerClick(which) {
    if (input.mode !== 'targeting') return;
    const idx = which === 'opp' ? 1 - HUMAN : HUMAN;
    const t = input.validNow.find((v) => v.kind === 'player' && v.idx === idx);
    if (t) chooseTarget(t); else MTG.Sfx.play('error');
  }
  function onHover(id) {
    const card = id ? game.cardById(id) : null;
    if (!card || card.zone === 'hand') { ui.showPreview(null); return; }
    ui.showPreview(card, game, scene);
  }

  // ------------------------------------------------------- engine wiring
  function wire() {
    const counts = () => ui.updateCounts(game, HUMAN);
    game.on('log', (e) => ui.log(e.key, e.params, e.cls));
    game.on('start', async () => { ui.setNames(game, HUMAN); counts(); });
    game.on('draw', async (e) => { await scene.animDraw(e.card, e.player, game.turn === 0); counts(); });
    game.on('handsDealt', async () => { await wait(200); });
    game.on('turnStart', async (e) => {
      ui.setTurnInfo(e.turn);
      MTG.Sfx.play('turn');
      await ui.banner(e.player === HUMAN ? 'turn.mine' : 'turn.theirs', e.player === HUMAN ? 'mine' : 'theirs');
    });
    game.on('phase', async (e) => {
      ui.setPhase(e.phase, e.active, HUMAN);
      if (input.mode === 'idle') ui.setWaiting(e.active !== HUMAN);
      await wait(e.phase === 'untap' || e.phase === 'cleanup' ? 150 : 260);
    });
    game.on('untap', async (e) => { await scene.animUntap(e.cards); counts(); });
    game.on('tap', async (e) => { await scene.animTap(e.cards); counts(); });
    game.on('pool', async (e) => ui.setPool(e.player, e.pool, HUMAN));
    game.on('zone', async (e) => {
      const c = game.cardById(e.card);
      if (e.to === 'graveyard') await scene.animToGraveyard(e.card);
      else if (e.to === 'hand') await scene.layout(true);
      else if (e.to === 'battlefield' && c.def.type === 'land') { await scene.layout(true); MTG.Sfx.play('enter'); }
      counts();
      ui.renderStack(game, scene);
    });
    game.on('cast', async (e) => {
      await scene.animCast(e.card, e.player, e.targets);
      ui.renderStack(game, scene); counts();
      if (e.player !== HUMAN) await wait(500);
    });
    game.on('trigger', async () => { ui.renderStack(game, scene); await wait(400); });
    game.on('resolveStart', async (e) => {
      ui.renderStack(game, scene);
      if (e.item.type === 'spell') {
        const c = e.item.card;
        if (c.def.type === 'creature') await scene.animResolveCreature(c.id);
        else await scene.animSpellHit(c.id, e.item.targets);
      } else {
        const p = scene.worldPos(e.item.card.id);
        scene.burst(p, e.item.card.def.color, { count: 60 });
      }
    });
    game.on('resolved', async () => { ui.renderStack(game, scene); scene.updateTargetLines(); await scene.layout(true); });
    game.on('fizzle', async (e) => { scene.floatText(scene.worldPos(e.card), MTG.t('fx.fizzle'), 'counter'); await wait(500); });
    game.on('damage', async (e) => { await scene.animDamageSpell(e.source, e.target, e.amount); await wait(250); });
    game.on('combatDamage', async (e) => { await scene.animCombatDamage(e.events, game); await wait(200); });
    game.on('life', async (e) => { ui.setLife(e.player, e.life, e.delta, HUMAN); await scene.animLife(e.player, e.delta); });
    game.on('pump', async (e) => { await scene.animPump(e.card, e.power, e.toughness); });
    game.on('destroy', async (e) => { await scene.animDeath(e.card); });
    game.on('dies', async (e) => { await scene.animDeath(e.card); });
    game.on('bounce', async (e) => { await scene.animBounce(e.card); });
    game.on('countered', async (e) => { await scene.animCountered(e.item.card.id); ui.renderStack(game, scene); });
    game.on('attackers', async (e) => { await scene.animAttackers(e.attackers); });
    game.on('blockers', async (e) => { await scene.animBlockers(e.blocks); await wait(300); });
    game.on('combatEnd', async () => { await scene.animCombatEnd(); });
    game.on('cleanupEffects', async () => { for (const id of Object.keys(game.cards)) scene.refreshCard(Number(id)); });
    game.on('discard', async (e) => { await scene.animDiscard(e.card); });
    game.on('aiThink', async (e) => { if (e.request.type === 'priority') await wait(250); else await wait(500); });
    game.on('awaiting', async (req) => {
      scene.disabled = false;
      switch (req.type) {
        case 'priority': enterPriority(req); break;
        case 'attackers': enterAttackers(req); break;
        case 'blockers': enterBlockers(req); break;
        case 'discard': enterDiscard(req); break;
        case 'triggerTargets': enterTargeting(game.cardById(req.cardId), req.specs, 'trigger'); break;
        default: break;
      }
    });
    game.on('gameOver', async (e) => {
      const win = e.winner === HUMAN;
      MTG.Sfx.play(win ? 'win' : 'lose');
      document.querySelector('#gameover h1').dataset.i18n = win ? 'over.win' : (e.winner === null ? 'over.draw' : 'over.lose');
      document.querySelector('#gameover p').dataset.i18n = win ? 'over.winText' : 'over.loseText';
      MTG.i18n.applyDom(document.getElementById('gameover'));
      if (win) for (let i = 0; i < 6; i++) setTimeout(() => scene.burst(new THREE.Vector3((Math.random() - 0.5) * 12, 2, (Math.random() - 0.5) * 8), ['R', 'G', 'W', 'U'][i % 4], { count: 200, speed: 6, size: 0.6, life: 1.5 }), i * 300);
      await wait(1200);
      ui.showOverlay('#gameover');
    });
    scene.onPlayerHit = (idx) => { /* life event handles UI */ };
  }

  // ---------------------------------------------------------------- start
  async function startGame(deckId, fullControl) {
    await cardArtReady;
    const decks = Object.keys(MTG.DECKS);
    const others = decks.filter((d) => d !== deckId);
    const oppDeck = MTG.DECKS[others[Math.floor(Math.random() * others.length)]];
    game = new MTG.Game({ decks: [MTG.DECKS[deckId], oppDeck], ai: MTG.AI.decide, humanIdx: HUMAN, fullControl });
    window.game = game;
    scene.setGame(game, HUMAN);
    ui.bind(game, scene, HUMAN);
    scene.onClick = onCardClick;
    scene.onHover = onHover;
    scene.onBackgroundClick = (button) => { if (button === 2 && input.mode === 'targeting') ui.onCancel(); };
    ui.onPlayerClick = onPlayerClick;
    wire();
    ui.updateCounts(game, HUMAN);
    ui.setLife(HUMAN, 20, 0, HUMAN); ui.setLife(1 - HUMAN, 20, 0, HUMAN);
    ui.hideOverlay('#start');
    game.start().catch((err) => { console.error(err); ui.log('log.error', { msg: err.message }, 'death'); });
  }

  window.addEventListener('DOMContentLoaded', () => {
    ui = new MTG.UI();
    scene = new MTG.Scene(document.getElementById('c'));
    cardArtReady = MTG.CardArt.preloadArt();
    window.scene = scene;
    // deck picker (rebuilt on language change)
    const picker = document.getElementById('deck-picker');
    let chosen = 'red';
    const buildPicker = () => {
      picker.innerHTML = '';
      for (const d of Object.values(MTG.DECKS)) {
        const el = document.createElement('div');
        el.className = 'deck ' + d.color + (d.id === chosen ? ' sel' : '');
        el.dataset.id = d.id;
        const cover = d.cover === 'emoji'
          ? `<div class="deck-cover emoji-cover" aria-hidden="true">${d.emoji}</div>`
          : `<img class="deck-cover" src="assets/deck-covers/${d.id}.png" alt="">`;
        el.innerHTML = `${cover}<div class="nm">${MTG.txt(d.name)}</div><div class="ds">${MTG.txt(d.desc)}</div>`;
        el.addEventListener('click', () => { chosen = d.id; picker.querySelectorAll('.deck').forEach((x) => x.classList.toggle('sel', x === el)); MTG.Sfx.unlock(); MTG.Sfx.play('click'); });
        picker.appendChild(el);
      }
    };
    buildPicker();
    ui.onLanguage = () => buildPicker();
    document.getElementById('btn-start').addEventListener('click', () => {
      MTG.Sfx.unlock();
      const full = document.getElementById('opt-full').checked;
      if (document.fullscreenEnabled && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      startGame(chosen, full);
    });
    document.getElementById('btn-restart').addEventListener('click', () => location.reload());
    document.getElementById('btn-help-start').addEventListener('click', () => ui.showOverlay('#help'));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && input.mode === 'targeting') ui.onCancel();
      if ((e.key === ' ' || e.key === 'Enter') && !document.querySelector('#start:not(.hidden)')) { e.preventDefault(); if (!ui.el.btnMain.classList.contains('hidden')) ui.el.btnMain.click(); }
    });
  });
})();
