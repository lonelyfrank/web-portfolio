# web-portfolio

Portfolio interattivo di Francesco Spina: un viaggio in pixel art tra codice, creatività e progetti.

Sito statico senza build: HTML, CSS e JavaScript leggibili in `dist/`, la cartella pubblicata.

## Due modalità

- **Viaggio**: tappe a schermo intero, il personaggio e la gatta camminano tra tappe vicine (12 fps) e corrono nei salti di più tappe (18 fps). A Home la gatta gli gira intorno e Frank si china per accarezzarla; About e Contact hanno interazioni dedicate sulle piazzole. Frecce, rotella e swipe per navigare tra Home, About, Projects e Contact.
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
  assets/ui/          elementi grafici ottimizzati (WebP)
assets/               originali in PNG degli elementi grafici
  sprite/             fogli animati del ragazzo e della gatta
design/               sfondo precedente, conservato come riferimento
tools/export-assets.py
tools/export-scene.py  esportazione del nuovo sfondo e del personaggio
tools/export-props.py  skyline, banco da lavoro e arredo urbano
tools/export-interactions.py  compositi registrati e terminali delle ringhiere
tools/check-stations.cjs  regressioni browser sulle postazioni
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
Gli script richiedono Pillow. Gli originali PNG restano in `assets/`.

I nuovi fogli includono ragazzo e gatta nella stessa animazione. Camminata e corsa
usano 8 × 2 celle da 128 × 112 px; riposo e carezza sono due strisce da 8 celle.
L'esportatore segue la trasparenza tra le coppie adiacenti per limitare i tagli
alle pose che si toccano nel foglio originale. L'ancoraggio segue il ragazzo,
così il passaggio della gatta non sposta tutto il gruppo.

Il riposo dura 3,2 secondi: dopo due cicli parte una carezza di 3,2 secondi,
poi riprende il riposo. La navigazione interrompe subito la carezza. Il ciclo
funziona anche nel footer in Lettura; i timer si sospendono quando la scheda è
nascosta. Con movimento ridotto viene mostrato il primo fotogramma statico.
Velocità CSS in `dist/style.css`; tempi di spostamento e riposo in `dist/app.js`.

Le postazioni Viaggio condividono il pavimento della passerella. Le piazzole
usano i pontili esistenti; Contact ha i supporti sotto il piano. La ringhiera
è suddivisa in segmenti esterni alle piazzole e termina con i moduli laterali
originali. Home resta libera. Gli oggetti decorativi sono dietro ai soggetti.

About e Contact usano fogli compositi: Frank, gatta e attrezzatura sono una sola
immagine durante l'interazione. Il nodo statico e l'avatar itinerante vengono
nascosti insieme, quindi ripristinati all'uscita. About esegue un ciclo di 8
fotogrammi; Contact esegue una sola sequenza e attende sull'ultima posa.
In Lettura gli stessi nodi vengono spostati nelle rispettive sezioni, con pose
statiche; non vengono clonati. Il footer conserva riposo e carezza.

`STATIONS` in `dist/app.js` registra pavimento, appoggio dell'attrezzatura,
arresto di Frank, area della gatta e comandi, in coordinate locali dell'atlante
144 × 136 (pavimento y=132). L'esportatore usa rettangoli e quote misurati nei
fogli; non centra, ridimensiona o allinea ogni fotogramma sul suo contenuto.
I personaggi in piedi sono alti circa 96 pixel, come negli atlanti esistenti.
La scala CSS è comune a oggetti, personaggi, pontili e ringhiere. Su schermi
stretti la camera segue il percorso senza rimpicciolire i singoli soggetti.

La navigazione attraversa avvicinamento, allineamento, interazione, attesa e
uscita. Un cambio tab interrompe i timer e riparte dall'appoggio della posa
corrente. Il movimento ridotto mostra una posa statica. La pagina nascosta
sospende i timer delle interazioni senza ripetere la preparazione della radio.

Vedi [audit degli asset e riferimenti](design/stations.md) per i limiti degli
originali e gli asset ancora necessari. **Il proiettore non è presente:** la
piazzola Projects e i suoi riferimenti sono predisposti, senza sostituti.

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
e `BROWSER_EXECUTABLE` ai rispettivi percorsi. I controlli verificano quota,
aperture della ringhiera, proprietà esclusiva dei compositi, navigazione rapida,
radio non ripetuta, ciclo About, modalità Lettura, movimento ridotto e viewport
1440, 1024, 390 e 320 pixel. Screenshot di verifica in `/tmp/stations-*-verified.png`.
