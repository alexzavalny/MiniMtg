/* Three.js rendering: table, cards, hand overlay, animations, particle effects. */
(function (root) {
  'use strict';
  const MTG = root.MTG || (root.MTG = {});

  // ---------------------------------------------------------------- tweens
  const EASE = {
    linear: (t) => t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inQuad: (t) => t * t,
  };
  const tweens = [];
  function tween(obj, to, ms, ease, delay) {
    // cancel tweens on the same object touching the same keys
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      if (tw.obj === obj && Object.keys(to).some((k) => k in tw.to)) { tw.resolve(); tweens.splice(i, 1); }
    }
    return new Promise((resolve) => {
      tweens.push({ obj, to, from: null, ms: Math.max(1, ms * (MTG.speed || 1)), ease: EASE[ease || 'outCubic'], delay: (delay || 0) * (MTG.speed || 1), t: 0, resolve });
    });
  }
  function updateTweens(dt) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      if (tw.delay > 0) { tw.delay -= dt; if (tw.delay > 0) continue; }
      if (!tw.from) { tw.from = {}; for (const k of Object.keys(tw.to)) tw.from[k] = tw.obj[k]; }
      tw.t += dt;
      const p = Math.min(1, tw.t / tw.ms);
      const e = tw.ease(p);
      for (const k of Object.keys(tw.to)) tw.obj[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
      if (p >= 1) { tweens.splice(i, 1); tw.resolve(); }
    }
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms * (MTG.speed || 1)));

  // ------------------------------------------------------------- particles
  class Particles {
    constructor(scene, max) {
      this.max = max;
      this.pos = new Float32Array(max * 3);
      this.col = new Float32Array(max * 3);
      this.size = new Float32Array(max);
      this.alpha = new Float32Array(max);
      this.vel = new Float32Array(max * 3);
      this.life = new Float32Array(max);
      this.maxLife = new Float32Array(max);
      this.grav = new Float32Array(max);
      this.drag = new Float32Array(max);
      this.baseSize = new Float32Array(max);
      this.alive = new Uint8Array(max);
      this.cursor = 0;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
      const tex = Particles.texture();
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTex: { value: tex } },
        vertexShader: `
          attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
          varying float vAlpha; varying vec3 vColor;
          void main() {
            vColor = aColor; vAlpha = aAlpha;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * (320.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform sampler2D uTex; varying float vAlpha; varying vec3 vColor;
          void main() {
            vec4 t = texture2D(uTex, gl_PointCoord);
            gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      this.points = new THREE.Points(geo, mat);
      this.points.frustumCulled = false;
      this.geo = geo;
      scene.add(this.points);
    }
    static texture() {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c); return t;
    }
    spawn(p, o) {
      const n = o.count || 30;
      const colors = (o.colors || [0xffffff]).map((c) => new THREE.Color(c));
      const dir = o.dir || null;
      for (let k = 0; k < n; k++) {
        const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
        this.alive[i] = 1;
        const spread = o.spread === undefined ? 1 : o.spread;
        let vx, vy, vz;
        if (o.ring) {
          const a = Math.random() * Math.PI * 2; vx = Math.cos(a); vy = 0.15; vz = Math.sin(a);
        } else {
          vx = (Math.random() - 0.5) * 2; vy = (Math.random() - 0.5) * 2; vz = (Math.random() - 0.5) * 2;
          const l = Math.hypot(vx, vy, vz) || 1; vx /= l; vy /= l; vz /= l;
          if (dir) { vx = vx * spread + dir.x; vy = vy * spread + dir.y; vz = vz * spread + dir.z; }
        }
        const sp = (o.speed || 3) * (0.4 + Math.random() * 0.8);
        this.vel[i * 3] = vx * sp; this.vel[i * 3 + 1] = vy * sp; this.vel[i * 3 + 2] = vz * sp;
        const r = o.radius || 0;
        this.pos[i * 3] = p.x + (Math.random() - 0.5) * r; this.pos[i * 3 + 1] = p.y + (Math.random() - 0.5) * r * 0.3; this.pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * r;
        const c = colors[Math.floor(Math.random() * colors.length)];
        this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
        this.maxLife[i] = this.life[i] = (o.life || 0.8) * (0.6 + Math.random() * 0.8);
        this.baseSize[i] = (o.size || 0.3) * (0.5 + Math.random());
        this.grav[i] = o.gravity === undefined ? -4 : o.gravity;
        this.drag[i] = o.drag === undefined ? 0.97 : o.drag;
      }
    }
    update(dt) {
      for (let i = 0; i < this.max; i++) {
        if (!this.alive[i]) { this.alpha[i] = 0; this.size[i] = 0; continue; }
        this.life[i] -= dt;
        if (this.life[i] <= 0) { this.alive[i] = 0; this.alpha[i] = 0; continue; }
        const f = this.life[i] / this.maxLife[i];
        this.vel[i * 3 + 1] += this.grav[i] * dt;
        const d = Math.pow(this.drag[i], dt * 60);
        this.vel[i * 3] *= d; this.vel[i * 3 + 1] *= d; this.vel[i * 3 + 2] *= d;
        this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
        this.alpha[i] = Math.min(1, f * 1.5);
        this.size[i] = this.baseSize[i] * (0.4 + 0.6 * f);
      }
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.aColor.needsUpdate = true;
      this.geo.attributes.aSize.needsUpdate = true;
      this.geo.attributes.aAlpha.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------------ scene
  const CARD_W = 1, CARD_H = 1.5;
  const CARD_RATIO = CARD_H / CARD_W;
  const WORLD_SCALE = 1.7;
  const ROW = { myCreatures: 1.6, myLands: 4.2, oppCreatures: -1.9, oppLands: -4.5 };
  const LIB = { my: [9.3, 4.2], myGy: [9.3, 1.6], opp: [9.3, -4.5], oppGy: [9.3, -1.9] };
  const GLOW_COLORS = {
    castable: 0xffd24a, land: 0xffd24a, selected: 0x4aff8a, target: 0xff3b3b, attack: 0xff8a2a,
    block: 0x4aa8ff, hover: 0xffffff, targetable: 0xff5a5a, chosen: 0x9dff4a, sick: 0x000000,
  };
  const FX_COLORS = {
    R: [0xff5a1f, 0xffb02a, 0xffe08a], G: [0x4dff7a, 0xa8ff5a, 0xd8ffb0], W: [0xfff4c0, 0xffe27a, 0xffffff],
    U: [0x4ab8ff, 0x8ad8ff, 0xd0f0ff], B: [0xa060ff, 0x604090, 0x202030],
  };

  class Scene {
    constructor(canvas) {
      this.canvas = canvas;
      this.views = {};
      this.texCache = {};
      this.hover = null;
      this.highlights = {};
      this.time = 0;
      this.shake = 0;
      this.onHover = null; this.onClick = null; this.onBackgroundClick = null;
      this.disabled = false;
      this.handOrder = [];
      this.oppHandCount = 0;
      this.selectedOffsets = {};
      this.lines = [];
      this._init();
    }

    _init() {
      const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.autoClear = false;
      renderer.setClearColor(0x05080c, 1);
      this.renderer = renderer;

      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.Fog(0x05080c, 24, 40);
      this.camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
      this.camBase = new THREE.Vector3(0, 13, 11.5);
      this.camera.position.copy(this.camBase);
      this.camera.lookAt(0, 0, 2.5);

      this.hudScene = new THREE.Scene();
      this.hudCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 1000);
      this.hudCamera.position.z = 500;

      // lights
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const key = new THREE.DirectionalLight(0xfff2dd, 0.9); key.position.set(4, 12, 6); this.scene.add(key);
      const rim = new THREE.PointLight(0x4ab8ff, 0.6, 40); rim.position.set(-8, 6, -6); this.scene.add(rim);
      const rim2 = new THREE.PointLight(0xff8a4a, 0.5, 40); rim2.position.set(8, 6, 6); this.scene.add(rim2);
      this.flash = new THREE.PointLight(0xffffff, 0, 30); this.flash.position.set(0, 4, 0); this.scene.add(this.flash);

      // Illustrated tabletop with a separately rendered, localizable gameplay guide.
      const tableTex = new THREE.TextureLoader().load('assets/table/arcane-table-surface.png');
      tableTex.encoding = THREE.sRGBEncoding; tableTex.anisotropy = 8;
      const table = new THREE.Mesh(new THREE.PlaneGeometry(36, 26), new THREE.MeshStandardMaterial({ map: tableTex, roughness: 0.96, metalness: 0.03 }));
      table.rotation.x = -Math.PI / 2; this.scene.add(table);
      this.table = table;
      const guideTex = new THREE.CanvasTexture(MTG.CardArt.renderTable());
      guideTex.encoding = THREE.sRGBEncoding; guideTex.anisotropy = 8;
      const tableGuide = new THREE.Mesh(new THREE.PlaneGeometry(26, 18), new THREE.MeshBasicMaterial({ map: guideTex, transparent: true, depthWrite: false }));
      tableGuide.rotation.x = -Math.PI / 2; tableGuide.position.y = 0.01; this.scene.add(tableGuide);
      this.tableGuide = tableGuide;
      MTG.i18n.onChange(() => this.relocalize());
      // dark surround
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: 0x03050a }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -0.05; this.scene.add(floor);
      // table edge glow
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(36.6, 26.6), new THREE.MeshBasicMaterial({ color: 0x1f5a66, transparent: true, opacity: 0.5 }));
      edge.rotation.x = -Math.PI / 2; edge.position.y = -0.02; this.scene.add(edge);
      // stars
      const starGeo = new THREE.BufferGeometry();
      const sp = new Float32Array(600 * 3);
      for (let i = 0; i < 600; i++) { sp[i * 3] = (Math.random() - 0.5) * 120; sp[i * 3 + 1] = -2 + Math.random() * 30; sp[i * 3 + 2] = -40 - Math.random() * 30; }
      starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      this.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9fd8ff, size: 0.25, transparent: true, opacity: 0.7 })));

      this.particles = new Particles(this.scene, 4000);
      this.geo = new THREE.PlaneGeometry(CARD_W, CARD_H);
      this.glowGeo = new THREE.PlaneGeometry(CARD_W * 1.32, CARD_H * 1.24);
      this.glowTex = Scene.glowTexture();
      this.backTex = new THREE.CanvasTexture(MTG.CardArt.renderBack());
      this.backTex.encoding = THREE.sRGBEncoding; this.backTex.anisotropy = 8;
      this.raycaster = new THREE.Raycaster();
      this.pointer = new THREE.Vector2(-2, -2);

      window.addEventListener('resize', () => this.resize());
      this.canvas.addEventListener('pointermove', (e) => this._pointer(e));
      this.canvas.addEventListener('pointerdown', (e) => this._click(e));
      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      this.resize();
      this.last = performance.now();
      const loop = (t) => { this._frame(t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }

    static glowTexture() {
      const c = document.createElement('canvas'); c.width = 256; c.height = 352;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 256, 352);
      ctx.shadowColor = '#fff'; ctx.shadowBlur = 28;
      ctx.fillStyle = '#fff';
      const r = 22, x = 30, y = 30, w = 196, h = 292;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); ctx.fill();
      }
      return new THREE.CanvasTexture(c);
    }
    makeArrow(from, to, color, arc, radius) {
      const mid = from.clone().lerp(to, 0.5); mid.y += arc;
      const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
      const group = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius || 0.07, 8, false), mat);
      tube.renderOrder = 998;
      const cone = new THREE.Mesh(new THREE.ConeGeometry((radius || 0.07) * 3.2, 0.55, 12), mat);
      const end = curve.getPoint(1), before = curve.getPoint(0.93);
      cone.position.copy(end);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(before).normalize());
      cone.renderOrder = 998;
      group.add(tube, cone);
      group.userData.pulse = true;
      return group;
    }
    resize() {
      const w = window.innerWidth, h = window.innerHeight;
      this.width = w; this.height = h;
      this.renderer.setSize(w, h, false);
      const aspect = w / h;
      this.camera.aspect = aspect;
      const base = 45 * Math.PI / 180;
      const hfovTan = Math.tan(base / 2) * (16 / 9);
      this.camera.fov = aspect >= 16 / 9 ? 45 : (2 * Math.atan(hfovTan / aspect)) * 180 / Math.PI;
      this.camera.updateProjectionMatrix();
      this.hudCamera.left = -w / 2; this.hudCamera.right = w / 2; this.hudCamera.top = h / 2; this.hudCamera.bottom = -h / 2;
      this.hudCamera.updateProjectionMatrix();
      if (this.game) this.layout(false);
    }

    // ------------------------------------------------------------- textures
    textureFor(card) {
      const g = this.game;
      let key = MTG.i18n.lang + ':' + card.def.id;
      let state = null;
      if (card.def.type === 'creature' && card.zone === 'battlefield') {
        const p = g.getPower(card), t = g.getToughness(card);
        if (p !== card.def.power || t !== card.def.toughness || card.damage) {
          state = { power: p, toughness: t, damage: card.damage };
          key += `|${p}/${t}|${card.damage}`;
        }
      }
      let tex = this.texCache[key];
      if (!tex) {
        const canvas = MTG.CardArt.renderCard(card.def, state);
        tex = new THREE.CanvasTexture(canvas);
        tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
        tex.userData.canvas = canvas;
        this.texCache[key] = tex;
      }
      return tex;
    }
    /** Language changed: re-render table labels, card back and every card face. */
    relocalize() {
      const tex = new THREE.CanvasTexture(MTG.CardArt.renderTable());
      tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
      this.tableGuide.material.map.dispose(); this.tableGuide.material.map = tex; this.tableGuide.material.needsUpdate = true;
      const back = new THREE.CanvasTexture(MTG.CardArt.renderBack());
      back.encoding = THREE.sRGBEncoding; back.anisotropy = 8;
      this.backTex.image = back.image; this.backTex.needsUpdate = true;
      for (const id of Object.keys(this.views)) this.refreshCard(Number(id));
    }
    cardImageURL(card) {
      const tex = this.textureFor(card);
      if (!tex.userData.url) tex.userData.url = tex.userData.canvas.toDataURL('image/png');
      return tex.userData.url;
    }

    // ---------------------------------------------------------------- views
    createView(card) {
      const group = new THREE.Group();
      const frontMat = new THREE.MeshBasicMaterial({ map: this.textureFor(card), transparent: true });
      const front = new THREE.Mesh(this.geo, frontMat); front.position.z = 0.004;
      const backMat = new THREE.MeshBasicMaterial({ map: this.backTex, transparent: true });
      const back = new THREE.Mesh(this.geo, backMat); back.rotation.y = Math.PI; back.position.z = -0.004;
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: this.glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const glow = new THREE.Mesh(this.glowGeo, glowMat); glow.position.z = -0.01;
      const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
      const shadow = new THREE.Mesh(this.geo, shadowMat); shadow.position.z = -0.02; shadow.position.x = 0.05; shadow.position.y = -0.05; shadow.scale.set(1.04, 1.03, 1);
      group.add(shadow, glow, back, front);
      front.userData.viewId = card.id; back.userData.viewId = card.id;
      const view = { id: card.id, card, group, front, back, glow, shadow, layer: null, busy: false, _opacity: 1 };
      Object.defineProperty(view, 'opacity', {
        get() { return this._opacity; },
        set(o) { this._opacity = o; front.material.opacity = o; back.material.opacity = o; shadow.material.opacity = 0.35 * o; },
      });
      this.views[card.id] = view;
      this.setLayer(view, 'world');
      group.visible = false;
      return view;
    }
    setLayer(view, layer) {
      if (view.layer === layer) return;
      if (view.layer === 'world') this.scene.remove(view.group);
      if (view.layer === 'hud') this.hudScene.remove(view.group);
      view.layer = layer;
      (layer === 'world' ? this.scene : this.hudScene).add(view.group);
      view.shadow.visible = layer === 'world';
      view.glow.position.z = layer === 'hud' ? -1.5 : -0.01;
    }
    refreshCard(id) {
      const v = this.views[id]; if (!v) return;
      const tex = this.textureFor(v.card);
      if (v.front.material.map !== tex) { v.front.material.map = tex; v.front.material.needsUpdate = true; }
    }
    setOpacity(view, o) { view.opacity = o; }
    view(id) { return this.views[id]; }

    setGame(game, humanIdx) {
      this.game = game; this.human = humanIdx;
      for (const id of Object.keys(game.cards)) this.createView(game.cards[id]);
      this.layout(false);
    }

    // --------------------------------------------------------------- layout
    rowX(i, n) {
      const maxW = 13.8;
      let step = CARD_W * WORLD_SCALE + 0.22;
      if (n * step > maxW) step = maxW / n;
      return (i - (n - 1) / 2) * step;
    }
    worldTarget(card) {
      const g = this.game, mine = card.controller === this.human;
      const pl = g.players[card.controller];
      if (card.zone === 'battlefield') {
        const isLand = card.def.type === 'land';
        const row = pl.battlefield.filter((c) => (c.def.type === 'land') === isLand);
        const i = row.indexOf(card), n = row.length;
        const z = mine ? (isLand ? ROW.myLands : ROW.myCreatures) : (isLand ? ROW.oppLands : ROW.oppCreatures);
        const off = this.selectedOffsets[card.id] || 0;
        const attackShift = card.attacking ? (mine ? -1.0 : 1.0) : 0;
        let x = this.rowX(i, n), zz = z + attackShift - (mine ? off : -off);
        if (card.blocking) {
          const a = g.cardById(card.blocking);
          const at = a ? this.worldTarget(a) : null;
          if (at) { x = at.pos.x; zz = at.pos.z + (mine ? 1.25 : -1.25); }
        }
        return { pos: new THREE.Vector3(x, 0.02 + i * 0.008 + (card.attacking || card.blocking ? 0.15 : 0), zz), rot: new THREE.Euler(-Math.PI / 2, 0, card.tapped ? (mine ? -Math.PI / 2 : Math.PI / 2) : 0), scale: WORLD_SCALE };
      }
      if (card.zone === 'library') {
        const owner = g.players[card.owner];
        const i = owner.library.indexOf(card);
        const p = card.owner === this.human ? LIB.my : LIB.opp;
        return { pos: new THREE.Vector3(p[0], 0.02 + i * 0.012, p[1]), rot: new THREE.Euler(Math.PI / 2, 0, 0), scale: WORLD_SCALE };
      }
      if (card.zone === 'graveyard') {
        const owner = g.players[card.owner];
        const i = owner.graveyard.indexOf(card);
        const p = card.owner === this.human ? LIB.myGy : LIB.oppGy;
        return { pos: new THREE.Vector3(p[0], 0.02 + i * 0.012, p[1]), rot: new THREE.Euler(-Math.PI / 2, 0, (i % 2) * 0.06), scale: WORLD_SCALE };
      }
      if (card.zone === 'stack') {
        const i = g.stack.findIndex((s) => s.card === card);
        return { pos: new THREE.Vector3(-5.2 + 0.5 * i, 2.0 + i * 0.35, 0.2 - i * 0.2), rot: new THREE.Euler(-0.62, 0, 0), scale: WORLD_SCALE * 1.25 };
      }
      return null;
    }
    handLayout() {
      const g = this.game, w = this.width, h = this.height;
      const hand = g.players[this.human].hand;
      const n = hand.length;
      const cardH = Math.min(h * 0.31, w * 0.17 * CARD_RATIO), cardW = cardH / CARD_RATIO;
      const maxTotal = Math.min(w * 0.64, n * cardW * 0.95);
      const step = n > 1 ? Math.min(cardW * 0.95, (maxTotal - cardW) / (n - 1)) : 0;
      const total = step * (n - 1) + cardW;
      const baseY = -h / 2 + cardH * 0.36;
      const out = {};
      hand.forEach((c, i) => {
        const t = n > 1 ? (i - (n - 1) / 2) / ((n - 1) / 2) : 0;
        const lift = this.selectedOffsets[c.id] ? 60 : 0;
        out[c.id] = { x: -total / 2 + cardW / 2 + i * step, y: baseY - Math.abs(t) * cardH * 0.06 + lift, rot: -t * 0.10, scale: cardH / CARD_H, z: i };
      });
      if (this.hover && out[this.hover]) {
        const o = out[this.hover]; const bigH = Math.min(h * 0.62, w * 0.36 * CARD_RATIO);
        o.scale = bigH / CARD_H; o.y = -h / 2 + bigH / 2 + 8; o.rot = 0; o.z = 200;
        o.x = Math.max(-w / 2 + bigH / CARD_RATIO / 2 + 10, Math.min(w / 2 - bigH / CARD_RATIO / 2 - 10, o.x));
      }
      return out;
    }
    oppHandLayout() {
      const g = this.game, w = this.width, h = this.height;
      const hand = g.players[1 - this.human].hand;
      const n = hand.length;
      const cardH = h * 0.10, cardW = cardH / CARD_RATIO;
      const step = Math.min(cardW * 0.45, (w * 0.22) / Math.max(1, n));
      const total = step * (n - 1) + cardW;
      const out = {};
      hand.forEach((c, i) => {
        out[c.id] = { x: -total / 2 + cardW / 2 + i * step, y: h / 2 - 50 - cardH * 0.12, rot: (i - (n - 1) / 2) * 0.05, scale: cardH / CARD_H, z: i, back: true };
      });
      return out;
    }
    layout(animate, only) {
      const g = this.game; if (!g) return Promise.resolve();
      const ps = [];
      const ms = animate ? 380 : 0;
      const hl = this.handLayout(), ohl = this.oppHandLayout();
      for (const id of Object.keys(this.views)) {
        const v = this.views[id]; const c = v.card;
        if (only && !only.includes(c.id)) continue;
        if (v.busy) continue;
        if (c.zone === 'hand') {
          const t = c.controller === this.human ? hl[c.id] : ohl[c.id];
          if (!t) continue;
          this.setLayer(v, 'hud'); v.group.visible = true;
          const ry = t.back ? Math.PI : 0;
          if (ms) {
            ps.push(tween(v.group.position, { x: t.x, y: t.y, z: t.z }, ms));
            ps.push(tween(v.group.rotation, { x: 0, y: ry, z: t.rot }, ms));
            ps.push(tween(v.group.scale, { x: t.scale, y: t.scale, z: 1 }, ms));
          } else {
            v.group.position.set(t.x, t.y, t.z); v.group.rotation.set(0, ry, t.rot); v.group.scale.set(t.scale, t.scale, 1);
          }
        } else {
          const t = this.worldTarget(c);
          if (!t) { v.group.visible = false; continue; }
          this.setLayer(v, 'world'); v.group.visible = true;
          const lift = (this.hover === c.id && c.zone === 'battlefield') ? 0.35 : 0;
          if (ms) {
            ps.push(tween(v.group.position, { x: t.pos.x, y: t.pos.y + lift, z: t.pos.z }, ms));
            ps.push(tween(v.group.rotation, { x: t.rot.x, y: t.rot.y, z: t.rot.z }, ms));
            ps.push(tween(v.group.scale, { x: t.scale, y: t.scale, z: 1 }, ms));
          } else {
            v.group.position.set(t.pos.x, t.pos.y + lift, t.pos.z); v.group.rotation.copy(t.rot); v.group.scale.set(t.scale, t.scale, 1);
          }
        }
      }
      return Promise.all(ps);
    }

    // ------------------------------------------------------------ highlights
    setHighlights(map) { this.highlights = map || {}; }
    setSelectedOffsets(map) { this.selectedOffsets = map || {}; this.layout(true); }

    // ------------------------------------------------------------- helpers
    worldPos(id) { const v = this.views[id]; const p = new THREE.Vector3(); v.group.getWorldPosition(p); return p; }
    toScreen(v3) {
      const p = v3.clone().project(this.camera);
      return { x: (p.x + 1) / 2 * this.width, y: (1 - p.y) / 2 * this.height };
    }
    hudToScreen(view) { return { x: view.group.position.x + this.width / 2, y: this.height / 2 - view.group.position.y }; }
    screenPosOf(id) {
      const v = this.views[id];
      if (v.layer === 'hud') return this.hudToScreen(v);
      return this.toScreen(this.worldPos(id));
    }
    playerFxPos(idx) { return new THREE.Vector3(0, 1.2, idx === this.human ? 6.3 : -6.6); }
    targetFxPos(t) {
      if (t.kind === 'player') return this.playerFxPos(t.idx);
      if (t.kind === 'card') { const v = this.views[t.id]; if (v && v.layer === 'world') return this.worldPos(t.id).add(new THREE.Vector3(0, 0.3, 0)); }
      if (t.kind === 'stack') { const it = this.game.stack.find((s) => s.id === t.id); if (it) return this.worldPos(it.card.id); }
      return new THREE.Vector3(0, 1, 0);
    }
    floatText(pos3, text, cls) {
      const s = pos3.isVector3 ? this.toScreen(pos3) : pos3;
      const el = document.createElement('div');
      el.className = 'floater ' + (cls || '');
      el.textContent = text;
      el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
      document.getElementById('fx-layer').appendChild(el);
      setTimeout(() => el.remove(), 1500);
    }
    flashLight(pos, color, intensity) {
      this.flash.position.copy(pos).add(new THREE.Vector3(0, 2.5, 0));
      this.flash.color.set(color);
      this.flash.intensity = intensity || 4;
      tween(this.flash, { intensity: 0 }, 450, 'outQuad');
    }
    cameraShake(amount) { this.shake = Math.max(this.shake, amount); }

    // -------------------------------------------------------------- effects
    burst(pos, color, opts) {
      const cols = FX_COLORS[color] || FX_COLORS.W;
      this.particles.spawn(pos, Object.assign({ count: 90, colors: cols, speed: 4, life: 0.9, size: 0.45, gravity: -3 }, opts || {}));
    }
    lightning(from, to, color) {
      const col = new THREE.Color(color || 0xffe27a);
      const mats = [
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthTest: false }),
        new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthTest: false }),
      ];
      const lines = [];
      const make = () => {
        for (const l of lines) this.scene.remove(l);
        lines.length = 0;
        for (let k = 0; k < 4; k++) {
          const pts = [];
          const segs = 14;
          for (let i = 0; i <= segs; i++) {
            const t = i / segs;
            const p = from.clone().lerp(to, t);
            const j = (i === 0 || i === segs) ? 0 : (0.35 + k * 0.1);
            p.x += (Math.random() - 0.5) * j; p.y += (Math.random() - 0.5) * j + Math.sin(t * Math.PI) * 1.2; p.z += (Math.random() - 0.5) * j;
            pts.push(p);
          }
          const geo = new THREE.BufferGeometry().setFromPoints(pts);
          const line = new THREE.Line(geo, mats[k === 0 ? 0 : 1]);
          line.renderOrder = 999;
          this.scene.add(line); lines.push(line);
        }
      };
      let n = 0;
      const iv = setInterval(() => { make(); if (++n > 6) { clearInterval(iv); for (const l of lines) this.scene.remove(l); } }, 55);
      make();
      this.flashLight(to, col, 6);
    }
    spellFx(color, kind, from, to) {
      // returns promise when the visual "hit" happened
      const cols = FX_COLORS[color] || FX_COLORS.W;
      if (color === 'R') {
        this.lightning(from, to, 0xffb02a);
        this.burst(to, 'R', { count: 140, speed: 5, size: 0.5, gravity: -2 });
        this.cameraShake(0.12);
        MTG.Sfx && MTG.Sfx.play('zap');
        return wait(350);
      }
      if (color === 'G') {
        this.particles.spawn(to, { count: 120, colors: cols, speed: 2.5, life: 1.2, size: 0.45, gravity: 1.5, dir: new THREE.Vector3(0, 1, 0), spread: 0.8 });
        this.flashLight(to, 0x7dff8a, 3);
        MTG.Sfx && MTG.Sfx.play('grow');
        return wait(350);
      }
      if (color === 'U') {
        this.particles.spawn(to, { count: 140, colors: cols, speed: 4, life: 1.0, size: 0.4, gravity: 0.5, ring: true, drag: 0.94 });
        this.particles.spawn(to, { count: 60, colors: cols, speed: 2, life: 1.2, size: 0.5, gravity: 2, dir: new THREE.Vector3(0, 1, 0), spread: 0.4 });
        this.flashLight(to, 0x6cc6ff, 3);
        MTG.Sfx && MTG.Sfx.play('swirl');
        return wait(350);
      }
      // white
      this.particles.spawn(to, { count: 160, colors: cols, speed: 5, life: 0.9, size: 0.5, gravity: -1, drag: 0.93 });
      this.flashLight(to, 0xfff2a8, 6);
      MTG.Sfx && MTG.Sfx.play('holy');
      return wait(350);
    }

    // ------------------------------------------------------------ animations
    async animDraw(id, player, fast) {
      const v = this.views[id]; const c = v.card;
      v.busy = true;
      const k = fast ? 0.45 : 1;
      const mine = player === this.human;
      // fly up from the library toward the camera then drop into the hand overlay
      const lib = mine ? LIB.my : LIB.opp;
      this.setLayer(v, 'world'); v.group.visible = true;
      v.group.position.set(lib[0], 0.6, lib[1]); v.group.rotation.set(Math.PI / 2, 0, 0); v.group.scale.set(WORLD_SCALE, WORLD_SCALE, 1);
      MTG.Sfx && MTG.Sfx.play('draw');
      await Promise.all([
        tween(v.group.position, { x: lib[0] * 0.5, y: 3.5, z: mine ? 7 : -6 }, 260 * k, 'outQuad'),
        tween(v.group.rotation, { x: mine ? -0.5 : Math.PI / 2, y: 0, z: 0 }, 260 * k, 'outQuad'),
      ]);
      v.busy = false;
      // now place into hand via layout (hud)
      const target = (mine ? this.handLayout() : this.oppHandLayout())[c.id];
      this.setLayer(v, 'hud');
      const sx = mine ? this.width * 0.36 : -this.width * 0.3, sy = mine ? -this.height * 0.2 : this.height * 0.55;
      v.group.position.set(sx, sy, 300); v.group.rotation.set(0, mine ? 0 : Math.PI, 0); v.group.scale.set(target.scale * 0.6, target.scale * 0.6, 1);
      if (fast) { this.layout(true); await wait(120); } else await this.layout(true);
    }
    async animCast(id, player, targets) {
      const v = this.views[id]; const c = v.card;
      const mine = player === this.human;
      v.busy = true;
      // hud -> world stack position
      const t = this.worldTarget(c);
      this.setLayer(v, 'world'); v.group.visible = true;
      const startZ = mine ? 8.5 : -7.5;
      v.group.position.set(mine ? 0 : -3, 3.2, startZ); v.group.rotation.set(mine ? -0.62 : Math.PI / 2, mine ? 0 : Math.PI, 0); v.group.scale.set(t.scale, t.scale, 1);
      MTG.Sfx && MTG.Sfx.play('cast');
      await Promise.all([
        tween(v.group.position, { x: t.pos.x, y: t.pos.y + 1.2, z: t.pos.z }, 520, 'outBack'),
        tween(v.group.rotation, { x: t.rot.x, y: 0, z: 0 }, 520, 'outCubic'),
        tween(v.group.scale, { x: t.scale, y: t.scale, z: 1 }, 520, 'outCubic'),
      ]);
      await tween(v.group.position, { y: t.pos.y }, 250, 'outCubic');
      const col = c.def.color;
      this.burst(t.pos, col, { count: 50, speed: 2, size: 0.3, gravity: 0, life: 0.7 });
      this.flashLight(t.pos, (FX_COLORS[col] || FX_COLORS.W)[0], 2.5);
      v.busy = false;
      this.updateTargetLines();
    }
    updateTargetLines() {
      for (const l of this.lines) this.scene.remove(l);
      this.lines = [];
      const g = this.game; if (!g) return;
      for (const it of g.stack) {
        if (!it.targets || !it.targets.length) continue;
        const from = this.worldPos(it.card.id);
        for (const t of it.targets) {
          const to = this.targetFxPos(t).add(new THREE.Vector3(0, 0.25, 0));
          const arrow = this.makeArrow(from, to, 0xff4a4a, 1.6, 0.07);
          this.scene.add(arrow); this.lines.push(arrow);
        }
      }
    }
    blockLines(pairs) {
      for (const l of this.blockLineObjs || []) this.scene.remove(l);
      this.blockLineObjs = [];
      for (const pr of pairs) {
        const from = this.worldPos(pr.blocker), to = this.worldPos(pr.attacker);
        from.y = 0.4; to.y = 0.4;
        const arrow = this.makeArrow(from, to, 0x4aa8ff, 0.9, 0.06);
        this.scene.add(arrow); this.blockLineObjs.push(arrow);
      }
    }
    clearBlockLines() { for (const l of this.blockLineObjs || []) this.scene.remove(l); this.blockLineObjs = []; }

    async animResolveCreature(id) {
      const v = this.views[id];
      const from = this.worldPos(id);
      this.burst(from, v.card.def.color, { count: 60, speed: 3, size: 0.35 });
      MTG.Sfx && MTG.Sfx.play('enter');
      this.updateTargetLines();
      await this.layout(true);
      const p = this.worldPos(id);
      this.particles.spawn(p, { count: 50, colors: FX_COLORS[v.card.def.color] || FX_COLORS.W, speed: 2, life: 0.8, size: 0.35, ring: true, gravity: 0, drag: 0.92 });
    }
    async animSpellHit(id, targets) {
      const v = this.views[id]; const c = v.card;
      const from = this.worldPos(id);
      const col = c.def.color;
      this.updateTargetLines();
      if (!targets || !targets.length) {
        await this.spellFx(col, c.def.effect.kind, from, from.clone().add(new THREE.Vector3(0, 0.5, 0)));
        return;
      }
      const ps = targets.map((t) => this.spellFx(col, c.def.effect.kind, from, this.targetFxPos(t)));
      await Promise.all(ps);
    }
    async animToGraveyard(id) {
      const v = this.views[id];
      v.busy = false;
      await this.layout(true, [id]);
      this.updateTargetLines();
    }
    async animDeath(id) {
      const v = this.views[id]; const c = v.card;
      v.busy = true;
      const p = this.worldPos(id);
      this.particles.spawn(p, { count: 80, colors: [0x333333, 0x666666, 0x1a1a1a, 0xff6a2a], speed: 1.5, life: 1.3, size: 0.6, gravity: 1.2, dir: new THREE.Vector3(0, 1, 0), spread: 0.7, drag: 0.95 });
      MTG.Sfx && MTG.Sfx.play('death');
      await Promise.all([
        tween(v, { opacity: 0 }, 420, 'inQuad'),
        tween(v.group.position, { y: p.y + 0.8 }, 420, 'outQuad'),
        tween(v.group.scale, { x: WORLD_SCALE * 0.7, y: WORLD_SCALE * 0.7 }, 420, 'inQuad'),
      ]);
      v.busy = false;
      const t = this.worldTarget(c);
      if (t) { v.group.position.copy(t.pos); v.group.rotation.copy(t.rot); v.group.scale.set(t.scale, t.scale, 1); }
      this.setOpacity(v, 1);
      this.layout(false, [id]);
    }
    async animBounce(id) {
      const v = this.views[id]; const p = this.worldPos(id);
      this.particles.spawn(p, { count: 90, colors: FX_COLORS.U, speed: 3, life: 1, size: 0.45, ring: true, gravity: 0.5, drag: 0.93 });
      await tween(v.group.position, { y: p.y + 2.5 }, 350, 'outQuad');
    }
    async animPump(id, power, toughness) {
      const v = this.views[id]; const p = this.worldPos(id);
      this.refreshCard(id);
      this.floatText(p, `+${power}/+${toughness}`, 'pump');
      const s = v.group.scale.x;
      await tween(v.group.scale, { x: s * 1.25, y: s * 1.25 }, 180, 'outBack');
      await tween(v.group.scale, { x: s, y: s }, 240, 'outCubic');
    }
    async animCountered(id) {
      const v = this.views[id]; const p = this.worldPos(id);
      this.particles.spawn(p, { count: 150, colors: FX_COLORS.U, speed: 5, life: 1, size: 0.4, gravity: -2 });
      this.flashLight(p, 0x6cc6ff, 5);
      MTG.Sfx && MTG.Sfx.play('counter');
      this.floatText(p, MTG.t('fx.countered'), 'counter');
      await tween(v.group.scale, { x: 0.01, y: 0.01 }, 350, 'inQuad');
      this.updateTargetLines();
    }
    async animTap(ids) {
      MTG.Sfx && MTG.Sfx.play('tap');
      await this.layout(true, ids);
    }
    async animUntap(ids) { await this.layout(true, ids); }
    async animAttackers(ids) {
      MTG.Sfx && MTG.Sfx.play('attack');
      await this.layout(true);
      for (const id of ids) {
        const p = this.worldPos(id);
        this.particles.spawn(p, { count: 30, colors: FX_COLORS.R, speed: 2, life: 0.6, size: 0.3, ring: true, gravity: 0 });
      }
    }
    async animBlockers(pairs) {
      await this.layout(true);
      this.blockLines(pairs);
      if (pairs.length) MTG.Sfx && MTG.Sfx.play('block');
    }
    async animCombatDamage(events, game) {
      // group by source: lunge each attacker/blocker and show numbers
      const bySource = {};
      for (const e of events) (bySource[e.source] || (bySource[e.source] = [])).push(e);
      const lunges = [];
      for (const sid of Object.keys(bySource)) {
        const v = this.views[sid]; if (!v || v.layer !== 'world') continue;
        const c = v.card;
        const mine = c.controller === this.human;
        const dz = (c.attacking ? (mine ? -1 : 1) : (mine ? -1 : 1)) * 0.9;
        const p0 = v.group.position.clone();
        lunges.push((async () => {
          await tween(v.group.position, { z: p0.z + dz, y: p0.y + 0.3 }, 140, 'inQuad');
          await tween(v.group.position, { z: p0.z, y: p0.y }, 300, 'outCubic');
        })());
      }
      await wait(140);
      MTG.Sfx && MTG.Sfx.play('hit');
      let shake = 0;
      for (const e of events) {
        const src = game.cardById(e.source);
        const col = src ? src.def.color : 'R';
        const pos = this.targetFxPos(e.target);
        this.burst(pos, col, { count: 40, speed: 3, size: 0.35, life: 0.7 });
        if (e.target.kind === 'player') {
          this.floatText(pos, '-' + e.amount, 'dmg big');
          shake = Math.max(shake, 0.15 + e.amount * 0.02);
          if (this.onPlayerHit) this.onPlayerHit(e.target.idx, e.amount);
        } else {
          this.floatText(pos, '-' + e.amount, 'dmg');
          this.refreshCard(e.target.id);
        }
      }
      if (shake) this.cameraShake(shake);
      await Promise.all(lunges);
    }
    async animCombatEnd() {
      this.clearBlockLines();
      await this.layout(true);
    }
    async animDamageSpell(sourceId, target, amount) {
      const pos = this.targetFxPos(target);
      this.floatText(pos, '-' + amount, target.kind === 'player' ? 'dmg big' : 'dmg');
      if (target.kind === 'player') { this.cameraShake(0.2); if (this.onPlayerHit) this.onPlayerHit(target.idx, amount); }
      else this.refreshCard(target.id);
    }
    async animLife(player, delta) {
      if (delta > 0) {
        const pos = this.playerFxPos(player);
        this.particles.spawn(pos, { count: 60, colors: FX_COLORS.W, speed: 2, life: 1, size: 0.4, gravity: 1.5, dir: new THREE.Vector3(0, 1, 0), spread: 0.6 });
        this.floatText(pos, '+' + delta, 'heal big');
        MTG.Sfx && MTG.Sfx.play('heal');
      }
    }
    async animDiscard(id) {
      const v = this.views[id];
      await this.layout(true, [id]);
    }

    // --------------------------------------------------------------- picking
    _pointer(e) {
      const r = this.canvas.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.pointerPx = { x: e.clientX, y: e.clientY };
    }
    // Hand hit-test uses the un-enlarged layout so a hovered (enlarged) card never hides its neighbours.
    pickHand() {
      if (!this.game || !this.pointerPx) return null;
      const saved = this.hover; this.hover = null;
      const hl = this.handLayout(); this.hover = saved;
      const x = this.pointerPx.x - this.width / 2, y = this.height / 2 - this.pointerPx.y;
      const hand = this.game.players[this.human].hand;
      let bandTop = -Infinity;
      for (let i = hand.length - 1; i >= 0; i--) {
        const t = hl[hand[i].id]; if (!t) continue;
        const w = t.scale, h = t.scale * CARD_RATIO;
        bandTop = Math.max(bandTop, t.y + h / 2);
        if (Math.abs(x - t.x) <= w / 2 && Math.abs(y - t.y) <= h / 2) return hand[i].id;
      }
      // pointer above the hand band but still over the enlarged hovered card -> keep it
      if (saved && hl[saved]) {
        const v = this.views[saved];
        if (v && v.layer === 'hud' && y > bandTop) {
          const w = v.group.scale.x, h = v.group.scale.y * CARD_RATIO;
          if (Math.abs(x - v.group.position.x) <= w / 2 && Math.abs(y - v.group.position.y) <= h / 2) return saved;
        }
      }
      return null;
    }
    pick() {
      if (this.disabled) return null;
      const hh = this.pickHand();
      if (hh) return hh;
      if (!this.game) return null;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      let hits = this.raycaster.intersectObjects(this.scene.children, true).filter((h) => h.object.userData.viewId && h.object.visible);
      if (hits.length) {
        // only battlefield / stack / top of graveyard
        for (const h of hits) {
          const c = this.game.cards[h.object.userData.viewId];
          if (c.zone === 'battlefield' || c.zone === 'stack') return c.id;
          if (c.zone === 'graveyard') {
            const gy = this.game.players[c.owner].graveyard; if (gy[gy.length - 1] === c) return c.id;
          }
        }
      }
      return null;
    }
    _click(e) {
      if (this.disabled) return;
      const id = this.pick();
      if (id) { if (this.onClick) this.onClick(id, e.button); }
      else if (this.onBackgroundClick) this.onBackgroundClick(e.button);
    }

    // ----------------------------------------------------------------- frame
    _frame(t) {
      const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
      this.time += dt;
      updateTweens(dt * 1000);
      this.particles.update(dt);
      // hover
      const id = this.pick();
      if (id !== this.hover) {
        const prev = this.hover; this.hover = id;
        if (this.game) {
          const ids = [prev, id].filter(Boolean);
          this.layout(true, ids);
        }
        if (this.onHover) this.onHover(id);
      }
      // glows
      const pulse = 0.65 + 0.35 * Math.sin(this.time * 6);
      for (const id of Object.keys(this.views)) {
        const v = this.views[id];
        let style = this.highlights[id];
        if (this.hover === Number(id) && !style) style = 'hover';
        if (style && GLOW_COLORS[style] !== undefined) {
          v.glow.material.color.set(GLOW_COLORS[style]);
          const strong = style === 'target' || style === 'targetable' || style === 'selected' || style === 'chosen';
          v.glow.material.opacity = style === 'hover' ? 0.35 : (strong ? 0.5 + 0.4 * pulse : 0.45 + 0.25 * pulse);
        } else v.glow.material.opacity = 0;
      }
      for (const a of [...this.lines, ...(this.blockLineObjs || [])]) {
        if (a.children) for (const m of a.children) m.material.opacity = 0.7 + 0.3 * Math.sin(this.time * 7);
      }
      // camera shake
      if (this.shake > 0.001) {
        this.camera.position.set(this.camBase.x + (Math.random() - 0.5) * this.shake, this.camBase.y + (Math.random() - 0.5) * this.shake, this.camBase.z + (Math.random() - 0.5) * this.shake);
        this.shake *= 0.86;
      } else this.camera.position.copy(this.camBase);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      this.renderer.clearDepth();
      this.renderer.render(this.hudScene, this.hudCamera);
    }
  }

  MTG.Scene = Scene;
  MTG.tween = tween;
  MTG.wait = wait;
})(typeof window !== 'undefined' ? window : globalThis);
