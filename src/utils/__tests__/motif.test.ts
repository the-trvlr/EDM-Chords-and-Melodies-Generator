import { describe, expect, it } from 'vitest';
import { extractMotif, repeatMotif, transformMotif } from '../motif';

const motif = [
  { midi: 60, step: 0, duration: 4, velocity: 0.8 },
  { midi: 64, step: 4, duration: 4, velocity: 0.8 },
  { midi: 67, step: 8, duration: 4, velocity: 0.8 },
];

describe('motif lab', () => {
  it('extracts the first bar only', () => {
    expect(extractMotif([...motif, { midi: 72, step: 20, duration: 2 }])).toHaveLength(3);
  });

  it('inverts around the first note and transposes', () => {
    const inverted = transformMotif(motif, 'invert', 12);
    expect(inverted.map(note => note.midi)).toEqual([72, 68, 65]);
  });

  it('retrogrades and repeats without changing pitch', () => {
    const retro = transformMotif(motif, 'retrograde');
    expect(retro.map(note => note.midi)).toEqual([67, 64, 60]);
    const repeated = repeatMotif(motif, 2);
    expect(repeated).toHaveLength(6);
    expect(repeated[3].step).toBe(16);
  });
});
