# web-portfolio

Portfolio interattivo di Francesco Spina: un viaggio in pixel art tra codice, creatività e progetti.

Sito statico senza build: HTML, CSS e JavaScript leggibili in `dist/`, la cartella pubblicata.

## Due modalità

- **Viaggio**: tappe a schermo intero, l'omino cammina lungo la passerella tra Home, About, Projects e Contact (frecce, rotella, swipe).
- **Lettura**: una pagina che scorre normalmente. È la modalità predefinita su mobile e funziona anche senza JavaScript.

## Struttura

```
dist/                 sito pubblicato
  index.html          contenuti (i segnaposto "DA COMPLETARE" hanno la classe .todo)
  style.css
  app.js
  assets/universe.webp
  assets/ui/          elementi grafici ottimizzati (WebP)
assets/               originali in PNG degli elementi grafici
design/               originale dello sfondo
tools/export-assets.py
```

## Elementi grafici

Gli originali in `assets/` vengono ritagliati, ridimensionati e convertiti in WebP con:

```
python3 tools/export-assets.py
```

Lo script stampa anche i valori di `border-image-slice` per le cornici da riportare in `style.css`.

## Anteprima in locale

```
python3 -m http.server 8080 --directory dist
```
