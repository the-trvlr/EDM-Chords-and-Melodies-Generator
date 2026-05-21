import type { ChordInfo } from './musicTheory';
import { NOTE_NAMES, SCALE_INTERVALS, type NoteName } from './musicTheory';

export type MelodyType = 'bass' | 'lead';

export interface MelodyNote {
  midi: number;
  step: number;
  duration: number; // in 16th note steps
}

export interface MelodyStyle {
  id: string;
  name: string;
  description: string;
}

export interface GeneratedMelody {
  notes: MelodyNote[];
  type: MelodyType;
  styleId: string;
  stepsPerChord: number;
}

// Seeded PRNG for reproducible randomization
class SeededRandom {
  private state: number;
  constructor(seed: number) {
    this.state = seed;
  }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  intRange(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

// ──── Scale helpers ────

function getScaleMidiNotes(root: string, scaleType: string, octave: number): number[] {
  const rootIdx = NOTE_NAMES.indexOf(root as NoteName);
  if (rootIdx === -1) return [];
  const intervals = SCALE_INTERVALS[scaleType] || SCALE_INTERVALS.minor;
  const rootMidi = (octave + 1) * 12 + rootIdx;
  return intervals.map(i => rootMidi + i);
}

function buildFullScale(root: string, scaleType: string, lowOct: number, highOct: number): number[] {
  const notes: number[] = [];
  for (let oct = lowOct; oct <= highOct; oct++) {
    for (const n of getScaleMidiNotes(root, scaleType, oct)) notes.push(n);
  }
  notes.sort((a, b) => a - b);
  return [...new Set(notes)];
}

function nearestInScale(midi: number, scale: number[]): number {
  let best = scale[0];
  for (const n of scale) {
    if (Math.abs(n - midi) < Math.abs(best - midi)) best = n;
  }
  return best;
}

function scaleStepFrom(midi: number, steps: number, scale: number[]): number {
  const idx = scale.indexOf(nearestInScale(midi, scale));
  const target = Math.max(0, Math.min(scale.length - 1, idx + steps));
  return scale[target];
}

// ──── Genre-specific melody styles ────

interface GenreMelodyDef {
  bass: MelodyStyle[];
  lead: MelodyStyle[];
}

const GENRE_STYLES: Record<string, GenreMelodyDef> = {
  house: {
    bass: [
      { id: 'house-groove', name: 'Groovy', description: 'Classic house groove bass' },
      { id: 'house-disco', name: 'Disco', description: 'Disco-influenced walking line' },
      { id: 'house-pump', name: 'Pumping', description: 'Four-on-the-floor root pump' },
    ],
    lead: [
      { id: 'house-soulful', name: 'Soulful', description: 'Smooth soulful melody' },
      { id: 'house-vocal', name: 'Vocal Hook', description: 'Simple catchy hook' },
      { id: 'house-stab', name: 'Stab', description: 'Off-beat chord stabs' },
    ],
  },
  techno: {
    bass: [
      { id: 'techno-hypnotic', name: 'Hypnotic', description: 'Repetitive driving bass' },
      { id: 'techno-acid', name: 'Acid', description: 'TB-303 style acid line' },
      { id: 'techno-minimal', name: 'Minimal', description: 'Sparse minimal bass' },
    ],
    lead: [
      { id: 'techno-loop', name: 'Loop', description: 'Hypnotic repeating motif' },
      { id: 'techno-stab', name: 'Stab', description: 'Minimal stab pattern' },
      { id: 'techno-atmo', name: 'Atmospheric', description: 'Sparse atmospheric notes' },
    ],
  },
  trance: {
    bass: [
      { id: 'trance-rolling', name: 'Rolling', description: 'Rolling 16th note bass' },
      { id: 'trance-drive', name: 'Driving', description: 'Driving offbeat bass' },
      { id: 'trance-gate', name: 'Gated', description: 'Gated sidechain bass' },
    ],
    lead: [
      { id: 'trance-arp', name: 'Arpeggio', description: 'Classic trance arpeggio' },
      { id: 'trance-euphoric', name: 'Euphoric', description: 'Uplifting euphoric melody' },
      { id: 'trance-pluck', name: 'Pluck', description: 'Plucked melodic sequence' },
    ],
  },
  dnb: {
    bass: [
      { id: 'dnb-reese', name: 'Reese', description: 'Rolling reese bass' },
      { id: 'dnb-jump', name: 'Jump Up', description: 'Bouncy jump-up bass' },
      { id: 'dnb-sub', name: 'Sub', description: 'Deep sub bass hits' },
    ],
    lead: [
      { id: 'dnb-liquid', name: 'Liquid', description: 'Smooth liquid melody' },
      { id: 'dnb-chop', name: 'Chopped', description: 'Fast chopped pattern' },
      { id: 'dnb-pad', name: 'Pad Melody', description: 'Sustained pad tones' },
    ],
  },
  dubstep: {
    bass: [
      { id: 'dub-wobble', name: 'Wobble', description: 'Classic wobble bass' },
      { id: 'dub-growl', name: 'Growl', description: 'Aggressive growl pattern' },
      { id: 'dub-half', name: 'Halftime', description: 'Halftime sub bass' },
    ],
    lead: [
      { id: 'dub-stab', name: 'Stab', description: 'Aggressive stab lead' },
      { id: 'dub-melodic', name: 'Melodic', description: 'Melodic dubstep lead' },
      { id: 'dub-chime', name: 'Chime', description: 'Bell-like chime melody' },
    ],
  },
  futureBass: {
    bass: [
      { id: 'fb-808', name: '808', description: 'Pitched 808 sub bass' },
      { id: 'fb-groove', name: 'Groove', description: 'Bouncy groovy bass' },
      { id: 'fb-slide', name: 'Slide', description: 'Sliding portamento bass' },
    ],
    lead: [
      { id: 'fb-chords', name: 'Chord Lead', description: 'Supersaw chord melody' },
      { id: 'fb-vocal', name: 'Vocal Chop', description: 'Vocal chop style melody' },
      { id: 'fb-flute', name: 'Flute', description: 'Flute-like legato melody' },
    ],
  },
  progressiveHouse: {
    bass: [
      { id: 'prog-groove', name: 'Progressive', description: 'Progressive groove bass' },
      { id: 'prog-pluck', name: 'Pluck Bass', description: 'Plucked rhythmic bass' },
      { id: 'prog-deep', name: 'Deep', description: 'Deep rolling bass' },
    ],
    lead: [
      { id: 'prog-arp', name: 'Arpeggio', description: 'Progressive arpeggio lead' },
      { id: 'prog-melodic', name: 'Melodic', description: 'Emotional melodic lead' },
      { id: 'prog-stab', name: 'Stab', description: 'Rhythmic stab melody' },
    ],
  },
  hardstyle: {
    bass: [
      { id: 'hs-reverse', name: 'Reverse', description: 'Reverse bass kick' },
      { id: 'hs-distort', name: 'Distorted', description: 'Hard distorted bass' },
      { id: 'hs-punch', name: 'Punch', description: 'Punchy kick-bass combo' },
    ],
    lead: [
      { id: 'hs-euphoric', name: 'Euphoric', description: 'Euphoric hardstyle lead' },
      { id: 'hs-screach', name: 'Screech', description: 'Raw screech melody' },
      { id: 'hs-piano', name: 'Piano', description: 'Hardstyle piano melody' },
    ],
  },
};

const DEFAULT_STYLES: GenreMelodyDef = GENRE_STYLES.house;

export function getGenreMelodyStyles(genreId: string, type: MelodyType): MelodyStyle[] {
  const genreDef = GENRE_STYLES[genreId] || DEFAULT_STYLES;
  return genreDef[type];
}

// ──── Pattern generation with randomization ────

type PatternFn = (
  chord: ChordInfo,
  scale: number[],
  rng: SeededRandom,
  chordIdx: number,
) => MelodyNote[];

// Helper: get chord tones at a target octave
function chordTonesAt(chord: ChordInfo, targetOctave: number): number[] {
  const rootMidi = chord.midiNotes[0];
  const rootOct = Math.floor(rootMidi / 12) - 1;
  const shift = (targetOctave - rootOct) * 12;
  return chord.midiNotes.map(n => n + shift);
}

// ── BASS PATTERNS ──

const bassGroove: PatternFn = (chord, scale, rng) => {
  const tones = chordTonesAt(chord, 2);
  const root = tones[0];
  const notes: MelodyNote[] = [];
  const positions = [0, 4, 8, 12];
  for (const p of positions) {
    const note = rng.chance(0.7) ? root : rng.pick(tones);
    const dur = rng.chance(0.3) ? 2 : 4;
    notes.push({ midi: note, step: p, duration: dur });
    if (dur === 2) {
      const pass = nearestInScale(note + (rng.chance(0.5) ? 2 : -2), scale);
      notes.push({ midi: pass, step: p + 2, duration: 2 });
    }
  }
  return notes;
};

const bassWalking: PatternFn = (chord, scale, rng) => {
  const tones = chordTonesAt(chord, 2);
  const notes: MelodyNote[] = [];
  let prev = tones[0];
  for (let beat = 0; beat < 4; beat++) {
    const step = beat * 4;
    let note: number;
    if (beat === 0) {
      note = tones[0];
    } else if (beat === 3 && rng.chance(0.5)) {
      // chromatic approach to next chord root
      note = prev + (rng.chance(0.5) ? 1 : -1);
    } else {
      note = rng.pick(tones);
      if (rng.chance(0.3)) note = nearestInScale(prev + rng.intRange(-4, 4), scale);
    }
    notes.push({ midi: note, step, duration: rng.chance(0.2) ? 3 : 4 });
    prev = note;
  }
  return notes;
};

const bassPump: PatternFn = (chord, _scale, rng) => {
  const root = chordTonesAt(chord, 2)[0];
  const notes: MelodyNote[] = [];
  for (let i = 0; i < 16; i += 2) {
    if (rng.chance(0.85)) {
      const oct = rng.chance(0.2) ? 12 : 0;
      notes.push({ midi: root + oct, step: i, duration: 2 });
    }
  }
  return notes;
};

const bassRolling: PatternFn = (chord, _scale, rng) => {
  const tones = chordTonesAt(chord, 2);
  const notes: MelodyNote[] = [];
  for (let i = 0; i < 16; i++) {
    if (rng.chance(0.6)) {
      const note = rng.chance(0.7) ? tones[0] : rng.pick(tones);
      notes.push({ midi: note, step: i, duration: 1 });
    }
  }
  return notes;
};

const bassOctaveBounce: PatternFn = (chord, _scale, rng) => {
  const root = chordTonesAt(chord, 2)[0];
  const tones = chordTonesAt(chord, 2);
  const notes: MelodyNote[] = [];
  for (let i = 0; i < 8; i++) {
    const step = i * 2;
    const high = i % 2 === 1;
    let note = high ? root + 12 : root;
    if (rng.chance(0.2)) note = rng.pick(tones) + (high ? 12 : 0);
    notes.push({ midi: note, step, duration: 2 });
  }
  return notes;
};

const bassHalftime: PatternFn = (chord, _scale, rng) => {
  const tones = chordTonesAt(chord, 1);
  const root = tones[0];
  const notes: MelodyNote[] = [
    { midi: root, step: 0, duration: rng.intRange(6, 10) },
  ];
  if (rng.chance(0.5)) {
    const second = rng.pick(tones);
    notes.push({ midi: second, step: rng.intRange(8, 12), duration: rng.intRange(3, 6) });
  }
  return notes;
};

const bass808: PatternFn = (chord, scale, rng) => {
  const tones = chordTonesAt(chord, 1);
  const notes: MelodyNote[] = [];
  const hitPositions = [0];
  if (rng.chance(0.6)) hitPositions.push(rng.pick([6, 8, 10]));
  if (rng.chance(0.3)) hitPositions.push(rng.pick([3, 4, 12, 14]));
  for (const p of hitPositions) {
    let note = rng.chance(0.6) ? tones[0] : rng.pick(tones);
    if (rng.chance(0.2)) note = nearestInScale(note + rng.intRange(-3, 3), scale);
    const dur = rng.intRange(2, Math.min(6, 16 - p));
    notes.push({ midi: note, step: p, duration: dur });
  }
  return notes;
};

// ── LEAD PATTERNS ──

const leadArpeggio: PatternFn = (chord, scale, rng) => {
  const tones = chordTonesAt(chord, 5);
  const notes: MelodyNote[] = [];
  const dir = rng.chance(0.5) ? 1 : -1;
  const seq = dir === 1 ? [...tones] : [...tones].reverse();
  const stepSize = Math.max(1, Math.floor(16 / (seq.length * 2)));
  let cursor = 0;
  for (let rep = 0; rep < 2 && cursor < 16; rep++) {
    for (const tone of seq) {
      if (cursor >= 16) break;
      let note = tone;
      if (rng.chance(0.15)) note = nearestInScale(tone + rng.intRange(-2, 2), scale);
      notes.push({ midi: note, step: cursor, duration: stepSize });
      cursor += stepSize;
    }
  }
  return notes;
};

const leadMelodic: PatternFn = (chord, scale, rng) => {
  const tones = chordTonesAt(chord, 5);
  const notes: MelodyNote[] = [];
  let prev = rng.pick(tones);
  let cursor = 0;
  while (cursor < 16) {
    const dur = rng.pick([2, 3, 4]);
    if (cursor + dur > 16) break;
    let next: number;
    if (rng.chance(0.5)) {
      next = rng.pick(tones);
    } else {
      const steps = rng.intRange(-3, 3);
      next = scaleStepFrom(prev, steps, scale);
    }
    // Avoid big jumps most of the time
    if (Math.abs(next - prev) > 7 && rng.chance(0.7)) {
      next = nearestInScale(prev + rng.intRange(-4, 4), scale);
    }
    notes.push({ midi: next, step: cursor, duration: dur });
    prev = next;
    cursor += dur;
  }
  return notes;
};

const leadScaleRun: PatternFn = (chord, scale, rng) => {
  const start = nearestInScale(chordTonesAt(chord, 5)[0], scale);
  const startIdx = scale.indexOf(start);
  const dir = rng.chance(0.6) ? 1 : -1;
  const notes: MelodyNote[] = [];
  for (let i = 0; i < 8; i++) {
    const idx = Math.max(0, Math.min(scale.length - 1, startIdx + i * dir));
    const skip = rng.chance(0.1);
    if (!skip) {
      notes.push({ midi: scale[idx], step: i * 2, duration: 2 });
    }
  }
  return notes;
};

const leadSyncopated: PatternFn = (chord, scale, rng) => {
  const tones = chordTonesAt(chord, 5);
  const positions = [0, 3, 6, 8, 11, 14];
  const notes: MelodyNote[] = [];
  for (const p of positions) {
    if (rng.chance(0.8)) {
      let note = rng.pick(tones);
      if (rng.chance(0.25)) note = nearestInScale(note + rng.intRange(-3, 3), scale);
      const dur = rng.pick([2, 3]);
      if (p + dur <= 16) {
        notes.push({ midi: note, step: p, duration: dur });
      }
    }
  }
  return notes;
};

const leadStab: PatternFn = (chord, _scale, rng) => {
  const tones = chordTonesAt(chord, 5);
  const notes: MelodyNote[] = [];
  const offbeats = [2, 6, 10, 14];
  for (const p of offbeats) {
    if (rng.chance(0.7)) {
      notes.push({ midi: rng.pick(tones), step: p, duration: rng.pick([1, 2]) });
    }
  }
  return notes;
};

const leadEuphoric: PatternFn = (chord, scale, rng) => {
  const tones = chordTonesAt(chord, 5);
  const notes: MelodyNote[] = [];
  let prev = tones[0];
  const durations = [4, 4, 2, 2, 2, 2];
  let cursor = 0;
  for (const dur of durations) {
    if (cursor >= 16) break;
    let note: number;
    if (rng.chance(0.4)) {
      note = rng.pick(tones);
    } else {
      note = scaleStepFrom(prev, rng.intRange(-2, 3), scale);
    }
    notes.push({ midi: note, step: cursor, duration: Math.min(dur, 16 - cursor) });
    prev = note;
    cursor += dur;
  }
  return notes;
};

const leadChopped: PatternFn = (chord, scale, rng) => {
  const tones = chordTonesAt(chord, 5);
  const notes: MelodyNote[] = [];
  for (let i = 0; i < 16; i++) {
    if (rng.chance(0.5)) {
      let note = rng.pick(tones);
      if (rng.chance(0.3)) note = nearestInScale(note + rng.intRange(-2, 2), scale);
      notes.push({ midi: note, step: i, duration: 1 });
    }
  }
  return notes;
};

// ── Style-to-pattern mapping ──

const BASS_PATTERN_MAP: Record<string, PatternFn> = {
  'house-groove': bassGroove,
  'house-disco': bassWalking,
  'house-pump': bassPump,
  'techno-hypnotic': bassPump,
  'techno-acid': bassRolling,
  'techno-minimal': bassHalftime,
  'trance-rolling': bassRolling,
  'trance-drive': bassOctaveBounce,
  'trance-gate': bassPump,
  'dnb-reese': bassRolling,
  'dnb-jump': bassOctaveBounce,
  'dnb-sub': bassHalftime,
  'dub-wobble': bassPump,
  'dub-growl': bassRolling,
  'dub-half': bassHalftime,
  'fb-808': bass808,
  'fb-groove': bassGroove,
  'fb-slide': bassWalking,
  'prog-groove': bassGroove,
  'prog-pluck': bassOctaveBounce,
  'prog-deep': bassHalftime,
  'hs-reverse': bassPump,
  'hs-distort': bassRolling,
  'hs-punch': bassOctaveBounce,
};

const LEAD_PATTERN_MAP: Record<string, PatternFn> = {
  'house-soulful': leadMelodic,
  'house-vocal': leadEuphoric,
  'house-stab': leadStab,
  'techno-loop': leadArpeggio,
  'techno-stab': leadStab,
  'techno-atmo': leadSyncopated,
  'trance-arp': leadArpeggio,
  'trance-euphoric': leadEuphoric,
  'trance-pluck': leadScaleRun,
  'dnb-liquid': leadMelodic,
  'dnb-chop': leadChopped,
  'dnb-pad': leadEuphoric,
  'dub-stab': leadStab,
  'dub-melodic': leadMelodic,
  'dub-chime': leadArpeggio,
  'fb-chords': leadEuphoric,
  'fb-vocal': leadChopped,
  'fb-flute': leadMelodic,
  'prog-arp': leadArpeggio,
  'prog-melodic': leadMelodic,
  'prog-stab': leadStab,
  'hs-euphoric': leadEuphoric,
  'hs-screach': leadScaleRun,
  'hs-piano': leadMelodic,
};

// ──── Main generation function ────

export function generateMelody(
  chords: ChordInfo[],
  type: MelodyType,
  styleId: string,
  rootKey: string,
  scaleType: string,
  seed: number = 0,
): GeneratedMelody {
  const rng = new SeededRandom(seed * 31337 + styleId.length * 7 + (type === 'bass' ? 1 : 2));
  const scale = buildFullScale(rootKey, scaleType, 0, 7);

  const patternMap = type === 'bass' ? BASS_PATTERN_MAP : LEAD_PATTERN_MAP;
  const patternFn = patternMap[styleId] || (type === 'bass' ? bassGroove : leadMelodic);

  const allNotes: MelodyNote[] = [];
  const stepsPerChord = 16;

  chords.forEach((chord, chordIdx) => {
    const chordNotes = patternFn(chord, scale, rng, chordIdx);
    for (const note of chordNotes) {
      if (note.step >= 0 && note.step < stepsPerChord) {
        allNotes.push({
          midi: note.midi,
          step: chordIdx * stepsPerChord + note.step,
          duration: Math.min(note.duration, stepsPerChord - note.step),
        });
      }
    }
  });

  return {
    notes: allNotes,
    type,
    styleId,
    stepsPerChord,
  };
}
