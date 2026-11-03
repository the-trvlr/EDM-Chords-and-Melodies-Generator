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

  it('gives every genre a distinct full drum signature', () => {
    const genres = ['house', 'techno', 'trance', 'dnb', 'dubstep', 'futureBass', 'progressiveHouse', 'hardstyle'];
    const signatures = genres.map(genre => {
      const pattern = getDrumPatternsForGenre(genre)[0].pattern;
      return [pattern.kick, pattern.snare, pattern.clap, pattern.hat].map(line => line.join('')).join('|');
    });
    expect(new Set(signatures).size).toBe(genres.length);
  });

  it('keeps the signature elements of each genre', () => {
    const house = getDrumPatternsForGenre('house')[0].pattern;
    const dnb = getDrumPatternsForGenre('dnb')[0].pattern;
    const dubstep = getDrumPatternsForGenre('dubstep')[0].pattern;
    const hardstyle = getDrumPatternsForGenre('hardstyle')[0].pattern;

    // House / hardstyle: four-on-the-floor kick.
    expect(house.kick).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
    expect(hardstyle.kick).toEqual(house.kick);
    // DnB: broken kick, backbeat snare.
    expect(dnb.kick).not.toEqual(house.kick);
    expect(dnb.snare[4]).toBe(1);
    expect(dnb.snare[12]).toBe(1);
    // Dubstep: half-time snare on beat 3 only.
    expect(dubstep.snare.filter(Boolean)).toHaveLength(1);
    expect(dubstep.snare[8]).toBe(1);
  });
});
