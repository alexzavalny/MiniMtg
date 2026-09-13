# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Magic: The Gathering–style teaching game (Russian UI) vs. a computer opponent. Plain HTML/CSS/JS + Three.js, no build step, no backend, no npm. Not a product — built to teach a kid MTG, so rules fidelity and visual clarity matter more than polish elsewhere.

## Commands

- Run: open `index.html` in a browser. Works from `file://` — all scripts are classic `<script>` tags (no ES modules, no fetch), Three.js is vendored at `lib/three.min.js` (r149 UMD, last UMD build — do not upgrade to an ESM-only version).
- Headless rules test: `node test/sim.js 300` — AI vs AI games, throws on engine crash or stuck loop (>5000 phase changes). `node test/sim.js 3 v` prints the Russian game log for one seed.
- Deck balance matrix: `node test/matchup.js` (win % of row deck as player 0 vs column deck).
- No linter, no bundler, no unit-test framework.

## Architecture

Everything lives on the global `window.MTG` namespace; script load order in `index.html` matters (`i18n → cards → card-art-data → engine → ai → cardart → sfx → scene → ui → main`).

**Localization (ru/en, instant switch):** `js/i18n.js` holds every UI string as `key: {ru, en}`; `MTG.t(key, params)` formats, `MTG.txt(obj)` resolves a `{ru,en}` object. Card data in `cards.js` uses `L('ру', 'en')` literals for name/subtype/text/flavor/deck names. Never bake a translated string into state: the engine logs `{key, params}` (params may be `{ru,en}` objects or arrays of names, quoted per language), `ui.setHint/setButtons` take keys and re-render from stored state in `ui.relocalize()`, static HTML uses `data-i18n` / `data-i18n-html` / `data-i18n-title`, and `scene.relocalize()` re-renders table/back/card textures (texture cache key is prefixed with the language). Card art PNGs are embedded as data URIs in `assets/card-art-data.js` because a `file://` `<img>` taints the canvas and WebGL rejects the texture.

**Headless core (runs in node):** `js/cards.js`, `js/engine.js`, `js/ai.js`. These must never touch DOM/THREE — `test/sim.js` depends on it.

- `engine.js` `Game` is an **async state machine**: `start()` runs the whole game; every visible change is `await this.emit(evt, data)` and listeners may return promises (the renderer's animations), so the engine waits for visuals. Player input goes through `choose(pIdx, request)`: for the AI it calls `opts.ai(game, p, request)` synchronously; for the human it emits `awaiting` and blocks on a promise resolved by `game.submit(response)`.
- Request/response shapes: `priority` → `{action:'pass'|'land'|'cast'|'tap', cardId, targets}`; `attackers` → `{attackers:[ids]}`; `blockers` → `{blocks:{blockerId: attackerId}}`; `discard` → `{cards:[ids]}`.
- Targets are `{kind:'card'|'player'|'stack', id|idx}`; target specs on card defs are strings (`any`, `creature`, `ownCreature`, `oppCreature`, `player`, `combatCreature`, `spell`) resolved by `validTargets`. Spells fizzle if all targets became illegal.
- Priority loop (`priorityRound`): two consecutive passes resolve the top of the stack or end the step. After a cast, priority goes to the opponent with `passes=1`, so one opposing pass resolves it. `shouldAutoPass` skips human prompts at steps where nothing is castable (unless `opts.fullControl`).
- Game over is signalled by throwing `GameOver` from `checkSBA`, caught in `start()`.
- Card effects are data (`effect.kind`: damage, pump, destroy, bounce, draw, counter, bite, gainLife, addMana, discardRandom) interpreted in `applyEffect`; ETB and upkeep triggers use `def.etb` / `def.upkeep` and go on the stack as `type:'trigger'` items. Adding a card = add a def in `cards.js` (+ deck list) and, if a new effect kind, a case in `applyEffect` plus AI handling in `ai.js`.
- `ai.js` returns one action per `priority` call (the engine re-asks until it passes). `decideAttackers` scores candidate attack sets by simulating the opponent's blocks via `decideBlockers`.

**Browser layer:** `js/scene.js` (Three.js), `js/cardart.js` (canvas card textures), `js/ui.js` (HTML HUD), `js/main.js` (glue + human input state machine).

- `main.js` `wire()` maps each engine event to an animation/UI update; `input.mode` (`priority | targeting | attackers | blockers | discard`) drives what card clicks do. `submit()` clears highlights and calls `game.submit`.
- `scene.js` keeps one `view` per card (`group` with front/back/glow/shadow meshes). Cards live in one of two layers: the perspective **world** scene (battlefield, library, graveyard, stack) or the orthographic **hud** scene in pixel units (both hands). `layout()` computes targets from live game state (`worldTarget` / `handLayout`) and tweens; `view.busy` opts a card out of layout during a custom animation. Hand hit-testing (`pickHand`) is analytic against the un-enlarged layout so the hovered enlarged card doesn't occlude neighbours.
- All durations pass through `MTG.speed` (tween ms and `wait`), set it <1 to speed up automated browser runs.
- Card textures are cached per language + `def.id` plus P/T/damage state key; `refreshCard(id)` swaps the texture after pumps/damage.
- Camera/table geometry: rows at fixed world z (`ROW`, `LIB` constants in `scene.js`, mirrored by labels drawn in `CardArt.renderTable`); camera fov is derived from aspect to keep horizontal extent constant. Change both if moving zones.
