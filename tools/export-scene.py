"""Esporta sfondo e personaggio caricati in assets/, senza modificare gli originali.

Uso: python3 tools/export-scene.py (richiede Pillow).
Camminata e teletrasporto provengono da due fogli distinti. Scala, centro e pavimento
sono registrati per ogni foglio, senza ridimensionamenti per fotogramma.
"""
from assetlib import alpha_bbox, load, output_path

from PIL import Image, ImageChops, ImageFilter

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

    Alcune pose adiacenti si toccano: una divisione in celle rettangolari
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


def export_motion(sheet):
    """Otto pose di camminata dalle prime due righe, con scala e ancore fisse."""
    if sheet.size != (1254, 1254):
        raise ValueError('Il foglio di movimento atteso misura 1254 × 1254 px.')
    cell = (160, 112)
    scale = CHARACTER_HEIGHT / 300  # altezza in piedi misurata nel nuovo foglio
    actor_x = 134                   # asse corporeo locale comune alle quattro colonne
    row_edges = (0, 320, 636)        # prime due righe: solo camminata
    floors = (317, 627)             # piano di appoggio di ciascuna riga sorgente
    atlas = Image.new('RGBA', (cell[0] * 8, cell[1]))
    for row in range(2):
        band = sheet.crop((0, row_edges[row], sheet.width, row_edges[row + 1]))
        alpha = band.getchannel('A')
        boundaries = [[0] * band.height]
        boundaries += [seam(alpha, round(column * sheet.width / 4), radius=20)
                       for column in range(1, 4)]
        boundaries += [[sheet.width] * band.height]
        for column in range(4):
            mask = bytearray(band.width * band.height)
            for y in range(band.height):
                start, end = boundaries[column][y], boundaries[column + 1][y]
                mask[y * band.width + start:y * band.width + end] = b'\xff' * (end - start)
            figure = band.copy()
            figure.putalpha(ImageChops.multiply(alpha, Image.frombytes('L', band.size, bytes(mask))))
            # Il ritaglio conserva le coordinate originali; non centra il contenuto.
            left, right = min(boundaries[column]), max(boundaries[column + 1])
            figure = figure.crop((left, 0, right, band.height))
            figure = figure.resize((round(figure.width * scale), round(figure.height * scale)),
                                   Image.Resampling.NEAREST)
            x = cell[0] // 2 + round((left - round(column * sheet.width / 4) - actor_x) * scale)
            y = cell[1] - 4 + round((row_edges[row] - floors[row]) * scale)
            bounds = alpha_bbox(figure, 16)
            if bounds is None or x + bounds[0] < 0 or x + bounds[2] > cell[0] or y + bounds[1] < 0 or y + bounds[3] > cell[1] - 4:
                raise ValueError(f'Fotogramma vuoto o fuori cella: riga {row}, colonna {column}')
            frame = Image.new('RGBA', cell)
            frame.paste(figure, (x, y))
            atlas.paste(frame, (((row % 2) * 4 + column) * cell[0], row // 2 * cell[1]))
    atlas.save(output_path('character-motion.webp'), lossless=True, method=6)


def export_teleport(sheet):
    """Undici pose di scomparsa e una cella vuota; la comparsa le ripercorre.

    Le tre righe usano la stessa scala e asse corporeo. Le particelle conservano
    la posizione del foglio: i loro ingombri non ridimensionano il personaggio.
    Il pavimento a y=132 lascia spazio anche agli effetti sotto le scarpe.
    """
    if sheet.size != (1254, 1254):
        raise ValueError('Il foglio di teletrasporto atteso misura 1254 × 1254 px.')
    cell = (160, 144)
    scale = CHARACTER_HEIGHT / 340
    row_edges = (0, 435, 830, 1254)
    floors = (402, 793, 1191)
    actor_x = 134
    atlas = Image.new('RGBA', (cell[0] * 12, cell[1]))
    for index in range(11):
        row, column = divmod(index, 4)
        left, right = (round(c * sheet.width / 4) for c in (column, column + 1))
        top, bottom = row_edges[row:row + 2]
        figure = sheet.crop((left, top, right, bottom))
        figure = figure.resize((round(figure.width * scale), round(figure.height * scale)),
                               Image.Resampling.NEAREST)
        x = cell[0] // 2 - round(actor_x * scale)
        y = 132 + round((top - floors[row]) * scale)
        bounds = alpha_bbox(figure, 16)
        if bounds is None or x + bounds[0] < 0 or x + bounds[2] > cell[0] or y + bounds[1] < 0 or y + bounds[3] > cell[1]:
            raise ValueError(f'Fotogramma teletrasporto vuoto o fuori cella: {index}')
        frame = Image.new('RGBA', cell)
        frame.paste(figure, (x, y))
        atlas.paste(frame, (index * cell[0], 0))
    atlas.save(output_path('character-teleport.webp'), lossless=True, method=6)


def rest_frames(name):
    sheet = load(name)
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
    atlas.save(output_path(name), lossless=True, method=6)


def export_character():
    sheet = load('Frank e il gatto calico in movimento(1).png')
    export_motion(sheet)
    export_teleport(load('Teletrasporto cyberpunk di ragazzo e gatto.png'))
    export_atlas([rest_frames('Otto fotogrammi_ gatta calico tra le gambe.png')], 'character-idle.webp')
    export_atlas([rest_frames('Animazione pixel_ ragazzo accarezza la gatta.png')], 'character-pet.webp')


if __name__ == '__main__':
    background = load('Metropoli cyberpunk tra pianeti lontani.png').convert('RGB')
    background.save(output_path('universe.webp'), quality=88, method=6)
    export_character()
    for name in ['universe.webp', 'character-motion.webp', 'character-teleport.webp', 'character-idle.webp', 'character-pet.webp']:
        print(f'{name}: {output_path(name).stat().st_size // 1024} KB')
