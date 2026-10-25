"""Regenerate all runtime artwork in a temporary directory and compare pixels.

Does not write to dist/ or change the original images. Requires Pillow.
"""
import contextlib
import io
import runpy
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image
import assetlib


def check():
    with TemporaryDirectory(prefix='portfolio-exports-') as directory:
        output = Path(directory)

        def output_path(name):
            path = output / assetlib.CATALOGUE['outputs'][name]
            path.parent.mkdir(parents=True, exist_ok=True)
            return path

        original_output_path = assetlib.output_path
        assetlib.output_path = output_path
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                runpy.run_path(str(assetlib.ROOT / 'tools/export-assets.py'), run_name='__main__')
        finally:
            assetlib.output_path = original_output_path
        expected = set(assetlib.CATALOGUE['outputs'].values())
        assert expected == {p.relative_to(output).as_posix() for p in output.rglob('*.webp')}, 'Incomplete export'
        for relative in sorted(expected):
            with Image.open(output / relative) as regenerated, Image.open(assetlib.ROOT / 'dist/assets' / relative) as current:
                assert regenerated.size == current.size, f'Dimensions changed: {relative}'
                assert regenerated.convert('RGBA').tobytes() == current.convert('RGBA').tobytes(), f'Pixels changed: {relative}'
        print(f'PASS: all {len(expected)} assets regenerate with identical dimensions and pixels.')


if __name__ == '__main__':
    check()
