"""Shared helpers for every exporter and check; paths come from design/assets.json."""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CATALOGUE = json.loads((ROOT / 'design/assets.json').read_text(encoding='utf-8'))


def source_path(name):
    return ROOT / 'assets' / CATALOGUE['sources'][name]


def output_path(name):
    path = ROOT / 'dist/assets' / CATALOGUE['outputs'][name]
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def load(name):
    """An original, unchanged, as RGBA."""
    return Image.open(source_path(name)).convert('RGBA')


def alpha_bbox(image, threshold):
    """Bounds of the pixels more opaque than `threshold`, ignoring faint glow and noise."""
    return image.getchannel('A').point(lambda a: 255 if a > threshold else 0).getbbox()
