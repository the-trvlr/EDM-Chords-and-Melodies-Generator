export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

export type NoteName = typeof NOTE_NAMES[number];

export interface ChordType {
  name: string;
  symbol: string;
  intervals: number[];
}

export interface ChordInfo {
  root: string;
  type: ChordType;
  notes: string[];
  midiNotes: number[];
  display: string;
  inversion?: number; // 0 = root position, 1 = first inversion, 2 = second inversion
}

export const CHORD_TYPES: Record<string, ChordType> = {
  major: { name: 'Major', symbol: '', intervals: [0, 4, 7] },
  minor: { name: 'Minor', symbol: 'm', intervals: [0, 3, 7] },
  dim: { name: 'Diminished', symbol: 'dim', intervals: [0, 3, 6] },
  aug: { name: 'Augmented', symbol: 'aug', intervals: [0, 4, 8] },
  sus2: { name: 'Suspended 2nd', symbol: 'sus2', intervals: [0, 2, 7] },
  sus4: { name: 'Suspended 4th', symbol: 'sus4', intervals: [0, 5, 7] },
  maj7: { name: 'Major 7th', symbol: 'maj7', intervals: [0, 4, 7, 11] },
  min7: { name: 'Minor 7th', symbol: 'm7', intervals: [0, 3, 7, 10] },
  dom7: { name: 'Dominant 7th', symbol: '7', intervals: [0, 4, 7, 10] },
  dim7: { name: 'Diminished 7th', symbol: 'dim7', intervals: [0, 3, 6, 9] },
  min9: { name: 'Minor 9th', symbol: 'm9', intervals: [0, 3, 7, 10, 14] },
  maj9: { name: 'Major 9th', symbol: 'maj9', intervals: [0, 4, 7, 11, 14] },
  add9: { name: 'Add 9', symbol: 'add9', intervals: [0, 4, 7, 14] },
};

export const SCALE_INTERVALS: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
};

export type ChordComplexity = 'basic' | '7ths' | '9ths' | 'jazzy';

const SCALE_CHORD_TYPES_BY_COMPLEXITY: Record<ChordComplexity, Record<string, string[]>> = {
  basic: {
    major: ['major', 'minor', 'minor', 'major', 'major', 'minor', 'dim'],
    minor: ['minor', 'dim', 'major', 'minor', 'minor', 'major', 'major'],
    dorian: ['minor', 'minor', 'major', 'major', 'minor', 'dim', 'major'],
    phrygian: ['minor', 'major', 'major', 'minor', 'dim', 'major', 'minor'],
    lydian: ['major', 'major', 'minor', 'dim', 'major', 'minor', 'minor'],
    mixolydian: ['major', 'minor', 'dim', 'major', 'minor', 'minor', 'major'],
    locrian: ['dim', 'major', 'minor', 'minor', 'major', 'major', 'minor'],
    harmonicMinor: ['minor', 'dim', 'aug', 'minor', 'major', 'major', 'dim'],
    melodicMinor: ['minor', 'minor', 'aug', 'major', 'major', 'dim', 'dim'],
  },
  '7ths': {
    major: ['maj7', 'min7', 'min7', 'maj7', 'dom7', 'min7', 'dim7'],
    minor: ['min7', 'dim7', 'maj7', 'min7', 'min7', 'maj7', 'dom7'],
    dorian: ['min7', 'min7', 'maj7', 'dom7', 'min7', 'dim7', 'maj7'],
    phrygian: ['min7', 'dom7', 'maj7', 'min7', 'dim7', 'maj7', 'min7'],
    lydian: ['maj7', 'dom7', 'min7', 'dim7', 'maj7', 'min7', 'min7'],
    mixolydian: ['dom7', 'min7', 'dim7', 'maj7', 'min7', 'min7', 'maj7'],
    locrian: ['dim7', 'maj7', 'min7', 'min7', 'dom7', 'maj7', 'min7'],
    harmonicMinor: ['min7', 'dim7', 'maj7', 'min7', 'dom7', 'maj7', 'dim7'],
    melodicMinor: ['min7', 'min7', 'maj7', 'dom7', 'dom7', 'dim7', 'dim7'],
  },
  '9ths': {
    major: ['maj9', 'min9', 'min7', 'maj9', 'dom7', 'min9', 'dim7'],
    minor: ['min9', 'dim7', 'maj9', 'min9', 'min7', 'maj9', 'dom7'],
    dorian: ['min9', 'min9', 'maj9', 'dom7', 'min7', 'dim7', 'maj9'],
    phrygian: ['min9', 'dom7', 'maj9', 'min7', 'dim7', 'maj9', 'min7'],
    lydian: ['maj9', 'dom7', 'min7', 'dim7', 'maj9', 'min7', 'min7'],
    mixolydian: ['dom7', 'min9', 'dim7', 'maj9', 'min7', 'min7', 'maj9'],
    locrian: ['dim7', 'maj9', 'min7', 'min7', 'dom7', 'maj9', 'min7'],
    harmonicMinor: ['min9', 'dim7', 'maj9', 'min7', 'dom7', 'maj9', 'dim7'],
    melodicMinor: ['min9', 'min9', 'maj9', 'dom7', 'dom7', 'dim7', 'dim7'],
  },
  jazzy: {
    major: ['maj9', 'min9', 'sus4', 'maj7', 'dom7', 'min9', 'dim7'],
    minor: ['min9', 'dim7', 'maj9', 'sus2', 'dom7', 'maj9', 'dom7'],
    dorian: ['min9', 'min9', 'maj9', 'sus4', 'min7', 'dim7', 'maj9'],
    phrygian: ['min9', 'dom7', 'maj9', 'sus2', 'dim7', 'maj9', 'min7'],
    lydian: ['maj9', 'dom7', 'sus4', 'dim7', 'maj9', 'min7', 'min7'],
    mixolydian: ['dom7', 'min9', 'dim7', 'maj9', 'min7', 'sus2', 'maj9'],
    locrian: ['dim7', 'maj9', 'sus2', 'min7', 'dom7', 'maj9', 'min7'],
    harmonicMinor: ['min9', 'dim7', 'maj9', 'sus4', 'dom7', 'maj9', 'dim7'],
    melodicMinor: ['min9', 'sus2', 'maj9', 'dom7', 'dom7', 'dim7', 'dim7'],
  },
};

export const SCALE_CHORD_TYPES: Record<string, string[]> = SCALE_CHORD_TYPES_BY_COMPLEXITY.basic;

export function getScaleChordTypes(scaleType: string, complexity: ChordComplexity): string[] {
  const map = SCALE_CHORD_TYPES_BY_COMPLEXITY[complexity];
  return map[scaleType] || map.major;
}

export const ROMAN_NUMERALS_MAJOR = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
export const ROMAN_NUMERALS_MINOR = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];

// Conventional key names per scale family. Flat keys use flats, sharp keys use
// sharps, matching standard music notation rather than always defaulting to sharps.
export const MAJOR_KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
export const MINOR_KEY_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'] as const;

// Pitch classes whose conventional key uses flats.
const MAJOR_FLAT_PCS = new Set([1, 3, 5, 8, 10]); // Db, Eb, F, Ab, Bb
const MINOR_FLAT_PCS = new Set([0, 2, 3, 5, 7, 10]); // Cm, Dm, Ebm, Fm, Gm, Bbm

export function noteNameToPc(name: string): number {
  const sharp = NOTE_NAMES.indexOf(name as NoteName);
  if (sharp >= 0) return sharp;
  const flat = FLAT_NAMES.indexOf(name as typeof FLAT_NAMES[number]);
  if (flat >= 0) return flat;
  return 0;
}

export function getKeyNamesForScale(scaleType: string): readonly string[] {
  // Modes use minor key naming convention
  if (['dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'].includes(scaleType)) {
    return MINOR_KEY_NAMES;
  }
  return scaleType === 'major' ? MAJOR_KEY_NAMES : MINOR_KEY_NAMES;
}

// Conventional spelling of a key's root for the given pitch class and scale.
export function getPreferredKeyName(pc: number, scaleType: string): string {
  const idx = ((pc % 12) + 12) % 12;
  return getKeyNamesForScale(scaleType)[idx];
}

// Whether a key should be spelled with flats (vs sharps).
export function keyPrefersFlats(pc: number, scaleType: string): boolean {
  const idx = ((pc % 12) + 12) % 12;
  if (scaleType === 'major') {
    return MAJOR_FLAT_PCS.has(idx);
  }
  // Modes and minor scales use the same flat/sharp preferences
  return MINOR_FLAT_PCS.has(idx);
}

export function noteToMidi(note: string, octave: number): number {
  const idx = NOTE_NAMES.indexOf(note as NoteName);
  if (idx === -1) {
    const flatIdx = FLAT_NAMES.indexOf(note as typeof FLAT_NAMES[number]);
    if (flatIdx === -1) return 60;
    return (octave + 1) * 12 + flatIdx;
  }
  return (octave + 1) * 12 + idx;
}

export function midiToNote(midi: number): { note: string; octave: number } {
  const octave = Math.floor(midi / 12) - 1;
  const noteIdx = midi % 12;
  return { note: NOTE_NAMES[noteIdx], octave };
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function getScaleNotes(root: string, scaleType: string, useFlats?: boolean): string[] {
  const rootIdx = noteNameToPc(root);
  const intervals = SCALE_INTERVALS[scaleType] || SCALE_INTERVALS.major;
  const flats = useFlats ?? keyPrefersFlats(rootIdx, scaleType);
  const names = flats ? FLAT_NAMES : NOTE_NAMES;
  return intervals.map(i => names[(rootIdx + i) % 12]);
}

export function getChordNotes(root: string, chordType: string, octave = 4, useFlats?: boolean): ChordInfo {
  const rootIdx = noteNameToPc(root);
  const type = CHORD_TYPES[chordType] || CHORD_TYPES.major;
  const rootMidi = noteToMidi(root, octave);
  const flats = useFlats ?? root.includes('b');
  const names = flats ? FLAT_NAMES : NOTE_NAMES;

  const rootName = names[rootIdx];
  const notes = type.intervals.map(i => names[(rootIdx + i) % 12]);
  const midiNotes = type.intervals.map(i => rootMidi + i);

  return {
    root: rootName,
    type,
    notes,
    midiNotes,
    display: `${rootName}${type.symbol}`,
  };
}

export function getChordsInKey(root: string, scaleType: string, complexity: ChordComplexity = 'basic'): ChordInfo[] {
  const useFlats = keyPrefersFlats(noteNameToPc(root), scaleType);
  const scaleNotes = getScaleNotes(root, scaleType, useFlats);
  const chordTypes = getScaleChordTypes(scaleType, complexity);

  return scaleNotes.map((note, i) => getChordNotes(note, chordTypes[i], 4, useFlats));
}

export function getRomanNumeral(index: number, scaleType: string): string {
  if (scaleType === 'major') return ROMAN_NUMERALS_MAJOR[index] || `${index + 1}`;
  return ROMAN_NUMERALS_MINOR[index] || `${index + 1}`;
}

export function midiNoteToToneName(midi: number): string {
  const { note, octave } = midiToNote(midi);
  return `${note}${octave}`;
}

export function invertChord(chord: ChordInfo, inversion: number): ChordInfo {
  const maxInversion = chord.midiNotes.length - 1;
  const safeInversion = Math.max(0, Math.min(inversion, maxInversion));
  
  if (safeInversion === 0) {
    return { ...chord, inversion: 0 };
  }
  
  const invertedMidiNotes = [...chord.midiNotes];
  const invertedNotes = [...chord.notes];
  
  // Move the first n notes up an octave
  for (let i = 0; i < safeInversion; i++) {
    invertedMidiNotes[i] += 12;
  }
  
  // Sort the MIDI notes to maintain ascending order
  invertedMidiNotes.sort((a, b) => a - b);
  
  // Update note names based on new MIDI notes
  const names = chord.root.includes('b') ? FLAT_NAMES : NOTE_NAMES;
  
  for (let i = 0; i < invertedMidiNotes.length; i++) {
    const pc = invertedMidiNotes[i] % 12;
    invertedNotes[i] = names[pc];
  }
  
  // Update display to show inversion (e.g., C/G for first inversion)
  const bassNote = invertedNotes[0];
  let display = chord.display;
  if (safeInversion === 1) {
    display = `${chord.root}${chord.type.symbol}/${bassNote}`;
  } else if (safeInversion === 2) {
    display = `${chord.root}${chord.type.symbol}/${bassNote}`;
  }
  
  return {
    ...chord,
    notes: invertedNotes,
    midiNotes: invertedMidiNotes,
    display,
    inversion: safeInversion,
  };
}

export function voiceLeading(chords: ChordInfo[]): ChordInfo[] {
  if (chords.length < 2) return chords;
  
  const result = [...chords];
  
  for (let i = 1; i < result.length; i++) {
    const prevChord = result[i - 1];
    const currChord = result[i];
    
    // Find the inversion that minimizes voice movement
    let bestInversion = 0;
    let minMovement = Infinity;
    
    const maxInversion = currChord.midiNotes.length - 1;
    
    for (let inv = 0; inv <= maxInversion; inv++) {
      const inverted = invertChord(currChord, inv);
      let totalMovement = 0;
      
      // Calculate total movement between corresponding voices
      for (let j = 0; j < Math.min(prevChord.midiNotes.length, inverted.midiNotes.length); j++) {
        const movement = Math.abs(prevChord.midiNotes[j] - inverted.midiNotes[j]);
        totalMovement += movement;
      }
      
      if (totalMovement < minMovement) {
        minMovement = totalMovement;
        bestInversion = inv;
      }
    }
    
    result[i] = invertChord(currChord, bestInversion);
  }
  
  return result;
}
