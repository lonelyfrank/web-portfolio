"""Esporta le sfere fornite in assets/skills/; non modifica gli originali.

Elenco e originali in design/skills.json, una voce per tecnologia. Pillow è
già usato dagli altri esportatori. WebP lossless conserva il canale alpha.
"""
import json

from assetlib import ROOT, source_path, output_path
from PIL import Image

SKILLS = {skill['id']: skill['source']
          for skill in json.loads((ROOT / 'design/skills.json').read_text(encoding='utf-8'))}

if __name__ == '__main__':
    for name, source in SKILLS.items():
        with Image.open(source_path(source)) as image:
            image = image.convert('RGBA')
            # Uniform canvas and nearest-neighbour sampling preserve hard pixel edges.
            image.resize((256, 256), Image.Resampling.NEAREST).save(
                output_path(f'{name}.webp'), lossless=True, method=6)
    print(f'Esportate {len(SKILLS)} sfere trasparenti in dist/assets/skills')
