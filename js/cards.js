/* Card definitions and decks. Pure data, no DOM. Works in browser and node. */
(function (root) {
  'use strict';

  // Bilingual literal: L('по-русски', 'in English') -> {ru, en}; resolved by MTG.txt() at display time.
  const L = (ru, en) => ({ ru, en });
  const KEYWORDS = ['flying', 'haste', 'trample', 'vigilance', 'first_strike', 'lifelink', 'deathtouch', 'reach'];

  // ---- card definitions -------------------------------------------------
  // cost: string like "2R", "GG", "" (land). effect targets: array of specs.
  const DEFS = {};
  function def(d) { DEFS[d.id] = d; return d; }

  // Lands
  def({ id: 'mountain', name: L('Гора', 'Mountain'), type: 'land', subtype: L('Гора', 'Mountain'), color: 'R', produces: 'R', emoji: '⛰️',
    text: L('Поверните: добавьте одну красную ману.', 'Tap: add one red mana.') });
  def({ id: 'forest', name: L('Лес', 'Forest'), type: 'land', subtype: L('Лес', 'Forest'), color: 'G', produces: 'G', emoji: '🌲',
    text: L('Поверните: добавьте одну зелёную ману.', 'Tap: add one green mana.') });
  def({ id: 'plains', name: L('Равнина', 'Plains'), type: 'land', subtype: L('Равнина', 'Plains'), color: 'W', produces: 'W', emoji: '🌾',
    text: L('Поверните: добавьте одну белую ману.', 'Tap: add one white mana.') });
  def({ id: 'island', name: L('Остров', 'Island'), type: 'land', subtype: L('Остров', 'Island'), color: 'U', produces: 'U', emoji: '🏝️',
    text: L('Поверните: добавьте одну синюю ману.', 'Tap: add one blue mana.') });
  def({ id: 'swamp', name: L('Болото', 'Swamp'), type: 'land', subtype: L('Болото', 'Swamp'), color: 'B', produces: 'B', emoji: '💀',
    text: L('Поверните: добавьте одну чёрную ману.', 'Tap: add one black mana.') });

  // RED
  def({ id: 'goblin_scout', name: L('Гоблин-разведчик', 'Goblin Scout'), type: 'creature', subtype: L('Гоблин', 'Goblin'), cost: 'R', color: 'R',
    power: 1, toughness: 1, keywords: ['haste'], emoji: '👺', flavor: L('Быстрый, злой и очень громкий.', 'Fast, angry and very loud.') });
  def({ id: 'fire_imp', name: L('Огненный бес', 'Fire Imp'), type: 'creature', subtype: L('Бес', 'Imp'), cost: '1R', color: 'R',
    power: 2, toughness: 1, keywords: [], emoji: '😈', flavor: L('Маленький, но кусается.', 'Small, but it bites.') });
  def({ id: 'goblin_berserk', name: L('Гоблин-берсерк', 'Goblin Berserker'), type: 'creature', subtype: L('Гоблин', 'Goblin'), cost: '2R', color: 'R',
    power: 3, toughness: 2, keywords: ['haste'], emoji: '🪓' });
  def({ id: 'fire_giant', name: L('Огненный великан', 'Fire Giant'), type: 'creature', subtype: L('Великан', 'Giant'), cost: '4R', color: 'R',
    power: 5, toughness: 3, keywords: ['trample'], emoji: '👹' });
  def({ id: 'red_dragon', name: L('Красный дракон', 'Red Dragon'), type: 'creature', subtype: L('Дракон', 'Dragon'), cost: '4RR', color: 'R',
    power: 4, toughness: 4, keywords: ['flying'], emoji: '🐉', flavor: L('Небо горит.', 'The sky is burning.') });
  def({ id: 'shock', name: L('Шок', 'Shock'), type: 'instant', cost: 'R', color: 'R', emoji: '⚡',
    text: L('Шок наносит 2 повреждения любой цели.', 'Shock deals 2 damage to any target.'),
    effect: { kind: 'damage', amount: 2, targets: ['any'] } });
  def({ id: 'bolt', name: L('Молния', 'Lightning Bolt'), type: 'instant', cost: 'R', color: 'R', emoji: '🌩️',
    text: L('Молния наносит 3 повреждения любой цели.', 'Lightning Bolt deals 3 damage to any target.'),
    effect: { kind: 'damage', amount: 3, targets: ['any'] } });
  def({ id: 'lava_axe', name: L('Лавовый топор', 'Lava Axe'), type: 'sorcery', cost: '4R', color: 'R', emoji: '☄️',
    text: L('Лавовый топор наносит 5 повреждений целевому игроку.', 'Lava Axe deals 5 damage to target player.'),
    effect: { kind: 'damage', amount: 5, targets: ['player'] } });

  // GREEN
  def({ id: 'wolf', name: L('Лесной волк', 'Forest Wolf'), type: 'creature', subtype: L('Волк', 'Wolf'), cost: '1G', color: 'G',
    power: 2, toughness: 2, keywords: [], emoji: '🐺' });
  def({ id: 'boar', name: L('Дикий кабан', 'Wild Boar'), type: 'creature', subtype: L('Кабан', 'Boar'), cost: '2G', color: 'G',
    power: 3, toughness: 3, keywords: [], emoji: '🐗' });
  def({ id: 'spider', name: L('Гигантский паук', 'Giant Spider'), type: 'creature', subtype: L('Паук', 'Spider'), cost: '3G', color: 'G',
    power: 2, toughness: 4, keywords: ['reach'], emoji: '🕷️' });
  def({ id: 'troll', name: L('Лесной тролль', 'Forest Troll'), type: 'creature', subtype: L('Тролль', 'Troll'), cost: '4G', color: 'G',
    power: 4, toughness: 3, keywords: ['trample'], emoji: '🧌' });
  def({ id: 'oak', name: L('Древний дуб', 'Ancient Oak'), type: 'creature', subtype: L('Древесник', 'Treefolk'), cost: '4GG', color: 'G',
    power: 4, toughness: 5, keywords: [], emoji: '🌳', flavor: L('Он помнит первый рассвет.', 'It remembers the first dawn.') });
  def({ id: 'wurm', name: L('Вирм', 'Wurm'), type: 'creature', subtype: L('Вирм', 'Wurm'), cost: '5GG', color: 'G',
    power: 7, toughness: 6, keywords: ['trample'], emoji: '🐛' });
  def({ id: 'giant_growth', name: L('Рост великана', 'Giant Growth'), type: 'instant', cost: 'G', color: 'G', emoji: '🌿',
    text: L('Целевое существо получает +3/+3 до конца хода.', 'Target creature gets +3/+3 until end of turn.'),
    effect: { kind: 'pump', power: 3, toughness: 3, targets: ['creature'] } });
  def({ id: 'bite', name: L('Укус', 'Bite'), type: 'sorcery', cost: '1G', color: 'G', emoji: '🦷',
    text: L('Целевое существо под вашим контролем наносит повреждения, равные своей силе, целевому существу под контролем противника.', 'Target creature you control deals damage equal to its power to target creature an opponent controls.'),
    effect: { kind: 'bite', targets: ['ownCreature', 'oppCreature'] } });

  // WHITE
  def({ id: 'soldier', name: L('Пехотинец', 'Foot Soldier'), type: 'creature', subtype: L('Человек Солдат', 'Human Soldier'), cost: '1W', color: 'W',
    power: 2, toughness: 2, keywords: [], emoji: '🛡️' });
  def({ id: 'knight', name: L('Рыцарь', 'Knight'), type: 'creature', subtype: L('Человек Рыцарь', 'Human Knight'), cost: '1W', color: 'W',
    power: 2, toughness: 1, keywords: ['first_strike'], emoji: '⚔️' });
  def({ id: 'healer', name: L('Монах-целитель', 'Healer Monk'), type: 'creature', subtype: L('Человек Монах', 'Human Monk'), cost: 'W', color: 'W',
    power: 1, toughness: 2, keywords: ['lifelink'], emoji: '🙏' });
  def({ id: 'pegasus', name: L('Крылатый страж', 'Winged Guardian'), type: 'creature', subtype: L('Пегас', 'Pegasus'), cost: '2W', color: 'W',
    power: 2, toughness: 2, keywords: ['flying'], emoji: '🕊️' });
  def({ id: 'paladin', name: L('Паладин', 'Paladin'), type: 'creature', subtype: L('Человек Рыцарь', 'Human Knight'), cost: '2W', color: 'W',
    power: 2, toughness: 3, keywords: ['vigilance'], emoji: '🏇' });
  def({ id: 'angel', name: L('Ангел', 'Angel'), type: 'creature', subtype: L('Ангел', 'Angel'), cost: '3WW', color: 'W',
    power: 4, toughness: 4, keywords: ['flying', 'vigilance'], emoji: '👼' });
  def({ id: 'smite', name: L('Кара небес', 'Smite'), type: 'instant', cost: '1W', color: 'W', emoji: '✨',
    text: L('Уничтожьте целевое атакующее или блокирующее существо.', 'Destroy target attacking or blocking creature.'),
    effect: { kind: 'destroy', targets: ['combatCreature'] } });
  def({ id: 'blessing', name: L('Благословение', 'Blessing'), type: 'instant', cost: 'W', color: 'W', emoji: '🌟',
    text: L('Целевое существо получает +2/+2 до конца хода.', 'Target creature gets +2/+2 until end of turn.'),
    effect: { kind: 'pump', power: 2, toughness: 2, targets: ['creature'] } });

  // BLUE
  def({ id: 'merfolk', name: L('Мерфолк-воин', 'Merfolk Warrior'), type: 'creature', subtype: L('Мерфолк', 'Merfolk'), cost: '1U', color: 'U',
    power: 2, toughness: 1, keywords: [], emoji: '🧜' });
  def({ id: 'mage', name: L('Мудрец', 'Sage'), type: 'creature', subtype: L('Человек Чародей', 'Human Wizard'), cost: '1U', color: 'U',
    power: 1, toughness: 1, keywords: [], emoji: '🧙',
    text: L('Когда Мудрец выходит на поле битвы, возьмите карту.', 'When Sage enters the battlefield, draw a card.'),
    etb: { kind: 'draw', amount: 1 } });
  def({ id: 'illusion', name: L('Летучая иллюзия', 'Flying Illusion'), type: 'creature', subtype: L('Иллюзия', 'Illusion'), cost: '2U', color: 'U',
    power: 3, toughness: 1, keywords: ['flying'], emoji: '👻' });
  def({ id: 'spirit', name: L('Дух ветра', 'Wind Spirit'), type: 'creature', subtype: L('Дух', 'Spirit'), cost: '3U', color: 'U',
    power: 2, toughness: 3, keywords: ['flying'], emoji: '🌬️' });
  def({ id: 'serpent', name: L('Морской змей', 'Sea Serpent'), type: 'creature', subtype: L('Змей', 'Serpent'), cost: '5U', color: 'U',
    power: 5, toughness: 5, keywords: [], emoji: '🐍' });
  def({ id: 'djinn', name: L('Джинн', 'Djinn'), type: 'creature', subtype: L('Джинн', 'Djinn'), cost: '4UU', color: 'U',
    power: 4, toughness: 4, keywords: ['flying'], emoji: '🧞' });
  def({ id: 'unsummon', name: L('Отзыв', 'Unsummon'), type: 'instant', cost: 'U', color: 'U', emoji: '🌀',
    text: L('Верните целевое существо в руку его владельца.', 'Return target creature to its owner\'s hand.'),
    effect: { kind: 'bounce', targets: ['creature'] } });
  def({ id: 'divination', name: L('Прозрение', 'Divination'), type: 'sorcery', cost: '2U', color: 'U', emoji: '🔮',
    text: L('Возьмите две карты.', 'Draw two cards.'),
    effect: { kind: 'draw', amount: 2, targets: [] } });
  def({ id: 'counterspell', name: L('Контрзаклинание', 'Counterspell'), type: 'instant', cost: 'UU', color: 'U', emoji: '🚫',
    text: L('Отмените целевое заклинание.', 'Counter target spell.'),
    effect: { kind: 'counter', targets: ['spell'] } });

  // BLACK — classic threats, discard and removal.
  def({ id: 'carnophage', name: L('Карнофаг', 'Carnophage'), type: 'creature', subtype: L('Зомби', 'Zombie'), cost: 'B', color: 'B',
    power: 2, toughness: 2, keywords: [], emoji: '🧟',
    text: L('В начале вашей поддержки пожертвуйте Карнофага, если не заплатите 1 жизнь.', 'At the beginning of your upkeep, sacrifice Carnophage unless you pay 1 life.'),
    upkeep: { kind: 'payLifeOrSacrifice', amount: 1 } });
  def({ id: 'black_knight', name: L('Чёрный рыцарь', 'Black Knight'), type: 'creature', subtype: L('Человек Рыцарь', 'Human Knight'), cost: 'BB', color: 'B',
    power: 2, toughness: 2, keywords: ['first_strike'], protection: ['W'], emoji: '♞',
    text: L('Защита от белого.', 'Protection from white.') });
  def({ id: 'hypnotic_specter', name: L('Гипнотический призрак', 'Hypnotic Specter'), type: 'creature', subtype: L('Призрак', 'Specter'), cost: '1BB', color: 'B',
    power: 2, toughness: 2, keywords: ['flying'], emoji: '👻',
    text: L('Когда он наносит игроку боевой урон, тот игрок случайно сбрасывает карту.', 'Whenever it deals combat damage to a player, that player discards a card at random.'),
    combatDamagePlayer: { kind: 'discardRandom', amount: 1, player: 'damagedPlayer' } });
  def({ id: 'nekrataal', name: L('Некратаал', 'Nekrataal'), type: 'creature', subtype: L('Человек Убийца', 'Human Assassin'), cost: '2BB', color: 'B',
    power: 2, toughness: 1, keywords: ['first_strike'], emoji: '🗡️',
    text: L('Когда Некратаал выходит на поле битвы, уничтожьте целевое не-чёрное существо.', 'When Nekrataal enters the battlefield, destroy target nonblack creature.'),
    etb: { kind: 'destroy', targets: ['nonBlackCreature'] } });
  def({ id: 'sengir_vampire', name: L('Сэнгирский вампир', 'Sengir Vampire'), type: 'creature', subtype: L('Вампир', 'Vampire'), cost: '3BB', color: 'B',
    power: 4, toughness: 4, keywords: ['flying'], emoji: '🧛',
    text: L('Когда существо, которому Сэнгирский вампир нанёс повреждения в этот ход, погибает, положите на него жетон +1/+1.', 'Whenever a creature dealt damage by Sengir Vampire this turn dies, put a +1/+1 counter on Sengir Vampire.'),
    creatureDiesAfterDamage: { kind: 'addCounter', power: 1, toughness: 1 } });
  def({ id: 'terror', name: L('Ужас', 'Terror'), type: 'instant', cost: '1B', color: 'B', emoji: '☠️',
    text: L('Уничтожьте целевое не-чёрное существо.', 'Destroy target nonblack creature.'),
    effect: { kind: 'destroy', targets: ['nonBlackCreature'] } });
  def({ id: 'dark_ritual', name: L('Тёмный ритуал', 'Dark Ritual'), type: 'instant', cost: 'B', color: 'B', emoji: '🕯️',
    text: L('Добавьте три чёрные маны.', 'Add three black mana.'),
    effect: { kind: 'addMana', color: 'B', manaName: L('чёрные маны', 'black mana'), amount: 3, targets: [] } });

  // ---- decks ------------------------------------------------------------
  function list(pairs) {
    const out = [];
    for (const [id, n] of pairs) for (let i = 0; i < n; i++) out.push(id);
    return out;
  }

  const DECKS = {
    red: {
      id: 'red', name: L('Пламя', 'Flame'), color: 'R', emoji: '🔥',
      desc: L('Быстрые гоблины и молнии. Бей быстро!', 'Fast goblins and lightning. Hit hard, hit fast!'),
      cards: list([['mountain', 17], ['goblin_scout', 4], ['fire_imp', 4], ['goblin_berserk', 4],
        ['fire_giant', 2], ['red_dragon', 1], ['shock', 4], ['bolt', 3], ['lava_axe', 1]]),
    },
    green: {
      id: 'green', name: L('Лес', 'Forest'), color: 'G', emoji: '🌳',
      desc: L('Огромные звери и рост. Растопчи всех!', 'Huge beasts and growth. Trample them all!'),
      cards: list([['forest', 17], ['wolf', 4], ['boar', 4], ['spider', 3], ['troll', 3],
        ['oak', 2], ['wurm', 1], ['giant_growth', 4], ['bite', 2]]),
    },
    white: {
      id: 'white', name: L('Свет', 'Light'), color: 'W', emoji: '☀️',
      desc: L('Рыцари, ангелы и защита. Держи строй!', 'Knights, angels and defense. Hold the line!'),
      cards: list([['plains', 17], ['soldier', 4], ['knight', 3], ['healer', 3], ['pegasus', 3],
        ['paladin', 3], ['angel', 2], ['smite', 3], ['blessing', 2]]),
    },
    blue: {
      id: 'blue', name: L('Вода', 'Water'), color: 'U', emoji: '🌊',
      desc: L('Летуны, хитрость и отмена заклинаний.', 'Fliers, tricks and counterspells.'),
      cards: list([['island', 17], ['merfolk', 4], ['mage', 2], ['illusion', 3], ['spirit', 3],
        ['serpent', 2], ['djinn', 1], ['unsummon', 3], ['divination', 2], ['counterspell', 3]]),
    },
    black: {
      id: 'black', name: L('Могила', 'Grave'), color: 'B', emoji: '🪦',
      desc: L('Жертвы, сброс карт и вампиры. Лишай противника ресурсов.', 'Sacrifices, discard and vampires. Strip the opponent of resources.'),
      cards: list([['swamp', 17], ['carnophage', 4], ['black_knight', 4], ['hypnotic_specter', 4],
        ['nekrataal', 3], ['sengir_vampire', 2], ['terror', 3], ['dark_ritual', 3]]),
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
  MTG.KEYWORDS = KEYWORDS;
  MTG.L = L;
})(typeof window !== 'undefined' ? window : globalThis);
