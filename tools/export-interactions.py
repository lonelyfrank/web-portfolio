"""Export registered composites. Coordinates are measured in the source sheets.

No per-frame bounding-box centering, scaling or head tracking: the desk/radio
and the floor define the coordinate system, including when Frank crouches.
Run with python3 tools/export-interactions.py (Pillow).
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets'
OUT = ROOT / 'dist/assets'
CELL = (144, 136)
FLOOR = 132


def composite(source, name, scale, row_origins, ground):
    sheet = Image.open(SRC / 'sprite' / source).convert('RGBA')
    atlas = Image.new('RGBA', (CELL[0] * 8, CELL[1]))
    for index in range(8):
        row, column = divmod(index, 4)
        # Registered grid, not the bounds of the changing silhouette.
        x, y = column * 444, row_origins[row]
        end = row_origins[row + 1] if row == 0 else sheet.height
        frame = sheet.crop((x, y, min(x + 444, sheet.width), end))
        frame = frame.resize((round(frame.width * scale), round(frame.height * scale)), Image.Resampling.NEAREST)
        atlas.paste(frame, (index * CELL[0] + 8, FLOOR - round(ground[row] * scale)))
    atlas.save(OUT / f'interaction-{name}.webp', lossless=True, method=6)


def export_interactions():
    OUT.mkdir(parents=True, exist_ok=True)
    composite('Animazione cyberpunk_ Frank e il gatto.png', 'about', 96 / 354, (0, 440), (414, 414))
    composite('Tecnico e gatto regolano la parabola.png', 'contact', 96 / 336, (0, 470), (444, 386))
    # Existing side terminals from the modular dock sheet, without stretching.
    sheet = Image.open(SRC / 'Banchine industriali modulari in pixel art.png').convert('RGBA')
    for name, box in [('left', (48, 810, 383, 960)), ('right', (1152, 810, 1492, 960))]:
        frame = sheet.crop(box)
        frame.save(OUT / 'ui' / f'rail-end-{name}.webp', lossless=True, method=6)


if __name__ == '__main__':
    export_interactions()
