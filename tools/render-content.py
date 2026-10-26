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
        stack_label = p.get('stack_label', 'Tecnologie')
        stack = ''.join(f'<li>{escape(tech)}</li>' for tech in p['stack'])
        links = ''.join(f'<a class="text-link" href="{p[key]}" target="_blank" rel="noopener">{label} ↗</a>'
                        for key, label in [('github', 'GitHub'), ('demo', p.get('demo_label', 'Demo'))] if p[key])
        evidence = ''.join(f'<dt>{label}</dt><dd>{p[key]}</dd>'
                           for key, label in [('contribution', 'Il mio contributo'),
                                              ('challenge', 'La difficoltà affrontata'),
                                              ('validation', 'Verifiche documentate'),
                                              ('ai', 'Uso dell’AI')]
                           if p.get(key))
        if 'case' in p:  # custom case-study labels, e.g. consulting entries
            evidence = ''.join(f'<dt>{escape(label)}</dt><dd>{escape(text)}</dd>' for label, text in p['case'])
            story = ''
        else:
            story = f"<dt>Il problema</dt><dd>{p['problem']}</dd><dt>La soluzione</dt><dd>{p['solution']}</dd>"
        articles.append(f'''        <article class="project" id="project-{i}" aria-labelledby="project-title-{i}">
          <div class="project-media"><img src="assets/projects/{p['id']}.webp" alt="Schermata olografica di {p['name']}" width="1056" height="704" loading="lazy" decoding="async"></div>
          <span class="micro">{i:02d} / {p['category']}</span>
          <h3 id="project-title-{i}">{p['name']}</h3>
          <p class="summary">{p['summary']}</p>
          <ul class="stack" aria-label="{stack_label}">{stack}</ul>
          <div class="project-links">{links}</div>
          <details class="case">
            <summary><span>Approfondimento</span><span aria-hidden="true">→</span></summary>
            <div class="case-body">
              <dl>{story}{evidence}</dl>
              <div class="case-links">{links}</div>
            </div>
          </details>
        </article>''')
    return articles


def skills():
    # Keep one entry per technology; headings are visible in Reading.
    rows, previous = [], None
    for skill in load('skills.json'):
        group = escape(skill['group'])
        if group != previous:
            rows.append(f'            <li class="skill-group"><h4>{group}</h4></li>')
            previous = group
        rows.append(f'''            <li class="skill-item" title="{escape(skill['name'])} — {group}">
              <span class="skill-orb" aria-hidden="true">
                <img src="assets/skills/{escape(skill['id'])}.webp" alt="" width="256" height="256">
              </span>
              <span class="skill-name sr-only">{escape(skill['name'])}</span>
              <span class="sr-only skill-context"> — {group}</span>
            </li>''')
    return rows


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
