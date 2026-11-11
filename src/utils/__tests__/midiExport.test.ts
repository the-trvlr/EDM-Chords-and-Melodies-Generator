import { describe, expect, it } from 'vitest';
import { buildDrumTracks, buildProgressionTracks } from '../midiExport';
import { getChordNotes } from '../musicTheory';
import type { RhythmPattern } from '../../data/genres';

const whole: RhythmPattern = {
  name: 'Whole Note',
  description: 'One chord per bar',
  subdivisions: 16,
  pattern: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

type AnyTrack = {
  events: { name: string; tick: number; pitch?: string[]; channel?: number }[];
  buildData: () => unknown;
};

function noteOns(track: unknown) {
  const anyTrack = track as AnyTrack;
  anyTrack.buildData();
  return anyTrack.events.filter(event => event.name === 'NoteOnEvent');
}

describe('MIDI export layout', () => {
  it('places consecutive chords on adjacent bars without an empty bar', () => {
    const chords = [getChordNotes('A', 'minor', 4, false), getChordNotes('F', 'major', 4, false)];
    const tracks = buildProgressionTracks(chords, 124, whole);
    expect(tracks).toHaveLength(1);
    // Whole-note chords start every 16 sixteenths = 512 ticks, with no gap.
    const ons = noteOns(tracks[0]);
    expect([...new Set(ons.map(event => event.tick))]).toEqual([0, 512]);
  });

  it('writes drum parts on GM channel 10 with GM notes', () => {
    const pattern = {
      kick: [1, ...new Array(15).fill(0)],
      snare: [0, 0, 0, 0, 1, ...new Array(11).fill(0)],
      clap: new Array(16).fill(0),
      hat: [0, 1, ...new Array(14).fill(0)],
      lowHat: new Array(16).fill(0),
      crash: new Array(16).fill(0),
      ride: new Array(16).fill(0),
    };
    const tracks = buildDrumTracks(pattern, 120, 2);
    expect(tracks).toHaveLength(3); // clap is empty and should be skipped

    const kick = noteOns(tracks[0]);
    expect(kick.map(event => event.tick)).toEqual([0, 512]);
    expect(kick[0].channel).toBe(10);

    const snare = noteOns(tracks[1]);
    expect(snare[0].tick).toBe(128);
    expect(snare[0].channel).toBe(10);
    const hat = noteOns(tracks[2]);
    expect(hat[0].tick).toBe(32);
    expect(hat[0].channel).toBe(10);
  });
});
