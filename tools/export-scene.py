"""Esporta sfondo e personaggio caricati in assets/, senza modificare gli originali.

Uso: python3 tools/export-scene.py (richiede Pillow).
Il foglio di movimento ha quattro righe di quattro pose. Il canale alpha
permette di separare le due righe di corsa senza tagliare capelli e scarpe.
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets'
SPRITES = SRC / 'sprite'
OUT = ROOT / 'dist' / 'assets'
CELL = (128, 112)
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


def seam(alpha, expected, radius=36):
    """Trova lo spazio trasparente tra due coppie ragazzo/gatta.

    Le pose di corsa adiacenti si toccano: una divisione in celle rettangolari
    taglierebbe code e scarpe. Il percorso segue i pixel meno opachi.
    """
    left, right = max(1, expected - radius), min(alpha.width - 1, expected + radius)
    pixels = alpha.load()
    previous = [0] * (right - left)
    paths = []
    for y in range(alpha.height):
        current, parents = [], []
        for i, x in enumerate(range(left, right)):
            parent = min(range(max(0, i - 1), min(len(previous), i + 2)), key=lambda j: previous[j])
            current.append(previous[parent] + pixels[x, y] ** 2 + abs(x - expected) * .05)
            parents.append(parent)
        paths.append(parents)
        previous = current
    cursor = min(range(len(previous)), key=previous.__getitem__)
    result = []
    for parents in reversed(paths):
        result.append(left + cursor)
        cursor = parents[cursor]
    return result[::-1]


def motion_rows(sheet):
    """Riordina il foglio 4 × 4: otto pose di camminata, poi otto di corsa.

    Le ultime due righe si sfiorano: il confine segue lo spazio trasparente
    invece di tagliare orizzontalmente scarpe, capelli e code.
    """
    alpha = sheet.getchannel('A')
    transposed = alpha.transpose(Image.Transpose.TRANSPOSE)
    boundaries = [[0] * sheet.width]
    boundaries += [seam(transposed, y, radius=24) for y in (255, 498, 698)]
    boundaries += [[sheet.height] * sheet.width]
    rows = [[], []]
    for row in range(4):
        mask = bytearray(sheet.width * sheet.height)
        for x in range(sheet.width):
            for y in range(boundaries[row][x], boundaries[row + 1][x]):
                mask[y * sheet.width + x] = 255
        band = sheet.copy()
        band.putalpha(ImageChops.multiply(alpha, Image.frombytes('L', sheet.size, bytes(mask))))
        frames = []
        for column in range(4):
            left, right = round(column * sheet.width / 4), round((column + 1) * sheet.width / 4)
            cell = band.crop((left, 0, right, sheet.height))
            box = cell.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
            if box is None:
                raise ValueError(f'Fotogramma vuoto: riga {row}, colonna {column}')
            frames.append((box, cell.crop(box)))
        ground = max(box[3] for box, _ in frames)
        # Le due righe di ogni animazione condividono la stessa quota dei piedi.
        rows[row // 2].extend(((box[0], box[1] - ground, box[2], box[3] - ground), figure)
                              for box, figure in frames)
    return rows


def rest_frames(name):
    sheet = Image.open(SPRITES / name).convert('RGBA')
    figures = components(sheet)
    rows = [sorted((item for item in figures if ((item[0][1] + item[0][3]) / 2 < sheet.height / 2) == (row == 0)),
                   key=lambda item: item[0][0]) for row in range(2)]
    if [len(row) for row in rows] != [4, 4]:
        raise ValueError(f'Attesi 4 × 2 fotogrammi in {name}.')
    return rows[0] + rows[1]


def export_atlas(rows, name, airborne=False, cell=CELL):
    scale = CHARACTER_HEIGHT / max(figure.height for _, figure in rows[0])
    atlas = Image.new('RGBA', (cell[0] * 8, cell[1] * len(rows)))
    for row_index, frames in enumerate(rows):
        ground = max(box[3] for box, _ in frames)
        for column, (box, figure) in enumerate(frames):
            # Ancora il ragazzo, non il gruppo: la gatta può passare a destra e
            # sinistra senza trascinare il corpo. La testa è isolata in alto.
            head = figure.getchannel('A').crop((0, 0, figure.width, max(1, figure.height // 3)))
            head_box = head.point(lambda a: 255 if a > 64 else 0).getbbox()
            anchor = (head_box[0] + head_box[2]) / 2
            figure = figure.resize((round(figure.width * scale), round(figure.height * scale)), Image.Resampling.NEAREST)
            x = cell[0] // 2 - round(anchor * scale)
            lift = round((ground - box[3]) * scale) if airborne else 0
            y = cell[1] - 4 - lift - figure.height
            if x < 0 or x + figure.width > cell[0] or y < 0:
                raise ValueError(f'Fotogramma fuori cella: {name}, {row_index}, {column}')
            atlas.paste(figure, (column * cell[0] + x, row_index * cell[1] + y))
    atlas.save(OUT / name, lossless=True, method=6)


def export_character():
    sheet = Image.open(SPRITES / 'Frank e il gatto calico in movimento.png').convert('RGBA')
    export_atlas(motion_rows(sheet), 'character-motion.webp', airborne=True, cell=(160, 112))
    export_atlas([rest_frames('Otto fotogrammi_ gatta calico tra le gambe.png')], 'character-idle.webp')
    export_atlas([rest_frames('Animazione pixel_ ragazzo accarezza la gatta.png')], 'character-pet.webp')


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    background = Image.open(SRC / 'Metropoli cyberpunk tra pianeti lontani.png').convert('RGB')
    background.save(OUT / 'universe.webp', quality=88, method=6)
    export_character()
    for name in ['universe.webp', 'character-motion.webp', 'character-idle.webp', 'character-pet.webp']:
        print(f'{name}: {(OUT / name).stat().st_size // 1024} KB')
