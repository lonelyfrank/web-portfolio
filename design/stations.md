# Postazioni: asset e keypoint

## Asset attuali

| Postazione | Originale | Rendering |
| --- | --- | --- |
| Home | Riposo, carezza, camminata/corsa in `assets/sprite/` | Nessuna attrezzatura sulla zona di sosta |
| About | `Frank e il gatto calico animato.png` (1774 × 887) | Solo Frank e gatta, sopra la scrivania statica |
| Contact | `Frank e il gatto calico, otto pose.png` (1774 × 887) | Solo Frank e gatta, sopra il modulo radio persistente |
| Projects | `Proiettore olografico cyberpunk in pixel art.png` | Base del proiettore, nessuna interazione inventata |

I precedenti compositi, che includevano anche l'attrezzatura, sono stati
sostituiti dagli asset aggiornati. Gli atlanti `interaction-*.webp` ora
contengono solo i personaggi: scrivania e radio non vengono mai nascoste,
clonate o sostituite. Il cambio di sagoma delle attrezzature è eliminato.

## Riferimenti locali

Canvas 144 × 136; pavimento y=132. Il piano dei pontili inizia quattro pixel
più indietro/in alto; fascia frontale e supporti restano sotto i piedi.

| Postazione | Arresto Frank | Appoggio attrezzatura | Area calica (x,y,w,h) | Comandi |
| --- | --- | --- | --- | --- |
| Home | 72,132 | — | 28,112,92,20 | — |
| About | 91,132 | 68,129 | 36,108,96,24 | Tastiera 68,82 |
| Projects | 48,132 | 104,132 | 8,112,64,20 | Nessuna sequenza PG disponibile |
| Contact | 61,132 | 111,131 | 8,98,80,34 | Pannello 87,111; manopola 123,103 |

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

## Sequenza e scansione radio

1. Avvicinamento con camminata/corsa esistente e arresto sul riferimento locale.
2. Allineamento e sostituzione del solo avatar itinerante con il livello animato.
3. Interazione: ciclo About; una sola sequenza Contact, poi posa finale.
4. Attesa: gli oggetti restano negli stessi nodi e nelle stesse posizioni.
5. Uscita immediata e ripresa del percorso, annullando i timer dell'interazione.

Il radar ha un timer indipendente: pausa casuale fra 30.000 e 45.000 ms,
scansione singola di 2.250 ms (frame 1,2,3,4,5,6,7,0,1), poi nuova pausa.
L'immagine resta sulla posa inclinata 1 fra le scansioni. La base del modulo
mantiene posizione e dimensioni; il foglio originale anima disco e segnale.

Avvicinamento/allineamento/interazione Contact sospendono la scansione e
ripristinano subito la posa di riferimento per mantenere il contatto con i
comandi. La scansione può riprendere durante l'attesa finale. Movimento ridotto
e documento nascosto cancellano il timer; la ripresa attende un nuovo intervallo
completo, senza recuperare scansioni arretrate. Anche in Lettura la scansione
occasionale rispetta movimento ridotto e visibilità del documento.

## Limiti degli originali

La gatta Contact mantiene la posa fornita nel nuovo foglio: ferma sulle zampe,
non una seduta distinta. La coppia si sposta insieme durante la registrazione
sui comandi. Un'eventuale gatta seduta completamente indipendente richiede un
livello dedicato. Non è disponibile un'animazione di Frank col proiettore.

## Verifica

`tools/check-stations.cjs` verifica quota, aperture, attrezzature persistenti,
un solo livello dei personaggi, ciclo About, sequenza Contact non ripetuta,
cambi rapidi di tab, Lettura, movimento ridotto e viewport 1440/1024/390/320 px.
Con l'orologio del browser controlla anche pausa di 30 e 45 secondi, scansione
singola, stabilità del riquadro della radio e interruzione durante il lavoro.
I keyframe Contact sono stati controllati anche con screenshot ravvicinati.
