import { describe, expect, it } from 'vitest';
import { buildSchedule, eventsForTrack, groupByStep, totalSteps } from '../schedule';
import { getChordNotes } from '../musicTheory';
import type { RhythmPattern } from '../../data/genres';

const rhythm: RhythmPattern = {
  name: 'Straight',
  subdivisions: 16,
  description: 'Quarter notes',
  pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
};

const chords = [
  getChordNotes('A', 'minor', 4, false),
  getChordNotes('F', 'major', 4, false),
];

describe('buildSchedule', () => {
  it('lays out one chord hit per quarter note with hold-until-next-hit durations', () => {
    const events = buildSchedule({ chords, rhythm });
    expect(events).toHaveLength(8);
    expect(totalSteps(chords)).toBe(32);
    const first = events[0];
    expect(first.track).toBe('chord');
    expect(first.step).toBe(0);
    expect(first.durationSteps).toBe(4);
    expect(events.map(event => event.step)).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
  });

  it('replaces block chords with arp events when an arpeggio is present', () => {
    const arp = {
      notes: [
        { midi: 57, step: 0, duration: 1 },
        { midi: 60, step: 1, duration: 1 },
      ],
      type: 'lead' as const,
      styleId: 'arpeggiator',
      stepsPerChord: 16,
    };
    const events = buildSchedule({ chords, rhythm, arpMelody: arp });
    expect(events.filter(event => event.track === 'chord')).toHaveLength(0);
    expect(events.filter(event => event.track === 'arp')).toHaveLength(2);
  });

  it('repeats a one-bar drum pattern across every bar', () => {
    const drums = {
      kick: [1, ...new Array(15).fill(0)],
      snare: [0, 0, 0, 0, 1, ...new Array(11).fill(0)],
      clap: new Array(16).fill(0),
      hat: new Array(16).fill(0),
    };
    const events = buildSchedule({ chords, rhythm, drums });
    const kick = events.filter(event => event.track === 'drums' && event.instrument === 'kick');
    const snare = events.filter(event => event.track === 'drums' && event.instrument === 'snare');
    expect(kick.map(event => event.step)).toEqual([0, 16]);
    expect(snare.map(event => event.step)).toEqual([4, 20]);
  });

  it('clips melody notes that fall outside the progression', () => {
    const bass = {
      notes: [
        { midi: 40, step: 0, duration: 2 },
        { midi: 41, step: 999, duration: 2 },
      ],
      type: 'bass' as const,
      styleId: 'test',
      stepsPerChord: 16,
    };
    const events = buildSchedule({ chords, rhythm, bass }).filter(event => event.track === 'bass');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ track: 'bass', step: 0, midi: 40 });
  });

  it('groups events by step and filters by track', () => {
    const events = buildSchedule({ chords, rhythm });
    const grouped = groupByStep(events);
    expect(grouped.get(0)).toHaveLength(1);
    expect(eventsForTrack(events, 'chord')).toHaveLength(8);
    expect(eventsForTrack(events, 'bass')).toHaveLength(0);
  });

  it('returns no events for an empty progression', () => {
    expect(buildSchedule({ chords: [], rhythm })).toEqual([]);
  });
});
