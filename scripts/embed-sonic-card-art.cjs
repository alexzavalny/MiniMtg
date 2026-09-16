/* Embed the Sonic-deck JPEGs so cards still render from file://. */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ids = [
  'green_hill_zone', 'chemical_plant_zone',
  'sonic_the_hedgehog', 'miles_tails_prower', 'knuckles_the_echidna', 'amy_rose',
  'shadow_the_hedgehog', 'rouge_the_bat', 'cream_and_cheese', 'blaze_the_cat',
  'silver_the_hedgehog', 'vector_the_crocodile', 'espio_the_chameleon', 'charmy_bee',
  'big_the_cat', 'doctor_eggman', 'power_sneakers', 'shield_monitor', 'chaos_emerald',
  'ring_cache', 'warp_ring',
];
const art = Object.fromEntries(ids.map((id) => [id, `data:image/jpeg;base64,${fs.readFileSync(path.join(root, 'assets', 'card-art', `${id}.jpg`)).toString('base64')}`]));
const source = `/* Generated from assets/card-art/{${ids.join(',')}}.jpg. */\n(function (root) {\n  const MTG = root.MTG || (root.MTG = {});\n  Object.assign(MTG.ART_DATA || (MTG.ART_DATA = {}), ${JSON.stringify(art)});\n})(typeof window !== 'undefined' ? window : globalThis);\n`;
fs.writeFileSync(path.join(root, 'assets', 'sonic-card-art-data.js'), source);
