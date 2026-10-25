"""Render the content catalogues into semantic HTML (it also works without JS).

design/projects.json and design/skills.json are the only sources of the project
articles and of the skill list in dist/index.html, between their markers.
Run: python3 tools/render-content.py
"""
import json
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / 'dist/index.html'


def load(name):
    return json.loads((ROOT / 'design' / name).read_text(encoding='utf-8'))


def projects():
    articles = []
    for i, project in enumerate(load('projects.json'), 1):
        p = {k: escape(v) if isinstance(v, str) else v for k, v in project.items()}
        stack = ''.join(f'<li>{escape(tech)}</li>' for tech in p['stack'])
        links = ''.join(f'<a class="text-link" href="{p[key]}" target="_blank" rel="noopener">{label} ↗</a>'
                        for key, label in [('github', 'GitHub'), ('demo', 'Demo')] if p[key])
        articles.append(f'''        <article class="project" id="project-{i}" aria-labelledby="project-title-{i}">
          <div class="project-media"><img src="assets/projects/{p['id']}.webp" alt="Schermata olografica di {p['name']}" width="1056" height="704" loading="lazy" decoding="async"></div>
          <span class="micro">{i:02d} / {p['category']}</span>
          <h3 id="project-title-{i}">{p['name']}</h3>
          <p class="summary">{p['summary']}</p>
          <ul class="stack" aria-label="Tecnologie">{stack}</ul>
          <div class="project-links">{links}</div>
          <details class="case">
            <summary><span>Approfondimento</span><span aria-hidden="true">→</span></summary>
            <div class="case-body">
              <dl><dt>Il problema</dt><dd>{p['problem']}</dd><dt>La soluzione</dt><dd>{p['solution']}</dd></dl>
              <div class="case-links">{links}</div>
            </div>
          </details>
        </article>''')
    return articles


def skills():
    # Names stay available to screen readers; the bubbles are decorative.
    return [f'''            <li>
              <span class="skill-orb" aria-hidden="true">
                <img src="assets/skills/{escape(skill['id'])}.webp" alt="" width="256" height="256">
              </span>
              <span class="skill-name sr-only">{escape(skill['name'])}</span>
            </li>''' for skill in load('skills.json')]


# Marker name → (renderer, indentation of the closing marker).
CATALOGUES = {
    'SKILL CATALOGUE': (skills, '            '),
    'PROJECT CATALOGUE': (projects, '      '),
}


def rendered_html():
    text = INDEX.read_text(encoding='utf-8')
    for name, (render, indent) in CATALOGUES.items():
        start, end = f'<!-- {name} -->', f'<!-- /{name} -->'
        before, rest = text.split(start)
        _, after = rest.split(end)
        text = before + start + '\n' + '\n'.join(render()) + '\n' + indent + end + after
    return text


if __name__ == '__main__':
    INDEX.write_text(rendered_html(), encoding='utf-8')
