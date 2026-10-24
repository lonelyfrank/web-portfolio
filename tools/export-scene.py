"""Esporta sfondo e personaggio caricati in assets/, senza modificare gli originali.

Uso: python3 tools/export-scene.py (richiede Pillow).
Il foglio originale non ha celle regolari: alcuni fotogrammi di corsa si
sovrappongono in orizzontale. Il canale alpha permette di separarli senza tagli.
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets'
OUT = ROOT / 'dist' / 'assets'
CELL = (96, 112)
CHARACTER_HEIGHT = 96


def components(image):
    """Individua le figure, ignorando i pixel isolati del foglio."""
    width, height = image.size
    alpha = image.getchannel('A')
    pending = bytearray(alpha.point(lambda value: 255 if value > 16 else 0).tobytes())
    figures = []
    for start in range(len(pending)):
        if not pending[start]:
            continue
        pending[start] = 0
        stack, pixels = [start], []
        while stack:
            position = stack.pop()
            pixels.append(position)
            y, x = divmod(position, width)
            neighbours = []
            if x: neighbours.append(position - 1)
            if x < width - 1: neighbours.append(position + 1)
            if y: neighbours.append(position - width)
            if y < height - 1: neighbours.append(position + width)
            for neighbour in neighbours:
                if pending[neighbour]:
                    pending[neighbour] = 0
                    stack.append(neighbour)
        if len(pixels) < 1000:
            continue
        mask = bytearray(width * height)
        for position in pixels:
            mask[position] = 255
        # Recupera anche i bordi semitrasparenti attorno alla figura.
        mask = Image.frombytes('L', image.size, bytes(mask)).filter(ImageFilter.MaxFilter(5))
        figure = image.copy()
        figure.putalpha(ImageChops.multiply(alpha, mask))
        box = figure.getchannel('A').getbbox()
        figures.append((box, figure.crop(box)))
    return figures


def export_character():
    sheet = Image.open(SRC / 'Foglio sprite pixel art_ camminata e corsa.png').convert('RGBA')
    figures = components(sheet)
    rows = [sorted((item for item in figures if (item[0][1] < sheet.height / 2) == (row == 0)),
                   key=lambda item: item[0][0]) for row in range(2)]
    if [len(row) for row in rows] != [8, 8]:
        raise ValueError('Attesi 8 fotogrammi di camminata e 8 di corsa; controllare il foglio.')

    scale = CHARACTER_HEIGHT / max(box[3] - box[1] for box, _ in rows[0])
    atlas = Image.new('RGBA', (CELL[0] * 8, CELL[1] * 2))
    for row_index, row in enumerate(rows):
        ground = max(box[3] for box, _ in row)
        for column, (box, figure) in enumerate(row):
            figure = figure.resize((round(figure.width * scale), round(figure.height * scale)), Image.Resampling.NEAREST)
            x = column * CELL[0] + (CELL[0] - figure.width) // 2
            # Mantiene la fase aerea della corsa rispetto a un terreno comune.
            y = (row_index + 1) * CELL[1] - 4 - round((ground - box[3]) * scale) - figure.height
            atlas.paste(figure, (x, y))
    atlas.save(OUT / 'character-motion.webp', lossless=True, method=6)



def export_idle():
    sheet = Image.open(SRC / 'Personaggio cyberpunk_ otto fotogrammi di respirazione.png').convert('RGBA')
    figures = components(sheet)
    rows = [sorted((item for item in figures if ((item[0][1] + item[0][3]) / 2 < sheet.height / 2) == (row == 0)),
                   key=lambda item: item[0][0]) for row in range(2)]
    if [len(row) for row in rows] != [4, 4]:
        raise ValueError('Attesi 4 × 2 fotogrammi di respirazione; controllare il foglio.')
    frames = rows[0] + rows[1]
    scale = CHARACTER_HEIGHT / max(figure.height for _, figure in frames)
    atlas = Image.new('RGBA', (CELL[0] * 8, CELL[1]))
    for column, (_, figure) in enumerate(frames):
        # Una scala comune conserva il respiro; piedi allineati per evitare saltelli.
        figure = figure.resize((round(figure.width * scale), round(figure.height * scale)), Image.Resampling.NEAREST)
        x = column * CELL[0] + (CELL[0] - figure.width) // 2
        atlas.paste(figure, (x, CELL[1] - 4 - figure.height))
    atlas.save(OUT / 'character-idle.webp', lossless=True, method=6)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    background = Image.open(SRC / 'Metropoli cyberpunk tra pianeti lontani.png').convert('RGB')
    background.save(OUT / 'universe.webp', quality=88, method=6)
    export_character()
    export_idle()
    for name in ['universe.webp', 'character-motion.webp', 'character-idle.webp']:
        print(f'{name}: {(OUT / name).stat().st_size // 1024} KB')
