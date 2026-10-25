"""Shared source/output paths for every exporter; see design/assets.json."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOGUE = json.loads((ROOT / 'design/assets.json').read_text(encoding='utf-8'))


def source_path(name):
    return ROOT / 'assets' / CATALOGUE['sources'][name]


def output_path(name):
    path = ROOT / 'dist/assets' / CATALOGUE['outputs'][name]
    path.parent.mkdir(parents=True, exist_ok=True)
    return path
