import { describe, expect, it } from 'vitest';
import { DRUM_STEPS, generateDrums, getDrumPatternsForGenre, isDrumPattern } from '../drumGenerator';

describe('generateDrums', () => {
  it('returns one 16-step bar', () => {
    const pattern = generateDrums('house', 7);
    expect(pattern.kick).toHaveLength(DRUM_STEPS);
    expect(pattern.snare).toHaveLength(DRUM_STEPS);
    expect(pattern.clap).toHaveLength(DRUM_STEPS);
    expect(pattern.hat).toHaveLength(DRUM_STEPS);
  });

  it('is deterministic for a seed', () => {
    expect(generateDrums('techno', 42)).toEqual(generateDrums('techno', 42));
  });

  it('produces different patterns for different seeds', () => {
    const a = generateDrums('house', 1);
    const b = generateDrums('house', 2);
    expect(a).not.toEqual(b);
  });

  it('keeps only 0/1 steps', () => {
    const pattern = generateDrums('dnb', 3);
    for (const line of [pattern.kick, pattern.snare, pattern.clap, pattern.hat]) {
      expect(line.every(step => step === 0 || step === 1)).toBe(true);
    }
  });

  it('uses a two-step DnB kick instead of four-on-the-floor', () => {
    const pattern = generateDrums('dnb', 5);
    const fourOnFloor = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    expect(pattern.kick).not.toEqual(fourOnFloor);
    expect(pattern.snare[4]).toBe(1);
    expect(pattern.snare[12]).toBe(1);
  });

  it('falls back to a usable pattern for unknown genres', () => {
    const pattern = generateDrums('unknown-genre', 1);
    expect(pattern.kick[0]).toBe(1);
    expect(isDrumPattern(pattern)).toBe(true);
  });

  it('ships presets for every supported genre', () => {
    for (const genre of ['house', 'techno', 'trance', 'dnb', 'dubstep', 'futureBass', 'progressiveHouse', 'hardstyle']) {
      expect(getDrumPatternsForGenre(genre).length).toBeGreaterThan(0);
    }
  });
});
