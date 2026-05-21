import type { ChordInfo } from './musicTheory';
import { NOTE_NAMES, SCALE_INTERVALS, type NoteName } from './musicTheory';

export type MelodyType = 'bass' | 'lead';
export type MelodyVariation = 0 | 1 | 2 | 3;

export interface MelodyNote {
  midi: number;
  step: number;
  duration: number; // in 16th note steps
}

export interface GeneratedMelody {
  notes: MelodyNote[];
  type: MelodyType;
  variation: MelodyVariation;
  stepsPerChord: number;
}

function getScaleMidiNotes(root: string, scaleType: string, octave: number): number[] {
  const rootIdx = NOTE_NAMES.indexOf(root as NoteName);
  if (rootIdx === -1) return [];
  const intervals = SCALE_INTERVALS[scaleType] || SCALE_INTERVALS.minor;
  const rootMidi = (octave + 1) * 12 + rootIdx;
  return intervals.map(i => rootMidi + i);
}

function nearestScaleNote(midi: number, scaleNotes: number[]): number {
  const allOctaves: number[] = [];
  for (let oct = -2; oct <= 2; oct++) {
    for (const n of scaleNotes) {
      allOctaves.push(n + oct * 12);
    }
  }
  let best = allOctaves[0];
  for (const n of allOctaves) {
    if (Math.abs(n - midi) < Math.abs(best - midi)) best = n;
  }
  return best;
}

// Bass melody patterns (octave 2)
const BASS_PATTERNS: ((chord: ChordInfo, scaleNotes: number[]) => MelodyNote[])[] = [
  // Variation 0: Root notes on beats (simple)
  (chord) => {
    const root = chord.midiNotes[0] - 24; // 2 octaves down
    return [
      { midi: root, step: 0, duration: 4 },
      { midi: root, step: 4, duration: 4 },
      { midi: root, step: 8, duration: 4 },
      { midi: root, step: 12, duration: 4 },
    ];
  },
  // Variation 1: Root-fifth pattern
  (chord) => {
    const root = chord.midiNotes[0] - 24;
    const fifth = chord.midiNotes.length >= 3 ? chord.midiNotes[2] - 24 : root + 7;
    return [
      { midi: root, step: 0, duration: 4 },
      { midi: fifth, step: 4, duration: 4 },
      { midi: root, step: 8, duration: 4 },
      { midi: fifth, step: 12, duration: 4 },
    ];
  },
  // Variation 2: Octave bounce
  (chord) => {
    const root = chord.midiNotes[0] - 24;
    return [
      { midi: root, step: 0, duration: 2 },
      { midi: root + 12, step: 2, duration: 2 },
      { midi: root, step: 4, duration: 2 },
      { midi: root + 12, step: 6, duration: 2 },
      { midi: root, step: 8, duration: 2 },
      { midi: root + 12, step: 10, duration: 2 },
      { midi: root, step: 12, duration: 2 },
      { midi: root + 12, step: 14, duration: 2 },
    ];
  },
  // Variation 3: Walking bass (root, 3rd, 5th, octave)
  (chord) => {
    const root = chord.midiNotes[0] - 24;
    const third = chord.midiNotes.length >= 2 ? chord.midiNotes[1] - 24 : root + 4;
    const fifth = chord.midiNotes.length >= 3 ? chord.midiNotes[2] - 24 : root + 7;
    return [
      { midi: root, step: 0, duration: 4 },
      { midi: third, step: 4, duration: 4 },
      { midi: fifth, step: 8, duration: 4 },
      { midi: root + 12, step: 12, duration: 4 },
    ];
  },
];

// Lead melody patterns (octave 5)
const LEAD_PATTERNS: ((chord: ChordInfo, scaleNotes: number[]) => MelodyNote[])[] = [
  // Variation 0: Arpeggio up
  (chord) => {
    const base = chord.midiNotes.map(n => n + 12);
    const notes: MelodyNote[] = [];
    const step = Math.floor(16 / base.length);
    base.forEach((midi, i) => {
      notes.push({ midi, step: i * step, duration: step });
    });
    return notes;
  },
  // Variation 1: Arpeggio up-down
  (chord) => {
    const base = chord.midiNotes.map(n => n + 12);
    const seq = [...base, ...base.slice(0, -1).reverse()];
    const step = Math.max(2, Math.floor(16 / seq.length));
    return seq.map((midi, i) => ({
      midi,
      step: i * step,
      duration: step,
    })).filter(n => n.step < 16);
  },
  // Variation 2: Melodic scale run from root
  (chord, scaleNotes) => {
    const startNote = nearestScaleNote(chord.midiNotes[0] + 12, scaleNotes);
    const allScale: number[] = [];
    for (let oct = -1; oct <= 2; oct++) {
      for (const n of scaleNotes) allScale.push(n + oct * 12);
    }
    allScale.sort((a, b) => a - b);
    const startIdx = allScale.indexOf(startNote);
    const run = allScale.slice(startIdx, startIdx + 8);
    return run.map((midi, i) => ({
      midi,
      step: i * 2,
      duration: 2,
    }));
  },
  // Variation 3: Syncopated chord tones
  (chord) => {
    const tones = chord.midiNotes.map(n => n + 12);
    return [
      { midi: tones[0], step: 0, duration: 3 },
      { midi: tones[Math.min(1, tones.length - 1)], step: 3, duration: 2 },
      { midi: tones[Math.min(2, tones.length - 1)], step: 6, duration: 2 },
      { midi: tones[0], step: 8, duration: 3 },
      { midi: tones[Math.min(2, tones.length - 1)], step: 11, duration: 3 },
      { midi: tones[Math.min(1, tones.length - 1)], step: 14, duration: 2 },
    ];
  },
];

export const VARIATION_LABELS: Record<MelodyType, string[]> = {
  bass: ['Root Notes', 'Root-Fifth', 'Octave Bounce', 'Walking Bass'],
  lead: ['Arpeggio Up', 'Arpeggio Up-Down', 'Scale Run', 'Syncopated'],
};

export function generateMelody(
  chords: ChordInfo[],
  type: MelodyType,
  variation: MelodyVariation,
  rootKey: string,
  scaleType: string,
): GeneratedMelody {
  const octave = type === 'bass' ? 2 : 5;
  const scaleNotes = getScaleMidiNotes(rootKey, scaleType, octave);
  const patterns = type === 'bass' ? BASS_PATTERNS : LEAD_PATTERNS;
  const patternFn = patterns[variation] || patterns[0];

  const allNotes: MelodyNote[] = [];
  const stepsPerChord = 16;

  chords.forEach((chord, chordIdx) => {
    const chordNotes = patternFn(chord, scaleNotes);
    for (const note of chordNotes) {
      allNotes.push({
        midi: note.midi,
        step: chordIdx * stepsPerChord + note.step,
        duration: note.duration,
      });
    }
  });

  return {
    notes: allNotes,
    type,
    variation,
    stepsPerChord,
  };
}
