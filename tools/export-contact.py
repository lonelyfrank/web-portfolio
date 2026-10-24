"""Normalizza satelliti e targhette, conservando proporzioni e trasparenza.

Ignora solo il rumore alpha quasi invisibile per misurare l'ingombro;
16 px di margine sorgente proteggono antenne, pannelli e aloni.
Gli originali restano intatti. Nessun asset viene ridisegnato.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SATELLITES = {
    'github': 'Satellite GitHub in pixel art-1.png',
    'email': 'Satellite pixel art per email-3.png',
    'linkedin': 'Satellite orbitale LinkedIn pixel art-2.png',
    'cv': 'Satellite di download in pixel art-4.png',
}
PLATES = {
    'github': 'Targhetta GitHub pixel art cyberpunk-1.png',
    'email': 'Targhetta Email cyberpunk in pixel art-2.png',
    'linkedin': 'Targhetta LinkedIn in pixel art-3.png',
    'cv': 'Targa pixel art cyberpunk Scarica CV-4.png',
}

if __name__ == '__main__':
    output = ROOT / 'dist/assets/contact'
    output.mkdir(parents=True, exist_ok=True)
    assets = [(f'satellite-{name}', source, (512, 320), (488, 296))
              for name, source in SATELLITES.items()]
    assets += [(f'cta-{name}', source, (640, 144), (608, 128))
               for name, source in PLATES.items()]
    for name, source, canvas_size, artwork_size in assets:
        with Image.open(ROOT / 'assets/contact' / source) as original:
            image = original.convert('RGBA')
            bounds = image.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
            left, top, right, bottom = bounds
            image = image.crop((max(0, left - 16), max(0, top - 16),
                                min(image.width, right + 16), min(image.height, bottom + 16)))
            image.thumbnail(artwork_size, Image.Resampling.NEAREST)
            canvas = Image.new('RGBA', canvas_size)
            canvas.paste(image, ((canvas.width - image.width) // 2, (canvas.height - image.height) // 2))
            canvas.save(output / f'{name}.webp', lossless=True, method=6)
            print(f'{name}: {bounds} → {image.size}, canvas {canvas.size}')
