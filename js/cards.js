/* Card definitions and decks. Pure data, no DOM. Works in browser and node. */
(function (root) {
  'use strict';

  const KEYWORDS_RU = {
    flying: 'Полёт',
    haste: 'Ускорение',
    trample: 'Пробивной удар',
    vigilance: 'Бдительность',
    first_strike: 'Первый удар',
    lifelink: 'Цепь жизни',
    deathtouch: 'Смертельное касание',
    reach: 'Охват',
  };

  const KEYWORD_HELP_RU = {
    flying: 'Может быть заблокировано только существами с Полётом или Охватом.',
    haste: 'Может атаковать в тот же ход, когда вышло на поле.',
    trample: 'Лишний боевой урон сверх блокирующих идёт игроку.',
    vigilance: 'Не поворачивается при атаке.',
    first_strike: 'Наносит боевой урон раньше существ без первого удара.',
    lifelink: 'Урон от этого существа также прибавляет вам столько же жизней.',
    deathtouch: 'Любой урон от этого существа смертелен для существ.',
    reach: 'Может блокировать существ с Полётом.',
  };

  const COLOR_NAMES_RU = { W: 'Белый', U: 'Синий', B: 'Чёрный', R: 'Красный', G: 'Зелёный' };
  const TYPE_NAMES_RU = {
    land: 'Земля',
    creature: 'Существо',
    instant: 'Мгновенное заклинание',
    sorcery: 'Волшебство',
  };

  // ---- card definitions -------------------------------------------------
  // cost: string like "2R", "GG", "" (land). effect targets: array of specs.
  const DEFS = {};
  function def(d) { DEFS[d.id] = d; return d; }

  // Lands
  def({ id: 'mountain', name: 'Гора', type: 'land', subtype: 'Гора', color: 'R', produces: 'R', emoji: '⛰️',
    text: 'Поверните: добавьте одну красную ману.' });
  def({ id: 'forest', name: 'Лес', type: 'land', subtype: 'Лес', color: 'G', produces: 'G', emoji: '🌲',
    text: 'Поверните: добавьте одну зелёную ману.' });
  def({ id: 'plains', name: 'Равнина', type: 'land', subtype: 'Равнина', color: 'W', produces: 'W', emoji: '🌾',
    text: 'Поверните: добавьте одну белую ману.' });
  def({ id: 'island', name: 'Остров', type: 'land', subtype: 'Остров', color: 'U', produces: 'U', emoji: '🏝️',
    text: 'Поверните: добавьте одну синюю ману.' });

  // RED
  def({ id: 'goblin_scout', name: 'Гоблин-разведчик', type: 'creature', subtype: 'Гоблин', cost: 'R', color: 'R',
    power: 1, toughness: 1, keywords: ['haste'], emoji: '👺', flavor: 'Быстрый, злой и очень громкий.' });
  def({ id: 'fire_imp', name: 'Огненный бес', type: 'creature', subtype: 'Бес', cost: '1R', color: 'R',
    power: 2, toughness: 1, keywords: [], emoji: '😈', flavor: 'Маленький, но кусается.' });
  def({ id: 'goblin_berserk', name: 'Гоблин-берсерк', type: 'creature', subtype: 'Гоблин', cost: '2R', color: 'R',
    power: 3, toughness: 2, keywords: ['haste'], emoji: '🪓' });
  def({ id: 'fire_giant', name: 'Огненный великан', type: 'creature', subtype: 'Великан', cost: '4R', color: 'R',
    power: 5, toughness: 3, keywords: ['trample'], emoji: '👹' });
  def({ id: 'red_dragon', name: 'Красный дракон', type: 'creature', subtype: 'Дракон', cost: '4RR', color: 'R',
    power: 4, toughness: 4, keywords: ['flying'], emoji: '🐉', flavor: 'Небо горит.' });
  def({ id: 'shock', name: 'Шок', type: 'instant', cost: 'R', color: 'R', emoji: '⚡',
    text: 'Шок наносит 2 повреждения любой цели.',
    effect: { kind: 'damage', amount: 2, targets: ['any'] } });
  def({ id: 'bolt', name: 'Молния', type: 'instant', cost: 'R', color: 'R', emoji: '🌩️',
    text: 'Молния наносит 3 повреждения любой цели.',
    effect: { kind: 'damage', amount: 3, targets: ['any'] } });
  def({ id: 'lava_axe', name: 'Лавовый топор', type: 'sorcery', cost: '4R', color: 'R', emoji: '☄️',
    text: 'Лавовый топор наносит 5 повреждений целевому игроку.',
    effect: { kind: 'damage', amount: 5, targets: ['player'] } });

  // GREEN
  def({ id: 'wolf', name: 'Лесной волк', type: 'creature', subtype: 'Волк', cost: '1G', color: 'G',
    power: 2, toughness: 2, keywords: [], emoji: '🐺' });
  def({ id: 'boar', name: 'Дикий кабан', type: 'creature', subtype: 'Кабан', cost: '2G', color: 'G',
    power: 3, toughness: 3, keywords: [], emoji: '🐗' });
  def({ id: 'spider', name: 'Гигантский паук', type: 'creature', subtype: 'Паук', cost: '3G', color: 'G',
    power: 2, toughness: 4, keywords: ['reach'], emoji: '🕷️' });
  def({ id: 'troll', name: 'Лесной тролль', type: 'creature', subtype: 'Тролль', cost: '4G', color: 'G',
    power: 4, toughness: 3, keywords: ['trample'], emoji: '🧌' });
  def({ id: 'oak', name: 'Древний дуб', type: 'creature', subtype: 'Древесник', cost: '4GG', color: 'G',
    power: 4, toughness: 5, keywords: [], emoji: '🌳', flavor: 'Он помнит первый рассвет.' });
  def({ id: 'wurm', name: 'Вирм', type: 'creature', subtype: 'Вирм', cost: '5GG', color: 'G',
    power: 7, toughness: 6, keywords: ['trample'], emoji: '🐛' });
  def({ id: 'giant_growth', name: 'Рост великана', type: 'instant', cost: 'G', color: 'G', emoji: '🌿',
    text: 'Целевое существо получает +3/+3 до конца хода.',
    effect: { kind: 'pump', power: 3, toughness: 3, targets: ['creature'] } });
  def({ id: 'bite', name: 'Укус', type: 'sorcery', cost: '1G', color: 'G', emoji: '🦷',
    text: 'Целевое существо под вашим контролем наносит повреждения, равные своей силе, целевому существу под контролем противника.',
    effect: { kind: 'bite', targets: ['ownCreature', 'oppCreature'] } });

  // WHITE
  def({ id: 'soldier', name: 'Пехотинец', type: 'creature', subtype: 'Человек Солдат', cost: '1W', color: 'W',
    power: 2, toughness: 2, keywords: [], emoji: '🛡️' });
  def({ id: 'knight', name: 'Рыцарь', type: 'creature', subtype: 'Человек Рыцарь', cost: '1W', color: 'W',
    power: 2, toughness: 1, keywords: ['first_strike'], emoji: '⚔️' });
  def({ id: 'healer', name: 'Монах-целитель', type: 'creature', subtype: 'Человек Монах', cost: 'W', color: 'W',
    power: 1, toughness: 2, keywords: ['lifelink'], emoji: '🙏' });
  def({ id: 'pegasus', name: 'Крылатый страж', type: 'creature', subtype: 'Пегас', cost: '2W', color: 'W',
    power: 2, toughness: 2, keywords: ['flying'], emoji: '🕊️' });
  def({ id: 'paladin', name: 'Паладин', type: 'creature', subtype: 'Человек Рыцарь', cost: '2W', color: 'W',
    power: 2, toughness: 3, keywords: ['vigilance'], emoji: '🏇' });
  def({ id: 'angel', name: 'Ангел', type: 'creature', subtype: 'Ангел', cost: '3WW', color: 'W',
    power: 4, toughness: 4, keywords: ['flying', 'vigilance'], emoji: '👼' });
  def({ id: 'smite', name: 'Кара небес', type: 'instant', cost: '1W', color: 'W', emoji: '✨',
    text: 'Уничтожьте целевое атакующее или блокирующее существо.',
    effect: { kind: 'destroy', targets: ['combatCreature'] } });
  def({ id: 'blessing', name: 'Благословение', type: 'instant', cost: 'W', color: 'W', emoji: '🌟',
    text: 'Целевое существо получает +2/+2 до конца хода.',
    effect: { kind: 'pump', power: 2, toughness: 2, targets: ['creature'] } });

  // BLUE
  def({ id: 'merfolk', name: 'Мерфолк-воин', type: 'creature', subtype: 'Мерфолк', cost: '1U', color: 'U',
    power: 2, toughness: 1, keywords: [], emoji: '🧜' });
  def({ id: 'mage', name: 'Мудрец', type: 'creature', subtype: 'Человек Чародей', cost: '1U', color: 'U',
    power: 1, toughness: 1, keywords: [], emoji: '🧙',
    text: 'Когда Мудрец выходит на поле битвы, возьмите карту.',
    etb: { kind: 'draw', amount: 1 } });
  def({ id: 'illusion', name: 'Летучая иллюзия', type: 'creature', subtype: 'Иллюзия', cost: '2U', color: 'U',
    power: 3, toughness: 1, keywords: ['flying'], emoji: '👻' });
  def({ id: 'spirit', name: 'Дух ветра', type: 'creature', subtype: 'Дух', cost: '3U', color: 'U',
    power: 2, toughness: 3, keywords: ['flying'], emoji: '🌬️' });
  def({ id: 'serpent', name: 'Морской змей', type: 'creature', subtype: 'Змей', cost: '5U', color: 'U',
    power: 5, toughness: 5, keywords: [], emoji: '🐍' });
  def({ id: 'djinn', name: 'Джинн', type: 'creature', subtype: 'Джинн', cost: '4UU', color: 'U',
    power: 4, toughness: 4, keywords: ['flying'], emoji: '🧞' });
  def({ id: 'unsummon', name: 'Отзыв', type: 'instant', cost: 'U', color: 'U', emoji: '🌀',
    text: 'Верните целевое существо в руку его владельца.',
    effect: { kind: 'bounce', targets: ['creature'] } });
  def({ id: 'divination', name: 'Прозрение', type: 'sorcery', cost: '2U', color: 'U', emoji: '🔮',
    text: 'Возьмите две карты.',
    effect: { kind: 'draw', amount: 2, targets: [] } });
  def({ id: 'counterspell', name: 'Контрзаклинание', type: 'instant', cost: 'UU', color: 'U', emoji: '🚫',
    text: 'Отмените целевое заклинание.',
    effect: { kind: 'counter', targets: ['spell'] } });

  // ---- decks ------------------------------------------------------------
  function list(pairs) {
    const out = [];
    for (const [id, n] of pairs) for (let i = 0; i < n; i++) out.push(id);
    return out;
  }

  const DECKS = {
    red: {
      id: 'red', name: 'Пламя', color: 'R', emoji: '🔥',
      desc: 'Быстрые гоблины и молнии. Бей быстро!',
      cards: list([['mountain', 17], ['goblin_scout', 4], ['fire_imp', 4], ['goblin_berserk', 4],
        ['fire_giant', 2], ['red_dragon', 1], ['shock', 4], ['bolt', 3], ['lava_axe', 1]]),
    },
    green: {
      id: 'green', name: 'Лес', color: 'G', emoji: '🌳',
      desc: 'Огромные звери и рост. Растопчи всех!',
      cards: list([['forest', 17], ['wolf', 4], ['boar', 4], ['spider', 3], ['troll', 3],
        ['oak', 2], ['wurm', 1], ['giant_growth', 4], ['bite', 2]]),
    },
    white: {
      id: 'white', name: 'Свет', color: 'W', emoji: '☀️',
      desc: 'Рыцари, ангелы и защита. Держи строй!',
      cards: list([['plains', 17], ['soldier', 4], ['knight', 3], ['healer', 3], ['pegasus', 3],
        ['paladin', 3], ['angel', 2], ['smite', 3], ['blessing', 2]]),
    },
    blue: {
      id: 'blue', name: 'Вода', color: 'U', emoji: '🌊',
      desc: 'Летуны, хитрость и отмена заклинаний.',
      cards: list([['island', 17], ['merfolk', 4], ['mage', 2], ['illusion', 3], ['spirit', 3],
        ['serpent', 2], ['djinn', 1], ['unsummon', 3], ['divination', 2], ['counterspell', 3]]),
    },
  };

  function parseCost(cost) {
    const res = { generic: 0, W: 0, U: 0, B: 0, R: 0, G: 0, total: 0 };
    if (!cost) return res;
    for (const ch of cost) {
      if (ch >= '0' && ch <= '9') res.generic = res.generic * 10 + Number(ch);
      else if (res[ch] !== undefined) res[ch]++;
    }
    res.total = res.generic + res.W + res.U + res.B + res.R + res.G;
    return res;
  }

  function cmc(d) { return parseCost(d.cost).total; }

  const MTG = root.MTG || (root.MTG = {});
  MTG.DEFS = DEFS;
  MTG.DECKS = DECKS;
  MTG.parseCost = parseCost;
  MTG.cmc = cmc;
  MTG.KEYWORDS_RU = KEYWORDS_RU;
  MTG.KEYWORD_HELP_RU = KEYWORD_HELP_RU;
  MTG.COLOR_NAMES_RU = COLOR_NAMES_RU;
  MTG.TYPE_NAMES_RU = TYPE_NAMES_RU;
})(typeof window !== 'undefined' ? window : globalThis);
