/* Game engine: zones, turn structure, priority, stack, combat, state-based actions.
   Async: every visible change is emitted as an event; listeners may return promises
   (animations) and the engine waits for them. Works headless in node. */
(function (root) {
  'use strict';
  const MTG = root.MTG || (root.MTG = {});

  const PHASES = [
    'untap', 'upkeep', 'draw', 'main1',
    'combat_begin', 'combat_attackers', 'combat_blockers', 'combat_damage', 'combat_end',
    'main2', 'end', 'cleanup',
  ];
  const PHASE_RU = {
    untap: 'Разворот', upkeep: 'Поддержка', draw: 'Взятие карты', main1: 'Главная фаза 1',
    combat_begin: 'Начало боя', combat_attackers: 'Объявление атаки', combat_blockers: 'Объявление блока',
    combat_damage: 'Боевой урон', combat_end: 'Конец боя', main2: 'Главная фаза 2', end: 'Завершение', cleanup: 'Очистка',
  };
  const PHASE_HELP_RU = {
    untap: 'Все ваши повёрнутые карты разворачиваются.',
    upkeep: 'Короткий шаг перед взятием карты. Можно играть мгновенные заклинания.',
    draw: 'Активный игрок берёт карту из библиотеки.',
    main1: 'Можно разыграть землю (одну за ход), существ и волшебства.',
    combat_begin: 'Бой начинается. Последний шанс сыграть мгновенное заклинание до атаки.',
    combat_attackers: 'Активный игрок выбирает, какие существа атакуют. Они поворачиваются.',
    combat_blockers: 'Защищающийся игрок выбирает, какие существа блокируют.',
    combat_damage: 'Существа наносят повреждения одновременно. Сначала — с первым ударом.',
    combat_end: 'Бой окончен. Существа возвращаются.',
    main2: 'Вторая главная фаза. Можно доиграть существ и волшебства.',
    end: 'Шаг завершения хода. Можно играть мгновенные заклинания.',
    cleanup: 'Повреждения снимаются, эффекты «до конца хода» заканчиваются, лишние карты сбрасываются до 7.',
  };

  class GameOver extends Error { constructor() { super('game over'); this.gameOver = true; } }

  let nextId = 1;

  class Game {
    /**
     * @param {object} opts { decks: [deckDef, deckDef], ai: fn(game, pIdx, request) -> response,
     *                        humanIdx: 0|1|null, fullControl: bool, rng: fn }
     */
    constructor(opts) {
      this.opts = opts;
      this.rng = opts.rng || Math.random;
      this.ai = opts.ai;
      this.humanIdx = opts.humanIdx === undefined ? 0 : opts.humanIdx;
      this.listeners = {};
      this.players = [0, 1].map((i) => ({
        idx: i,
        name: i === this.humanIdx ? 'Вы' : 'Компьютер',
        deck: opts.decks[i],
        life: 20,
        library: [],
        hand: [],
        battlefield: [],
        graveyard: [],
        pool: { W: 0, U: 0, B: 0, R: 0, G: 0 },
        drewFromEmpty: false,
        lost: false,
      }));
      this.cards = {};
      for (const p of this.players) {
        for (const id of p.deck.cards) p.library.push(this.createCard(MTG.DEFS[id], p.idx));
      }
      this.turn = 0;
      this.active = 0;
      this.phase = null;
      this.stack = [];
      this.landPlayed = false;
      this.attackers = [];
      this.over = false;
      this.winner = null;
      this.pending = null;
      this._resolveInput = null;
      this.logLines = [];
    }

    // ---- events ----------------------------------------------------------
    on(evt, fn) { (this.listeners[evt] || (this.listeners[evt] = [])).push(fn); return this; }
    async emit(evt, data) {
      const fns = this.listeners[evt];
      if (!fns) return;
      for (const fn of fns) await fn(data || {});
    }
    async log(text, cls) {
      this.logLines.push(text);
      await this.emit('log', { text, cls: cls || '' });
    }

    // ---- helpers ---------------------------------------------------------
    createCard(def, owner) {
      const c = {
        id: nextId++, def, owner, controller: owner, zone: 'library',
        tapped: false, sick: false, damage: 0, buffs: [], attacking: false, blocking: null,
        blockedBy: [], blocked: false, deathtouched: false,
      };
      this.cards[c.id] = c;
      return c;
    }
    cardById(id) { return this.cards[id]; }
    opp(p) { return 1 - p; }
    isHuman(p) { return p === this.humanIdx; }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
    hasKw(card, kw) { return !!(card.def.keywords && card.def.keywords.includes(kw)); }
    getPower(card) { return card.def.power + card.buffs.reduce((s, b) => s + b.power, 0); }
    getToughness(card) { return card.def.toughness + card.buffs.reduce((s, b) => s + b.toughness, 0); }
    isCreature(card) { return card.def.type === 'creature'; }
    creatures(p) { return this.players[p].battlefield.filter((c) => this.isCreature(c)); }
    lands(p) { return this.players[p].battlefield.filter((c) => c.def.type === 'land'); }
    canBlock(blocker, attacker) {
      if (blocker.tapped) return false;
      if (this.hasKw(attacker, 'flying') && !this.hasKw(blocker, 'flying') && !this.hasKw(blocker, 'reach')) return false;
      return true;
    }
    canAttack(card) {
      return this.isCreature(card) && !card.tapped && (!card.sick || this.hasKw(card, 'haste'));
    }
    zoneOf(card) { return card.zone; }

    // ---- mana ------------------------------------------------------------
    availableMana(p) {
      const pl = this.players[p];
      const res = { W: 0, U: 0, B: 0, R: 0, G: 0 };
      for (const c of Object.keys(res)) res[c] = pl.pool[c];
      for (const l of this.lands(p)) if (!l.tapped) res[l.def.produces]++;
      return res;
    }
    canPay(p, cost) {
      const need = MTG.parseCost(cost);
      const avail = this.availableMana(p);
      let total = 0;
      for (const c of ['W', 'U', 'B', 'R', 'G']) {
        if (avail[c] < need[c]) return false;
        total += avail[c] - need[c];
      }
      return total >= need.generic;
    }
    async payCost(p, cost) {
      const pl = this.players[p];
      const need = MTG.parseCost(cost);
      const untapped = this.lands(p).filter((l) => !l.tapped);
      const tapped = [];
      const takeColor = async (c, n) => {
        for (let i = 0; i < n; i++) {
          if (pl.pool[c] > 0) { pl.pool[c]--; continue; }
          const idx = untapped.findIndex((l) => l.def.produces === c);
          if (idx < 0) throw new Error('cannot pay ' + c);
          const l = untapped.splice(idx, 1)[0];
          l.tapped = true; tapped.push(l);
        }
      };
      for (const c of ['W', 'U', 'B', 'R', 'G']) await takeColor(c, need[c]);
      let generic = need.generic;
      for (const c of ['W', 'U', 'B', 'R', 'G']) {
        while (generic > 0 && pl.pool[c] > 0) { pl.pool[c]--; generic--; }
      }
      while (generic > 0) {
        const l = untapped.shift();
        if (!l) throw new Error('cannot pay generic');
        l.tapped = true; tapped.push(l); generic--;
      }
      if (tapped.length) await this.emit('tap', { cards: tapped.map((c) => c.id), mana: true });
      await this.emit('pool', { player: p, pool: Object.assign({}, pl.pool) });
    }
    async tapForMana(p, cardId) {
      const l = this.cardById(cardId);
      if (!l || l.controller !== p || l.def.type !== 'land' || l.tapped || l.zone !== 'battlefield') return false;
      l.tapped = true;
      this.players[p].pool[l.def.produces]++;
      await this.emit('tap', { cards: [l.id], mana: true });
      await this.emit('pool', { player: p, pool: Object.assign({}, this.players[p].pool) });
      return true;
    }
    async emptyPools() {
      for (const pl of this.players) {
        let had = false;
        for (const c of Object.keys(pl.pool)) { if (pl.pool[c]) had = true; pl.pool[c] = 0; }
        if (had) await this.emit('pool', { player: pl.idx, pool: Object.assign({}, pl.pool) });
      }
    }

    // ---- targets ---------------------------------------------------------
    validTargets(p, spec, source) {
      const out = [];
      const allCreatures = [...this.creatures(0), ...this.creatures(1)];
      const push = (c) => out.push({ kind: 'card', id: c.id });
      switch (spec) {
        case 'any':
          allCreatures.forEach(push);
          out.push({ kind: 'player', idx: 0 }, { kind: 'player', idx: 1 });
          break;
        case 'creature': allCreatures.forEach(push); break;
        case 'ownCreature': this.creatures(p).forEach(push); break;
        case 'oppCreature': this.creatures(1 - p).forEach(push); break;
        case 'player': out.push({ kind: 'player', idx: 0 }, { kind: 'player', idx: 1 }); break;
        case 'combatCreature': allCreatures.filter((c) => c.attacking || c.blocking).forEach(push); break;
        case 'spell':
          for (const it of this.stack) {
            if (it.type === 'spell' && (!source || it.card.id !== source.id)) out.push({ kind: 'stack', id: it.id });
          }
          break;
        default: break;
      }
      return out;
    }
    targetLegal(t, spec, p, source) {
      return this.validTargets(p, spec, source).some((v) => v.kind === t.kind && (v.id === t.id) && (v.idx === t.idx));
    }
    targetSpecs(def) { return (def.effect && def.effect.targets) || []; }
    hasTargets(p, card) {
      return this.targetSpecs(card.def).every((spec) => this.validTargets(p, spec, card).length > 0);
    }
    describeTarget(t) {
      if (t.kind === 'player') return this.players[t.idx].name;
      if (t.kind === 'card') return this.cardById(t.id).def.name;
      if (t.kind === 'stack') { const it = this.stack.find((s) => s.id === t.id); return it ? it.card.def.name : '?'; }
      return '?';
    }

    // ---- casting ---------------------------------------------------------
    sorcerySpeed(p) {
      return this.active === p && (this.phase === 'main1' || this.phase === 'main2') && this.stack.length === 0;
    }
    canPlayLand(p, card) {
      return card.def.type === 'land' && card.zone === 'hand' && card.controller === p && this.sorcerySpeed(p) && !this.landPlayed;
    }
    canCast(p, card) {
      if (card.zone !== 'hand' || card.controller !== p) return false;
      const t = card.def.type;
      if (t === 'land') return false;
      if (t !== 'instant' && !this.sorcerySpeed(p)) return false;
      if (!this.canPay(p, card.def.cost)) return false;
      if (!this.hasTargets(p, card)) return false;
      return true;
    }
    buildPriorityRequest(p) {
      const pl = this.players[p];
      return {
        type: 'priority', player: p, phase: this.phase, active: this.active,
        castable: pl.hand.filter((c) => this.canCast(p, c)).map((c) => c.id),
        lands: pl.hand.filter((c) => this.canPlayLand(p, c)).map((c) => c.id),
        stackEmpty: this.stack.length === 0,
      };
    }
    async playLand(p, cardId) {
      const card = this.cardById(cardId);
      if (!card || !this.canPlayLand(p, card)) return false;
      this.landPlayed = true;
      await this.moveToBattlefield(card, p);
      await this.log(`${this.players[p].name}: разыграна земля «${card.def.name}».`);
      return true;
    }
    async castSpell(p, cardId, targets) {
      const card = this.cardById(cardId);
      if (!card || !this.canCast(p, card)) return false;
      const specs = this.targetSpecs(card.def);
      targets = targets || [];
      if (targets.length !== specs.length) return false;
      for (let i = 0; i < specs.length; i++) if (!this.targetLegal(targets[i], specs[i], p, card)) return false;
      await this.payCost(p, card.def.cost);
      this.removeFromZone(card);
      card.zone = 'stack';
      const item = { id: nextId++, type: 'spell', card, controller: p, targets };
      this.stack.push(item);
      const tdesc = targets.length ? ' → ' + targets.map((t) => this.describeTarget(t)).join(', ') : '';
      await this.log(`${this.players[p].name} разыгрывает «${card.def.name}»${tdesc}.`, 'cast');
      await this.emit('cast', { item, player: p, card: card.id, targets });
      return true;
    }
    async resolveTop() {
      const item = this.stack.pop();
      if (!item) return;
      const p = item.controller;
      await this.emit('resolveStart', { item });
      if (item.type === 'spell') {
        const card = item.card;
        const specs = this.targetSpecs(card.def);
        const legal = item.targets.map((t, i) => this.targetLegal(t, specs[i], p, card));
        if (specs.length && !legal.some((x) => x)) {
          await this.log(`«${card.def.name}» отменяется: цель исчезла.`, 'fizzle');
          await this.moveToGraveyard(card);
          await this.emit('fizzle', { card: card.id });
          await this.checkSBA();
          return;
        }
        if (card.def.type === 'creature') {
          await this.moveToBattlefield(card, p);
          await this.log(`«${card.def.name}» выходит на поле битвы.`);
          if (card.def.etb) {
            const trig = { id: nextId++, type: 'trigger', card, controller: p, effect: card.def.etb, targets: [] };
            this.stack.push(trig);
            await this.log(`Срабатывает способность «${card.def.name}».`, 'trigger');
            await this.emit('trigger', { item: trig });
          }
        } else {
          await this.applyEffect(card.def.effect, p, item.targets.filter((t, i) => legal[i]), card);
          await this.moveToGraveyard(card);
        }
      } else if (item.type === 'trigger') {
        await this.applyEffect(item.effect, p, item.targets, item.card);
      }
      await this.emit('resolved', { item });
      await this.checkSBA();
    }
    async applyEffect(effect, p, targets, source) {
      switch (effect.kind) {
        case 'damage':
          for (const t of targets) await this.dealDamage(source, t, effect.amount, false);
          break;
        case 'pump': {
          const c = this.cardById(targets[0].id);
          c.buffs.push({ power: effect.power, toughness: effect.toughness });
          await this.log(`«${c.def.name}» получает +${effect.power}/+${effect.toughness}.`);
          await this.emit('pump', { card: c.id, power: effect.power, toughness: effect.toughness });
          break;
        }
        case 'destroy': {
          const c = this.cardById(targets[0].id);
          await this.log(`«${c.def.name}» уничтожено.`, 'death');
          await this.emit('destroy', { card: c.id });
          await this.moveToGraveyard(c);
          break;
        }
        case 'bounce': {
          const c = this.cardById(targets[0].id);
          await this.log(`«${c.def.name}» возвращается в руку.`);
          await this.emit('bounce', { card: c.id });
          this.removeFromZone(c);
          this.resetCard(c);
          c.zone = 'hand'; c.controller = c.owner;
          this.players[c.owner].hand.push(c);
          await this.emit('zone', { card: c.id, to: 'hand', player: c.owner });
          break;
        }
        case 'draw':
          await this.drawCards(p, effect.amount);
          break;
        case 'gainLife':
          await this.changeLife(p, effect.amount, source);
          break;
        case 'counter': {
          const idx = this.stack.findIndex((s) => s.id === targets[0].id);
          if (idx >= 0) {
            const it = this.stack.splice(idx, 1)[0];
            await this.log(`«${it.card.def.name}» отменено!`, 'counter');
            await this.emit('countered', { item: it });
            await this.moveToGraveyard(it.card);
          }
          break;
        }
        case 'bite': {
          const a = targets.find((t) => this.cardById(t.id).controller === p);
          const b = targets.find((t) => this.cardById(t.id).controller !== p);
          if (a && b) {
            const src = this.cardById(a.id);
            await this.dealDamage(src, b, this.getPower(src), false);
          }
          break;
        }
        default: break;
      }
    }

    // ---- damage / life ---------------------------------------------------
    async dealDamage(source, target, amount, silent) {
      if (amount <= 0) return;
      if (target.kind === 'player') {
        const pl = this.players[target.idx];
        pl.life -= amount;
        await this.log(`«${source.def.name}» наносит ${amount} повреждений: ${pl.name}.`, 'damage');
        if (!silent) await this.emit('damage', { source: source.id, target, amount });
        await this.emit('life', { player: target.idx, life: pl.life, delta: -amount });
      } else {
        const c = this.cardById(target.id);
        if (!c || c.zone !== 'battlefield') return;
        c.damage += amount;
        if (this.isCreature(source) && this.hasKw(source, 'deathtouch')) c.deathtouched = true;
        await this.log(`«${source.def.name}» наносит ${amount} повреждений «${c.def.name}».`, 'damage');
        if (!silent) await this.emit('damage', { source: source.id, target, amount });
      }
      if (this.isCreature(source) && this.hasKw(source, 'lifelink')) {
        await this.changeLife(source.controller, amount, source);
      }
    }
    async changeLife(p, delta, source) {
      const pl = this.players[p];
      pl.life += delta;
      if (delta > 0) await this.log(`${pl.name} получает ${delta} жизней.`, 'life');
      await this.emit('life', { player: p, life: pl.life, delta });
    }

    // ---- zones -----------------------------------------------------------
    removeFromZone(card) {
      const pl = this.players[card.controller];
      for (const z of ['hand', 'battlefield', 'graveyard', 'library']) {
        const i = pl[z].indexOf(card);
        if (i >= 0) pl[z].splice(i, 1);
      }
      const owner = this.players[card.owner];
      for (const z of ['hand', 'graveyard', 'library']) {
        const i = owner[z].indexOf(card);
        if (i >= 0) owner[z].splice(i, 1);
      }
      const si = this.stack.findIndex((s) => s.card === card && s.type === 'spell');
      if (si >= 0) this.stack.splice(si, 1);
    }
    resetCard(card) {
      card.tapped = false; card.sick = false; card.damage = 0; card.buffs = [];
      card.attacking = false; card.blocking = null; card.blockedBy = []; card.blocked = false; card.deathtouched = false;
    }
    async moveToBattlefield(card, p) {
      this.removeFromZone(card);
      this.resetCard(card);
      card.zone = 'battlefield'; card.controller = p; card.sick = true;
      this.players[p].battlefield.push(card);
      await this.emit('zone', { card: card.id, to: 'battlefield', player: p });
    }
    async moveToGraveyard(card) {
      const wasAttacking = card.attacking;
      this.removeFromZone(card);
      // detach from combat
      if (card.blocking) {
        const a = this.cardById(card.blocking);
        if (a) a.blockedBy = a.blockedBy.filter((id) => id !== card.id);
      }
      if (wasAttacking) this.attackers = this.attackers.filter((id) => id !== card.id);
      this.resetCard(card);
      card.zone = 'graveyard'; card.controller = card.owner;
      this.players[card.owner].graveyard.push(card);
      await this.emit('zone', { card: card.id, to: 'graveyard', player: card.owner });
    }
    async drawCards(p, n) {
      for (let i = 0; i < n; i++) await this.drawCard(p);
    }
    async drawCard(p) {
      const pl = this.players[p];
      const card = pl.library.pop();
      if (!card) {
        pl.drewFromEmpty = true;
        await this.log(`${pl.name} не может взять карту: библиотека пуста!`, 'death');
        return null;
      }
      card.zone = 'hand';
      pl.hand.push(card);
      await this.emit('draw', { player: p, card: card.id });
      return card;
    }

    // ---- state based actions --------------------------------------------
    async checkSBA() {
      let changed = true;
      while (changed) {
        changed = false;
        for (const p of [0, 1]) {
          for (const c of [...this.creatures(p)]) {
            const t = this.getToughness(c);
            if (t <= 0 || c.damage >= t || (c.deathtouched && c.damage > 0)) {
              await this.log(`«${c.def.name}» погибает.`, 'death');
              await this.emit('dies', { card: c.id });
              await this.moveToGraveyard(c);
              changed = true;
            }
          }
        }
      }
      const losers = this.players.filter((pl) => pl.life <= 0 || pl.drewFromEmpty);
      if (losers.length) {
        this.over = true;
        this.winner = losers.length === 2 ? null : 1 - losers[0].idx;
        throw new GameOver();
      }
    }

    // ---- input -----------------------------------------------------------
    async choose(p, request) {
      if (this.over) throw new GameOver();
      if (!this.isHuman(p)) {
        const r = this.ai(this, p, request);
        await this.emit('aiThink', { player: p, request });
        return r;
      }
      this.pending = request;
      await this.emit('awaiting', request);
      return new Promise((res) => { this._resolveInput = res; });
    }
    submit(response) {
      if (!this._resolveInput) return false;
      const fn = this._resolveInput;
      this._resolveInput = null;
      this.pending = null;
      fn(response);
      return true;
    }
    hasCastableInstant(p) {
      return this.players[p].hand.some((c) => c.def.type === 'instant' && this.canCast(p, c));
    }
    shouldAutoPass(p, req) {
      if (!this.isHuman(p)) return false;
      if (this.opts.fullControl) return false;
      if (req.castable.length === 0 && req.lands.length === 0) return true;
      if (!req.stackEmpty) return false; // something on stack and we can respond -> ask
      const ph = this.phase;
      if (this.active === p) {
        if (ph === 'main1' || ph === 'main2') return false;
        if (ph === 'upkeep' || ph === 'draw') return true;
        return !this.hasCastableInstant(p);
      }
      if (['combat_attackers', 'combat_blockers', 'end'].includes(ph)) return !this.hasCastableInstant(p);
      return true;
    }

    // ---- priority --------------------------------------------------------
    async priorityRound() {
      if (this.over) return;
      let p = this.active;
      let passes = 0;
      for (;;) {
        const req = this.buildPriorityRequest(p);
        let resp;
        if (this.shouldAutoPass(p, req)) resp = { action: 'pass' };
        else resp = await this.choose(p, req);
        if (!resp || resp.action === 'pass') {
          passes++;
          if (passes >= 2) {
            if (this.stack.length) { await this.resolveTop(); passes = 0; p = this.active; }
            else break;
          } else p = 1 - p;
        } else if (resp.action === 'land') {
          if (await this.playLand(p, resp.cardId)) passes = 0;
        } else if (resp.action === 'tap') {
          await this.tapForMana(p, resp.cardId);
        } else if (resp.action === 'cast') {
          if (await this.castSpell(p, resp.cardId, resp.targets)) { passes = 1; p = 1 - p; }
        }
      }
      await this.emptyPools();
    }

    // ---- turn structure --------------------------------------------------
    async setPhase(ph) {
      this.phase = ph;
      await this.emit('phase', { phase: ph, active: this.active, turn: this.turn });
    }
    async start() {
      for (const pl of this.players) this.shuffle(pl.library);
      this.active = this.rng() < 0.5 ? 0 : 1;
      await this.emit('start', { first: this.active });
      await this.log(`Первым ходит: ${this.players[this.active].name}.`);
      for (let i = 0; i < 7; i++) for (const p of [0, 1]) await this.drawCard(p);
      await this.emit('handsDealt', {});
      try {
        while (!this.over) await this.takeTurn();
      } catch (e) {
        if (!e.gameOver) throw e;
      }
      this.over = true;
      await this.emit('gameOver', { winner: this.winner });
    }
    async takeTurn() {
      this.turn++;
      const ap = this.active;
      this.landPlayed = false;
      this.attackers = [];
      this.combatHappened = false;
      await this.emit('turnStart', { player: ap, turn: this.turn });
      await this.log(`— Ход ${this.turn}: ${this.players[ap].name} —`, 'turn');

      await this.setPhase('untap');
      const toUntap = this.players[ap].battlefield.filter((c) => c.tapped);
      for (const c of this.players[ap].battlefield) { c.tapped = false; c.sick = false; }
      if (toUntap.length) await this.emit('untap', { cards: toUntap.map((c) => c.id) });

      await this.setPhase('upkeep');
      await this.priorityRound();

      await this.setPhase('draw');
      if (this.turn > 1) await this.drawCard(ap);
      await this.checkSBA();
      await this.priorityRound();

      await this.setPhase('main1');
      await this.priorityRound();

      await this.setPhase('combat_begin');
      await this.priorityRound();

      await this.setPhase('combat_attackers');
      await this.declareAttackers();
      if (this.attackers.length) {
        await this.priorityRound();
        await this.setPhase('combat_blockers');
        await this.declareBlockers();
        await this.priorityRound();
        await this.setPhase('combat_damage');
        await this.combatDamage();
        await this.priorityRound();
      }
      await this.setPhase('combat_end');
      await this.endCombat();
      await this.priorityRound();

      await this.setPhase('main2');
      await this.priorityRound();

      await this.setPhase('end');
      await this.priorityRound();

      await this.setPhase('cleanup');
      await this.cleanup();
      this.active = 1 - ap;
    }

    async declareAttackers() {
      const ap = this.active;
      const cands = this.creatures(ap).filter((c) => this.canAttack(c));
      this.attackers = [];
      if (!cands.length) return;
      const resp = await this.choose(ap, { type: 'attackers', player: ap, candidates: cands.map((c) => c.id) });
      const chosen = (resp && resp.attackers || []).map((id) => this.cardById(id)).filter((c) => c && cands.includes(c));
      this.combatHappened = chosen.length > 0;
      const tapped = [];
      for (const c of chosen) {
        c.attacking = true; c.blocked = false; c.blockedBy = [];
        if (!this.hasKw(c, 'vigilance')) { c.tapped = true; tapped.push(c.id); }
        this.attackers.push(c.id);
      }
      if (chosen.length) {
        await this.log(`${this.players[ap].name} атакует: ${chosen.map((c) => '«' + c.def.name + '»').join(', ')}.`, 'attack');
        if (tapped.length) await this.emit('tap', { cards: tapped, mana: false });
        await this.emit('attackers', { player: ap, attackers: this.attackers.slice() });
      } else {
        await this.log(`${this.players[ap].name} не атакует.`);
      }
    }
    async declareBlockers() {
      const dp = 1 - this.active;
      const cands = this.creatures(dp).filter((c) => !c.tapped);
      const attackers = this.attackers.map((id) => this.cardById(id));
      if (!cands.length) { await this.log(`${this.players[dp].name} не может блокировать.`); return; }
      const resp = await this.choose(dp, {
        type: 'blockers', player: dp, attackers: this.attackers.slice(), candidates: cands.map((c) => c.id),
      });
      const blocks = (resp && resp.blocks) || {};
      const pairs = [];
      for (const [bid, aid] of Object.entries(blocks)) {
        const b = this.cardById(Number(bid)); const a = this.cardById(Number(aid));
        if (!b || !a || !cands.includes(b) || !attackers.includes(a) || !this.canBlock(b, a)) continue;
        b.blocking = a.id; a.blockedBy.push(b.id); a.blocked = true;
        pairs.push({ blocker: b.id, attacker: a.id });
      }
      if (pairs.length) {
        await this.log(`${this.players[dp].name} блокирует: ` +
          pairs.map((pr) => `«${this.cardById(pr.blocker).def.name}» → «${this.cardById(pr.attacker).def.name}»`).join(', ') + '.', 'block');
      } else await this.log(`${this.players[dp].name} не блокирует.`);
      await this.emit('blockers', { player: dp, blocks: pairs });
    }
    combatants() {
      const out = [];
      for (const id of this.attackers) { const a = this.cardById(id); if (a.zone === 'battlefield') out.push(a); }
      for (const c of this.creatures(1 - this.active)) if (c.blocking) out.push(c);
      return out;
    }
    async combatDamage() {
      const all = this.combatants();
      const anyFS = all.some((c) => this.hasKw(c, 'first_strike'));
      if (anyFS) {
        await this.log('Шаг первого удара.', 'phase');
        await this.dealCombatDamage((c) => this.hasKw(c, 'first_strike'));
        await this.checkSBA();
      }
      await this.dealCombatDamage((c) => !anyFS || !this.hasKw(c, 'first_strike'));
      await this.checkSBA();
    }
    async dealCombatDamage(filter) {
      const dp = 1 - this.active;
      const events = [];
      const assign = (src, target, amount) => { if (amount > 0) events.push({ source: src, target, amount }); };
      for (const id of this.attackers) {
        const a = this.cardById(id);
        if (a.zone !== 'battlefield' || !a.attacking || !filter(a)) continue;
        const power = this.getPower(a);
        if (power <= 0) continue;
        if (!a.blocked) { assign(a, { kind: 'player', idx: dp }, power); continue; }
        const blockers = a.blockedBy.map((bid) => this.cardById(bid)).filter((b) => b.zone === 'battlefield');
        const trample = this.hasKw(a, 'trample');
        if (!blockers.length) { if (trample) assign(a, { kind: 'player', idx: dp }, power); continue; }
        let remaining = power;
        const dt = this.hasKw(a, 'deathtouch');
        blockers.forEach((b, i) => {
          if (remaining <= 0) return;
          const lethal = dt ? 1 : Math.max(0, this.getToughness(b) - b.damage);
          const last = i === blockers.length - 1;
          let amt = (last && !trample) ? remaining : Math.min(remaining, lethal);
          if (amt <= 0 && last && !trample) amt = remaining;
          assign(a, { kind: 'card', id: b.id }, amt);
          remaining -= amt;
        });
        if (trample && remaining > 0) assign(a, { kind: 'player', idx: dp }, remaining);
      }
      for (const b of this.creatures(dp)) {
        if (!b.blocking || !filter(b)) continue;
        const a = this.cardById(b.blocking);
        if (!a || a.zone !== 'battlefield') continue;
        assign(b, { kind: 'card', id: a.id }, this.getPower(b));
      }
      if (!events.length) return;
      // apply simultaneously
      for (const e of events) await this.dealDamage(e.source, e.target, e.amount, true);
      await this.emit('combatDamage', {
        events: events.map((e) => ({ source: e.source.id, target: e.target, amount: e.amount })),
      });
    }
    async endCombat() {
      for (const p of [0, 1]) for (const c of this.creatures(p)) { c.attacking = false; c.blocking = null; c.blockedBy = []; c.blocked = false; }
      const had = this.combatHappened;
      this.attackers = [];
      this.combatHappened = false;
      if (had) await this.emit('combatEnd', {});
    }
    async cleanup() {
      const ap = this.active;
      const pl = this.players[ap];
      if (pl.hand.length > 7) {
        const n = pl.hand.length - 7;
        const resp = await this.choose(ap, { type: 'discard', player: ap, count: n, hand: pl.hand.map((c) => c.id) });
        let ids = (resp && resp.cards || []).map(Number).filter((id) => pl.hand.some((c) => c.id === id)).slice(0, n);
        while (ids.length < n) { const c = pl.hand.find((x) => !ids.includes(x.id)); ids.push(c.id); }
        for (const id of ids) {
          const c = this.cardById(id);
          await this.log(`${pl.name} сбрасывает «${c.def.name}».`);
          await this.emit('discard', { card: c.id });
          await this.moveToGraveyard(c);
        }
      }
      let changed = false;
      for (const p of [0, 1]) for (const c of this.creatures(p)) {
        if (c.damage || c.buffs.length || c.deathtouched) changed = true;
        c.damage = 0; c.buffs = []; c.deathtouched = false;
      }
      if (changed) await this.emit('cleanupEffects', {});
    }
  }

  MTG.Game = Game;
  MTG.PHASES = PHASES;
  MTG.PHASE_RU = PHASE_RU;
  MTG.PHASE_HELP_RU = PHASE_HELP_RU;
})(typeof window !== 'undefined' ? window : globalThis);
