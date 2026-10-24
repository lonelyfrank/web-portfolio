# web-portfolio

Portfolio interattivo di Francesco Spina: un viaggio in pixel art tra codice, creatività e progetti.

Sito statico senza build: HTML, CSS e JavaScript leggibili in `dist/`, la cartella pubblicata.

## Due modalità

- **Viaggio**: tappe a schermo intero, il personaggio cammina tra tappe vicine (12 fps) e corre nei salti di più tappe (18 fps). Frecce, rotella e swipe per navigare tra Home, About, Projects e Contact.
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
  assets/ui/          elementi grafici ottimizzati (WebP)
assets/               originali in PNG degli elementi grafici
design/               sfondo precedente, conservato come riferimento
tools/export-assets.py
tools/export-scene.py  esportazione del nuovo sfondo e del personaggio
```

## Elementi grafici

Gli originali in `assets/` vengono ritagliati, ridimensionati e convertiti in WebP con:

```
python3 tools/export-assets.py
```

Lo script stampa anche i valori di `border-image-slice` per le cornici da riportare in `style.css`.

Per esportare solo il nuovo sfondo e il personaggio: `python3 tools/export-scene.py`.
Entrambi gli script richiedono Pillow. Gli originali PNG restano in `assets/`.
Il foglio animato viene separato tramite trasparenza (i fotogrammi originali non
sono su una griglia regolare) e ricomposto in 8 × 2 celle da 96 × 112 px.
Il riposo usa gli otto fotogrammi di respirazione, riordinati dal foglio 4 × 2
in una striscia da 8 celle, con i piedi allineati. Il ciclo dura 2,4 secondi e
riprende automaticamente dopo camminata e corsa, anche nel personaggio della
modalità Lettura. Con movimento ridotto viene mostrato solo il primo fotogramma.
Velocità dei cicli in `dist/style.css`, tempi di spostamento in `dist/app.js`.

## Anteprima in locale

```
python3 -m http.server 8080 --directory dist
```
