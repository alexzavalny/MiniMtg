/* Export the browser game's card definitions and embedded art for PDF assembly. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'tmp', 'pdfs', 'card-art');
fs.mkdirSync(out, { recursive: true });

const context = { globalThis: {}, console };
context.window = undefined;
vm.createContext(context);
for (const file of ['js/i18n.js', 'js/cards.js', 'assets/card-art-data.js', 'assets/black-card-art-data.js', 'assets/tide-card-art-data.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const MTG = context.globalThis.MTG;
const cards = {};
for (const [id, card] of Object.entries(MTG.DEFS)) {
  const uri = MTG.ART_DATA[id];
  let art = null;
  if (uri) {
    const [, mime, data] = uri.match(/^data:([^;]+);base64,(.+)$/) || [];
    if (mime && data) {
      const extension = mime === 'image/png' ? 'png' : 'jpg';
      const filename = `${id}.${extension}`;
      fs.writeFileSync(path.join(out, filename), Buffer.from(data, 'base64'));
      art = `tmp/pdfs/card-art/${filename}`;
    }
  }
  cards[id] = { ...card, art };
}
fs.writeFileSync(path.join(root, 'tmp', 'pdfs', 'card-data.json'), JSON.stringify({ cards, decks: MTG.DECKS }, null, 2));
