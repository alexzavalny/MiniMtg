/* Rasterize the browser game's real CardArt canvas for print PDFs. */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'tmp', 'pdfs', 'game-cards');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'load' });
  await page.waitForFunction(() => window.MTG && MTG.CardArt && MTG.DEFS);
  await page.evaluate(async () => {
    MTG.i18n.lang = 'ru';
    await MTG.CardArt.preloadArt();
  });
  const entries = await page.evaluate(() => Object.keys(MTG.DEFS).map((id) => {
    const card = MTG.CardArt.renderCard(MTG.DEFS[id]);
    return [id, card.toDataURL('image/png')];
  }));
  for (const [id, uri] of entries) {
    fs.writeFileSync(path.join(output, `${id}.png`), Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64'));
  }
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
