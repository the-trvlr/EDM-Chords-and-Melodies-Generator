import { describe, expect, it } from 'vitest';
import { buildArrangementMidiTracks, buildDrumTracks, buildMelodyTrack, buildProgressionTracks } from '../midiExport';
import { getChordNotes } from '../musicTheory';
import type { RhythmPattern } from '../../data/genres';
import type { SongSection } from '../../types';

const whole: RhythmPattern = {
  name: 'Whole Note',
  description: 'One chord per bar',
  subdivisions: 16,
  pattern: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

type AnyTrack = {
  events: { name: string; tick: number; pitch?: string[]; channel?: number; instrument?: number; text?: string }[];
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

  it('assigns distinct channels and GM programs to melodic tracks', () => {
    const chords = [getChordNotes('A', 'minor', 4, false)];
    const chordTrack = buildProgressionTracks(chords, 124, whole, false, 'organ', 1)[0] as unknown as AnyTrack;
    const chordProgram = chordTrack.events.find(event => event.name === 'ProgramChangeEvent');
    expect(chordProgram?.channel).toBe(1);
    expect(chordProgram?.instrument).toBe(16);
    expect(noteOns(chordTrack)[0].channel).toBe(1);

    const bass = {
      notes: [{ midi: 40, step: 0, duration: 4, velocity: 0.8 }],
      type: 'bass' as const,
      styleId: 't',
      stepsPerChord: 16,
    };
    const bassTrack = buildMelodyTrack(bass, 124, 'Bass', 'A', 'minor', 'sub', 2)[0] as unknown as AnyTrack;
    const bassProgram = bassTrack.events.find(event => event.name === 'ProgramChangeEvent');
    expect(bassProgram?.channel).toBe(2);
    expect(bassProgram?.instrument).toBe(38);
    expect(noteOns(bassTrack)[0].channel).toBe(2);
  });

  it('splits the arrangement into local section regions', () => {
    const chords = [getChordNotes('A', 'minor', 4, false), getChordNotes('F', 'major', 4, false)];
    const bass = { notes: [{ midi: 40, step: 0, duration: 4, velocity: 0.8 }], type: 'bass' as const, styleId: 't', stepsPerChord: 16 };
    const lead = { notes: [{ midi: 64, step: 0, duration: 4, velocity: 0.8 }], type: 'lead' as const, styleId: 't', stepsPerChord: 16 };
    const drums = {
      kick: [1, ...new Array(15).fill(0)],
      snare: [0, 0, 0, 0, 1, ...new Array(11).fill(0)],
      clap: new Array(16).fill(0),
      hat: [0, 1, ...new Array(14).fill(0)],
      lowHat: new Array(16).fill(0),
      crash: new Array(16).fill(0),
      ride: new Array(16).fill(0),
    };
    const sections: SongSection[] = [
      { id: 'a', kind: 'intro' as const, bars: 1, tracks: ['chord'] as const, energy: 'low' as const },
      { id: 'b', kind: 'drop' as const, bars: 1, tracks: ['chord', 'bass', 'lead', 'drums'] as const, energy: 'high' as const },
    ];
    const tracks = buildArrangementMidiTracks(
      chords, whole, bass, lead, 124, 'A', 'minor', false, null, drums,
      { sections, layout: 'section' },
    ) as unknown as AnyTrack[];
    const names = tracks.map(track => track.events.find(event => event.name === 'TrackNameEvent')?.text);
    expect(names).toContain('01 intro - bar 1');
    expect(names).toContain('02 drop - bar 2');
    const dropChords = tracks.find(track => track.events.some(event => event.name === 'TrackNameEvent' && event.text === '02 drop - bar 2'))!;
    expect(noteOns(dropChords)[0].tick).toBe(0);
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
