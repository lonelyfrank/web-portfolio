"""Separa il kit dell'elevatore in parti riutilizzabili (richiede Pillow).

L'atlante originale resta in assets/. Ogni parte viene ritagliata sulla propria
trasparenza e ridotta con un unico rapporto per famiglia: nessuna parte viene
deformata. Lo stelo del pistone è ricomposto ripetendo il solo tratto cromato
centrale (righe identiche), così la corsa del piano resta rigida 1:1 senza
stirare la texture. Il vano è ricomposto ripetendo le righe centrali di pareti
e scalette fino alla profondità richiesta dalla scena.

Misure in unità di scena (su): il personaggio in piedi è alto 96 su.
Le immagini sono esportate a 2 px per su, come gli altri elementi di scena.
Run: python3 tools/export-elevator.py
"""
from assetlib import alpha_bbox, load, output_path

from PIL import Image

ATLAS = 'Atlante modulare per elevatore meccanico.png'
DENSITY = 2  # px per su

# Riquadri misurati sulle componenti connesse dell'atlante (alpha > 40).
PARTS = {
    'plate': (40, 60, 1756, 168),       # piano elevatore lungo, con staffe inferiori
    'edge': (696, 224, 1748, 300),      # bordo frontale fisso
    'cylinder': (540, 348, 684, 608),
    'rod': (1020, 348, 1112, 612),
    'shaft': (68, 640, 976, 812),       # vano scuro
}
# Larghezze finali in su (vedi STAGE in dist/js/config.js e .bay in dist/css/stage.css).
PLATE_W = 176
SHAFT_W = 214
SHAFT_H = 66      # dal fondo dell'architrave al fondo della scena
CYLINDER_W = 26
ROD_LENGTH = 124  # copre tutta la corsa (106 su) più l'innesto nel cilindro


def part(name):
    image = load(ATLAS)
    image = image.crop(PARTS[name])
    return image.crop(alpha_bbox(image, 40))


def scaled(image, width_su):
    scale = width_su * DENSITY / image.width
    return image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS), scale


def save(image, name):
    image.save(output_path(name), quality=90, method=6)
    print(f'{name}: {image.width} × {image.height} px = {image.width / DENSITY:g} × {image.height / DENSITY:g} su')


def repeat_rows(image, top, bottom, height):
    """Mantiene testa e piede, ripete le righe [top, bottom) fino a `height`."""
    head = image.crop((0, 0, image.width, top))
    tile = image.crop((0, top, image.width, bottom))
    foot = image.crop((0, bottom, image.width, image.height))
    result = Image.new('RGBA', (image.width, height))
    result.paste(head, (0, 0))
    y, end = top, height - foot.height
    while y < end:
        piece = tile.crop((0, 0, tile.width, min(tile.height, end - y)))
        result.paste(piece, (0, y))
        y += tile.height
    result.paste(foot, (0, end))
    return result


def export_elevator():
    plate, _ = scaled(part('plate'), PLATE_W)
    save(plate, 'lift-plate.webp')
    edge, _ = scaled(part('edge'), SHAFT_W)
    save(edge, 'lift-edge.webp')

    # Pistoni: stesso rapporto per cilindro e stelo.
    cylinder, scale = scaled(part('cylinder'), CYLINDER_W)
    save(cylinder, 'lift-cylinder.webp')
    rod = part('rod')
    rod = rod.resize((round(rod.width * scale), round(rod.height * scale)), Image.Resampling.LANCZOS)
    # Fra il 30% e il 45% lo stelo è solo cromo: staffa e occhiello restano intatti.
    rod = repeat_rows(rod, round(rod.height * .30), round(rod.height * .45), ROD_LENGTH * DENSITY)
    save(rod, 'lift-rod.webp')

    shaft, _ = scaled(part('shaft'), SHAFT_W)
    # Fra il 68% e il 78% ci sono solo montanti, scalette e rinforzi verticali:
    # le diagonali e le luci dei pilastri non vengono ripetute.
    shaft = repeat_rows(shaft, round(shaft.height * .68), round(shaft.height * .78), SHAFT_H * DENSITY)
    save(shaft, 'lift-shaft.webp')

    # Stato acceso del proiettore, registrato sul ritaglio spento esistente
    # (scostamento misurato: -7 px orizzontali, 0 verticali).
    projector = load('Proiettore olografico cyberpunk in pixel art.png')
    projector.crop((793, 648, 1514, 980)).resize((160, 74), Image.Resampling.NEAREST).save(
        output_path('projector-on.webp'), lossless=True, method=6)
    print('projector-on.webp: 160 × 74 px')


if __name__ == '__main__':
    export_elevator()
