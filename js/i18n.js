/* Two-language string table (ru / en) and helpers. Pure JS, works in node.
   Card data keeps its own {ru, en} objects in cards.js; everything else lives here.
   Usage: MTG.t('key', {params})  |  MTG.txt({ru, en})  |  MTG.i18n.set('en') */
(function (root) {
  'use strict';
  const MTG = root.MTG || (root.MTG = {});

  const S = {
    // ---- players / generic
    'player.you': { ru: 'Вы', en: 'You' },
    'player.cpu': { ru: 'Компьютер', en: 'Computer' },
    'turn.n': { ru: 'Ход {n}', en: 'Turn {n}' },
    'turn.mine': { ru: 'ВАШ ХОД', en: 'YOUR TURN' },
    'turn.theirs': { ru: 'ХОД ПРОТИВНИКА', en: 'OPPONENT\'S TURN' },
    'thinking': { ru: 'Компьютер думает…', en: 'Computer is thinking…' },
    'mana.label': { ru: 'Мана:', en: 'Mana:' },
    'title': { ru: 'Магия: Учебная битва', en: 'Magic: Training Battle' },

    // ---- phases (full / short / help)
    'phase.untap': { ru: 'Разворот', en: 'Untap' },
    'phase.upkeep': { ru: 'Поддержка', en: 'Upkeep' },
    'phase.draw': { ru: 'Взятие карты', en: 'Draw' },
    'phase.main1': { ru: 'Главная фаза 1', en: 'Main phase 1' },
    'phase.combat_begin': { ru: 'Начало боя', en: 'Beginning of combat' },
    'phase.combat_attackers': { ru: 'Объявление атаки', en: 'Declare attackers' },
    'phase.combat_blockers': { ru: 'Объявление блока', en: 'Declare blockers' },
    'phase.combat_damage': { ru: 'Боевой урон', en: 'Combat damage' },
    'phase.combat_end': { ru: 'Конец боя', en: 'End of combat' },
    'phase.main2': { ru: 'Главная фаза 2', en: 'Main phase 2' },
    'phase.end': { ru: 'Завершение', en: 'End step' },
    'phase.cleanup': { ru: 'Очистка', en: 'Cleanup' },
    'phaseShort.untap': { ru: 'Разворот', en: 'Untap' },
    'phaseShort.upkeep': { ru: 'Поддержка', en: 'Upkeep' },
    'phaseShort.draw': { ru: 'Взятие', en: 'Draw' },
    'phaseShort.main1': { ru: 'Главная 1', en: 'Main 1' },
    'phaseShort.combat_begin': { ru: 'Бой', en: 'Combat' },
    'phaseShort.combat_attackers': { ru: 'Атака', en: 'Attack' },
    'phaseShort.combat_blockers': { ru: 'Блок', en: 'Block' },
    'phaseShort.combat_damage': { ru: 'Урон', en: 'Damage' },
    'phaseShort.combat_end': { ru: 'Конец боя', en: 'End combat' },
    'phaseShort.main2': { ru: 'Главная 2', en: 'Main 2' },
    'phaseShort.end': { ru: 'Конец хода', en: 'End' },
    'phaseShort.cleanup': { ru: 'Очистка', en: 'Cleanup' },
    'phaseHelp.untap': { ru: 'Все ваши повёрнутые карты разворачиваются.', en: 'All your tapped cards untap.' },
    'phaseHelp.upkeep': { ru: 'Короткий шаг перед взятием карты. Можно играть мгновенные заклинания.', en: 'A short step before drawing. Instants may be cast.' },
    'phaseHelp.draw': { ru: 'Активный игрок берёт карту из библиотеки.', en: 'The active player draws a card from their library.' },
    'phaseHelp.main1': { ru: 'Можно разыграть землю (одну за ход), существ и волшебства.', en: 'Play a land (one per turn), creatures and sorceries.' },
    'phaseHelp.combat_begin': { ru: 'Бой начинается. Последний шанс сыграть мгновенное заклинание до атаки.', en: 'Combat begins. Last chance to cast an instant before attacks.' },
    'phaseHelp.combat_attackers': { ru: 'Активный игрок выбирает, какие существа атакуют. Они поворачиваются.', en: 'The active player chooses which creatures attack. They become tapped.' },
    'phaseHelp.combat_blockers': { ru: 'Защищающийся игрок выбирает, какие существа блокируют.', en: 'The defending player chooses which creatures block.' },
    'phaseHelp.combat_damage': { ru: 'Существа наносят повреждения одновременно. Сначала — с первым ударом.', en: 'Creatures deal damage simultaneously. First strike goes first.' },
    'phaseHelp.combat_end': { ru: 'Бой окончен. Существа возвращаются.', en: 'Combat is over. Creatures return.' },
    'phaseHelp.main2': { ru: 'Вторая главная фаза. Можно доиграть существ и волшебства.', en: 'Second main phase. Cast remaining creatures and sorceries.' },
    'phaseHelp.end': { ru: 'Шаг завершения хода. Можно играть мгновенные заклинания.', en: 'End step. Instants may be cast.' },
    'phaseHelp.cleanup': { ru: 'Повреждения снимаются, эффекты «до конца хода» заканчиваются, лишние карты сбрасываются до 7.', en: 'Damage wears off, "until end of turn" effects end, hand is discarded down to 7.' },

    // ---- card frame
    'card.basicLand': { ru: 'Базовая земля', en: 'Basic Land' },
    'card.back': { ru: 'МАГИЯ', en: 'MAGIC' },
    'type.land': { ru: 'Земля', en: 'Land' },
    'type.creature': { ru: 'Существо', en: 'Creature' },
    'type.instant': { ru: 'Мгновенное заклинание', en: 'Instant' },
    'type.sorcery': { ru: 'Волшебство', en: 'Sorcery' },
    'type.artifact': { ru: 'Артефакт', en: 'Artifact' },
    'kw.flying': { ru: 'Полёт', en: 'Flying' },
    'kw.haste': { ru: 'Ускорение', en: 'Haste' },
    'kw.trample': { ru: 'Пробивной удар', en: 'Trample' },
    'kw.vigilance': { ru: 'Бдительность', en: 'Vigilance' },
    'kw.first_strike': { ru: 'Первый удар', en: 'First strike' },
    'kw.lifelink': { ru: 'Цепь жизни', en: 'Lifelink' },
    'kw.deathtouch': { ru: 'Смертельное касание', en: 'Deathtouch' },
    'kw.reach': { ru: 'Охват', en: 'Reach' },
    'kw.flash': { ru: 'Миг', en: 'Flash' },
    'kw.hexproof': { ru: 'Порчеустойчивость', en: 'Hexproof' },
    'kwHelp.flying': { ru: 'Может быть заблокировано только существами с Полётом или Охватом.', en: 'Can be blocked only by creatures with Flying or Reach.' },
    'kwHelp.haste': { ru: 'Может атаковать в тот же ход, когда вышло на поле.', en: 'Can attack the turn it enters the battlefield.' },
    'kwHelp.trample': { ru: 'Лишний боевой урон сверх блокирующих идёт игроку.', en: 'Excess combat damage beyond the blockers goes to the player.' },
    'kwHelp.vigilance': { ru: 'Не поворачивается при атаке.', en: 'Attacking doesn\'t cause it to tap.' },
    'kwHelp.first_strike': { ru: 'Наносит боевой урон раньше существ без первого удара.', en: 'Deals combat damage before creatures without first strike.' },
    'kwHelp.lifelink': { ru: 'Урон от этого существа также прибавляет вам столько же жизней.', en: 'Damage dealt by this creature also causes you to gain that much life.' },
    'kwHelp.deathtouch': { ru: 'Любой урон от этого существа смертелен для существ.', en: 'Any damage this deals to a creature is enough to destroy it.' },
    'kwHelp.reach': { ru: 'Может блокировать существ с Полётом.', en: 'Can block creatures with Flying.' },
    'kwHelp.flash': { ru: 'Это существо можно разыграть в любой момент, когда можно разыграть мгновенное заклинание.', en: 'You may cast this creature any time you could cast an instant.' },
    'kwHelp.hexproof': { ru: 'Заклинания и способности противника не могут выбирать это существо целью.', en: 'Spells and abilities your opponents control cannot target this creature.' },
    'table.myLands': { ru: 'ВАШИ ЗЕМЛИ', en: 'YOUR LANDS' },
    'table.myCreatures': { ru: 'ВАШИ СУЩЕСТВА', en: 'YOUR CREATURES' },
    'table.oppCreatures': { ru: 'СУЩЕСТВА ПРОТИВНИКА', en: 'OPPONENT\'S CREATURES' },
    'table.oppLands': { ru: 'ЗЕМЛИ ПРОТИВНИКА', en: 'OPPONENT\'S LANDS' },
    'table.library': { ru: 'БИБЛИОТЕКА', en: 'LIBRARY' },
    'table.graveyard': { ru: 'КЛАДБИЩЕ', en: 'GRAVEYARD' },

    // ---- engine log
    'log.first': { ru: 'Первым ходит: {player}.', en: 'Going first: {player}.' },
    'log.turn': { ru: '— Ход {n}: {player} —', en: '— Turn {n}: {player} —' },
    'log.land': { ru: '{player}: разыграна земля «{card}».', en: '{player}: played land "{card}".' },
    'log.cast': { ru: '{player} разыгрывает «{card}».', en: '{player} casts "{card}".' },
    'log.castAt': { ru: '{player} разыгрывает «{card}» → {targets}.', en: '{player} casts "{card}" → {targets}.' },
    'log.fizzle': { ru: '«{card}» отменяется: цель исчезла.', en: '"{card}" fizzles: its target is gone.' },
    'log.enters': { ru: '«{card}» выходит на поле битвы.', en: '"{card}" enters the battlefield.' },
    'log.trigger': { ru: 'Срабатывает способность «{card}».', en: 'The ability of "{card}" triggers.' },
    'log.pump': { ru: '«{card}» получает +{p}/+{t}.', en: '"{card}" gets +{p}/+{t}.' },
    'log.destroyed': { ru: '«{card}» уничтожено.', en: '"{card}" is destroyed.' },
    'log.bounce': { ru: '«{card}» возвращается в руку.', en: '"{card}" returns to its owner\'s hand.' },
    'log.countered': { ru: '«{card}» отменено!', en: '"{card}" is countered!' },
    'log.damagePlayer': { ru: '«{source}» наносит {n} повреждений: {player}.', en: '"{source}" deals {n} damage to {player}.' },
    'log.damageCard': { ru: '«{source}» наносит {n} повреждений «{card}».', en: '"{source}" deals {n} damage to "{card}".' },
    'log.gainLife': { ru: '{player} получает {n} жизней.', en: '{player} gains {n} life.' },
    'log.loseLife': { ru: '{player} теряет {n} жизней.', en: '{player} loses {n} life.' },
    'log.addMana': { ru: 'В запас маны добавлено: {n} {color}.', en: 'Added {n} {color} to the mana pool.' },
    'log.sacrificed': { ru: '«{card}» принесён в жертву.', en: '"{card}" is sacrificed.' },
    'log.counterAdded': { ru: 'На «{card}» кладётся жетон +{p}/+{t}.', en: 'A +{p}/+{t} counter is put on "{card}".' },
    'log.tapped': { ru: '«{card}» поворачивается и не развернётся на следующем ходу владельца.', en: '"{card}" is tapped and will not untap during its controller\'s next untap step.' },
    'log.combatDamagePrevented': { ru: 'Эфирная мгла предотвращает все боевые повреждения в этом ходу.', en: 'Ethereal Haze prevents all combat damage this turn.' },
    'log.deckOut': { ru: '{player} не может взять карту: библиотека пуста!', en: '{player} cannot draw: the library is empty!' },
    'log.dies': { ru: '«{card}» погибает.', en: '"{card}" dies.' },
    'log.attacks': { ru: '{player} атакует: {cards}.', en: '{player} attacks with {cards}.' },
    'log.noAttack': { ru: '{player} не атакует.', en: '{player} does not attack.' },
    'log.cantBlock': { ru: '{player} не может блокировать.', en: '{player} has no blockers.' },
    'log.blocks': { ru: '{player} блокирует: {pairs}.', en: '{player} blocks: {pairs}.' },
    'log.noBlock': { ru: '{player} не блокирует.', en: '{player} does not block.' },
    'log.firstStrike': { ru: 'Шаг первого удара.', en: 'First strike damage step.' },
    'log.discard': { ru: '{player} сбрасывает «{card}».', en: '{player} discards "{card}".' },
    'log.error': { ru: 'Ошибка: {msg}', en: 'Error: {msg}' },

    // ---- hints (action bar)
    'hint.stack': { ru: '{who} «{card}». В ответ можно сыграть <b>мгновенное</b> заклинание. Или нажмите «Пропустить» — заклинание разрешится.', en: '{who} "{card}". You may respond with an <b>instant</b>. Or press "Pass" and the spell resolves.' },
    'hint.who.you': { ru: 'Вы разыграли', en: 'You cast' },
    'hint.who.opp': { ru: 'Противник разыграл', en: 'The opponent cast' },
    'hint.main1': { ru: 'Ваша <b>главная фаза</b>. Сыграйте землю (одну за ход) и существ. Готово? Переходите к бою.', en: 'Your <b>main phase</b>. Play a land (one per turn) and creatures. Done? Move on to combat.' },
    'hint.main2': { ru: 'Вторая <b>главная фаза</b>. Можно доиграть карты. Затем завершите ход.', en: 'Second <b>main phase</b>. Cast remaining cards, then end your turn.' },
    'hint.combat_begin': { ru: 'Начало боя. Можно сыграть мгновенное заклинание до объявления атаки.', en: 'Beginning of combat. You may cast an instant before attackers are declared.' },
    'hint.myAttackers': { ru: 'Атака объявлена. Можно сыграть мгновенное заклинание до блока.', en: 'Attackers declared. You may cast an instant before blocks.' },
    'hint.myBlockers': { ru: 'Блоки объявлены. Самое время для <b>Роста великана</b> или <b>Молнии</b>!', en: 'Blocks declared. Perfect time for a <b>Giant Growth</b> or a <b>Lightning Bolt</b>!' },
    'hint.theirBlockers': { ru: 'Вы объявили блоки. Можно усилить блокирующего мгновенным заклинанием.', en: 'You declared blocks. You may boost a blocker with an instant.' },
    'hint.theirAttackers': { ru: 'Противник атакует. Можно сыграть мгновенное заклинание (например, убить атакующего).', en: 'The opponent is attacking. You may cast an instant (e.g. kill an attacker).' },
    'hint.theirEnd': { ru: 'Конец хода противника. Хороший момент потратить лишнюю ману на мгновенное заклинание.', en: 'Opponent\'s end step. A good moment to spend spare mana on an instant.' },
    'hint.generic': { ru: 'Фаза «{phase}». Можно сыграть мгновенное заклинание или нажать «Далее».', en: '"{phase}" step. Cast an instant or press "Next".' },
    'hint.target': { ru: '🎯 Выберите {what} для «{card}».', en: '🎯 Choose {what} for "{card}".' },
    'target.any': { ru: 'любую цель: существо или игрока', en: 'any target: a creature or a player' },
    'target.creature': { ru: 'существо', en: 'a creature' },
    'target.ownCreature': { ru: 'своё существо', en: 'a creature you control' },
    'target.oppCreature': { ru: 'существо противника', en: 'an opponent\'s creature' },
    'target.nonBlackCreature': { ru: 'не-чёрное существо', en: 'a nonblack creature' },
    'target.player': { ru: 'игрока', en: 'a player' },
    'target.combatCreature': { ru: 'атакующее или блокирующее существо', en: 'an attacking or blocking creature' },
    'target.spell': { ru: 'заклинание в стеке', en: 'a spell on the stack' },
    'hint.attackers': { ru: '⚔️ <b>Объявление атаки.</b> Щёлкните по существам, которые атакуют, затем нажмите «Атаковать».', en: '⚔️ <b>Declare attackers.</b> Click the creatures that attack, then press "Attack".' },
    'hint.blockers': { ru: '🛡️ <b>Объявление блока.</b> Щёлкните своё существо, затем — атакующего, которого оно блокирует. Повторный щелчок снимает блок.', en: '🛡️ <b>Declare blockers.</b> Click your creature, then the attacker it blocks. Click again to remove the block.' },
    'hint.blockFirst': { ru: 'Сначала выберите <b>своё</b> существо, которое будет блокировать.', en: 'First pick <b>your</b> creature that will block.' },
    'hint.cantBlockFlying': { ru: '⛔ «{blocker}» не может блокировать «{attacker}»: у атакующего Полёт, а у блокирующего нет Полёта или Охвата.', en: '⛔ "{blocker}" cannot block "{attacker}": the attacker has Flying and the blocker has neither Flying nor Reach.' },
    'hint.blockSet': { ru: '🛡️ Блок назначен. Можно добавить ещё или подтвердить.', en: '🛡️ Block assigned. Add more or confirm.' },
    'hint.discard': { ru: '🧹 В руке больше 7 карт. Выберите {n} карт(ы) для сброса ({k}/{n}).', en: '🧹 More than 7 cards in hand. Choose {n} card(s) to discard ({k}/{n}).' },
    'why.landOnce': { ru: 'Землю можно разыграть только одну за ход.', en: 'You may play only one land per turn.' },
    'why.landTiming': { ru: 'Землю можно разыграть только в свою главную фазу, когда стек пуст.', en: 'Lands can be played only in your main phase while the stack is empty.' },
    'why.stack': { ru: 'Сначала должен разрешиться стек.', en: 'The stack must resolve first.' },
    'why.notYourTurn': { ru: 'Существ и волшебства можно играть только в свой ход.', en: 'Creatures and sorceries can be cast only on your turn.' },
    'why.notMain': { ru: 'Существ и волшебства можно играть только в главную фазу.', en: 'Creatures and sorceries can be cast only in a main phase.' },
    'why.mana': { ru: 'Не хватает маны. Нужно: {cost}. Разверните/сыграйте земли.', en: 'Not enough mana. Cost: {cost}. Untap or play lands.' },
    'why.noTarget': { ru: 'Сейчас нет подходящей цели для этого заклинания.', en: 'There is no legal target for this spell right now.' },
    'why.generic': { ru: 'Сейчас нельзя сыграть эту карту.', en: 'This card cannot be played right now.' },

    // ---- buttons
    'btn.next': { ru: 'Далее ▶', en: 'Next ▶' },
    'btn.pass': { ru: 'Пропустить ▶', en: 'Pass ▶' },
    'btn.toCombat': { ru: 'К бою ⚔️', en: 'To combat ⚔️' },
    'btn.endTurn': { ru: 'Завершить ход ⏭', en: 'End turn ⏭' },
    'btn.cancel': { ru: 'Отмена ✖', en: 'Cancel ✖' },
    'btn.attack': { ru: 'Атаковать ({n}) ⚔️', en: 'Attack ({n}) ⚔️' },
    'btn.noAttack': { ru: 'Не атаковать ▶', en: 'No attack ▶' },
    'btn.reset': { ru: 'Сбросить выбор', en: 'Reset' },
    'btn.confirmBlock': { ru: 'Подтвердить блок ({n}) 🛡️', en: 'Confirm blocks ({n}) 🛡️' },
    'btn.noBlock': { ru: 'Не блокировать ▶', en: 'No block ▶' },
    'btn.discard': { ru: 'Сбросить', en: 'Discard' },
    'btn.play': { ru: '▶ Играть', en: '▶ Play' },
    'btn.howto': { ru: '❓ Как играть', en: '❓ How to play' },
    'btn.again': { ru: '🔄 Играть ещё', en: '🔄 Play again' },
    'btn.log': { ru: 'Журнал', en: 'Log' },
    'btn.help': { ru: 'Помощь', en: 'Help' },
    'btn.sound': { ru: 'Звук', en: 'Sound' },

    // ---- panels / preview / stack
    'preview.sick': { ru: '💤 Болезнь вызова: не может атаковать в этот ход.', en: '💤 Summoning sickness: cannot attack this turn.' },
    'preview.tapped': { ru: '↩️ Повёрнуто: не может блокировать.', en: '↩️ Tapped: cannot block.' },
    'preview.damage': { ru: '🩸 Повреждения: {n} (снимаются в конце хода).', en: '🩸 Damage: {n} (wears off at end of turn).' },
    'preview.instant': { ru: '⚡ Мгновенное заклинание можно играть в любой момент, когда у вас приоритет.', en: '⚡ An instant can be cast any time you have priority.' },
    'preview.sorcery': { ru: '📜 Волшебство: только в свою главную фазу, когда стек пуст.', en: '📜 Sorcery: only in your main phase while the stack is empty.' },
    'stack.title': { ru: 'СТЕК (разрешается сверху вниз)', en: 'STACK (resolves top to bottom)' },
    'stack.ability': { ru: 'Способность «{card}»', en: 'Ability of "{card}"' },
    'fx.countered': { ru: 'ОТМЕНЕНО', en: 'COUNTERED' },
    'fx.fizzle': { ru: 'ЦЕЛЬ ИСЧЕЗЛА', en: 'NO TARGET' },

    // ---- start / game over
    'start.title': { ru: '✨ МАГИЯ ✨', en: '✨ MAGIC ✨' },
    'start.subtitle': { ru: 'Учебная битва против компьютера', en: 'Training battle against the computer' },
    'start.lead': { ru: 'Выбери колоду. У каждого игрока 20 жизней. Кто первым опустит противника до нуля — победил!', en: 'Pick a deck. Each player has 20 life. Bring your opponent to zero first to win!' },
    'start.fullControl': { ru: 'Останавливаться на каждой фазе (полный контроль)', en: 'Stop at every step (full control)' },
    'over.win': { ru: '🏆 ПОБЕДА!', en: '🏆 VICTORY!' },
    'over.lose': { ru: '💀 ПОРАЖЕНИЕ', en: '💀 DEFEAT' },
    'over.draw': { ru: '🤝 НИЧЬЯ', en: '🤝 DRAW' },
    'over.winText': { ru: 'Ты победил компьютер! Отличная игра.', en: 'You beat the computer! Great game.' },
    'over.loseText': { ru: 'В следующий раз получится! Попробуй ещё.', en: 'Next time! Give it another try.' },

    // ---- help overlay (html)
    'help.title': { ru: 'Как играть', en: 'How to play' },
    'help.col1': {
      ru: `<h3>🎯 Цель</h3>
<p>У каждого 20 жизней. Опусти жизни противника до 0 — победа. Если у игрока закончились карты в библиотеке и он должен взять карту — он проиграл.</p>
<h3>🏔️ Земли и мана</h3>
<p>Один раз за ход можно положить <b>землю</b>. Земли <b>поворачиваются</b> и дают ману — ей платят за заклинания. В начале твоего хода всё разворачивается.</p>
<h3>🐺 Существа</h3>
<p>У существа есть <b>сила/выносливость</b> (например 3/2). Только что вышедшее существо «болеет» и не может атаковать до твоего следующего хода (если нет Ускорения).</p>
<h3>⚡ Стек</h3>
<p>Заклинания не действуют сразу — они попадают в <b>стек</b>. Противник может ответить мгновенным заклинанием. Стек разрешается сверху вниз: последнее сыгранное срабатывает первым.</p>`,
      en: `<h3>🎯 Goal</h3>
<p>Each player has 20 life. Bring the opponent to 0 to win. A player who must draw from an empty library loses.</p>
<h3>🏔️ Lands and mana</h3>
<p>Once per turn you may play a <b>land</b>. Lands <b>tap</b> for mana, which pays for spells. Everything untaps at the start of your turn.</p>
<h3>🐺 Creatures</h3>
<p>A creature has <b>power/toughness</b> (e.g. 3/2). A creature that just entered is "summoning sick" and cannot attack until your next turn (unless it has Haste).</p>
<h3>⚡ The stack</h3>
<p>Spells don't take effect immediately — they go on the <b>stack</b>. The opponent may respond with an instant. The stack resolves top to bottom: the last spell cast resolves first.</p>`,
    },
    'help.col2': {
      ru: `<h3>🔁 Фазы хода</h3>
<ol>
<li><b>Разворот</b> — все твои карты разворачиваются.</li>
<li><b>Поддержка, Взятие карты</b> — берёшь карту.</li>
<li><b>Главная фаза 1</b> — земли, существа, волшебства.</li>
<li><b>Бой</b>: объяви атакующих → противник объявляет блокирующих → урон.</li>
<li><b>Главная фаза 2</b> — можно доиграть карты.</li>
<li><b>Завершение, Очистка</b> — повреждения снимаются.</li>
</ol>
<h3>⚔️ Бой</h3>
<p>Атакующие поворачиваются. Незаблокированное существо бьёт игрока. Заблокированные существа бьют друг друга одновременно. Если урон ≥ выносливости — существо погибает.</p>
<h3>🪶 Ключевые слова</h3>
<p><b>Полёт</b> — блокируют только Полёт/Охват. <b>Первый удар</b> — бьёт раньше. <b>Пробивной удар</b> — лишний урон идёт игроку. <b>Бдительность</b> — не поворачивается при атаке. <b>Цепь жизни</b> — урон лечит тебя. <b>Ускорение</b> — атакует сразу.</p>
<h3>🖱️ Управление</h3>
<p>Щёлкай по картам. Правая кнопка / Esc — отмена выбора цели. Пробел — «Далее». Наведи на карту на столе — увидишь её крупно.</p>`,
      en: `<h3>🔁 Turn phases</h3>
<ol>
<li><b>Untap</b> — all your cards untap.</li>
<li><b>Upkeep, Draw</b> — you draw a card.</li>
<li><b>Main phase 1</b> — lands, creatures, sorceries.</li>
<li><b>Combat</b>: declare attackers → the opponent declares blockers → damage.</li>
<li><b>Main phase 2</b> — cast remaining cards.</li>
<li><b>End, Cleanup</b> — damage wears off.</li>
</ol>
<h3>⚔️ Combat</h3>
<p>Attackers tap. An unblocked creature hits the player. Blocked creatures hit each other simultaneously. Damage ≥ toughness kills a creature.</p>
<h3>🪶 Keywords</h3>
<p><b>Flying</b> — blocked only by Flying/Reach. <b>First strike</b> — hits first. <b>Trample</b> — excess damage goes to the player. <b>Vigilance</b> — doesn't tap to attack. <b>Lifelink</b> — damage heals you. <b>Haste</b> — attacks right away.</p>
<h3>🖱️ Controls</h3>
<p>Click cards. Right click / Esc cancels targeting. Space — "Next". Hover a card on the table to see it large.</p>`,
    },
  };

  const i18n = {
    lang: 'ru',
    strings: S,
    _listeners: [],
    /** Resolve a {ru, en} object (or pass a plain string through). */
    txt(v) { return v && typeof v === 'object' && !Array.isArray(v) ? (v[i18n.lang] || v.ru || '') : v; },
    quote(v) { const s = i18n.txt(v); return i18n.lang === 'ru' ? '«' + s + '»' : '"' + s + '"'; },
    fmt(v) {
      if (Array.isArray(v)) return v.map((x) => (Array.isArray(x) ? x.map(i18n.quote).join(' → ') : i18n.quote(x))).join(', ');
      return i18n.txt(v);
    },
    /** Translate a key with {param} substitution. Params may be strings, numbers, {ru,en} objects or arrays of names. */
    t(key, params) {
      const e = S[key];
      let s = e ? (e[i18n.lang] || e.ru) : key;
      if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] === undefined ? m : i18n.fmt(params[k])));
      return s;
    },
    set(lang) {
      if (lang !== 'ru' && lang !== 'en') return;
      if (i18n.lang === lang) return;
      i18n.lang = lang;
      try { localStorage.setItem('mtg.lang', lang); } catch (e) { /* ignore */ }
      for (const fn of i18n._listeners) fn(lang);
    },
    onChange(fn) { i18n._listeners.push(fn); },
    /** Fill elements carrying data-i18n / data-i18n-html / data-i18n-title. */
    applyDom(scope) {
      const rootEl = scope || (typeof document !== 'undefined' ? document : null);
      if (!rootEl) return;
      rootEl.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = i18n.t(el.dataset.i18n); });
      rootEl.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = i18n.t(el.dataset.i18nHtml); });
      rootEl.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = i18n.t(el.dataset.i18nTitle); });
    },
  };
  try { const saved = localStorage.getItem('mtg.lang'); if (saved === 'en' || saved === 'ru') i18n.lang = saved; } catch (e) { /* node */ }

  MTG.i18n = i18n;
  MTG.t = i18n.t;
  MTG.txt = i18n.txt;
})(typeof window !== 'undefined' ? window : globalThis);
