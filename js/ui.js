/* HTML HUD: panels, phase track, log, hints, overlays. All text goes through MTG.t / MTG.txt;
   relocalize() re-renders everything currently on screen when the language changes. */
(function (root) {
  'use strict';
  const MTG = root.MTG || (root.MTG = {});
  const $ = (s) => document.querySelector(s);
  const t = (k, p) => MTG.t(k, p);
  const txt = (v) => MTG.txt(v);

  const PHASE_ICON = {
    untap: '🔄', upkeep: '⏰', draw: '🃏', main1: '1️⃣', combat_begin: '⚔️', combat_attackers: '🗡️',
    combat_blockers: '🛡️', combat_damage: '💥', combat_end: '🏁', main2: '2️⃣', end: '🌙', cleanup: '🧹',
  };
  const MANA_EMOJI = { W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌳' };

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
        oppDeck: $('#opp-deck'), myDeck: $('#my-deck'), langBtn: $('#btn-lang'),
      };
      // state kept for relocalize()
      this.state = { phase: null, active: 0, turn: 0, hint: null, buttons: null, preview: null, logs: [], game: null, scene: null, humanIdx: 0 };
      this.buildPhases();
      this.onMain = null; this.onCancel = null; this.onPlayerClick = null; this.onLanguage = null;
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
      // language toggle
      this.el.langBtn.addEventListener('click', () => { MTG.Sfx.play('click'); MTG.i18n.set(MTG.i18n.lang === 'ru' ? 'en' : 'ru'); });
      MTG.i18n.onChange(() => this.relocalize());
      this.relocalize();
    }

    // ------------------------------------------------------------ language
    relocalize() {
      const lang = MTG.i18n.lang;
      this.el.langBtn.innerHTML = lang === 'ru'
        ? '<span class="on">🇷🇺 RU</span><span class="sep">/</span><span>🇬🇧 EN</span>'
        : '<span>🇷🇺 RU</span><span class="sep">/</span><span class="on">🇬🇧 EN</span>';
      document.documentElement.lang = lang;
      document.title = t('title');
      MTG.i18n.applyDom(document);
      this.buildPhases();
      const st = this.state;
      if (st.phase) this.setPhase(st.phase, st.active, st.humanIdx, true);
      if (st.turn) this.setTurnInfo(st.turn);
      if (st.hint) this.setHint(st.hint.key, st.hint.params, st.hint.cls);
      if (st.buttons) this.setButtons(st.buttons.main, st.buttons.cancel, st.buttons.cls, st.buttons.params);
      if (st.game) { this.setNames(st.game, st.humanIdx); this.renderStack(st.game, st.scene); }
      if (st.preview && st.game) this.showPreview(st.preview, st.game, st.scene);
      this.renderLog();
      if (this.onLanguage) this.onLanguage(lang);
    }

    buildPhases() {
      this.el.phases.innerHTML = '';
      for (const ph of MTG.PHASES) {
        const li = document.createElement('li');
        li.dataset.phase = ph;
        li.className = ph.startsWith('combat_') ? 'sub' : '';
        li.innerHTML = `<span class="ico">${PHASE_ICON[ph]}</span><span class="nm">${t('phaseShort.' + ph)}</span>`;
        li.title = t('phaseHelp.' + ph);
        this.el.phases.appendChild(li);
      }
    }
    setPhase(phase, active, humanIdx, silent) {
      Object.assign(this.state, { phase, active, humanIdx });
      const mine = active === humanIdx;
      this.el.phases.querySelectorAll('li').forEach((li) => {
        li.classList.toggle('cur', li.dataset.phase === phase);
        const idx = MTG.PHASES.indexOf(li.dataset.phase);
        li.classList.toggle('done', idx < MTG.PHASES.indexOf(phase));
      });
      this.el.phases.classList.toggle('mine', mine);
      this.el.phases.classList.toggle('theirs', !mine);
      this.el.turnLabel.textContent = mine ? t('turn.mine') : t('turn.theirs');
      this.el.turnLabel.className = 'turn-label ' + (mine ? 'mine' : 'theirs');
      this.el.phaseHint.innerHTML = `<b>${PHASE_ICON[phase]} ${t('phase.' + phase)}</b><br>${t('phaseHelp.' + phase)}`;
      if (!silent) MTG.Sfx.play('phase');
    }
    setTurnInfo(turn) { this.state.turn = turn; $('#turn-num').textContent = t('turn.n', { n: turn }); }

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
      const untapped = game.lands(humanIdx).filter((l) => !l.tapped).length;
      $('#my-lands').textContent = `${untapped}/${game.lands(humanIdx).length}`;
      const ou = game.lands(1 - humanIdx).filter((l) => !l.tapped).length;
      $('#opp-lands').textContent = `${ou}/${game.lands(1 - humanIdx).length}`;
    }
    setNames(game, humanIdx) {
      Object.assign(this.state, { game, humanIdx });
      const me = game.players[humanIdx], opp = game.players[1 - humanIdx];
      this.el.oppDeck.textContent = `${opp.deck.emoji} ${txt(opp.deck.name)}`;
      this.el.myDeck.textContent = `${me.deck.emoji} ${txt(me.deck.name)}`;
    }
    bind(game, scene, humanIdx) { Object.assign(this.state, { game, scene, humanIdx }); }

    // --------------------------------------------------------------- log
    log(key, params, cls) {
      this.state.logs.push({ key, params, cls });
      if (this.state.logs.length > 80) this.state.logs.shift();
      this.el.log.appendChild(this.logEntry({ key, params, cls }));
      while (this.el.log.children.length > 80) this.el.log.removeChild(this.el.log.firstChild);
      this.el.log.scrollTop = this.el.log.scrollHeight;
    }
    logEntry(e) {
      const d = document.createElement('div');
      d.className = 'entry ' + (e.cls || '');
      d.textContent = t(e.key, e.params);
      return d;
    }
    renderLog() {
      this.el.log.innerHTML = '';
      for (const e of this.state.logs) this.el.log.appendChild(this.logEntry(e));
      this.el.log.scrollTop = this.el.log.scrollHeight;
    }

    // ------------------------------------------------------- hint/buttons
    /** key: i18n key (or null to clear). */
    setHint(key, params, cls) {
      this.state.hint = key ? { key, params, cls } : null;
      this.el.hint.innerHTML = key ? t(key, params) : '';
      this.el.hint.className = cls || '';
    }
    /** main/cancel: i18n keys or null; params substituted into both labels. */
    setButtons(main, cancel, mainCls, params) {
      this.state.buttons = { main, cancel, cls: mainCls, params };
      if (main) { this.el.btnMain.textContent = t(main, params); this.el.btnMain.classList.remove('hidden'); this.el.btnMain.className = 'btn ' + (mainCls || ''); }
      else this.el.btnMain.classList.add('hidden');
      if (cancel) { this.el.btnCancel.textContent = t(cancel, params); this.el.btnCancel.classList.remove('hidden'); }
      else this.el.btnCancel.classList.add('hidden');
    }
    /** Idle state: 'thinking' spinner for the computer, empty for the human's own auto-passed steps. */
    setWaiting(thinking) {
      this.setHint(thinking ? 'thinking' : null, null, thinking ? 'thinking' : '');
      this.setButtons(null, null);
    }

    showPreview(card, game, scene) {
      this.state.preview = card || null;
      if (!card) { this.el.preview.classList.add('hidden'); return; }
      this.el.previewImg.src = scene.cardImageURL(card);
      let html = '';
      const d = card.def;
      if (d.keywords && d.keywords.length) {
        html += d.keywords.map((k) => `<div class="kw"><b>${t('kw.' + k)}</b> — ${t('kwHelp.' + k)}</div>`).join('');
      }
      if (card.zone === 'battlefield' && d.type === 'creature') {
        if (card.sick && !game.hasKw(card, 'haste')) html += `<div class="kw warn">${t('preview.sick')}</div>`;
        if (card.tapped) html += `<div class="kw warn">${t('preview.tapped')}</div>`;
        if (card.damage) html += `<div class="kw warn">${t('preview.damage', { n: card.damage })}</div>`;
      }
      if (d.type === 'instant') html += `<div class="kw">${t('preview.instant')}</div>`;
      if (d.type === 'sorcery') html += `<div class="kw">${t('preview.sorcery')}</div>`;
      this.el.previewText.innerHTML = html;
      this.el.preview.classList.remove('hidden');
    }

    renderStack(game, scene) {
      if (!game || !game.stack.length) { this.el.stack.classList.add('hidden'); this.el.stack.innerHTML = ''; return; }
      let html = `<div class="title">${t('stack.title')}</div>`;
      for (let i = game.stack.length - 1; i >= 0; i--) {
        const it = game.stack[i];
        const who = txt(game.players[it.controller].name);
        const tg = it.targets && it.targets.length ? ' → ' + it.targets.map((x) => txt(game.describeTarget(x))).join(', ') : '';
        const label = it.type === 'trigger' ? t('stack.ability', { card: it.card.def.name }) : MTG.i18n.quote(it.card.def.name);
        html += `<div class="item ${i === game.stack.length - 1 ? 'top' : ''}"><img src="${scene.cardImageURL(it.card)}"><div><div class="who">${who}</div><div class="nm">${label}${tg}</div></div></div>`;
      }
      this.el.stack.innerHTML = html;
      this.el.stack.classList.remove('hidden');
    }

    banner(key, cls) {
      const b = this.el.banner;
      b.textContent = t(key); b.className = 'banner ' + (cls || '');
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
