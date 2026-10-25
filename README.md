# web-portfolio

Portfolio interattivo di Francesco Spina: un viaggio in pixel art fra codice,
creatività e progetti. Sito statico senza build o dipendenze runtime:
`dist/` contiene direttamente la versione pubblicabile.

## Avvio locale

```sh
python3 -m http.server 8082 --bind 127.0.0.1 --directory dist
```

Aprire `http://127.0.0.1:8082`. Gli script sono moduli ES e richiedono un
server HTTP: aprendo `index.html` direttamente da file non vengono eseguiti.

I moduli non hanno dipendenze cicliche: `main.js` importa le funzionalità,
che dipendono da `stage/` e da `config`/`dom`/`state`. Lo stato condiviso è
solo in `state.js`; ogni altro stato appartiene al modulo che lo gestisce.
Aggiungendo o rinominando un modulo, aggiornare i `modulepreload` di
`index.html` (lo verifica `check-assets.py`). La configurazione Sites esistente è in
`.openai/hosting.json`; modificare i file locali non pubblica automaticamente il sito.

## Struttura

| Percorso | Responsabilità |
| --- | --- |
| `dist/index.html` | Contenuti semantici, navigazione, modalità iniziale, cataloghi generati |
| `dist/js/main.js` | Unico punto d'ingresso (modulo ES): registra i listener e compone la scena |
| `dist/js/config.js`, `dom.js`, `state.js` | Costanti di scena e regia, nodi condivisi, stato comune (sezione, fase, movimento) |
| `dist/js/navigation.js`, `mode.js`, `reading.js`, `motion.js`, `lifecycle.js`, `detail.js` | Tappe e input, Viaggio/Lettura, avanzamento, movimento ridotto, visibilità/resize, dialog |
| `dist/js/stage/` | Viaggio: `director` (regia), `camera`, `bays` (elevatori), `actor` (Frank e la gatta), `stations`, `projector`, `radio`, `rest`, `phase` |
| `dist/js/sections/` | Carosello dei progetti, bolle delle competenze, satelliti di Contact |
| `dist/css/` | `base`, `world`, `layout`, `home`, `about`, `projects`, `contact`, `stage`: caricati in quest'ordine di cascata |
| `dist/assets/` | Immagini WebP effettivamente usate dal sito |
| `assets/` | Originali PNG, conservati senza alterazioni |
| `design/assets.json` | Catalogo dei percorsi originali, esportazioni e riferimenti |
| `design/projects.json`, `design/skills.json` | Uniche sorgenti di progetti e competenze (testi, ordine, originali delle immagini) |
| `design/stations.md` | Coordinate, keypoint e vincoli degli sprite e delle postazioni |
| `design/audit.md` | Esiti, interventi e limiti delle revisioni del progetto |
| `tools/` | Esportatori, renderer e controlli locali; non sono distribuiti al browser |

## Modalità e navigazione

**Viaggio** mostra una sezione alla volta: Home, About, Projects e Contact.
La camera muove ponte, postazioni e contenuti; personaggi e attrezzature usano
una scala comune. Il comportamento predefinito si attiva da 900 × 640 CSS px.
**Lettura** è una pagina a scorrimento normale, predefinita sui dispositivi più
piccoli e disponibile anche senza JavaScript. La scelta esplicita è conservata
in `localStorage`; valori sconosciuti o storage non disponibile non impediscono
l’avvio.

Navbar, hash, frecce, rotella e swipe convergono sulla stessa regia. Le sezioni
inattive attraversano il viewport durante il viaggio ma restano escluse dal
focus tramite `inert`. Lo scroll verticale conserva la priorità nei pannelli
annidati e nella pagina: si cambia tappa solo quando nessun contenitore può
scorrere nella direzione richiesta. I delta della rotella in pixel, righe e
pagine vengono normalizzati. Gesti touch cancellati e scorciatoie con
modificatori non provocano cambi di sezione.

Una nuova destinazione interrompe le attese precedenti e riparte dalle
coordinate renderizzate. Le sezioni adiacenti usano la camminata a 168 unità
di scena/s, con cadenza sincronizzata allo spostamento dei piedi. Nei salti
fra tab distanti Frank e la gatta si teletrasportano: scompaiono sul punto di
partenza e ricompaiono su quello di arrivo, mentre la camera continua a
scorrere a 280 unità/s. Gli 11 keyframe caricati si ripercorrono al contrario
per la comparsa; una cella trasparente copre lo spostamento fra i due punti.
Clic durante l’effetto conservano la posa corrente e il resize ne riprende
l’avanzamento. La camera conserva velocità lineare durante il
tragitto; le misure del contenitore vengono aggiornate al cambio modalità
e al resize, senza ricalcolarle a ogni fotogramma.

Salita e discesa degli elevatori avvengono durante il viaggio. Il proiettore,
il fascio e la card Projects si accendono solo ad arrivo completato. Il resize
riprende il tragitto dalla camera corrente; movimento ridotto e documento
nascosto portano la scena a una composizione stabile. Il passaggio a Lettura
cancella anche le animazioni pendenti degli elevatori. Le animazioni decorative
sono sospese quando il documento è nascosto.

La preferenza iniziale di movimento segue il sistema. Il comando Movimento
permette una scelta esplicita coerente per CSS e JavaScript; un successivo
cambio della preferenza di sistema aggiorna nuovamente il controllo.

Home alterna 6,4 secondi di riposo e 3,2 secondi di carezza; About usa otto
pose in ciclo; Contact esegue una sequenza di otto pose e si ferma sull’ultima.
La radio compie una scansione di 2,25 secondi dopo una pausa casuale di 30–45
secondi. Tempi, ancoraggi e regole meccaniche sono descritti in
[design/stations.md](design/stations.md).

## Sezioni

### About

Biografia, competenze e formazione occupano tre colonne sui desktop e seguono
l’ordine di lettura sugli schermi piccoli. Le 18 immagini delle competenze
alimentano un gruppo di dieci bolle. Il ricambio casuale sostituisce una o due
bolle ogni 2,2–5 secondi; crescita e assestamento durano 1,25 secondi. Le due
varianti Windows non compaiono insieme. Il mouse muove una breve catena locale;
il tocco conserva lo scorrimento. Fuori vista e a documento nascosto il ciclo
si sospende. Con movimento ridotto o senza JavaScript compare la griglia
completa. I nomi restano sempre disponibili ai lettori di schermo.

### Projects

Il catalogo contiene cinque progetti. In Viaggio si presenta una card alla
volta, affiancata a introduzione e dettagli; in Lettura e senza JavaScript
sono visibili tutti gli articoli. Il carosello non avanza automaticamente.
Immagine, testo e annuncio accessibile condividono una sola selezione.
Le frecce nel carosello cambiano progetto; quelle nel resto della pagina
controllano il viaggio. L’approfondimento usa un dialog in Viaggio e un
`details` in Lettura.

Il cambio attende la decodifica dell’immagine richiesta, quindi esegue 150 ms
in uscita e 190 ms in ingresso. Uscita dalla sezione, cambio modalità,
movimento ridotto e documento nascosto annullano il cambio. Dopo 10 secondi
una decodifica bloccata libera i controlli, conserva il progetto corrente e
annuncia la possibilità di riprovare. Con movimento ridotto il cambio è immediato.

Per aggiornare i contenuti, modificare `design/projects.json` (o
`design/skills.json` per le competenze) ed eseguire:

```sh
python3 tools/render-content.py
```

Le immagini mantengono canvas 1056 × 704, uguale larghezza utile e base
allineata; le diverse proporzioni dell’HUD originale restano intatte.

### Contact

Il testo affianca quattro satelliti, ordinati GitHub, Email, LinkedIn e CV.
Fluttuano solo le immagini; targhette e aree dei link restano ferme. Hover e
focus sospendono la fluttuazione nella posizione corrente. Sotto 900 px in
Viaggio e fino a 1100 px in Lettura, il testo precede la griglia; sotto 361 px
la griglia ha una sola colonna.

È disponibile soltanto il collegamento GitHub. Email, profilo LinkedIn e PDF
del CV non sono ancora forniti: gli elementi sono statici, con stato non
disponibile, fuori dal percorso Tab. Per attivarli, sostituire i contenitori
con link `mailto:`, al profilo o al PDF con `download`. Il dominio definitivo
per il metadato `og:image` resta da configurare; `dist/og.jpg` è conservato.

## Asset ed esportazione

Gli originali e i WebP condividono categorie funzionali:

| Cartella | Contenuto |
| --- | --- |
| `backgrounds/` | Panorama e livelli della città |
| `bridge/` | Passerella, ringhiera, banchine, staffe e terminali della ringhiera |
| `elevator/` | Kit del vano elevatore |
| `stations/` | Scrivania, radio e proiettore |
| `props/` | Lampioni, dissuasori, cavi e moduli decorativi |
| `ships/` | Navi dello sfondo |
| `sprite/` | Personaggi, camminata, teletrasporto e interazioni |
| `skills/`, `projects/`, `contact/` | Asset delle rispettive sezioni |
| `ui/` | Cornici ancora utilizzate, insegne e terminale Home |

`assets/reference/` conserva sei originali attualmente non utilizzati, inclusi
le vecchie cornici monitor e il riferimento del personaggio. Il panorama
precedente resta in `design/universe.png`. Questi riferimenti non vengono
esportati nel sito. Nessun PNG originale è stato eliminato o ricampionato.

Pillow è richiesto soltanto per gli strumenti Python. Tutti gli esportatori
condividono `tools/assetlib.py` (percorsi da `design/assets.json`, apertura
degli originali e riquadro alfa).
Per rigenerare **tutti** i 77 WebP:

```sh
python3 tools/export-assets.py
```

Gli esportatori `export-scene.py`, `export-props.py`, `export-interactions.py`,
`export-elevator.py`, `export-skills.py`, `export-contact.py` e
`export-projects.py` possono anche essere eseguiti singolarmente. Conservano
ritagli, keypoint, dimensioni e campionamento già definiti per ogni famiglia.
Non vengono ricreati i derivati delle decorazioni rimosse.

## Verifiche

Controlli statici, senza server o browser:

```sh
python3 -B tools/check-assets.py
python3 -B tools/check-exports.py
```

Il primo verifica percorsi HTML/CSS, immagini, ID, ancore, cataloghi generati, moduli precaricati,
inventario degli originali ed esportazioni e configurazione di hosting.
Il secondo rigenera l’intero insieme in una cartella temporanea e confronta
dimensioni e pixel con i file presenti in `dist/`, senza modificarli.

Con il server locale attivo, Playwright e Chromium disponibili:

```sh
node tools/check-all.cjs
```

La suite esegue controlli statici e di sintassi, poi otto gruppi browser in
sequenza: `lifecycle`, `teleport`, `journey`, `projects`, `stations`, `about`, `contact` e
`bubbles`. È possibile selezionarne alcuni, ad esempio:

```sh
node tools/check-all.cjs lifecycle journey
```

Prima di un refactor, servire una copia della versione corrente (per esempio
sulla porta 8087) e confrontarla con quella modificata:

```sh
PORTFOLIO_BASELINE_URL=http://127.0.0.1:8087 node tools/check-all.cjs styles appearance
```

`styles` confronta, proprietà per proprietà, gli stili calcolati di ogni
elemento e pseudo-elemento in 57 stati: Lettura da 320 a 2560 px, ogni sezione
del Viaggio da 390 a 2560 px, assenza di JavaScript, pose forzate dello sprite,
dialog e `details` aperti; con movimento completo confronta animazioni e
transizioni. `appearance` acquisisce 12 coppie di screenshot con movimento
ridotto e verifica l’identità dei pixel, in Viaggio desktop e Lettura
desktop/mobile.

Gli script `check-*.cjs` restano eseguibili anche singolarmente. Per usare
installazioni esterne al progetto:

```sh
PLAYWRIGHT_MODULE=/percorso/node_modules/playwright \
BROWSER_EXECUTABLE=/percorso/chromium \
PORTFOLIO_URL=http://127.0.0.1:8082 \
SCREENSHOT_DIR=/tmp/portfolio-checks \
node tools/check-all.cjs
```

Gli screenshot sono salvati per impostazione predefinita in
`/tmp/portfolio-checks`. I controlli coprono viewport da 320 a 2560 px,
Lettura e Viaggio, assenza di JavaScript, movimento ridotto, tastiera e focus,
scroll annidato, pose degli sprite, fotogrammi intermedi, inversioni, resize,
visibilità del documento, ricambio delle bolle e timeout delle immagini.
