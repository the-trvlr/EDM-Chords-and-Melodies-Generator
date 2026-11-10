import { describe, expect, it } from 'vitest';
import { GENRES } from '../../data/genres';
import { getChordNotes } from '../musicTheory';
import { generateMelody, getGenreMelodyStyles, type MelodyNote, type MelodyType } from '../melodyGenerator';

const triads = [
  getChordNotes('A', 'minor', 4, false),
  getChordNotes('F', 'major', 4, false),
  getChordNotes('D', 'minor', 4, false),
  getChordNotes('E', 'minor', 4, false),
];

// Same chord count and same triad sizes, different roots/qualities.
const substitution = [
  getChordNotes('C', 'major', 4, false),
  getChordNotes('G', 'major', 4, false),
  getChordNotes('A', 'minor', 4, false),
  getChordNotes('F', 'major', 4, false),
];

// Four-note chords: the old generator changed the rhythm when chords grew.
const sevenths = [
  getChordNotes('A', 'min7', 4, false),
  getChordNotes('F', 'maj7', 4, false),
  getChordNotes('D', 'min7', 4, false),
  getChordNotes('E', 'min7', 4, false),
];

const transposed = [
  getChordNotes('C', 'minor', 4, false),
  getChordNotes('G#', 'major', 4, false),
  getChordNotes('F', 'minor', 4, false),
  getChordNotes('G', 'minor', 4, false),
];

const rhythmOf = (notes: MelodyNote[]) => notes.map(note => `${note.step}:${note.duration}`);

function strongBeatChordTones(notes: MelodyNote[], chords: typeof triads): boolean {
  return notes.every(note => {
    if (note.step % 4 !== 0) return true;
    const chord = chords[Math.floor(note.step / 16) % chords.length];
    return chord.midiNotes.some(midi => midi % 12 === note.midi % 12);
  });
}

const styles: { genre: string; type: MelodyType; style: string }[] = [];
for (const genre of GENRES) {
  for (const type of ['bass', 'lead'] as const) {
    for (const style of getGenreMelodyStyles(genre.id, type)) {
      styles.push({ genre: genre.id, type, style: style.id });
    }
  }
}

describe('melody follows the chord progression', () => {
  it('keeps the rhythm when only the chords change', () => {
    for (const { genre, type, style } of styles) {
      for (const seed of [1, 3, 5]) {
        const options = { density: 'busy' as const, idea: 1 };
        const base = generateMelody(triads, type, style, 'A', 'minor', seed, 1, options).notes;
        const sub = generateMelody(substitution, type, style, 'A', 'minor', seed, 1, options).notes;
        const seventh = generateMelody(sevenths, type, style, 'A', 'minor', seed, 1, options).notes;
        const transposedNotes = generateMelody(transposed, type, style, 'C', 'minor', seed, 1, options).notes;
        const label = `${genre}/${style}/${seed}`;
        expect(rhythmOf(sub), `${label} substitution`).toEqual(rhythmOf(base));
        expect(rhythmOf(seventh), `${label} sevenths`).toEqual(rhythmOf(base));
        expect(rhythmOf(transposedNotes), `${label} transposition`).toEqual(rhythmOf(base));
      }
    }
  });

  it('puts strong beats on chord tones of the current progression', () => {
    for (const { type, style } of styles) {
      for (const seed of [1, 3]) {
        for (const [chords, key, scale] of [
          [substitution, 'A', 'minor'],
          [sevenths, 'A', 'minor'],
          [transposed, 'C', 'minor'],
        ] as const) {
          const notes = generateMelody(chords, type, style, key, scale, seed, 1, { density: 'busy' }).notes;
          expect(strongBeatChordTones(notes, chords), `${style}/${seed}`).toBe(true);
        }
      }
    }
  });

  it('keeps a motif rhythm across bars for every variation', () => {
    for (const variation of ['repeat', 'transpose', 'invert'] as const) {
      const notes = generateMelody(triads, 'bass', 'house-groove', 'A', 'minor', 4, 1, { density: 'busy', variation }).notes;
      const bar = (index: number) => notes
        .filter(note => Math.floor(note.step / 16) === index)
        .map(note => `${note.step % 16}:${note.duration}`)
        .join(',');
      expect(bar(1), variation).toBe(bar(0));
      expect(bar(2), variation).toBe(bar(0));
      expect(bar(3), variation).toBe(bar(0));
      expect(new Set(notes.map(note => note.midi)).size, variation).toBeGreaterThan(1);
    }
  });

  it('moves the register with contour without changing rhythm', () => {
    const options = { density: 'busy' as const, idea: 1 };
    const low = generateMelody(triads, 'lead', 'house-soulful', 'A', 'minor', 2, 3, { ...options, contour: 'low' }).notes;
    const high = generateMelody(triads, 'lead', 'house-soulful', 'A', 'minor', 2, 3, { ...options, contour: 'high' }).notes;
    const average = (notes: MelodyNote[]) => notes.reduce((sum, note) => sum + note.midi, 0) / notes.length;
    expect(rhythmOf(low)).toEqual(rhythmOf(high));
    expect(average(high)).toBeGreaterThan(average(low));
  });

  it('can split call and response across bars', () => {
    const call = generateMelody(triads, 'bass', 'house-groove', 'A', 'minor', 1, 1, { barFilter: 0 }).notes;
    const response = generateMelody(triads, 'lead', 'house-soulful', 'A', 'minor', 1, 1, { barFilter: 1 }).notes;
    expect(call.every(note => Math.floor(note.step / 16) % 2 === 0)).toBe(true);
    expect(response.every(note => Math.floor(note.step / 16) % 2 === 1)).toBe(true);
  });

  it('changes pitches, not steps or durations, when a chord is replaced', () => {
    const base = generateMelody(triads, 'bass', 'house-groove', 'A', 'minor', 2, 1, { density: 'busy' }).notes;
    const sub = generateMelody(substitution, 'bass', 'house-groove', 'A', 'minor', 2, 1, { density: 'busy' }).notes;
    expect(rhythmOf(sub)).toEqual(rhythmOf(base));
    expect(sub.map(note => note.midi)).not.toEqual(base.map(note => note.midi));
  });
});
