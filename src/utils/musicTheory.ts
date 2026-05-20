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
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
};

export const SCALE_CHORD_TYPES: Record<string, string[]> = {
  major: ['major', 'minor', 'minor', 'major', 'major', 'minor', 'dim'],
  minor: ['minor', 'dim', 'major', 'minor', 'minor', 'major', 'major'],
  harmonicMinor: ['minor', 'dim', 'aug', 'minor', 'major', 'major', 'dim'],
  melodicMinor: ['minor', 'minor', 'aug', 'major', 'major', 'dim', 'dim'],
};

export const ROMAN_NUMERALS_MAJOR = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
export const ROMAN_NUMERALS_MINOR = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];

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

export function getScaleNotes(root: string, scaleType: string): string[] {
  const rootIdx = NOTE_NAMES.indexOf(root as NoteName) ?? FLAT_NAMES.indexOf(root as typeof FLAT_NAMES[number]);
  const intervals = SCALE_INTERVALS[scaleType] || SCALE_INTERVALS.major;
  return intervals.map(i => NOTE_NAMES[(rootIdx + i) % 12]);
}

export function getChordNotes(root: string, chordType: string, octave = 4): ChordInfo {
  const rootIdx = NOTE_NAMES.indexOf(root as NoteName) >= 0
    ? NOTE_NAMES.indexOf(root as NoteName)
    : FLAT_NAMES.indexOf(root as typeof FLAT_NAMES[number]);
  const type = CHORD_TYPES[chordType] || CHORD_TYPES.major;
  const rootMidi = noteToMidi(root, octave);

  const notes = type.intervals.map(i => NOTE_NAMES[(rootIdx + i) % 12]);
  const midiNotes = type.intervals.map(i => rootMidi + i);

  return {
    root,
    type,
    notes,
    midiNotes,
    display: `${root}${type.symbol}`,
  };
}

export function getChordsInKey(root: string, scaleType: string): ChordInfo[] {
  const scaleNotes = getScaleNotes(root, scaleType);
  const chordTypes = SCALE_CHORD_TYPES[scaleType] || SCALE_CHORD_TYPES.major;

  return scaleNotes.map((note, i) => getChordNotes(note, chordTypes[i]));
}

export function getRomanNumeral(index: number, scaleType: string): string {
  if (scaleType === 'major') return ROMAN_NUMERALS_MAJOR[index] || `${index + 1}`;
  return ROMAN_NUMERALS_MINOR[index] || `${index + 1}`;
}

export function midiNoteToToneName(midi: number): string {
  const { note, octave } = midiToNote(midi);
  return `${note}${octave}`;
}
