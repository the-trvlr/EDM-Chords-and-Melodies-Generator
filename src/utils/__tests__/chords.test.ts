import { describe, expect, it } from 'vitest';
import { getChordNotes, invertChord } from '../musicTheory';

describe('chord inversions', () => {
  const root = getChordNotes('C', 'major', 4, false);

  it('builds each inversion from the root position, not from the current voicing', () => {
    const first = invertChord(root, 1);
    const second = invertChord(root, 2);
    expect(first.midiNotes).toEqual([64, 67, 72]);
    expect(first.display).toBe('C/E');
    expect(second.midiNotes).toEqual([67, 72, 76]);
    expect(second.display).toBe('C/G');
  });

  it('returns to the original root voicing', () => {
    const first = invertChord(root, 1);
    const second = invertChord(root, 2);
    expect(invertChord(first, 0).midiNotes).toEqual(root.midiNotes);
    expect(invertChord(first, 0).display).toBe('C');
    expect(invertChord(second, 0).midiNotes).toEqual(root.midiNotes);
    expect(invertChord(second, 0).display).toBe('C');
  });

  it('switches between ready-made inversions instead of stacking them', () => {
    const first = invertChord(root, 1);
    const second = invertChord(root, 2);
    expect(invertChord(first, 1).midiNotes).toEqual(first.midiNotes);
    expect(invertChord(first, 2).midiNotes).toEqual(second.midiNotes);
    expect(invertChord(second, 1).midiNotes).toEqual(first.midiNotes);
    expect(invertChord(second, 2).midiNotes).toEqual(second.midiNotes);
  });

  it('handles seventh chords', () => {
    const seventh = getChordNotes('A', 'min7', 4, false);
    const first = invertChord(seventh, 1);
    const second = invertChord(seventh, 2);
    expect(first.midiNotes).toEqual([72, 76, 79, 81]);
    expect(second.midiNotes).toEqual([76, 79, 81, 84]);
    expect(invertChord(second, 0).midiNotes).toEqual(seventh.midiNotes);
    expect(invertChord(second, 1).midiNotes).toEqual(first.midiNotes);
  });
});
