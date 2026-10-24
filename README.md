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
  skills.js           ciclo e movimento delle sfere About
  contact.js          visibilità e pausa della fluttuazione dei satelliti
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
tools/check-journey.cjs   frame intermedi, ancoraggi, visibilità e interruzioni
tools/check-about.cjs     layout About, accessibilità e indipendenza dalla scena
tools/check-bubbles.cjs   dieci bolle, ricambio casuale simultaneo e accessibilità
tools/export-skills.py   esportazione delle sfere fornite
tools/export-contact.py  esportazione dei quattro satelliti forniti
tools/check-contact.cjs  layout Contact, focus, movimento e destinazioni
```

## Contact e satelliti

Contact ha il maxi titolo e il messaggio su quattro righe nella colonna
sinistra, con le ultime due righe in corsivo. I satelliti occupano le altre
due colonne: GitHub / Email, poi LinkedIn / Scarica CV. In Viaggio, dai 900 px
di larghezza, restano tre colonne: satelliti (massimo 220 px), targhette
(160–200 px) e spaziatura si adattano all'altezza utile sopra la scena usando
le unità container. Anche la tipografia si compatta sui desktop bassi, senza
tagliare i contenuti o nascondere le scrollbar per simulare il risultato.
Le viewport desktop verificate da 900 × 600 a 2560 × 1440 non richiedono scroll.
Sotto 900 px in Viaggio e fino a 1100 px in Lettura, il testo precede la griglia;
sotto 361 px i contatti si dispongono in una colonna. Mobile e Lettura conservano
lo scorrimento normale. I contenuti sono indipendenti dall'antenna; in Lettura
la postazione segue i contenuti.

`python3 tools/export-contact.py` esporta gli originali in `assets/contact/`
come WebP lossless trasparenti 512 × 320 in `dist/assets/contact/`. L'ingombro
viene misurato ignorando il rumore alpha ≤ 8/255, con margine aggiuntivo;
proporzioni, antenne e pannelli restano integri. Il campionamento è nearest-neighbour.
Lo stesso script esporta le quattro targhette fornite come `cta-*.webp`
trasparenti 640 × 144. Le targhette sostituiscono le etichette visibili e restano
ferme sotto i satelliti, nello stesso link; i nomi HTML restano disponibili
ai lettori di schermo senza una seconda scritta visibile. Hover e focus
illuminano leggermente la targhetta dei link disponibili, senza ridimensionarla.

Solo le immagini fluttuano di 5 px in cicli di 5,8–7,8 secondi. Le etichette
e le aree dei link restano ferme. Hover e focus sospendono il movimento nella
posizione corrente; fuori vista o con documento nascosto le animazioni sono
in pausa. Movimento ridotto, il comando Movimento e l'assenza di JavaScript
mantengono i satelliti statici. Il vecchio monitor, il cavo HTML della parabola
e i pulsanti segnaposto sono rimossi; scena e animazioni esistenti sono conservate.

L'unica destinazione disponibile è `https://github.com/lonelyfrank`.
Email, profilo LinkedIn e PDF del CV **mancano nel progetto**: i tre elementi
mostrano uno stato non disponibile, senza link inventati né controlli nel
percorso Tab. Quando forniti, i contenitori statici in `dist/index.html`
andranno convertiti in link semantici (mailto, profilo, PDF con `download`),
conservando l'ordine GitHub, Email, LinkedIn, Curriculum.

Con l'anteprima attiva sulla porta 8082, `node tools/check-contact.cjs` verifica
sedici viewport da 320 × 568 a 2560 × 1440, entrambe le modalità, assenza di
scroll su desktop in Viaggio e scorrimento accessibile su mobile,
focus, pausa su hover/focus e fuori vista, movimento ridotto e assenza di JS.
Supporta le stesse variabili browser degli altri controlli; screenshot in `/tmp`
o `SCREENSHOT_DIR`. Eseguire anche `tools/check-about.cjs` e `tools/check-stations.cjs`
per le regressioni nelle sezioni e nella scena condivisa.

## About e asset delle competenze

About usa tre colonne aperte: biografia, competenze e formazione. Sotto i
1001 px diventano una colonna nello stesso ordine. Il titolo riprende font,
peso e scala della Home. In Viaggio la composizione segue la camera insieme alla propria area del mondo,
indipendentemente dal trasferimento della scrivania; su schermi bassi il contenuto scorre sopra
la fascia della scena. In Lettura la postazione esistente segue il contenuto.

Le sfere fornite in `assets/skill/` sono esportate da
`python3 tools/export-skills.py` in `dist/assets/skills/`: WebP lossless
256 × 256 con trasparenza e campionamento nearest-neighbour. Gli originali
restano intatti; non vengono generate nuove immagini.

Il ciclo include tutti i 18 asset forniti, comprese le due varianti Windows,
come richiesto: HTML, CSS, JavaScript, Windows (due immagini), Vue, PHP,
Laravel, AEM, WordPress, Jira, Linux, GitHub, TypeScript, React, Python, Claude
e Shopify. Le varianti Windows sono distanziate nel ciclo e non compaiono
insieme. I nomi rimangono nel DOM per i lettori di schermo, senza etichette visibili.

`dist/skills.js` mantiene un gruppo compatto di dieci bolle. Ogni 2,2–5
secondi (intervallo casuale) sostituisce una bolla, oppure due insieme nel
42% dei ricambi. Le uscite privilegiano le sei bolle più periferiche e quelle più vecchie.
Una bolla centrale presente da oltre 32 secondi può lasciare il posto, così
nessun asset blocca la rotazione. Le immagini mostrate meno di recente hanno
priorità per gli ingressi. Scoppio e nascita avvengono nello stesso
fotogramma: non ci sono momenti con nove bolle o un'undicesima sovrapposta.

Le nuove immagini nascono già visibili, piccole, in interstizi triangolari
variabili tra le superstiti. Crescita e assestamento delle vicine partono
insieme e durano 1,25 secondi. Un calcolo di impacchettamento compatto
aggiorna le destinazioni solo al ricambio o al resize; non ci sono traiettorie
libere o rimbalzi continui. Il gruppo resta contenuto nella colonna delle
competenze. Il galleggiamento di 1,5 px completa il movimento senza agitare
i loghi. I sottotitoli sono nascosti visivamente; i nomi restano accessibili
ai lettori di schermo.

Il mouse scosta prima la bolla più vicina e poi una breve catena di adiacenti,
con ritardo di 110 ms per passaggio e intensità decrescente. Le altre bolle
rimangono ferme; all'uscita del puntatore il gruppo si ricompone. Il tocco
mantiene lo scorrimento della pagina senza repulsione.

Il ciclo si sospende quando il campo esce dalla vista o il documento viene
nascosto, conservando il tempo residuo delle bolle. Con movimento ridotto o
senza JavaScript compare la griglia completa statica. L'elenco rimane sempre
completo per i lettori di schermo, senza annunci live o controlli fittizi.

La formazione riporta solo Boolean / Full Stack Development e gli argomenti
già presenti; non sono state aggiunte date o certificazioni.

Per verificare: servire `dist/` su `http://127.0.0.1:8082`, poi eseguire
`node tools/check-about.cjs`, `node tools/check-bubbles.cjs` e
`node tools/check-stations.cjs`. Se necessario,
impostare `PLAYWRIGHT_MODULE`, `BROWSER_EXECUTABLE`, `PORTFOLIO_URL` e
`SCREENSHOT_DIR` per usare gli strumenti browser già installati.

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
usano 8 × 2 celle da 160 × 112 px. La camminata usa le prime due righe di
`Frank e il gatto calico in movimento(1).png` (1254 × 1254); la corsa usa le
otto pose di `Corsa pixel-art di ragazzo e gatto.png` (1774 × 887), in ordine
da sinistra a destra, prima la riga superiore e poi quella inferiore.
Riposo e carezza sono due strisce da 8 celle di 128 × 112 px.
Ogni sequenza usa una sola scala, un asse corporeo fisso e un pavimento
misurato per ciascuna riga, mantenendo la stessa scala in scena. Non
si ridimensionano o ricentrano le singole pose sul loro ingombro; oscillazioni
e salti restano quelli del disegno. I ritagli seguono lo spazio trasparente
fra le colonne per conservare anche scarpe e code vicine al bordo.

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
trasferimento Frank e la gatta camminano fra sezioni adiacenti (anche dalla
navbar) e corrono quando si saltano più sezioni. La prima riga dell'atlante
contiene la camminata, la seconda la corsa. Velocità del ponte e cadenza sono
sincronizzate da `STAGE.walkSpeed` / `walkStride` e `runSpeed` / `runStride`.
Le quattro aree hanno ancoraggi permanenti su moduli consecutivi del ponte
(`STATION_BAYS`, 330 su), senza vani vuoti intermedi. Le slide sono consecutive,
separate da un piccolo margine (minimo 40 px, `SLIDE_GAP`, oppure il margine
laterale della pagina per tenere le vicine fuori schermo a riposo), e conservano
la larghezza responsive.
La camera determina la posizione della striscia di slide interpolando fra gli
ancoraggi delle postazioni: testi e ponte condividono il progresso del viaggio,
con distanze diverse. La navigazione usa 168 su/s fra aree adiacenti e 280 su/s
nei salti: circa 2 secondi fra tab vicine, 2,3 o 3,6 secondi per due o tre aree.
La cadenza dello sprite resta naturale e sincronizzata ai piedi sul ponte.
Le brevi inversioni della camera
durano almeno 120 ms. Una richiesta durante il tragitto percorre solo la distanza
residua dalla posizione effettiva; se serve solo riallineare la camera, il
personaggio resta fermo nel mondo. La direzione dipende dalla destinazione
nel mondo, non dal segno del cambio di voce nel menu.

Home, About, Projects e Contact traslano come gruppi usando la camera renderizzata
del ponte. Titoli, testi, CTA, competenze e contatti mantengono le loro coordinate
interne; sfere e satelliti conservano animazioni locali su livelli figli.
La parallasse lontana campiona la stessa camera a velocità ridotta. All'arrivo,
`normalize()` sottrae lo stesso multiplo del modulo a camera, ancoraggi testuali
e vani, compensando la texture: non cambia la posizione sullo schermo.

Lo stato attivo governa navigazione, `inert` e focus, non la visibilità. Una
sezione inattiva resta visibile finché il suo riquadro attraversa il viewport;
le sezioni vengono posizionate prima di rimuovere `hidden`. Non ci sono
animazioni di comparsa/scomparsa né timer di uscita per i contenuti. Nei salti
si vedono anche i contenuti delle aree intermedie, senza renderli interattivi.
Lo scorrimento verticale resta disponibile dentro ogni pagina.

La regia meccanica resta indipendente: al clic si esce dall'interazione,
la postazione precedente scende e quella di destinazione sale durante il viaggio.
Proiettori, fasci e collegamenti mantengono accensione e misure sui pannelli reali.
I testi non dipendono dall'accensione o dall'altezza degli elevatori. Ogni nuova
richiesta annulla i timer della precedente e riparte dalle trasformazioni
renderizzate, conservando gli ancoraggi anche nelle inversioni. Il resize
prosegue il tragitto dalla camera corrente; cambio modalità, documento nascosto
e movimento ridotto presentano direttamente una composizione stabile.

About e Contact usano i fogli con soli Frank e gatta, registrati sui keypoint di
piedi e mani: scrivania e parabola sono oggetti statici sul piano mobile e
salgono e scendono con esso. About esegue un ciclo di 8 fotogrammi; Contact una
sola sequenza, poi attende sull'ultima posa. In Lettura gli stessi nodi vengono
spostati nelle rispettive sezioni, con pose statiche. Il footer conserva riposo
e carezza.

La parabola ruota con una scansione di 2,25 secondi seguita da una pausa casuale
di 30–45 secondi, solo con Contact ferma (o in Lettura); in transizione, con
movimento ridotto e con il documento nascosto il timer è sospeso.

Projects conserva due ologrammi, l'archivio dei progetti e il progetto selezionato,
proiettati dai rispettivi emettitori. About e Contact hanno invece composizioni
aperte, indipendenti dalle postazioni. In Lettura e senza JavaScript tutti i
contenuti restano visibili.
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

`node tools/check-journey.cjs` aggiunge verifiche dei frame intermedi in Chromium:
Home ↔ About, About ↔ Contact, Home → Contact e passaggi attraverso Projects.
Campiona le vere transizioni CSS della camera, controllando visibilità, opacità,
assenza di sovrapposizioni, spostamenti dei gruppi e allineamenti interni.
Verifica inoltre inversioni, click rapidi, normalizzazione, resize in transito,
passaggio fra modalità, movimento ridotto, focus e viewport equivalente al 200%
di zoom. Usa le stesse variabili ambiente degli altri controlli e salva i frame
`journey-*-mid.png` in `SCREENSHOT_DIR` (predefinito `/tmp`) per revisione visiva.
