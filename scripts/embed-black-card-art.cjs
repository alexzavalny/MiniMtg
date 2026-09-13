/* Embed the generated black-deck JPEGs so cards still render from file://. */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ids = ['swamp', 'carnophage', 'black_knight', 'hypnotic_specter', 'nekrataal', 'sengir_vampire', 'terror', 'dark_ritual'];
const art = Object.fromEntries(ids.map((id) => [id, `data:image/jpeg;base64,${fs.readFileSync(path.join(root, 'assets', 'card-art', `${id}.jpg`)).toString('base64')}`]));
const source = `/* Generated from assets/card-art/{${ids.join(',')}}.jpg. */\n(function (root) {\n  const MTG = root.MTG || (root.MTG = {});\n  Object.assign(MTG.ART_DATA || (MTG.ART_DATA = {}), ${JSON.stringify(art)});\n})(typeof window !== 'undefined' ? window : globalThis);\n`;
fs.writeFileSync(path.join(root, 'assets', 'black-card-art-data.js'), source);
