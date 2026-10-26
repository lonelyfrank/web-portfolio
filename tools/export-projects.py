"""Export supplied HUDs on equal 3:2 canvases without stretching the artwork.

Only transparent padding is trimmed. Originals are retained. Every HUD has
the same visible width and centre; differing artwork ratios remain intact.
"""
import json

from assetlib import ROOT, alpha_bbox, source_path, output_path
from PIL import Image

CARDS = {project['id']: project['artwork']
         for project in json.loads((ROOT / 'design/projects.json').read_text(encoding='utf-8'))}

def export(image, target, size, artwork_width):
    # Ignore near-invisible alpha noise when measuring the supplied Casaurea PNG.
    l, t, r, b = alpha_bbox(image, 8)
    bounds = (max(0, l - 6), max(0, t - 6), min(image.width, r + 6), min(image.height, b + 6))
    image = image.crop(bounds)
    image = image.resize((artwork_width, round(image.height * artwork_width / image.width)), Image.Resampling.NEAREST)
    assert image.height <= size[1], 'Artwork must fit without cropping'
    canvas = Image.new('RGBA', size)
    top = 578 - image.height if size == (1056, 704) else (size[1] - image.height) // 2
    canvas.paste(image, ((size[0] - image.width) // 2, top))
    canvas.save(target, lossless=True, method=6)
    print(f'{target.name}: artwork {image.size}, canvas {size}')

if __name__ == '__main__':
    for name, source in CARDS.items():
        with Image.open(source_path(source)) as image:
            export(image.convert('RGBA'), output_path(f'{name}.webp'), (1056, 704), 1000)
    with Image.open(source_path('carousel_arrows_variants.png')) as source:
        # Middle-intensity arrows, isolated from the six authored variants.
        for name, bounds in [('prev', (142, 65, 270, 215)), ('next', (572, 65, 705, 215))]:
            export(source.convert('RGBA').crop(bounds), output_path(f'arrow-{name}.webp'), (128, 144), 112)
