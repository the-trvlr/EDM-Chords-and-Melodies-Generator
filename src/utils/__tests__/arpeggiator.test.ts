import { describe, expect, it } from 'vitest';
import { arpeggiate, type ArpSettings } from '../arpeggiator';
import { getChordNotes } from '../musicTheory';

const chords = [getChordNotes('A', 'minor', 4, false), getChordNotes('F', 'major', 4, false)];
const settings = (overrides: Partial<ArpSettings> = {}): ArpSettings => ({
  pattern: 'up',
  rate: 'eighth',
  octaveRange: 1,
  gate: 0.8,
  ...overrides,
});

describe('arpeggiator', () => {
  it('fills the entire bar with eighth notes', () => {
    const notes = arpeggiate(chords, settings(), 1).notes;
    const bar1 = notes.filter(note => note.step < 16);
    expect(bar1.map(note => note.step)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(bar1.every(note => note.duration > 1 && note.duration < 2)).toBe(true);
  });

  it('fills the entire bar with sixteenth notes', () => {
    const notes = arpeggiate(chords, settings({ rate: 'sixteenth' }), 1).notes;
    const bar2 = notes.filter(note => note.step >= 16 && note.step < 32);
    expect(bar2.map(note => note.step)).toEqual(Array.from({ length: 16 }, (_, index) => 16 + index));
  });

  it('cycles the chord pattern instead of stopping after one pass', () => {
    const notes = arpeggiate([chords[0]], settings({ pattern: 'up', octaveRange: 1 }), 1).notes;
    // A minor: A4 C5 E5, repeated across the bar.
    expect(notes.map(note => note.step)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(notes.map(note => note.midi)).toEqual([69, 72, 76, 69, 72, 76, 69, 72]);
  });

  it('spreads two octaves across the bar', () => {
    const notes = arpeggiate([chords[0]], settings({ octaveRange: 2 }), 1).notes;
    const midis = notes.map(note => note.midi);
    expect(Math.min(...midis)).toBe(69);
    expect(Math.max(...midis)).toBe(88);
  });

  it('is deterministic for a seed and changes with it', () => {
    const a = arpeggiate(chords, settings({ pattern: 'random' }), 5).notes;
    const b = arpeggiate(chords, settings({ pattern: 'random' }), 5).notes;
    const c = arpeggiate(chords, settings({ pattern: 'random' }), 6).notes;
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});
