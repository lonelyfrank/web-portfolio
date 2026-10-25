# Revisione del portfolio — 25 ottobre 2026

Intervento locale sul corpo esistente del sito. Contenuti, destinazioni,
composizione grafica, modalità e meccanica del viaggio sono conservati.
Nessuna pubblicazione o modifica della configurazione di accesso Sites.

## Ambito analizzato

La revisione comprende tutti i file applicativi, gli strumenti, la
documentazione e i file di configurazione del progetto, oltre all’inventario
completo delle immagini. `.git` e le directory di supporto dell’ambiente non
sono sorgenti applicative e non sono state modificate.

| File o gruppo | Analisi e risultato |
| --- | --- |
| `dist/index.html` | Struttura semantica, link, ancore, ordine degli script, pre-caricamenti e avvio. Aggiornati percorsi, preferenze iniziali e classi per testo accessibile. |
| `dist/app.js` | Regia, attese, cancellazioni, resize, normalizzazione, sprite, radio, focus, tastiera, rotella, swipe, visibilità e movimento ridotto. Corretti i casi descritti sotto. |
| `dist/projects.js` | Selezione unica, annullamento, decodifica, focus e stato dei controlli. Aggiunto timeout recuperabile e cancellazione esplicita della decodifica. |
| `dist/skills.js` | Distribuzione, ricambio, puntatore, resize, visibilità e preferenze. Algoritmo conservato e verificato con quattro sequenze casuali riproducibili. |
| `dist/contact.js` | Osservatori, visibilità e pausa; comportamento conservato e verificato. |
| `dist/style.css` | Cascade, responsive, keyframe e selettori dinamici. Rimossi residui non più usati; unificate regole di movimento e testo accessibile. |
| `dist/projects.css` | Eliminati override delle vecchie cornici; presentazione attuale mantenuta come regola di base. |
| `dist/favicon.svg`, `dist/og.jpg` | Favicon e immagine social conservati; integrità delle immagini verificata. L’URL assoluto social richiede ancora il dominio. |
| Tutti gli originali in `assets/` | 63 PNG verificati e confrontati byte per byte con la revisione iniziale. Sei riferimenti non attivi conservati separatamente. |
| Tutte le immagini in `dist/assets/` | 77 WebP attivi inventariati, referenziati dal sito e rigenerabili con pixel identici. Rimossi sette derivati inutilizzati. |
| `design/projects.json` | Contenuti, collegamenti e corrispondenza con HTML verificati; dati conservati. |
| `design/stations.md`, `design/universe.png` | Coordinate e riferimento grafico conservati; corrette le descrizioni obsolete di camera e resize. |
| `tools/export-assets.py` | Ora esporta l’intero insieme, inclusi elevatore, competenze, contatti e progetti; non ricrea derivati obsoleti. |
| `tools/export-scene.py`, `export-props.py`, `export-interactions.py`, `export-elevator.py` | Verificati ritagli, registrazione, keypoint e percorsi; coordinate e campionamento conservati. |
| `tools/export-skills.py`, `export-contact.py`, `export-projects.py` | Verificati canvas, trasparenza e nomi; percorsi condivisi tramite catalogo. |
| `tools/render-projects.py` | Rendering separato dalla scrittura per controllare il catalogo senza modificare HTML. |
| Le sei suite browser preesistenti | Lette integralmente, configurazione condivisa ed esecuzione sul refactor. |
| `README.md`, `.openai/hosting.json` | README riscritto sul funzionamento attuale; identità Sites e directory `dist` conservate. |
| Nuovi strumenti di controllo | `check-assets.py`, `check-exports.py`, `check-lifecycle.cjs`, `check-appearance.cjs`, `check-all.cjs`, `browser-settings.cjs` e `asset_paths.py`. |
| `.gitignore`, `design/assets.json` | Cache Python escluse; percorsi di ogni originale, derivato e riferimento esplicitati. |

## Correzioni

- **Interruzioni:** cancellare un timer della regia ora risolve anche la sua
  Promise. Le animazioni di piano e allestimento sono congelate alla quota
  renderizzata e cancellate anche quando si passa a Lettura, evitando lavoro
  pendente su una scena nascosta.
- **Scorrimento:** la rotella controlla tutti gli antenati scorrevoli fino alla
  sezione attiva. Un contenitore interno senza scroll non sottrae più il gesto
  alla pagina. Delta in righe/pagine sono convertiti; piccoli gesti distanti
  nel tempo non si sommano indefinitamente.
- **Input e focus:** il link “Salta ai contenuti” non riporta più a Home;
  scorciatoie con modificatori e contenuti editabili mantengono il comportamento
  nativo. Swipe cancellati e gesti multitouch non usano coordinate obsolete.
- **Carosello:** la decodifica viene annullata insieme al cambio; una richiesta
  bloccata scade dopo 10 secondi, libera i controlli e conserva la card attuale.
  Ogni animazione conserva il proprio riferimento durante la cancellazione.
- **Lavoro per fotogramma:** misure del layout conservate durante il viaggio e
  aggiornate su modalità/resize; attributo `hidden` scritto solo quando cambia.
  Evitate ricerche ripetute dei nodi stabili.
- **Movimento:** animazioni decorative sospese a documento nascosto e bolle
  non attive ferme. Preferenza iniziale del sistema e scelta esplicita tramite
  Movimento governano lo stesso stato CSS/JS; il movimento ridotto disattiva
  anche lo scorrimento fluido della radice.
- **Pulizia:** rimossi vecchi stili monitor, segnaposto, vapore, selettori senza
  elementi e metadati di scena non letti dal runtime. Keypoint completi restano
  nel documento delle postazioni. Un’unica utility serve i testi per lettori
  di schermo.

Le velocità di camminata/corsa, i keyframe, le durate delle interazioni e la
curva lineare della camera non sono stati alterati. Il lavoro sulla fluidità
riguarda continuità delle interruzioni e riduzione del lavoro superfluo,
senza cambiare il passo dei personaggi. Non è stata misurata una percentuale
di aumento degli FPS.

## Asset

Le categorie sono `backgrounds`, `bridge`, `elevator`, `stations`, `props`,
`ships`, `sprite`, `skills`, `projects`, `contact` e `ui`. Gli originali non
usati sono in `assets/reference/`. Il catalogo completo è
[assets.json](assets.json); gli esportatori condividono `tools/asset_paths.py`.

I sette derivati rimossi erano `antenna.webp`, `dish.webp`, `platform.webp`,
`frame-monitor-cyan.webp`, `frame-monitor-pink.webp`, `exhaust.webp` e
`steam.webp`. Nessuno serve il rendering attuale; gli originali e gli atlanti
che permettono di recuperarli restano disponibili. Il totale rimosso dalla
directory pubblicabile è 199.340 byte, circa 195 KiB.

## Verifica

- Test iniziale della navigazione prima delle modifiche superato.
- Controlli statici: tutte le risorse locali, ancore, ID, inventario immagini,
  catalogo HTML, sintassi Python/JavaScript e percorso di hosting.
- Rigenerazione completa in directory temporanea: dimensioni e pixel dei
  77 asset identici ai file del sito.
- Sette suite browser: ciclo di vita, fotogrammi del viaggio, carosello,
  postazioni, About, Contact e bolle. Coprono tastiera/focus, assenza di JS,
  movimento ridotto, interruzioni, resize, visibilità e viewport da 320 a
  2560 px; anche il viewport equivalente a zoom desktop del 200%.
- Confronto visivo automatico con la revisione iniziale: 12 coppie di
  screenshot, quattro sezioni in Viaggio 1440 px, Lettura 1440 px e Lettura
  390 px, con movimento ridotto per rendere il confronto deterministico.
- Revisione visiva di screenshot desktop e mobile delle suite.

Comandi e variabili ambiente sono documentati nel [README](../README.md).
Il confronto opzionale si esegue con `node tools/check-all.cjs appearance`,
fornendo `PORTFOLIO_BASELINE_URL` per una copia originale servita separatamente.

## Limiti e contenuti ancora da fornire

La verifica browser è stata eseguita in Chromium: non certifica Safari,
Firefox o le prestazioni su dispositivi fisici. Le prove di accessibilità
riguardano DOM, focus, tastiera e preferenze, non una sessione con lettore di
schermo. L’integrità delle immagini non equivale a una revisione artistica
di ogni fotogramma originale.

Restano da fornire email, profilo LinkedIn, PDF del CV e dominio definitivo
per `og:image`. Queste mancanze erano già esplicitate nel sito e non sono
state sostituite con dati inventati. I font esterni esistenti restano in uso;
sono mantenuti i fallback di sistema.
