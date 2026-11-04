import { describe, expect, it } from 'vitest';
import { GENRES } from '../../data/genres';
import { getChordNotes, getChordsInKey } from '../musicTheory';
import {
  fitMelodyToRange,
  generateMelody,
  getGenreMelodyStyles,
  melodyRangeLabel,
  melodyRangeStart,
} from '../melodyGenerator';

function progressionFor(genreId: string, key: string, scale: string) {
  const genre = GENRES.find(item => item.id === genreId)!;
  const prog = genre.progressions[0];
  const scaleChords = getChordsInKey(key, scale, 'basic');
  return prog.degrees.map((degree, index) => {
    const base = scaleChords[degree];
    return prog.chordTypes?.[index] ? getChordNotes(base.root, prog.chordTypes[index], 4, false) : base;
  });
}

const maxLeap = (notes: { midi: number }[]) => notes.reduce(
  (worst, note, index) => index === 0 ? 0 : Math.max(worst, Math.abs(note.midi - notes[index - 1].midi)),
  0,
);

describe('melody range', () => {
  it('labels ranges as one octave', () => {
    expect(melodyRangeStart(2)).toBe(36);
    expect(melodyRangeLabel(2)).toBe('C2–B2');
    expect(melodyRangeStart(4)).toBe(60);
  });

  it('keeps every bass style inside C2–B2 with small leaps', () => {
    for (const genre of GENRES) {
      for (const style of getGenreMelodyStyles(genre.id, 'bass')) {
        for (let seed = 1; seed <= 12; seed++) {
          const notes = generateMelody(progressionFor(genre.id, 'A', 'minor'), 'bass', style.id, 'A', 'minor', seed, 2).notes;
          expect(Math.min(...notes.map(note => note.midi)), `${genre.id}/${style.id}/${seed}`).toBeGreaterThanOrEqual(36);
          expect(Math.max(...notes.map(note => note.midi)), `${genre.id}/${style.id}/${seed}`).toBeLessThanOrEqual(47);
          expect(maxLeap(notes), `${genre.id}/${style.id}/${seed}`).toBeLessThanOrEqual(7);
        }
      }
    }
  });

  it('keeps every lead style inside C4–B4 with small leaps', () => {
    for (const genre of GENRES) {
      for (const style of getGenreMelodyStyles(genre.id, 'lead')) {
        for (let seed = 1; seed <= 12; seed++) {
          const notes = generateMelody(progressionFor(genre.id, 'A', 'minor'), 'lead', style.id, 'A', 'minor', seed, 4).notes;
          expect(Math.min(...notes.map(note => note.midi)), `${genre.id}/${style.id}/${seed}`).toBeGreaterThanOrEqual(60);
          expect(Math.max(...notes.map(note => note.midi)), `${genre.id}/${style.id}/${seed}`).toBeLessThanOrEqual(71);
          expect(maxLeap(notes), `${genre.id}/${style.id}/${seed}`).toBeLessThanOrEqual(9);
        }
      }
    }
  });

  it('uses C5–B5 as the default lead register', () => {
    const chords = progressionFor('house', 'A', 'minor');
    const notes = generateMelody(chords, 'lead', 'house-soulful', 'A', 'minor', 7).notes;
    expect(Math.min(...notes.map(note => note.midi))).toBeGreaterThanOrEqual(72);
    expect(Math.max(...notes.map(note => note.midi))).toBeLessThanOrEqual(83);
  });

  it('moves the whole line when the base range changes', () => {
    const chords = progressionFor('house', 'A', 'minor');
    const low = generateMelody(chords, 'bass', 'house-groove', 'A', 'minor', 1, 1).notes;
    const high = generateMelody(chords, 'bass', 'house-groove', 'A', 'minor', 1, 3).notes;
    expect(Math.min(...low.map(note => note.midi))).toBeGreaterThanOrEqual(24);
    expect(Math.max(...low.map(note => note.midi))).toBeLessThanOrEqual(35);
    expect(Math.min(...high.map(note => note.midi))).toBeGreaterThanOrEqual(48);
    expect(Math.max(...high.map(note => note.midi))).toBeLessThanOrEqual(59);
  });

  it('folds arbitrary notes into the requested octave', () => {
    const fitted = fitMelodyToRange(
      [{ step: 0, midi: 12, duration: 1 }, { step: 4, midi: 120, duration: 1 }],
      'lead',
      4,
      [60, 62, 64, 65, 67, 69, 71],
    );
    expect(fitted.every(note => note.midi >= 60 && note.midi <= 71)).toBe(true);
    expect(maxLeap(fitted)).toBeLessThanOrEqual(9);
  });
});
