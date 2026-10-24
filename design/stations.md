# Postazioni: audit e registrazione

Verificati gli originali PNG e gli atlanti WebP prima dell'intervento.

| Postazione | Asset effettivamente disponibile | Uso |
| --- | --- | --- |
| Home | Riposo, carezza, camminata/corsa in `assets/sprite/` | Conservati, senza attrezzatura sulla zona di sosta |
| About | `Animazione cyberpunk_ Frank e il gatto.png`, 1774 × 887 | Otto pose composite: scrivania, Frank alla tastiera, calica attorno alle gambe |
| Contact | `Tecnico e gatto regolano la parabola.png`, 1774 × 887 | Otto pose composite: preparazione, pannello, regolazione, ritorno in piedi; nessun ciclo di preparazione |
| Projects | Nessun proiettore o foglio di interazione trovato | Piazzola libera, riferimenti pronti, solo animazione base dei protagonisti |

I fogli base erano già esportati e animati; i due compositi non erano usati.
La scrivania era nel contenuto About e la radio nel contenuto Contact, separate
dalla passerella. La ringhiera era una fascia continua. Ora le postazioni sono
figlie dello stesso mondo dell'avatar; l'area dei contenuti resta indipendente.

## Coordinate

Il canvas di ogni composito è 144 × 136, con pavimento a y=132 e margine
orizzontale di 8 pixel. La quota della passerella coincide con y=132. Il piano
superiore dei pontili comincia quattro pixel più indietro/in alto; il bordo
frontale e i supporti si sviluppano sotto i piedi.

| Postazione | Arresto Frank | Appoggio attrezzatura | Area calica (x, y, w, h) | Comandi |
| --- | --- | --- | --- | --- |
| Home | 72,132 | — | 28,112,92,20 | — |
| About | 85,132 | 68,129 | 36,108,96,24 | Tastiera 66,81 |
| Projects | 48,132 | Riservato 104,132 | 8,112,64,20 | Da registrare sull'asset mancante |
| Contact | 57,132 | 103,131 | 10,102,28,30 | Pannello 81,114; regolazione 103,100 |

Gli appoggi dell'attrezzatura sono arretrati sul piano superiore. La fascia
frontale non viene usata come maschera dei protagonisti. L'interazione composita
contiene già gli incroci davanti/dietro delle zampe e delle gambe.

`tools/export-interactions.py` usa un solo rapporto di scala per ciascun foglio,
normalizzato sui 96 pixel di Frank in piedi. La seconda riga della radio inizia
dopo il corridoio trasparente a y=470, non a metà altezza: il taglio a metà
includeva frammenti dei piedi della prima riga. Non si usa il bounding box del
contenuto per riposizionare ogni frame. I piccoli spostamenti disegnati nelle
pose originali sono conservati; gli appoggi di uscita di Frank sono espliciti.

## Sequenza e interruzioni

- Avvicinamento: camminata/corsa esistente e quota costante. La durata dipende
  dalla distanza effettiva, anche quando una navigazione viene interrotta.
- Allineamento: arresto sul riferimento locale e orientamento verso i comandi.
- Interazione: un solo composito visibile, attrezzatura statica e avatar nascosti.
- Attesa: About continua il ciclo disponibile; Contact mantiene il frame 7.
- Uscita: cancellazione immediata dei timer, ripristino degli elementi statici
  e ripartenza dell'avatar dalla posa corrente. Nessun blocco di navigazione.

La modalità Lettura sposta i nodi esistenti nelle sezioni e mostra pose statiche.
Il movimento ridotto seleziona About frame 0 e Contact frame 7. Nessun nuovo
fotogramma o effetto decorativo è stato generato.

## Limiti degli asset e materiale necessario

1. **Proiettore assente.** Servono il suo sprite statico trasparente, la quota
   della base, il punto dell'emettitore e (solo quando disponibile) l'eventuale
   foglio di interazione. Il terminale Home e il piedistallo per monitor non
   sono proiettori e non vengono usati come sostituti.
2. **Posa della calica in Contact.** Il composito la mostra ferma a terra accanto
   a Frank, con una posa sulle zampe; non contiene una sequenza distinta di
   seduta. Per una seduta inequivocabile occorre una variante del composito
   Contact con la gatta seduta negli stessi riferimenti, oppure livelli separati
   compatibili. La posa originale è mantenuta, senza inventare animazioni.
3. **Attrezzature statiche e composite non identiche.** Gli originali separati
   di scrivania e radio hanno proporzioni interne diverse dalle versioni nei
   compositi. Pavimento e appoggi sono registrati, ma monitor/tastiera e disco
   possono cambiare sagoma nel passaggio. Per una sostituzione perfettamente
   identica serve una lastra statica dell'attrezzatura ricavata dallo stesso
   disegno del composito, senza personaggi. Non vengono deformati gli originali
   per nascondere questa differenza.

## Verifica

`tools/check-stations.cjs` verifica nel browser quota e aperture, assenza di
duplicazioni durante le interazioni, ciclo About, sequenza Contact non ripetuta,
cambi rapidi di tab, movimento ridotto, Lettura e layout da 1440 a 320 pixel.
Le schermate desktop/mobile sono state ispezionate anche visivamente.
