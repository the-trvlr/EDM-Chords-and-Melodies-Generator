// @ts-expect-error midi-writer-js ships types but ESM resolution differs in Vitest
import MidiWriter from 'midi-writer-js';
import { describe, expect, it } from 'vitest';
import { analyzeMidiBuffer } from '../referenceAnalysis';

describe('reference analysis', () => {
  it('reads tempo and chord material from MIDI', () => {
    const track = new MidiWriter.Track();
    track.setTempo(120);
    track.addEvent(new MidiWriter.NoteEvent({ pitch: ['C4', 'E4', 'G4'], duration: '1', tick: 0, velocity: 90 }));
    track.addEvent(new MidiWriter.NoteEvent({ pitch: ['F4', 'A4', 'C5'], duration: '1', tick: 480, velocity: 90 }));
    const bytes = new MidiWriter.Writer([track]).buildFile();
    const result = analyzeMidiBuffer(bytes.buffer as ArrayBuffer, 'test.mid');
    expect(result.bpm).toBe(120);
    expect(result.chords.length).toBeGreaterThan(0);
    expect(result.chords.some(chord => chord.root === 'C' || chord.root === 'F')).toBe(true);
    expect(result.durationSec).toBeGreaterThan(0);
  });
});
