# web-portfolio

Portfolio interattivo di Francesco Spina: un viaggio in pixel art fra codice,
creatività e progetti.

**Live: [lonelyfrank.github.io/web-portfolio](https://lonelyfrank.github.io/web-portfolio/)**

Sito statico, senza build né dipendenze runtime: `dist/` è la versione
pubblicata.

## Modalità

- **Viaggio**: una sezione alla volta (Home, About, Projects, Contact), con
  camera, ponte e personaggi animati. Si attiva da 900 × 640 px.
- **Lettura**: pagina a scorrimento normale, predefinita sui dispositivi
  piccoli e disponibile anche senza JavaScript. Segue il design in
  `dist/css/reading.css`.

La scelta è salvata in `localStorage`; il movimento ridotto segue il sistema.

## Avvio locale

```sh
python3 -m http.server 8082 --bind 127.0.0.1 --directory dist
```

Aprire `http://127.0.0.1:8082`. Gli script sono moduli ES: servono via HTTP,
non da `file://`.

## Struttura

| Percorso | Contenuto |
| --- | --- |
| `dist/index.html` | Contenuti semantici e cataloghi generati |
| `dist/js/` | `main.js` (ingresso), moduli di navigazione e modalità, `stage/` (Viaggio), `sections/` (progetti, competenze, contatti) |
| `dist/css/` | Un foglio per componente, caricati nell'ordine di cascata di `index.html` |
| `dist/assets/` | WebP usati dal sito |
| `assets/` | Originali PNG, non modificati |
| `design/` | Sorgenti di progetti (`projects.json`) e competenze (`skills.json`), catalogo asset, note su sprite e postazioni |
| `tools/` | Esportatori, renderer e controlli locali (non distribuiti) |

Aggiungendo o rinominando un modulo JS, aggiornare i `modulepreload` di
`index.html` (lo verifica `check-assets.py`).

## Contenuti

Per modificare progetti o competenze, cambiare `design/projects.json` o
`design/skills.json` e rigenerare l'HTML:

```sh
python3 tools/render-content.py
```

In Contact sono attivi GitHub e LinkedIn. Email e CV sono nascosti, come
commenti in `index.html`, finché non saranno disponibili. Il metadato
`og:image` aspetta l'URL assoluto definitivo.

## Asset

Per rigenerare i WebP da `assets/` (richiede Pillow):

```sh
python3 tools/export-assets.py
```

Gli esportatori per famiglia (`export-scene.py`, `export-props.py`, …) si
possono eseguire anche da soli.

## Verifiche

Controlli statici:

```sh
python3 -B tools/check-assets.py
python3 -B tools/check-exports.py
```

Suite browser (server locale attivo, Playwright e Chromium disponibili):

```sh
node tools/check-all.cjs               # tutto
node tools/check-all.cjs projects about # solo alcuni gruppi
```

Per usare installazioni esterne:

```sh
PLAYWRIGHT_MODULE=/percorso/node_modules/playwright \
BROWSER_EXECUTABLE=/percorso/chromium \
PORTFOLIO_URL=http://127.0.0.1:8082 \
node tools/check-all.cjs
```

I gruppi `styles` e `appearance` confrontano la versione corrente con una
copia precedente servita su un'altra porta (`PORTFOLIO_BASELINE_URL`).

## Pubblicazione

Ogni push su `main` esegue `.github/workflows/pages.yml`, che pubblica `dist/`
su GitHub Pages (Settings → Pages → Source: GitHub Actions).
