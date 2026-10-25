"""Check the whole local asset graph, image integrity and generated catalogue."""
import ast
import json
import re
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

from PIL import Image
from asset_paths import ROOT, CATALOGUE
from importlib.util import module_from_spec, spec_from_file_location


class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.references, self.fragments, self.labels = [], [], [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        for key in ('src', 'href'):
            value = attrs.get(key)
            if not value:
                continue
            parsed = urlsplit(value)
            if parsed.scheme or parsed.netloc:
                continue
            if parsed.path:
                self.references.append(unquote(parsed.path))
            elif parsed.fragment:
                self.fragments.append(parsed.fragment)
        self.labels.extend(attrs.get('aria-labelledby', '').split())
        if tag == 'img':
            assert 'alt' in attrs, f'Image missing alt: {attrs}'


def check():
    dist = ROOT / 'dist'
    html = (dist / 'index.html').read_text(encoding='utf-8')
    document = Document()
    document.feed(html)
    duplicates = [name for name, count in Counter(document.ids).items() if count > 1]
    assert not duplicates, f'Duplicate IDs: {duplicates}'
    # detail-title is deliberately created only when opening the dialog.
    assert set(document.labels) - set(document.ids) == {'detail-title'}
    assert not set(document.fragments) - set(document.ids), 'Broken local fragment'
    references = set(document.references)
    for css in dist.glob('*.css'):
        references.update(re.findall(r'url\([\'"]?([^\'"\)]+)', css.read_text(encoding='utf-8')))
    for reference in references:
        assert (dist / reference).is_file(), f'Missing local resource: {reference}'

    outputs = set(CATALOGUE['outputs'].values())
    assert outputs == {p.relative_to(dist / 'assets').as_posix() for p in (dist / 'assets').rglob('*.webp')}
    assert outputs == {ref.removeprefix('assets/') for ref in references if ref.startswith('assets/')}, 'Unused or uncatalogued runtime asset'
    originals = {f'assets/{path}' for path in CATALOGUE['sources'].values()}
    originals.update(path for path in CATALOGUE['references'] if path.startswith('assets/'))
    assert originals == {p.relative_to(ROOT).as_posix() for p in (ROOT / 'assets').rglob('*.png')}, 'Uncatalogued original'
    images = originals | set(CATALOGUE['references']) | {f'dist/assets/{path}' for path in outputs}
    for relative in sorted(images):
        with Image.open(ROOT / relative) as image:
            image.verify()

    for script in (ROOT / 'tools').glob('*.py'):
        ast.parse(script.read_text(encoding='utf-8'), filename=str(script))
    spec = spec_from_file_location('render_projects', ROOT / 'tools/render-projects.py')
    renderer = module_from_spec(spec)
    spec.loader.exec_module(renderer)
    assert html == renderer.rendered_html(), 'Run python3 tools/render-projects.py to update the project catalogue'
    hosting = json.loads((ROOT / '.openai/hosting.json').read_text(encoding='utf-8'))
    assert hosting['static']['directory'] == 'dist'
    print(f'PASS: {len(originals)} originals, {len(outputs)} runtime assets, image integrity, local URLs, IDs, catalogue, Python syntax and hosting path.')


if __name__ == '__main__':
    try:
        check()
    except (AssertionError, OSError, ValueError) as error:
        sys.exit(str(error))
