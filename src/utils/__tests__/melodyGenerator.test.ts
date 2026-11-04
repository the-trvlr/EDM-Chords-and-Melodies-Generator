import { describe, expect, it } from 'vitest';
import { GENRES } from '../../data/genres';
import { getChordNotes, getChordsInKey } from '../musicTheory';
import { generateMelody, getGenreMelodyStyles } from '../melodyGenerator';

function progressionFor(genreId: string) {
  const genre = GENRES.find(item => item.id === genreId)!;
  const prog = genre.progressions[0];
  const scaleChords = getChordsInKey('A', 'minor', 'basic');
  return prog.degrees.map((degree, index) => {
    const base = scaleChords[degree];
    return prog.chordTypes?.[index] ? getChordNotes(base.root, prog.chordTypes[index], 4, false) : base;
  });
}

describe('melody generator', () => {
  it('snaps strong beats to chord tones', () => {
    for (const genre of GENRES) {
      const chords = progressionFor(genre.id);
      for (const style of getGenreMelodyStyles(genre.id, 'lead')) {
        for (let seed = 1; seed <= 8; seed++) {
          const notes = generateMelody(chords, 'lead', style.id, 'A', 'minor', seed, 1, { density: 'busy', idea: 1 }).notes;
          for (const note of notes) {
            if (note.step % 4 !== 0) continue;
            const chord = chords[Math.floor(note.step / 16) % chords.length];
            const pcs = chord.midiNotes.map(midi => midi % 12);
            expect(pcs, `${genre.id}/${style.id}/${seed}/step${note.step}`).toContain(note.midi % 12);
          }
        }
      }
    }
  });

  it('density reduces note count without empty bars', () => {
    const chords = progressionFor('techno');
    const sparse = generateMelody(chords, 'bass', 'techno-acid', 'A', 'minor', 4, 1, { density: 'sparse' }).notes;
    const medium = generateMelody(chords, 'bass', 'techno-acid', 'A', 'minor', 4, 1, { density: 'medium' }).notes;
    const busy = generateMelody(chords, 'bass', 'techno-acid', 'A', 'minor', 4, 1, { density: 'busy' }).notes;
    expect(sparse.length).toBeLessThanOrEqual(medium.length);
    expect(medium.length).toBeLessThanOrEqual(busy.length);
    expect(sparse.length).toBeGreaterThan(0);
    // Every bar keeps at least one note.
    for (let bar = 0; bar < chords.length; bar++) {
      expect(sparse.some(note => Math.floor(note.step / 16) === bar)).toBe(true);
    }
  });

  it('offers three deterministic ideas', () => {
    const chords = progressionFor('house');
    const idea1 = generateMelody(chords, 'lead', 'house-soulful', 'A', 'minor', 3, 1, { idea: 1 }).notes;
    const idea1b = generateMelody(chords, 'lead', 'house-soulful', 'A', 'minor', 3, 1, { idea: 1 }).notes;
    const idea2 = generateMelody(chords, 'lead', 'house-soulful', 'A', 'minor', 3, 1, { idea: 2 }).notes;
    expect(idea1).toEqual(idea1b);
    expect(idea1).not.toEqual(idea2);
  });
});
