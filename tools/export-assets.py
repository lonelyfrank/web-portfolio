"""Esporta gli elementi grafici di assets/ (originali) in dist/assets/ui/ (WebP ottimizzati).

Uso: python3 tools/export-assets.py

Ogni immagine viene ritagliata sul contenuto opaco e ridimensionata a circa 2x la misura
a cui è mostrata nel sito. Per le cornici stampa i valori di border-image-slice da usare
nel CSS; per strada e ringhiera ritaglia un modulo ripetibile in orizzontale.
"""
from pathlib import Path
import runpy

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets'
OUT = ROOT / 'dist' / 'assets' / 'ui'


def load(name):
    return Image.open(SRC / name).convert('RGBA')


def solid_bbox(im, threshold=16):
    """Riquadro del contenuto ignorando i bagliori quasi trasparenti."""
    return im.getchannel('A').point(lambda v: 255 if v > threshold else 0).getbbox()


def save(im, name, width=None, height=None):
    if width or height:
        scale = (width / im.width) if width else (height / im.height)
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    im.save(OUT / name, 'WEBP', quality=86, method=6)
    print(f'{name:22} {im.width}x{im.height}  {(OUT / name).stat().st_size // 1024} KB')
    return im


def sprite(src, name, **size):
    im = load(src)
    return save(im.crop(solid_bbox(im)), name, **size)


def tile(src, name, x0, x1, height, pad_top=0, pad_bottom=0):
    """Modulo orizzontale ripetibile tra le colonne x0 e x1 (scelte su un giunto scuro)."""
    im = load(src)
    box = solid_bbox(im)
    return save(im.crop((x0, box[1] - pad_top, x1, box[3] + pad_bottom)), name, height=height)


def platform(src, name, cut_left, cut_right, width):
    """Pontile con entrambe le estremità: testata sinistra fino a cut_left + testata destra da cut_right.
    I due tagli cadono su giunti scuri, come per il modulo ripetibile."""
    im = load(src)
    box = solid_bbox(im)
    left = im.crop((box[0], box[1], cut_left, box[3]))
    right = im.crop((cut_right, box[1], box[2], box[3]))
    out = Image.new('RGBA', (left.width + right.width, left.height))
    out.paste(left, (0, 0))
    out.paste(right, (left.width, 0))
    return save(out, name, width=width)


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
    OUT.mkdir(parents=True, exist_ok=True)

    # Strada (modalità Viaggio) e ponte (fondo pagina in Lettura)
    tile('Modulo di passerella cyberpunk-1.png', 'walkway.webp', 825, 1346, height=96, pad_top=6, pad_bottom=6)
    tile('Modulo ringhiera cyberpunk in pixel art-2.png', 'railing.webp', 1068, 1594, height=80, pad_top=10, pad_bottom=6)
    platform('Modulo di passerella cyberpunk-1.png', 'platform.webp', 825, 1346, width=720)
    sprite('Staffa strutturale cyberpunk in pixel art-3.png', 'bracket.webp', width=440)

    # Cornici
    frame('Cornice pixel art orizzontale trasparente-1.png', 'frame-panel.webp', width=800)
    frame('Cornice monitor cyberpunk al neon-1.png', 'frame-monitor-cyan.webp', width=400)
    frame('Cornice monitor cyberpunk magenta trasparente-2.png', 'frame-monitor-pink.webp', width=400)
    frame('Cornice a freccia cyberpunk al neon.png', 'sign-arrow.webp', width=520)
    frame('Cornice cyberpunk al neon, vuota.png', 'sign.webp', width=520)

    # Oggetti
    sprite('Terminale cyberpunk a schermo trasparente-3.png', 'terminal.webp', width=640)
    sprite('Antenna cyberpunk blu notte-2.png', 'antenna.webp', height=880)
    sprite('Parabola satellitare cyberpunk-4.png', 'dish.webp', width=480)

    # Navi nel cielo
    sprite('Cargo cruiser corazzato al neon-3.png', 'ship-cargo.webp', width=640)
    sprite('Navetta pixel art con bagliori magenta-2.png', 'ship-shuttle.webp', width=440)
    sprite('Scout spaziale compatto in pixel art-1.png', 'ship-scout.webp', width=300)

    # Sfondo panoramico e personaggio con posa ferma, camminata e corsa.
    runpy.run_path(str(ROOT / 'tools' / 'export-scene.py'), run_name='__main__')
