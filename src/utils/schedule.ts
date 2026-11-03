import type { ChordInfo } from './musicTheory';
import type { RhythmPattern } from '../data/genres';
import type { GeneratedMelody } from './melodyGenerator';
import type { DrumPattern } from './drumGenerator';
import type { SongSection, TrackOctaves } from '../types';

/**
 * Fixed 16-step grid per chord/bar. Melodies, arpeggios and drums are all
 * generated on this grid, so a single event list can drive live playback,
 * WAV rendering and MIDI export (WYSIWYG export).
 */
export const STEPS_PER_CHORD = 16;

export type TrackId = 'chord' | 'bass' | 'lead' | 'drums';
export type DrumInstrument = 'kick' | 'snare' | 'clap' | 'hat';

export type ScheduleEvent =
  | { track: 'chord'; step: number; durationSteps: number; midis: number[]; offset: number }
  | { track: 'bass' | 'lead' | 'arp'; step: number; durationSteps: number; midi: number; offset: number }
  | { track: 'drums'; step: number; durationSteps: number; instrument: DrumInstrument; offset: number };

export interface ScheduleInput {
  chords: ChordInfo[];
  rhythm: RhythmPattern;
  bass?: GeneratedMelody | null;
  lead?: GeneratedMelody | null;
  arpMelody?: GeneratedMelody | null;
  drums?: DrumPattern | null;
  sections?: SongSection[] | null;
  octaves?: TrackOctaves;
  /** 0..0.6 — delays odd 16th steps. */
  swing?: number;
  humanize?: boolean;
}

const ALL_TRACKS: TrackId[] = ['chord', 'bass', 'lead', 'drums'];
const DEFAULT_OCTAVES: TrackOctaves = { chord: 0, bass: 0, lead: 0 };

function clampMidi(midi: number): number {
  return Math.max(0, Math.min(127, midi));
}

function shiftMidi(midi: number, octave: number): number {
  return clampMidi(midi + octave * 12);
}

function activeSections(input: Pick<ScheduleInput, 'sections'>): SongSection[] | null {
  const sections = (input.sections ?? []).filter(section => section.bars > 0);
  return sections.length > 0 ? sections : null;
}

export function songBars(input: Pick<ScheduleInput, 'chords' | 'sections'>): number {
  const sections = activeSections(input);
  if (sections) return sections.reduce((total, section) => total + section.bars, 0);
  return input.chords.length;
}

export function songSteps(input: Pick<ScheduleInput, 'chords' | 'sections'>): number {
  return songBars(input) * STEPS_PER_CHORD;
}

/** Length of one pass through the chord progression. */
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

function eventOffset(step: number, track: ScheduleEvent['track'], swing: number, humanize: boolean): number {
  let offset = 0;
  if (swing > 0 && step % 2 === 1) offset += swing * 0.5;
  if (humanize && track !== 'chord') {
    const noise = Math.sin(step * 12.9898 + track.length * 7.13) * 43758.5453;
    offset += (noise - Math.floor(noise) - 0.5) * 0.06;
  }
  return offset;
}

/**
 * Builds the full song as a flat, deterministic event list.
 * Without sections it loops the progression once; with sections it repeats the
 * progression per section while gating the tracks listed in that section.
 */
export function buildSchedule(input: ScheduleInput): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];
  if (input.chords.length === 0) return events;

  const pattern = input.rhythm.pattern;
  const plen = pattern.length || STEPS_PER_CHORD;
  const octaves: TrackOctaves = { ...DEFAULT_OCTAVES, ...input.octaves };
  const swing = Math.max(0, Math.min(0.6, input.swing ?? 0));
  const humanize = input.humanize === true;

  const pushBar = (barInSong: number, barInProg: number, tracks: Set<TrackId>) => {
    const stepBase = barInSong * STEPS_PER_CHORD;
    const chord = input.chords[barInProg];

    if (input.arpMelody) {
      if (tracks.has('chord')) {
        for (const note of input.arpMelody.notes) {
          const barOfNote = Math.floor(note.step / STEPS_PER_CHORD);
          if (barOfNote !== barInProg) continue;
          events.push({
            track: 'arp',
            step: stepBase + (note.step % STEPS_PER_CHORD),
            durationSteps: note.duration,
            midi: shiftMidi(note.midi, octaves.chord),
            offset: 0,
          });
        }
      }
    } else if (tracks.has('chord')) {
      for (let sic = 0; sic < STEPS_PER_CHORD; sic++) {
        const ps = sic % plen;
        if (!pattern[ps]) continue;
        events.push({
          track: 'chord',
          step: stepBase + sic,
          durationSteps: nextHitDistance(pattern, ps),
          midis: chord.midiNotes.map(midi => shiftMidi(midi, octaves.chord)),
          offset: 0,
        });
      }
    }

    const pushMelody = (
      melody: GeneratedMelody | null | undefined,
      track: 'bass' | 'lead',
      octave: number,
    ) => {
      if (!melody || !tracks.has(track)) return;
      for (const note of melody.notes) {
        const barOfNote = Math.floor(note.step / STEPS_PER_CHORD);
        if (barOfNote !== barInProg) continue;
        events.push({
          track,
          step: stepBase + (note.step % STEPS_PER_CHORD),
          durationSteps: note.duration,
          midi: shiftMidi(note.midi, octave),
          offset: 0,
        });
      }
    };

    pushMelody(input.bass, 'bass', octaves.bass);
    pushMelody(input.lead, 'lead', octaves.lead);

    if (input.drums && tracks.has('drums')) {
      const instruments: DrumInstrument[] = ['kick', 'snare', 'clap', 'hat'];
      for (let sic = 0; sic < STEPS_PER_CHORD; sic++) {
        for (const instrument of instruments) {
          if (!input.drums[instrument][sic]) continue;
          events.push({
            track: 'drums',
            step: stepBase + sic,
            durationSteps: 1,
            instrument,
            offset: 0,
          });
        }
      }
    }
  };

  const sections = activeSections(input);
  if (sections) {
    let barInSong = 0;
    for (const section of sections) {
      const tracks = new Set(section.tracks);
      for (let bar = 0; bar < section.bars; bar++) {
        pushBar(barInSong, barInSong % input.chords.length, tracks);
        barInSong++;
      }
    }
  } else {
    const tracks = new Set(ALL_TRACKS);
    for (let bar = 0; bar < input.chords.length; bar++) {
      pushBar(bar, bar, tracks);
    }
  }

  for (const event of events) {
    event.offset = eventOffset(event.step, event.track, swing, humanize);
  }

  return events.sort((a, b) => (a.step + a.offset) - (b.step + b.offset));
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
  if (track === 'drums') return events.filter(event => event.track === 'drums');
  if (track === 'chord') return events.filter(event => event.track === 'chord' || event.track === 'arp');
  return events.filter(event => event.track === track);
}

