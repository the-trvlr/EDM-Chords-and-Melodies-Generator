import { describe, expect, it } from 'vitest';
import { GENRES } from '../../data/genres';
import { getChordNotes, getChordsInKey } from '../musicTheory';
import {
  fitMelodyToRange,
  fitNotesToSpan,
  generateMelody,
  getGenreMelodyStyles,
  melodySpanBounds,
  melodySpanLabel,
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

const rangeOf = (notes: { midi: number }[]) => ({
  min: Math.min(...notes.map(note => note.midi)),
  max: Math.max(...notes.map(note => note.midi)),
});

describe('melody range span', () => {
  it('exposes 1, 2 and 3 octave windows', () => {
    expect(melodySpanLabel(1)).toBe('1 octave');
    expect(melodySpanLabel(3)).toBe('3 octaves');
    expect(melodySpanBounds('bass', 1)).toEqual({ start: 36, end: 47 });
    expect(melodySpanBounds('bass', 2)).toEqual({ start: 36, end: 59 });
    expect(melodySpanBounds('lead', 1)).toEqual({ start: 72, end: 83 });
    expect(melodySpanBounds('lead', 3)).toEqual({ start: 72, end: 107 });
  });

  it('keeps every bass style inside the selected span with small leaps', () => {
    for (const span of [1, 2, 3]) {
      const { start, end } = melodySpanBounds('bass', span);
      for (const genre of GENRES) {
        for (const style of getGenreMelodyStyles(genre.id, 'bass')) {
          for (let seed = 1; seed <= 12; seed++) {
            const notes = generateMelody(progressionFor(genre.id, 'A', 'minor'), 'bass', style.id, 'A', 'minor', seed, span).notes;
            const { min, max } = rangeOf(notes);
            const label = `${genre.id}/${style.id}/${seed}/span${span}`;
            expect(min, label).toBeGreaterThanOrEqual(start);
            expect(max, label).toBeLessThanOrEqual(end);
            expect(maxLeap(notes), label).toBeLessThanOrEqual(7);
          }
        }
      }
    }
  });

  it('keeps every lead style inside the selected span with small leaps', () => {
    for (const span of [1, 2, 3]) {
      const { start, end } = melodySpanBounds('lead', span);
      for (const genre of GENRES) {
        for (const style of getGenreMelodyStyles(genre.id, 'lead')) {
          for (let seed = 1; seed <= 12; seed++) {
            const notes = generateMelody(progressionFor(genre.id, 'A', 'minor'), 'lead', style.id, 'A', 'minor', seed, span).notes;
            const { min, max } = rangeOf(notes);
            const label = `${genre.id}/${style.id}/${seed}/span${span}`;
            expect(min, label).toBeGreaterThanOrEqual(start);
            expect(max, label).toBeLessThanOrEqual(end);
            expect(maxLeap(notes), label).toBeLessThanOrEqual(9);
          }
        }
      }
    }
  });

  it('uses the extra octaves when the span grows', () => {
    const chords = progressionFor('techno', 'A', 'minor');
    const one = generateMelody(chords, 'bass', 'techno-hypnotic', 'A', 'minor', 3, 1).notes;
    const two = generateMelody(chords, 'bass', 'techno-hypnotic', 'A', 'minor', 3, 2).notes;
    expect(rangeOf(one).max).toBeLessThanOrEqual(47);
    expect(rangeOf(two).max).toBeLessThanOrEqual(59);
    // The octave-bounce pattern is flattened inside one octave and opens up with two.
    expect(rangeOf(two).max).toBeGreaterThan(rangeOf(one).max);
  });

  it('folds arbitrary notes into the requested span', () => {
    const folded = fitNotesToSpan(
      [{ step: 0, midi: 12, duration: 1 }, { step: 4, midi: 120, duration: 1 }],
      'lead',
      1,
    );
    expect(folded.every(note => note.midi >= 72 && note.midi <= 83)).toBe(true);
    expect(maxLeap(fitMelodyToRange(folded, 'lead', 1, [72, 74, 76, 77, 79, 81, 83]))).toBeLessThanOrEqual(9);
  });
});
