// Costanti di sezioni, scena e regia. Keypoint e vincoli: design/stations.md.
// MODE_KEY e JOURNEY_QUERY sono ripetuti nello script inline di index.html,
// che sceglie la modalità prima del primo paint.

export const SECTIONS = ['home', 'about', 'projects', 'contact'];
export const SECTION = Object.fromEntries(SECTIONS.map((id, index) => [id, index]));
export const SITE_TITLE = 'Francesco Spina — Space Journey';

export const MODE_KEY = 'fs-mode';
export const JOURNEY_QUERY = '(min-width: 900px) and (min-height: 640px)';

// Local coordinates use the exported 144 × 136 canvas (floor y=132).
// Keypoints are documented in design/stations.md; runtime keeps only the anchors
// used by the director. Never infer them from frame alpha bounds.
// `bay` is the canvas x of the lift shaft centre, `focus` the canvas x of the
// character + equipment group, which is the one centred in the viewport.
export const STATIONS = [
  { id: 'home', floor: 132, stop: [72, 132], bay: 72, focus: 72, equipment: null },
  { id: 'about', floor: 132, stop: [91, 132], bay: 53, focus: 56, equipment: [68, 129], frames: 8, loop: true, staticFrame: 0, actorX: [91, 91, 91, 91, 91, 91, 91, 91] },
  { id: 'projects', floor: 132, stop: [138, 132], bay: 72, focus: 72, equipment: null },
  { id: 'contact', floor: 132, stop: [61, 132], bay: 145, focus: 118, equipment: [111, 131], frames: 8, loop: false, staticFrame: 7, actorX: [61, 64, 62, 99, 98, 59, 60, 60] },
];

// Ponte modulare (unità di scena "su": il personaggio in piedi è alto 96 su).
export const STAGE = {
  bay: 330,        // passo fra due vani elevatori
  drop: 106,       // corsa del piano: copre l'allestimento più alto (parabola, 102 su)
  bays: 8,         // vani generati su ciascun lato del centro
  jumpSpeed: 280,  // su/s della camera durante il teletrasporto
  walkSpeed: 168,  // su/s fra sezioni adiacenti
  walkStride: 96,  // avanzamento della camminata per ciclo di 8 fotogrammi
  alignSpeed: 72,  // su/s per i piccoli aggiustamenti all'arrivo
};
// Consecutive stations occupy neighbouring bridge modules. Text slides have
// their own responsive pitch, projected from this same camera.
export const STATION_BAYS = 1;
export const SLIDE_GAP = 40; // minimum px between panels; preserve the viewport gutter at rest

// Sequenza della transizione (ms). Le fasi compatibili si sovrappongono:
// discesa, salita della destinazione e spostamento partono dalla richiesta.
export const TIMING = {
  lower: 360,        // discesa completa del piano
  rise: 420,         // salita completa del piano
  activate: 240,     // accensione di schermi e proiezioni
  minTravel: 120,    // mantiene leggibili anche brevi inversioni/riallineamenti
  teleportFrame: 55, // durata delle pose di scomparsa/ricomparsa
};
export const TELEPORT_FRAMES = 12; // undici pose e una cella trasparente

export const REST = {
  idleMs: 6400, // due giri della gatta prima della carezza
  petMs: 3200,
};
export const INTERACTION = {
  frameMs: 400, // durata di ogni posa di About e Contact
  alignMs: 100, // attesa fra l'arrivo e la prima posa
};
export const RADIO = {
  minDelayMs: 7000, // pausa fra due scansioni
  maxDelayMs: 12000,
  tunedDelayMs: 600, // la parabola risponde quando Frank ha finito di sintonizzarla
  frameMs: 250,
  scan: [1, 2, 3, 4, 5, 6, 7, 0, 1], // una scansione, poi torna alla posa inclinata
};
export const WHEEL = {
  cooldownMs: 800, // fra due cambi di tappa
  burstMs: 180,    // eventi più distanti iniziano un nuovo gesto
  threshold: 85,   // px accumulati per cambiare tappa
};
