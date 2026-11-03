import type { ChordInfo } from './musicTheory';
import type { RhythmPattern } from '../data/genres';
import type { GeneratedMelody } from './melodyGenerator';
import type { DrumPattern } from './drumGenerator';

/**
 * Fixed 16-step grid per chord/bar. Melodies, arpeggios and drums are all
 * generated on this grid, so a single event list can drive live playback,
 * WAV rendering and MIDI export (WYSIWYG export).
 */
export const STEPS_PER_CHORD = 16;

export type TrackId = 'chord' | 'bass' | 'lead' | 'drums';
export type DrumInstrument = 'kick' | 'snare' | 'clap' | 'hat';

export type ScheduleEvent =
  | { track: 'chord'; step: number; durationSteps: number; midis: number[] }
  | { track: 'bass' | 'lead' | 'arp'; step: number; durationSteps: number; midi: number }
  | { track: 'drums'; step: number; durationSteps: number; instrument: DrumInstrument };

export interface ScheduleInput {
  chords: ChordInfo[];
  rhythm: RhythmPattern;
  bass?: GeneratedMelody | null;
  lead?: GeneratedMelody | null;
  arpMelody?: GeneratedMelody | null;
  drums?: DrumPattern | null;
}

export function totalSteps(chords: ChordInfo[]): number {
  return chords.length * STEPS_PER_CHORD;
}

function nextHitDistance(pattern: number[], from: number): number {
  const len = pattern.length;
  for (let i = 1; i <= len; i++) {
    if (pattern[(from + i) % len]) return i;
  }
  return len;
}

/**
 * Builds the full arrangement as a flat, deterministic event list.
 * Chord rhythm hits use the same "hold until the next hit" rule everywhere.
 */
export function buildSchedule(input: ScheduleInput): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];
  const steps = totalSteps(input.chords);
  if (steps === 0) return events;

  const pattern = input.rhythm.pattern;
  const plen = pattern.length || STEPS_PER_CHORD;

  if (input.arpMelody) {
    for (const note of input.arpMelody.notes) {
      if (note.step >= steps) continue;
      events.push({ track: 'arp', step: note.step, durationSteps: note.duration, midi: note.midi });
    }
  } else {
    input.chords.forEach((chord, chordIdx) => {
      for (let sic = 0; sic < STEPS_PER_CHORD; sic++) {
        const ps = sic % plen;
        if (!pattern[ps]) continue;
        const step = chordIdx * STEPS_PER_CHORD + sic;
        if (step >= steps) break;
        events.push({
          track: 'chord',
          step,
          durationSteps: nextHitDistance(pattern, ps),
          midis: [...chord.midiNotes],
        });
      }
    });
  }

  if (input.bass) {
    for (const note of input.bass.notes) {
      if (note.step >= steps) continue;
      events.push({ track: 'bass', step: note.step, durationSteps: note.duration, midi: note.midi });
    }
  }

  if (input.lead) {
    for (const note of input.lead.notes) {
      if (note.step >= steps) continue;
      events.push({ track: 'lead', step: note.step, durationSteps: note.duration, midi: note.midi });
    }
  }

  if (input.drums) {
    const instruments: DrumInstrument[] = ['kick', 'snare', 'clap', 'hat'];
    // Drum patterns are one bar long and repeat every bar.
    for (let step = 0; step < steps; step++) {
      const inBar = step % STEPS_PER_CHORD;
      for (const instrument of instruments) {
        if (!input.drums[instrument][inBar]) continue;
        events.push({ track: 'drums', step, durationSteps: 1, instrument });
      }
    }
  }

  return events.sort((a, b) => a.step - b.step);
}

export function groupByStep(events: ScheduleEvent[]): Map<number, ScheduleEvent[]> {
  const map = new Map<number, ScheduleEvent[]>();
  for (const event of events) {
    const list = map.get(event.step);
    if (list) list.push(event);
    else map.set(event.step, [event]);
  }
  return map;
}

export function eventsForTrack(events: ScheduleEvent[], track: TrackId): ScheduleEvent[] {
  if (track === 'drums') return events.filter(e => e.track === 'drums');
  if (track === 'chord') return events.filter(e => e.track === 'chord' || e.track === 'arp');
  return events.filter(e => e.track === track);
}
