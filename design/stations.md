# Postazioni: asset e keypoint

I percorsi completi sono raccolti in [assets.json](assets.json). Gli originali
sono divisi per funzione in `assets/`; i derivati usati dal sito in `dist/assets/`.

## Asset attuali

| Postazione | Originale | Rendering |
| --- | --- | --- |
| Home | Riposo, carezza, camminata/corsa in `assets/sprite/` | Nessuna attrezzatura sulla zona di sosta |
| About | `Frank e il gatto calico animato.png` (1774 × 887) | Solo Frank e gatta, sopra la scrivania statica |
| Contact | `Frank e il gatto calico, otto pose.png` (1774 × 887) | Solo Frank e gatta, sopra il modulo radio persistente |
| Projects | `Proiettore olografico cyberpunk in pixel art.png` | Un emettitore centrale, 100 × 46,25 su; stato spento e acceso registrati fra loro (−7 px) |
| Kit elevatore | `Atlante modulare per elevatore meccanico.png` | Piano, bordo frontale, cilindro, stelo, vano (`lift-*.webp`) |

I precedenti compositi, che includevano anche l'attrezzatura, sono stati
sostituiti dagli asset aggiornati. Gli atlanti `interaction-*.webp` ora
contengono solo i personaggi: scrivania e radio non vengono mai nascoste,
clonate o sostituite. Il cambio di sagoma delle attrezzature è eliminato.

## Riferimenti locali

Canvas 144 × 136; pavimento y=132. Il piano dei pontili inizia quattro pixel
più indietro/in alto; fascia frontale e supporti restano sotto i piedi.

| Postazione | Arresto Frank | Appoggio attrezzatura | Area calica (x,y,w,h) | Comandi | Vano (`bay`) | Centro gruppo (`focus`) |
| --- | --- | --- | --- | --- | --- | --- |
| Home | 72,132 | Lampioni −84 / 127 | 28,112,92,20 | — | 72 | 72 |
| About | 91,132 | 68,129; lampione −35 | 36,108,96,24 | Tastiera 68,82 | 53 | 56 |
| Projects | 138,132 | Emettitore centrato a x=72 (y 130) | 74,112,64,20 | Nessuna sequenza PG disponibile | 72 | 72 |
| Contact | 61,132 | 111,131; lampione 162 | 8,98,80,34 | Pannello 87,111; manopola 123,103 | 145 | 118 |

Il piano mobile (176 su) ha la superficie a y=128, a filo della piazzola; le
attrezzature mantengono i propri appoggi (129–131), quindi mani e piedi restano
registrati come prima. Il vano è centrato su `bay`, il gruppo su `focus`.

La scrivania è larga 140 pixel locali: la tastiera coincide con le mani del
nuovo foglio. La radio passa da 91 a 102 pixel (+12,1%), mantenendo l'appoggio.
Le misure seguono tutte la stessa `--scene-unit` responsive.

`tools/export-interactions.py` usa un unico rapporto di scala per ogni foglio:
96/438 per About e 96/380 per Contact, così Frank in piedi resta alto 96 pixel.
Le righe About hanno origine y=0/443 e pavimento locale y=442/443; Contact ha
origine y=0/470 e pavimento y=460/396. I tagli evitano residui della riga sopra.
Ogni cella è isolata prima dell'inserimento nell'atlante.

About mantiene la stessa origine x=36 in tutti i frame. Per Contact i keypoint
manuali `CONTACT_HANDS` e `CONTACT_TARGETS` registrano il personaggio sul pannello
o sulla manopola. Cambia soltanto la traslazione orizzontale dei personaggi;
scala e pavimento restano costanti, anche nelle pose accovacciate. Non vengono
calcolati centri o scale dal bounding box della sagoma animata. Gli appoggi di
uscita di Frank, inclusi quelli vicino alla manopola, sono in `STATIONS.actorX`.
Frank e la gatta restano una coppia nello stesso asset: le sovrapposizioni fra
zampe e gambe sono quelle disegnate nel foglio.

## Kit dell'elevatore

`tools/export-elevator.py` ritaglia le parti sulla trasparenza (alpha > 40) e le
riduce con un rapporto per famiglia, senza deformarle:

| Parte | Atlante (px) | Scena (su) | Uso |
| --- | --- | --- | --- |
| Piano lungo | 40,60–1756,168 | 176 × 11 | Mobile, staffe a x=21 e 160 |
| Bordo frontale | 696,224–1748,300 | 214 × 15,5 | Fisso, architrave del vano |
| Cilindro | 540,348–684,608 | 26 × 47,5 | Fisso, ancorato al fondo |
| Stelo | 1020,348–1112,612 | 17 × 124 | Mobile con il piano; ripetute solo le righe cromate 30–45% |
| Vano | 68,640–976,812 | 214 × 66 | Fisso; ripetute solo le righe 68–78% (montanti e scalette) |

La corsa del piano (106 su) copre l'allestimento più alto (parabola, 102 su). Gli
steli si muovono 1:1 con il piano e scorrono dietro ai cilindri; il piano, gli
steli e i cilindri restano visibili nel vano, mentre l'allestimento si scurisce
e svanisce nel buio dell'ultimo tratto. Gli sportelli del kit non sono usati:
in vista frontale si aprirebbero nella faccia della passerella proprio sotto i
piedi di Frank.

## Sequenza e scansione radio

1. Uscita dall'interazione: l'avatar riparte dall'appoggio della posa corrente.
2. Spegnimento del proiettore, del fascio e della card; i testi seguono la camera.
3. Al clic partono insieme discesa della postazione attuale (360 ms), salita
   della destinazione (420 ms) e movimento. Un vano occupato completa prima
   la discesa; durante i cambi rapidi le animazioni ripartono dalla quota corrente.
   La postazione Projects emerge spenta: proiettore, fascio e card si accendono
   soltanto quando Frank ha completato il viaggio e il piano è fermo. Il fascio
   si spegne immediatamente alla partenza, prima del movimento della camera.
4. Trasferimento di un modulo per sezione: fra sezioni adiacenti si cammina a 168 su/s,
   con 8 fotogrammi in 571 ms (falcata 96 su); i salti di più sezioni usano
   la corsa a 280 su/s, con 16 fotogrammi in 429 ms (falcata 120 su).
   Due sezioni percorrono circa 660 su in 2,4 s, tre circa 990 su in 3,5 s;
   i piccoli spostamenti verso la postazione modificano leggermente la durata.
   La stessa regola vale per navbar, frecce, rotella, swipe e hash.
   Titoli e pannelli seguono la camera del ponte con la stessa traslazione
   orizzontale delle postazioni; i cambi rapidi ripartono dalla posizione visibile.
   All'arrivo tornano esattamente alla posizione di lettura, senza spostamenti
   dovuti al riciclo dei moduli. In Lettura e con movimento ridotto restano fermi.
5–6. Arrivo alla postazione già alzata; per i ritorni molto brevi si attende
   soltanto il completamento dei movimenti dell'elevatore ancora in corso.
7. All’arrivo si accende la proiezione Projects; le altre postazioni conservano la loro regia.
8. Interazione: ciclo About; una sola sequenza Contact, poi posa finale.

About mantiene soltanto la scena della scrivania: console, schede e cavo HTML
sono stati rimossi. Biografia, competenze e formazione restano visibili nella
parte superiore dalla selezione della sezione, senza attendere la salita o
l'interazione. Seguono la camera del ponte come gruppo rigido, senza dipendere dall’elevatore. La fascia contenuti scorre
verticalmente quando necessario, mentre la scena conserva scala e animazioni.
Le regole di comparsa e collegamento sopra descritte rimangono per Projects.
`tools/check-about.cjs` verifica layout, scorrimento, accessibilità e
movimento ridotto da 320 a 1920 px, in entrambe le modalità.

Contact segue la stessa separazione: titolo e messaggio a sinistra, quattro
satelliti su due colonne a destra, scena nella fascia inferiore. Il monitor
dei canali e il relativo cavo HTML sono rimossi, senza modificare radio,
personaggi, keypoint o elevatore. I contenuti seguono la camera come gruppo rigido e restano
consultabili durante il trasferimento. `tools/check-contact.cjs` verifica
anche focus, fluttuazione, assenza del vecchio pannello, composizione senza
scroll sui desktop bassi e scorrimento accessibile su mobile.

Il radar ha un timer indipendente: pausa casuale fra 30.000 e 45.000 ms,
scansione singola di 2.250 ms (frame 1,2,3,4,5,6,7,0,1), poi nuova pausa.
L'immagine resta sulla posa inclinata 1 fra le scansioni. La base del modulo
mantiene posizione e dimensioni; il foglio originale anima disco e segnale.

In Viaggio la scansione è attiva solo con Contact ferma in attesa: transizioni,
lavoro di Frank, movimento ridotto e documento nascosto cancellano il timer; la
ripresa attende un nuovo intervallo completo. In Lettura la scansione occasionale
rispetta movimento ridotto e visibilità del documento.

## Limiti degli originali

La gatta Contact mantiene la posa fornita nel nuovo foglio: ferma sulle zampe,
non una seduta distinta. La coppia si sposta insieme durante la registrazione
sui comandi. Un'eventuale gatta seduta completamente indipendente richiede un
livello dedicato. Non è disponibile un'animazione di Frank col proiettore.

Projects non ha un'animazione di Frank: all'arrivo resta nella posa di riposo
accanto al proiettore centrale. I salti di più aree percorrono un modulo del ponte per
sezione saltata. Con un resize durante un
trasferimento la scena riprende dalla camera corrente; documento nascosto e
movimento ridotto presentano invece direttamente la composizione finale.

## Verifica

`tools/check-stations.cjs` verifica un solo vano alzato e un solo allestimento
visibile, quote di piano, piastra e piedi, sequenza About → Projects, viaggio
inverso, cambi rapidi, ritorno a metà trasferimento, tastiera/rotella/hash,
documento nascosto, resize, 1366/1440/1920 senza pannelli tagliati, movimento
ridotto, Lettura, focus, mobile e tempi del radar (orologio del browser).
I keyframe Contact e la registrazione delle mani sono stati controllati anche
con screenshot ravvicinati.
