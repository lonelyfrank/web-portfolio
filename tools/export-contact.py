"""Normalizza satelliti e targhette, conservando proporzioni e trasparenza.

Ignora solo il rumore alpha quasi invisibile per misurare l'ingombro;
16 px di margine sorgente proteggono antenne, pannelli e aloni.
Gli originali restano intatti. Nessun asset viene ridisegnato.
"""
from assetlib import alpha_bbox, source_path, output_path
from PIL import Image

SATELLITES = {
    'github': 'satellite_github.png',
    'email': 'satellite_email.png',
    'linkedin': 'satellite_linkedin.png',
    'cv': 'satellite_cv_download.png',
}
PLATES = {
    'github': 'cta_plate_github.png',
    'email': 'cta_plate_email.png',
    'linkedin': 'cta_plate_linkedin.png',
    'cv': 'cta_plate_cv_download.png',
}

if __name__ == '__main__':
    assets = [(f'satellite-{name}', source, (512, 320), (488, 296))
              for name, source in SATELLITES.items()]
    assets += [(f'cta-{name}', source, (640, 144), (608, 128))
               for name, source in PLATES.items()]
    for name, source, canvas_size, artwork_size in assets:
        with Image.open(source_path(source)) as original:
            image = original.convert('RGBA')
            bounds = alpha_bbox(image, 8)
            left, top, right, bottom = bounds
            image = image.crop((max(0, left - 16), max(0, top - 16),
                                min(image.width, right + 16), min(image.height, bottom + 16)))
            image.thumbnail(artwork_size, Image.Resampling.NEAREST)
            canvas = Image.new('RGBA', canvas_size)
            canvas.paste(image, ((canvas.width - image.width) // 2, (canvas.height - image.height) // 2))
            canvas.save(output_path(f'{name}.webp'), lossless=True, method=6)
            print(f'{name}: {bounds} → {image.size}, canvas {canvas.size}')
