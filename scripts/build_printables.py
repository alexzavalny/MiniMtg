#!/usr/bin/env python3
"""Build A4 Russian print-and-play deck sheets directly from the game's data."""
from __future__ import annotations

import json
import os
import subprocess
from collections import Counter
from io import BytesIO
from pathlib import Path

from reportlab.lib.colors import Color, HexColor, white, black
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'pdf'
TMP = ROOT / 'tmp' / 'pdfs'
RUNTIME = Path('/Users/alex/.cache/codex-runtimes/codex-primary-runtime/dependencies')
NODE = ['/usr/bin/arch', '-arm64', str(RUNTIME / 'node' / 'bin' / 'node')]
PAGE_W, PAGE_H = A4
CARD_W, CARD_H = 63 * mm, 88 * mm
LEFT = (PAGE_W - 3 * CARD_W) / 2
TOP = 12 * mm
GAP_Y = 3 * mm
FONT_DIR = Path('/System/Library/Fonts/Supplemental')
REGULAR = FONT_DIR / 'Arial Unicode.ttf'
BOLD = FONT_DIR / 'Arial Bold.ttf'
if not REGULAR.exists():
    REGULAR = Path('/Library/Fonts/Arial Unicode.ttf')
if not BOLD.exists():
    BOLD = Path('/Library/Fonts/Arial Bold.ttf')

pdfmetrics.registerFont(TTFont('Game', str(REGULAR)))
pdfmetrics.registerFont(TTFont('GameBold', str(BOLD if BOLD.exists() else REGULAR)))

PAL = {
    'R': dict(a='#5a140c', b='#e8602f', frame='#b8371f', frame2='#f08a5a', box='#f6e2d3', ink='#2b0f08', glow='#ff7a3c'),
    'G': dict(a='#0d3316', b='#4cb35a', frame='#2d7a3a', frame2='#7ed08a', box='#e0efd6', ink='#0d2a12', glow='#7dff8a'),
    'W': dict(a='#8b8360', b='#fff6d6', frame='#e3d8a8', frame2='#fff9e0', box='#fbf8ec', ink='#3a3320', glow='#fff2a8'),
    'U': dict(a='#0a1f4d', b='#4a90e8', frame='#2b5cb0', frame2='#7fb2f5', box='#dbe7fa', ink='#0a1a3a', glow='#6cc6ff'),
}
# ReportLab does not embed Apple Color Emoji reliably. These deliberately use the
# same conventional colour letters on every printer instead of tofu squares.
MANA = {'W': 'W', 'U': 'U', 'R': 'R', 'G': 'G'}
MANA_FILL = {'W': '#fff7d0', 'U': '#a9dcff', 'R': '#ffb59a', 'G': '#a6e2b6'}
TYPE = {'land': 'Базовая земля', 'creature': 'Существо', 'instant': 'Мгновенное заклинание', 'sorcery': 'Волшебство'}
KEYWORDS = {
    'flying': 'Полёт', 'haste': 'Ускорение', 'trample': 'Пробивной удар', 'vigilance': 'Бдительность',
    'first_strike': 'Первый удар', 'lifelink': 'Цепь жизни', 'deathtouch': 'Смертельное касание', 'reach': 'Охват',
    'flash': 'Миг', 'hexproof': 'Порчеустойчивость',
}

def ru(value):
    return value.get('ru', '') if isinstance(value, dict) else (value or '')

def color(hex_value: str, alpha: float = 1):
    base = HexColor(hex_value)
    return Color(base.red, base.green, base.blue, alpha=alpha)

def clipped_image(c: canvas.Canvas, filename: Path, x, y, w, h):
    """Draw a cover-fit art image clipped to the rounded card window."""
    image = ImageReader(str(filename))
    iw, ih = image.getSize()
    scale = max(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    c.saveState()
    p = c.beginPath(); p.roundRect(x, y, w, h, 3 * mm)
    c.clipPath(p, stroke=0, fill=0)
    c.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, mask='auto')
    c.restoreState()

def fit_font(c, text, max_w, initial, name='GameBold', minimum=5.2):
    size = initial
    while pdfmetrics.stringWidth(text, name, size) > max_w and size > minimum:
        size -= .2
    return size

def wrap(c, text, max_w, font, size):
    words = text.split()
    lines, line = [], ''
    for word in words:
        candidate = f'{line} {word}'.strip()
        if line and pdfmetrics.stringWidth(candidate, font, size) > max_w:
            lines.append(line); line = word
        else:
            line = candidate
    if line: lines.append(line)
    return lines

def rounded(c, x, y, w, h, radius, fill, stroke=None, width=.5):
    c.setFillColor(fill)
    if stroke:
        c.setStrokeColor(stroke); c.setLineWidth(width)
    else:
        c.setStrokeColor(fill)
    c.roundRect(x, y, w, h, radius, stroke=1 if stroke else 0, fill=1)

def mana_symbols(c, cost, x_right, y):
    symbols = []
    digits = ''.join(ch for ch in (cost or '') if ch.isdigit())
    if digits: symbols.append((digits, None))
    for clr in 'WURG':
        symbols.extend([(MANA[clr], clr)] * (cost or '').count(clr))
    x = x_right
    for symbol, clr in reversed(symbols):
        c.setFillColor(color(MANA_FILL.get(clr, '#d9d2ce')))
        c.circle(x, y, 3.3 * mm, stroke=0, fill=1)
        c.setFillColor(HexColor('#222'))
        c.setFont('GameBold', 7.5 if clr else 6.5)
        c.drawCentredString(x, y - 2.6, symbol)
        x -= 7.3 * mm
    return x + 4 * mm

def draw_card(c, card, index, total):
    x = LEFT + (index % 3) * CARD_W
    y = PAGE_H - TOP - CARD_H - (index // 3) * (CARD_H + GAP_Y)
    # Do not approximate the card UI here. This is the exact 512 × 768 canvas
    # emitted by js/cardart.js in Chrome, including browser emoji and shadows.
    render = TMP / 'game-cards' / f"{card['id']}.png"
    if not render.exists():
        raise FileNotFoundError(f"Missing game render: {render}")
    c.drawImage(ImageReader(str(render)), x, y, CARD_W, CARD_H, mask='auto')

def crop_marks(c):
    c.setStrokeColor(Color(.15, .15, .15, .65)); c.setLineWidth(.25 * mm)
    for row in range(3):
        for col in range(3):
            x = LEFT + col * CARD_W; y = PAGE_H - TOP - CARD_H - row * (CARD_H + GAP_Y)
            m = 2.2 * mm
            for xx in (x, x + CARD_W):
                c.line(xx, y - m, xx, y - .25 * mm); c.line(xx, y + CARD_H + .25 * mm, xx, y + CARD_H + m)
            for yy in (y, y + CARD_H):
                c.line(x - m, yy, x - .25 * mm, yy); c.line(x + CARD_W + .25 * mm, yy, x + CARD_W + m, yy)

def footer(c, deck, page, pages):
    c.setFillColor(HexColor('#4a4d56')); c.setFont('Game', 7.3)
    c.drawString(LEFT, 6.4 * mm, f"Магия: учебная битва • {ru(deck['name'])} • 40 карт • лист {page}/{pages}")
    c.drawRightString(PAGE_W - LEFT, 6.4 * mm, 'Печать: 100% масштаба • 63 × 88 мм')

def build_deck_pdf(deck_id, deck, cards):
    filename = {'red': 'plamya.pdf', 'green': 'les.pdf', 'white': 'svet.pdf', 'blue': 'voda.pdf', 'black': 'mogila.pdf', 'tide': 'priliv.pdf'}[deck_id]
    c = canvas.Canvas(str(OUT / filename), pagesize=A4, pageCompression=1)
    c.setTitle(f"Магия — колода «{ru(deck['name'])}»")
    pages = (len(deck['cards']) + 8) // 9
    for page in range(pages):
        start, current = page * 9, deck['cards'][page * 9:(page + 1) * 9]
        crop_marks(c)
        for slot, card_id in enumerate(current):
            draw_card(c, cards[card_id], slot, len(deck['cards']))
        footer(c, deck, page + 1, pages)
        c.showPage()
    c.save()

def heading(c, title, subtitle=None):
    c.setFillColor(HexColor('#142432')); c.rect(0, PAGE_H - 31 * mm, PAGE_W, 31 * mm, stroke=0, fill=1)
    c.setFillColor(HexColor('#ffd878')); c.setFont('GameBold', 22)
    c.drawString(16 * mm, PAGE_H - 17 * mm, title)
    if subtitle:
        c.setFillColor(white); c.setFont('Game', 9.2); c.drawString(16 * mm, PAGE_H - 24 * mm, subtitle)

def section(c, title, items, y):
    c.setFillColor(HexColor('#213b4b')); c.setFont('GameBold', 13); c.drawString(16 * mm, y, title); y -= 7 * mm
    c.setFont('Game', 9.2); c.setFillColor(HexColor('#24313a'))
    for item in items:
        lines = wrap(c, item, PAGE_W - 36 * mm, 'Game', 9.2)
        c.setFillColor(HexColor('#d66636')); c.circle(18 * mm, y + 2.5, 1.3, stroke=0, fill=1)
        c.setFillColor(HexColor('#24313a'))
        for line in lines:
            c.drawString(22 * mm, y, line); y -= 4.8 * mm
        y -= 2.2 * mm
    return y

def build_rules():
    c = canvas.Canvas(str(OUT / 'rules.pdf'), pagesize=A4, pageCompression=1)
    c.setTitle('Магия: учебная битва — правила')
    # Cover
    c.setFillColor(HexColor('#0d1e2c')); c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    c.setFillColor(HexColor('#ffd878')); c.setFont('GameBold', 30); c.drawCentredString(PAGE_W / 2, PAGE_H - 70 * mm, 'МАГИЯ')
    c.setFillColor(white); c.setFont('GameBold', 17); c.drawCentredString(PAGE_W / 2, PAGE_H - 83 * mm, 'УЧЕБНАЯ БИТВА')
    c.setFillColor(HexColor('#a9dcff')); c.setFont('Game', 12); c.drawCentredString(PAGE_W / 2, PAGE_H - 96 * mm, 'Правила для игры против компьютера')
    for x, icon, col in [(45 * mm, 'R', '#ffb59a'), (85 * mm, 'G', '#a6e2b6'), (125 * mm, 'W', '#fff7d0'), (165 * mm, 'U', '#a9dcff')]:
        c.setFillColor(color(col)); c.circle(x, PAGE_H - 128 * mm, 13 * mm, stroke=0, fill=1)
        c.setFillColor(HexColor('#1b2230')); c.setFont('GameBold', 26); c.drawCentredString(x, PAGE_H - 136 * mm, icon)
    c.setFillColor(white); c.setFont('Game', 10); c.drawCentredString(PAGE_W / 2, 31 * mm, 'Версия для печати • все названия и правила на русском языке')
    c.showPage()
    heading(c, '1. Цель игры', 'Быстрый старт: 20 жизней, колода из 40 карт, победа - опустить жизни соперника до нуля.')
    y = PAGE_H - 42 * mm
    y = section(c, 'Победа', [
        'У каждого игрока 20 жизней. Нанесите достаточно повреждений, чтобы жизни противника стали равны 0 или меньше.',
        'Если игрок должен взять карту из пустой библиотеки, он проигрывает.',
        'В игре против компьютера вы выбираете одну из шести готовых колод. У каждой колоды 40 карт.',
    ], y)
    y = section(c, 'Что есть на карте', [
        'Верхняя строка: название и стоимость. Цветные символы показывают, какую ману нужно заплатить; число - сколько маны любого цвета нужно добавить.',
        'Иллюстрация не влияет на правила. Строка типа сообщает, земля это, существо, мгновенное заклинание или волшебство.',
        'Нижний текст описывает способность. У существа справа внизу указаны сила/выносливость: например, 3/2 наносит 3 повреждения и погибает от 2 повреждений.',
    ], y)
    c.showPage()
    heading(c, '2. Земли, мана и заклинания', 'Один ход строится вокруг земель, оплаты маны и правильного момента для розыгрыша карт.')
    y = PAGE_H - 42 * mm
    y = section(c, 'Земли и мана', [
        'В свою главную фазу можно разыграть не больше одной земли за ход. Земля не является заклинанием и не попадает в стек.',
        'Поверните землю, чтобы получить одну ману её цвета. Повернутая карта не может блокировать. В начале вашего хода все ваши карты разворачиваются.',
        'Чтобы разыграть заклинание, заплатите его стоимость: поверните подходящие земли. Например, 2G означает две маны любого цвета и одну зелёную.',
    ], y)
    y = section(c, 'Виды заклинаний', [
        'Существа остаются на поле битвы и могут атаковать или блокировать. Только что вышедшее существо не атакует до вашего следующего хода, если у него нет Ускорения.',
        'Волшебство разыгрывается только в вашу главную фазу, когда стек пуст. После разрешения оно уходит на кладбище.',
        'Мгновенное заклинание можно разыграть в любой момент, когда у вас есть приоритет: в том числе в ответ на заклинание или во время боя.',
    ], y)
    c.showPage()
    heading(c, '3. Ход и стек', 'Игра сама ведёт вас по фазам. Полный контроль позволяет останавливаться на каждом окне приоритета.')
    y = PAGE_H - 42 * mm
    y = section(c, 'Порядок фаз', [
        '1. Разворот - разверните свои карты. 2. Поддержка и взятие карты - возьмите карту.',
        '3. Главная фаза 1 - разыграйте землю, существ и волшебства. 4. Бой - атака, блоки, повреждения.',
        '5. Главная фаза 2 - снова можно разыгрывать землю (если ещё не играли), существ и волшебства. 6. Завершение - повреждения с существ снимаются.',
    ], y)
    y = section(c, 'Стек и приоритет', [
        'Заклинание не действует сразу: оно попадает в стек. Игроки по очереди могут ответить мгновенным заклинанием или способностью.',
        'Когда оба игрока пропускают приоритет, верхнее заклинание разрешается. Поэтому последнее разыгранное заклинание срабатывает первым.',
        'Если у заклинания больше нет легальной цели, оно не разрешается. Например, Отзыв возвращает существо в руку до того, как другое заклинание успеет нанести ему урон.',
    ], y)
    c.showPage()
    heading(c, '4. Бой', 'В бою атакующие выбираются вами, а блоки назначаются противником.')
    y = PAGE_H - 42 * mm
    y = section(c, 'Шаги боя', [
        'В начале боя ещё можно разыграть мгновенные заклинания. Затем выберите атакующих существ и подтвердите атаку.',
        'Атакующие обычно поворачиваются. Противник выбирает блокирующих. Одно существо может блокировать одного атакующего; несколько существ могут блокировать одного атакующего.',
        'Незаблокированное существо наносит повреждения игроку. Заблокированные существа одновременно наносят повреждения друг другу. Существо с повреждениями не меньше выносливости погибает.',
        'Пробивной удар позволяет лишним повреждениям пройти игроку. Первый удар наносит повреждения раньше обычных существ.',
    ], y)
    y = section(c, 'Полезные ключевые слова', [
        'Полёт: блокировать может только существо с Полётом или Охватом. Охват: может блокировать летающих.',
        'Бдительность: существо не поворачивается при атаке. Цепь жизни: нанесённые повреждения также дают вам столько же жизней.',
        'Ускорение: существо может атаковать в ход выхода. Смертельное касание: любое количество нанесённых существу повреждений считается смертельным.',
    ], y)
    c.showPage()
    heading(c, '5. Памятка и колоды', 'Короткая шпаргалка для первого матча.')
    y = PAGE_H - 42 * mm
    y = section(c, 'Шпаргалка хода', [
        'Начало хода: разверните карты и возьмите карту. Главная фаза: сыграйте землю, оплатите заклинания. Бой: атакуйте, назначьте блоки, разыграйте мгновенные заклинания. Вторая главная: доиграйте карты. Завершение: передайте ход.',
        'Не хватает маны? Сначала играйте землю, затем поворачивайте нужные земли. Нужна реакция? Используйте мгновенное заклинание, пока оно лежит в стеке.',
        'Щелчок по карте выбирает её. Правая кнопка мыши или Esc отменяет выбор цели. Пробел соответствует кнопке «Далее».',
    ], y)
    y = section(c, 'Шесть колод', [
        'Пламя (R) - быстрые гоблины, прямые повреждения и огненный дракон. Давите темпом.',
        'Лес (G) - крупные существа, рост и пробивной удар. Ставьте мощных существ и выигрывайте бой.',
        'Свет (W) - рыцари, ангелы, защита и лечение. Удерживайте поле и выбирайте выгодные блоки.',
        'Вода (U) - летающие существа, возврат в руку, взятие карт и отмена заклинаний. Играйте от реакции.',
        'Могила (B) - жертвы, случайный сброс карт, точечное уничтожение и вампиры. Лишайте соперника ресурсов.',
        'Прилив (W/U) - русалки, лечение, защитные чары и замедление. Берегите своих и сдерживайте врага.',
    ], y)
    c.setFillColor(HexColor('#66727c')); c.setFont('Game', 7.5)
    c.drawCentredString(PAGE_W / 2, 11 * mm, 'Печать карт: 100% масштаба, без подгонки страницы. Размер карты после обрезки: 63 × 88 мм.')
    c.save()

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    node_env = os.environ.copy()
    node_env['NODE_PATH'] = str(RUNTIME / 'node' / 'node_modules')
    subprocess.run(NODE + ['scripts/export-card-data.cjs'], cwd=ROOT, env=node_env, check=True)
    subprocess.run(NODE + ['scripts/render-game-cards.cjs'], cwd=ROOT, env=node_env, check=True)
    data = json.loads((TMP / 'card-data.json').read_text())
    for deck_id, deck in data['decks'].items():
        if len(deck['cards']) != 40:
            raise ValueError(f"Expected 40 cards in {deck_id}, got {len(deck['cards'])}")
        build_deck_pdf(deck_id, deck, data['cards'])
    build_rules()

if __name__ == '__main__':
    main()
