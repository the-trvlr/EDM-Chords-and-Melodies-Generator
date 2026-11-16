import { describe, expect, it } from 'vitest';
import { generateProgressions } from '../progressionGenerator';

describe('progression generator', () => {
  it('generates the requested number of bars and keeps the key', () => {
    const four = generateProgressions('A', 'minor', 'basic', { mood: 'uplifting', bars: 4, voiceLead: true });
    const eight = generateProgressions('A', 'minor', 'basic', { mood: 'uplifting', bars: 8, voiceLead: true });
    expect(four).toHaveLength(3);
    expect(four[0].chords).toHaveLength(4);
    expect(eight[0].chords).toHaveLength(8);
    expect(four[0].chords[0].root).toBe('A');
  });
});
