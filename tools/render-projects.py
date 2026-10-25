"""Render the single project catalogue into semantic HTML (also works without JS)."""
import json
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
START, END = '<!-- PROJECT CATALOGUE -->', '<!-- /PROJECT CATALOGUE -->'

def render():
    projects = json.loads((ROOT / 'design/projects.json').read_text())
    articles = []
    for i, project in enumerate(projects, 1):
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
    file = ROOT / 'dist/index.html'
    text = file.read_text()
    before, rest = text.split(START)
    _, after = rest.split(END)
    file.write_text(before + START + '\n' + '\n'.join(articles) + '\n      ' + END + after)

if __name__ == '__main__':
    render()
