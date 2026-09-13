/* HTML HUD: panels, phase track, log, hints, overlays. */
(function (root) {
  'use strict';
  const MTG = root.MTG || (root.MTG = {});
  const $ = (s) => document.querySelector(s);

  const PHASE_ICON = {
    untap: '🔄', upkeep: '⏰', draw: '🃏', main1: '1️⃣', combat_begin: '⚔️', combat_attackers: '🗡️',
    combat_blockers: '🛡️', combat_damage: '💥', combat_end: '🏁', main2: '2️⃣', end: '🌙', cleanup: '🧹',
  };
  const MANA_EMOJI = { W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌳' };
  const PHASE_SHORT = {
    untap: 'Разворот', upkeep: 'Поддержка', draw: 'Взятие', main1: 'Главная 1', combat_begin: 'Бой',
    combat_attackers: 'Атака', combat_blockers: 'Блок', combat_damage: 'Урон', combat_end: 'Конец боя',
    main2: 'Главная 2', end: 'Конец хода', cleanup: 'Очистка',
  };

  class UI {
    constructor() {
      this.el = {
        oppLife: $('#opp-life'), myLife: $('#my-life'),
        oppHand: $('#opp-hand'), oppLib: $('#opp-lib'), oppGy: $('#opp-gy'),
        myHand: $('#my-hand'), myLib: $('#my-lib'), myGy: $('#my-gy'),
        myPool: $('#my-pool'), oppPool: $('#opp-pool'),
        phases: $('#phases'), turnLabel: $('#turn-label'), phaseHint: $('#phase-hint'),
        hint: $('#hint'), btnMain: $('#btn-main'), btnCancel: $('#btn-cancel'),
        log: $('#log'), preview: $('#preview'), previewImg: $('#preview img'), previewText: $('#preview .ptext'),
        banner: $('#banner'), stack: $('#stack-panel'), oppPanel: $('#opp-panel'), myPanel: $('#my-panel'),
        oppName: $('#opp-name'), oppDeck: $('#opp-deck'), myDeck: $('#my-deck'),
      };
      this.buildPhases();
      this.onMain = null; this.onCancel = null; this.onPlayerClick = null;
      this.el.btnMain.addEventListener('click', () => { MTG.Sfx.play('click'); if (this.onMain) this.onMain(); });
      this.el.btnCancel.addEventListener('click', () => { MTG.Sfx.play('click'); if (this.onCancel) this.onCancel(); });
      this.el.oppPanel.addEventListener('click', () => { if (this.onPlayerClick) this.onPlayerClick('opp'); });
      this.el.myPanel.addEventListener('click', () => { if (this.onPlayerClick) this.onPlayerClick('me'); });
      $('#btn-sound').addEventListener('click', () => {
        MTG.Sfx.enabled = !MTG.Sfx.enabled;
        $('#btn-sound').textContent = MTG.Sfx.enabled ? '🔊' : '🔇';
      });
      $('#btn-help').addEventListener('click', () => this.showOverlay('#help'));
      $('#btn-log').addEventListener('click', () => this.el.log.classList.toggle('open'));
      document.querySelectorAll('.overlay .close').forEach((b) => b.addEventListener('click', () => this.hideOverlay(b.closest('.overlay'))));
    }

    buildPhases() {
      this.el.phases.innerHTML = '';
      for (const ph of MTG.PHASES) {
        const li = document.createElement('li');
        li.dataset.phase = ph;
        li.className = ph.startsWith('combat_') ? 'sub' : '';
        li.innerHTML = `<span class="ico">${PHASE_ICON[ph]}</span><span class="nm">${PHASE_SHORT[ph]}</span>`;
        li.title = MTG.PHASE_HELP_RU[ph];
        this.el.phases.appendChild(li);
      }
    }
    setPhase(phase, active, humanIdx) {
      const mine = active === humanIdx;
      this.el.phases.querySelectorAll('li').forEach((li) => {
        li.classList.toggle('cur', li.dataset.phase === phase);
        const idx = MTG.PHASES.indexOf(li.dataset.phase);
        li.classList.toggle('done', idx < MTG.PHASES.indexOf(phase));
      });
      this.el.phases.classList.toggle('mine', mine);
      this.el.phases.classList.toggle('theirs', !mine);
      this.el.turnLabel.textContent = mine ? 'ВАШ ХОД' : 'ХОД ПРОТИВНИКА';
      this.el.turnLabel.className = 'turn-label ' + (mine ? 'mine' : 'theirs');
      this.el.phaseHint.innerHTML = `<b>${PHASE_ICON[phase]} ${MTG.PHASE_RU[phase]}</b><br>${MTG.PHASE_HELP_RU[phase]}`;
      MTG.Sfx.play('phase');
    }
    setTurnInfo(turn) { $('#turn-num').textContent = 'Ход ' + turn; }

    setLife(idx, life, delta, humanIdx) {
      const el = idx === humanIdx ? this.el.myLife : this.el.oppLife;
      el.textContent = life;
      el.classList.remove('hit', 'heal');
      void el.offsetWidth; // restart animation
      if (delta < 0) el.classList.add('hit');
      else if (delta > 0) el.classList.add('heal');
      const panel = idx === humanIdx ? this.el.myPanel : this.el.oppPanel;
      if (delta < 0) { panel.classList.remove('shake'); void panel.offsetWidth; panel.classList.add('shake'); }
      if (idx === humanIdx && delta < 0) {
        const f = $('#red-flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
      }
    }
    setPool(idx, pool, humanIdx) {
      const el = idx === humanIdx ? this.el.myPool : this.el.oppPool;
      let html = '';
      for (const c of ['W', 'U', 'B', 'R', 'G']) for (let i = 0; i < pool[c]; i++) html += `<span class="mana ${c}">${MANA_EMOJI[c]}</span>`;
      el.innerHTML = html;
      el.classList.toggle('has', html !== '');
    }
    updateCounts(game, humanIdx) {
      const me = game.players[humanIdx], opp = game.players[1 - humanIdx];
      this.el.myHand.textContent = me.hand.length; this.el.myLib.textContent = me.library.length; this.el.myGy.textContent = me.graveyard.length;
      this.el.oppHand.textContent = opp.hand.length; this.el.oppLib.textContent = opp.library.length; this.el.oppGy.textContent = opp.graveyard.length;
      // lands available
      const untapped = game.lands(humanIdx).filter((l) => !l.tapped).length;
      $('#my-lands').textContent = `${untapped}/${game.lands(humanIdx).length}`;
      const ou = game.lands(1 - humanIdx).filter((l) => !l.tapped).length;
      $('#opp-lands').textContent = `${ou}/${game.lands(1 - humanIdx).length}`;
    }
    setNames(game, humanIdx) {
      const me = game.players[humanIdx], opp = game.players[1 - humanIdx];
      this.el.oppDeck.textContent = `${opp.deck.emoji} ${opp.deck.name}`;
      this.el.myDeck.textContent = `${me.deck.emoji} ${me.deck.name}`;
    }

    log(text, cls) {
      const d = document.createElement('div');
      d.className = 'entry ' + (cls || '');
      d.textContent = text;
      this.el.log.appendChild(d);
      while (this.el.log.children.length > 80) this.el.log.removeChild(this.el.log.firstChild);
      this.el.log.scrollTop = this.el.log.scrollHeight;
    }

    setHint(text, cls) { this.el.hint.innerHTML = text; this.el.hint.className = cls || ''; }
    setButtons(main, cancel, mainCls) {
      if (main) { this.el.btnMain.textContent = main; this.el.btnMain.classList.remove('hidden'); this.el.btnMain.className = 'btn ' + (mainCls || ''); }
      else this.el.btnMain.classList.add('hidden');
      if (cancel) { this.el.btnCancel.textContent = cancel; this.el.btnCancel.classList.remove('hidden'); }
      else this.el.btnCancel.classList.add('hidden');
    }
    setWaiting(text) {
      this.setHint(text === undefined ? '<span class="thinking">Компьютер думает…</span>' : text);
      this.setButtons(null, null);
    }

    showPreview(card, game, scene) {
      if (!card) { this.el.preview.classList.add('hidden'); return; }
      this.el.previewImg.src = scene.cardImageURL(card);
      let html = '';
      const d = card.def;
      if (d.keywords && d.keywords.length) {
        html += d.keywords.map((k) => `<div class="kw"><b>${MTG.KEYWORDS_RU[k]}</b> — ${MTG.KEYWORD_HELP_RU[k]}</div>`).join('');
      }
      if (card.zone === 'battlefield' && d.type === 'creature') {
        if (card.sick && !game.hasKw(card, 'haste')) html += `<div class="kw warn">💤 Болезнь вызова: не может атаковать в этот ход.</div>`;
        if (card.tapped) html += `<div class="kw warn">↩️ Повёрнуто: не может блокировать.</div>`;
        if (card.damage) html += `<div class="kw warn">🩸 Повреждения: ${card.damage} (снимаются в конце хода).</div>`;
      }
      if (d.type === 'instant') html += `<div class="kw">⚡ Мгновенное заклинание можно играть в любой момент, когда у вас приоритет.</div>`;
      if (d.type === 'sorcery') html += `<div class="kw">📜 Волшебство: только в свою главную фазу, когда стек пуст.</div>`;
      this.el.previewText.innerHTML = html;
      this.el.preview.classList.remove('hidden');
    }

    renderStack(game, scene) {
      if (!game.stack.length) { this.el.stack.classList.add('hidden'); this.el.stack.innerHTML = ''; return; }
      let html = '<div class="title">СТЕК (разрешается сверху вниз)</div>';
      for (let i = game.stack.length - 1; i >= 0; i--) {
        const it = game.stack[i];
        const who = game.players[it.controller].name;
        const tg = it.targets && it.targets.length ? ' → ' + it.targets.map((t) => game.describeTarget(t)).join(', ') : '';
        const label = it.type === 'trigger' ? `Способность «${it.card.def.name}»` : `«${it.card.def.name}»`;
        html += `<div class="item ${i === game.stack.length - 1 ? 'top' : ''}"><img src="${scene.cardImageURL(it.card)}"><div><div class="who">${who}</div><div class="nm">${label}${tg}</div></div></div>`;
      }
      this.el.stack.innerHTML = html;
      this.el.stack.classList.remove('hidden');
    }

    banner(text, cls) {
      const b = this.el.banner;
      b.textContent = text; b.className = 'banner ' + (cls || '');
      void b.offsetWidth; b.classList.add('show');
      return new Promise((r) => setTimeout(() => { b.classList.remove('show'); r(); }, 1000));
    }
    setPlayerTargetable(which, on) {
      (which === 'opp' ? this.el.oppPanel : this.el.myPanel).classList.toggle('targetable', on);
    }
    showOverlay(sel) { $(sel).classList.remove('hidden'); }
    hideOverlay(el) { (typeof el === 'string' ? $(el) : el).classList.add('hidden'); }
  }

  MTG.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);
