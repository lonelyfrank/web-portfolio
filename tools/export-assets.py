"""Esporta gli elementi grafici di assets/ (originali) in dist/assets/ (WebP organizzati per funzione).

Uso: python3 tools/export-assets.py

Ogni immagine viene ritagliata sul contenuto opaco e ridimensionata a circa 2x la misura
a cui è mostrata nel sito. Per le cornici stampa i valori di border-image-slice da usare
nel CSS; per strada e ringhiera ritaglia un modulo ripetibile in orizzontale.
"""
from asset_paths import ROOT, source_path, output_path
import runpy

from PIL import Image


def load(name):
    return Image.open(source_path(name)).convert('RGBA')


def solid_bbox(im, threshold=16):
    """Riquadro del contenuto ignorando i bagliori quasi trasparenti."""
    return im.getchannel('A').point(lambda v: 255 if v > threshold else 0).getbbox()


def save(im, name, width=None, height=None):
    if width or height:
        scale = (width / im.width) if width else (height / im.height)
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    im.save(output_path(name), 'WEBP', quality=86, method=6)
    print(f'{name:22} {im.width}x{im.height}  {output_path(name).stat().st_size // 1024} KB')
    return im


def sprite(src, name, **size):
    im = load(src)
    return save(im.crop(solid_bbox(im)), name, **size)


def tile(src, name, x0, x1, height, pad_top=0, pad_bottom=0):
    """Modulo orizzontale ripetibile tra le colonne x0 e x1 (scelte su un giunto scuro)."""
    im = load(src)
    box = solid_bbox(im)
    return save(im.crop((x0, box[1] - pad_top, x1, box[3] + pad_bottom)), name, height=height)


def frame(src, name, width):
    """Cornice per border-image: stampa lo slice (top right bottom left) nel WebP esportato."""
    im = load(src)
    box = solid_bbox(im)
    im = im.crop(box)
    alpha = im.getchannel('A')
    cx, cy = im.width // 2, im.height // 2

    def edge(dx, dy):
        x, y = cx, cy
        while 0 < x < im.width - 1 and 0 < y < im.height - 1 and alpha.getpixel((x, y)) <= 40:
            x += dx
            y += dy
        return x, y

    left, top = edge(-1, 0)[0], edge(0, -1)[1]
    right, bottom = im.width - edge(1, 0)[0], im.height - edge(0, 1)[1]
    out = save(im, name, width=width)
    k = out.width / im.width
    print(f'{"":22} border-image-slice: {round(top * k)} {round(right * k)} {round(bottom * k)} {round(left * k)}')


if __name__ == '__main__':
    # Strada (modalità Viaggio) e ponte (fondo pagina in Lettura)
    tile('Modulo di passerella cyberpunk-1.png', 'walkway.webp', 825, 1346, height=96, pad_top=6, pad_bottom=6)
    tile('Modulo ringhiera cyberpunk in pixel art-2.png', 'railing.webp', 1068, 1594, height=80, pad_top=10, pad_bottom=6)
    sprite('Staffa strutturale cyberpunk in pixel art-3.png', 'bracket.webp', width=440)

    # Cornici
    frame('Cornice pixel art orizzontale trasparente-1.png', 'frame-panel.webp', width=800)
    frame('Cornice a freccia cyberpunk al neon.png', 'sign-arrow.webp', width=520)
    frame('Cornice cyberpunk al neon, vuota.png', 'sign.webp', width=520)

    # Oggetti
    sprite('Terminale cyberpunk a schermo trasparente-3.png', 'terminal.webp', width=640)

    # Navi nel cielo
    sprite('Cargo cruiser corazzato al neon-3.png', 'ship-cargo.webp', width=640)
    sprite('Navetta pixel art con bagliori magenta-2.png', 'ship-shuttle.webp', width=440)
    sprite('Scout spaziale compatto in pixel art-1.png', 'ship-scout.webp', width=300)

    # Sfondo panoramico e personaggio con posa ferma, camminata e corsa.
    for exporter in ['scene', 'props', 'interactions', 'elevator', 'skills', 'contact', 'projects']:
        runpy.run_path(str(ROOT / 'tools' / f'export-{exporter}.py'), run_name='__main__')
