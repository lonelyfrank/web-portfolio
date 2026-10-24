# web-portfolio

Portfolio interattivo di Francesco Spina: un viaggio in pixel art tra codice, creatività e progetti.

Sito statico senza build: HTML, CSS e JavaScript leggibili in `dist/`, la cartella pubblicata.

## Due modalità

- **Viaggio**: un'area alla volta. Frank e la gatta restano al centro della scena, il ponte e la città scorrono attorno a loro e l'allestimento dell'area (scrivania, proiettori, parabola, lampioni) sale da un vano elevatore. A Home la gatta gli gira intorno e Frank si china per accarezzarla; About e Contact hanno interazioni dedicate. Frecce, rotella, swipe, link e hash usano la stessa regia.
- **Lettura**: una pagina che scorre normalmente. È la modalità predefinita su mobile e funziona anche senza JavaScript.

## Struttura

```
dist/                 sito pubblicato
  index.html          contenuti (i segnaposto "DA COMPLETARE" hanno la classe .todo)
  style.css
  app.js
  assets/universe.webp
  assets/character-idle.webp
  assets/character-motion.webp
  assets/character-pet.webp
  assets/interaction-about.webp
  assets/interaction-contact.webp
  assets/ui/          elementi grafici ottimizzati (WebP), lift-* = kit dell'elevatore
assets/               originali in PNG degli elementi grafici
  sprite/             fogli animati del ragazzo e della gatta
design/               sfondo precedente, conservato come riferimento
tools/export-assets.py
tools/export-scene.py  esportazione del nuovo sfondo e del personaggio
tools/export-props.py  skyline, banco da lavoro e arredo urbano
tools/export-interactions.py  sprite registrati tramite keypoint, proiettore e terminali
tools/export-elevator.py  parti del kit elevatore e stato acceso del proiettore
tools/check-stations.cjs  regressioni browser sulla scena Viaggio
```

## Elementi grafici

Gli originali in `assets/` vengono ritagliati, ridimensionati e convertiti in WebP con:

```
python3 tools/export-assets.py
```

Lo script stampa anche i valori di `border-image-slice` per le cornici da riportare in `style.css`.

Per esportare solo il nuovo sfondo e il personaggio: `python3 tools/export-scene.py`.
Per esportare solo gli elementi delle scene: `python3 tools/export-props.py`.
Per le interazioni: `python3 tools/export-interactions.py`.
Per il kit dell'elevatore: `python3 tools/export-elevator.py`.
Gli script richiedono Pillow. Gli originali PNG restano in `assets/`.

I nuovi fogli includono ragazzo e gatta nella stessa animazione. Camminata e corsa
usano 8 × 2 celle da 160 × 112 px, esportate dalle quattro righe del foglio
`Frank e il gatto calico in movimento.png`; riposo e carezza sono due strisce
da 8 celle di 128 × 112 px. Il centro del personaggio e la scala restano comuni.
L'esportatore segue la trasparenza tra le coppie adiacenti per limitare i tagli
alle pose che si toccano nel foglio originale. L'ancoraggio segue il ragazzo,
così il passaggio della gatta non sposta tutto il gruppo.

Il riposo dura 3,2 secondi: dopo due cicli parte una carezza di 3,2 secondi,
poi riprende il riposo. La navigazione interrompe subito la carezza. Il ciclo
funziona anche nel footer in Lettura; i timer si sospendono quando la scheda è
nascosta. Con movimento ridotto viene mostrato il primo fotogramma statico.
Velocità CSS in `dist/style.css`; tempi di spostamento e riposo in `dist/app.js`.

### Scena Viaggio

Il ponte è modulare: ogni 330 unità di scena (su; Frank in piedi è alto 96 su)
c'è un vano elevatore appeso sotto la passerella, con piano mobile, steli,
cilindri e bordo frontale ricavati da `Atlante modulare per elevatore meccanico.png`.
La passerella resta continua sotto i piedi di Frank e della gatta: il vano si
apre dietro la corsia di camminata, la piattaforma si ferma a filo della piazzola.

Livelli, dal fondo: cielo e città (parallasse) → ringhiera e staffe → vano →
superficie della piazzola → piano mobile con l'allestimento → cilindri →
passerella → fascia della piazzola e bordo frontale → personaggio → HTML.

Ogni area ha un solo allestimento (`STATIONS` in `dist/app.js`): `bay` è la
posizione del vano nel canvas 144 × 136 dell'area, `focus` il centro del gruppo
personaggio + postazione che viene messo al centro della finestra. Durante il
trasferimento il ponte scorre alla velocità della corsa (`STAGE.runSpeed`,
cadenza da `STAGE.runStride`), la parallasse dipende dall'indice dell'area
(spostamenti limitati, mai cumulativi) e, a scena ferma, il ponte viene
rinormalizzato di un multiplo del modulo senza salti visibili.

Sequenza (`TIMING`, circa 1,5–1,8 s): uscita dall'interazione e spegnimento dei
contenuti → discesa della postazione nel vano (si scurisce e scompare) →
trasferimento → arresto → salita → accensione di schermi, fasci e collegamenti →
interazione. Ogni richiesta sostituisce la precedente: timer annullati,
animazioni riprese dal valore corrente, nessuna coda. Un ritorno rapido rialza
la stessa postazione dallo stesso vano. Resize, documento nascosto e movimento
ridotto portano subito alla composizione stabile.

About e Contact usano i fogli con soli Frank e gatta, registrati sui keypoint di
piedi e mani: scrivania e parabola sono oggetti statici sul piano mobile e
salgono e scendono con esso. About esegue un ciclo di 8 fotogrammi; Contact una
sola sequenza, poi attende sull'ultima posa. In Lettura gli stessi nodi vengono
spostati nelle rispettive sezioni, con pose statiche. Il footer conserva riposo
e carezza.

La parabola ruota con una scansione di 2,25 secondi seguita da una pausa casuale
di 30–45 secondi, solo con Contact ferma (o in Lettura); in transizione, con
movimento ridotto e con il documento nascosto il timer è sospeso.

I contenuti sono collegati alle postazioni: About è un pannello editoriale con
tre viste (Profilo, Competenze, Percorso) cablato al monitor della scrivania;
Projects ha due ologrammi, l'archivio dei progetti e il progetto selezionato,
proiettati dai rispettivi emettitori; Contact è un monitor fisico sul cavo della
parabola. In Lettura e senza JavaScript tutti i pannelli restano visibili.
Vedi l'[audit degli asset e riferimenti](design/stations.md).

## Anteprima in locale

```
python3 -m http.server 8080 --directory dist
```

## Verifica delle postazioni

Con l'anteprima attiva e Playwright disponibile:

```sh
PORTFOLIO_URL=http://127.0.0.1:8080 node tools/check-stations.cjs
```

Se Playwright o Chromium sono esterni al progetto, impostare `PLAYWRIGHT_MODULE`
e `BROWSER_EXECUTABLE` ai rispettivi percorsi. I controlli verificano un solo
vano alzato e un solo allestimento visibile, quote di piano e piedi, sequenza
About → Projects, viaggio inverso, cambi rapidi, ritorno a metà trasferimento,
tastiera, rotella e hash, documento nascosto, resize, viewport 1366 × 768,
1440 × 900 e 1920 × 1080 senza pannelli tagliati, movimento ridotto, Lettura,
focus, mobile e tempi della parabola. Screenshot di verifica in
`/tmp/stations-*-verified.png` (o in `SCREENSHOT_DIR`).
