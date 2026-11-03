// @ts-expect-error midi-writer-js has types but exports resolution fails
import MidiWriter from 'midi-writer-js';
import type { ChordInfo } from './musicTheory';
import type { RhythmPattern } from '../data/genres';
import type { GeneratedMelody } from './melodyGenerator';
import type { DrumPattern } from './drumGenerator';
import { buildSchedule, type ScheduleEvent } from './schedule';
import type { SongSection, TrackOctaves } from '../types';

export function exportProgressionToMidi(
  chords: ChordInfo[],
  bpm: number,
  rhythm: RhythmPattern,
  keyName: string,
  scaleName: string,
  doubleTime = false,
): void {
  const track = new MidiWriter.Track();
  track.setTempo(bpm);
  track.addTrackName(`EDM Chord Progression - ${keyName} ${scaleName}`);
  track.setTimeSignature(4, 4);

  const ticksPer16th = 32;
  const barSteps = rhythm.pattern.length;

  const repetitions = doubleTime ? 2 : 1;

  for (const chord of chords) {
    const pitches = chord.midiNotes.map(
      m => `${getNoteLetter(m % 12)}${Math.floor(m / 12) - 1}`,
    );

    const hits: number[] = [];
    for (let i = 0; i < barSteps; i++) {
      if (rhythm.pattern[i]) hits.push(i);
    }

    for (let rep = 0; rep < repetitions; rep++) {
      if (hits.length === 0) {
        track.addEvent(new MidiWriter.NoteEvent({
          pitch: pitches as MidiWriter.Pitch[],
          duration: `T${barSteps * ticksPer16th}` as MidiWriter.Duration,
          velocity: 0,
        }));
        continue;
      }

      let cursor = 0;
      for (let h = 0; h < hits.length; h++) {
        const hitPos = hits[h];
        const nextPos = h + 1 < hits.length ? hits[h + 1] : barSteps;

        const waitSteps = hitPos - cursor;
        const durationSteps = nextPos - hitPos;

        const opts: Record<string, unknown> = {
          pitch: pitches,
          duration: `T${durationSteps * ticksPer16th}`,
          velocity: 80,
        };
        if (waitSteps > 0) {
          opts.wait = `T${waitSteps * ticksPer16th}`;
        }

        track.addEvent(new MidiWriter.NoteEvent(opts));
        cursor = nextPos;
      }
    }
  }

  const write = new MidiWriter.Writer([track]);
  const dataUri = write.dataUri();

  const link = document.createElement('a');
  link.href = dataUri;
  link.download = `chord-progression-${keyName}-${scaleName}-${bpm}bpm.mid`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadTrack(track: MidiWriter.Track, filename: string): void {
  const write = new MidiWriter.Writer([track]);
  const link = document.createElement('a');
  link.href = write.dataUri();
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Exports a single melody (bass/lead/arp) as its own MIDI file. */
export function exportMelodyToMidi(
  melody: GeneratedMelody,
  bpm: number,
  label: string,
  keyName: string,
  scaleName: string,
): void {
  const track = buildMelodyTrack(melody, bpm, label);
  downloadTrack(track, `edm-${label.toLowerCase()}-${keyName}-${scaleName}-${bpm}bpm.mid`);
}

/** Exports the drum bar, repeated for the whole progression, with GM drum notes. */
export function exportDrumsToMidi(
  drums: DrumPattern,
  bpm: number,
  bars: number,
  keyName: string,
  scaleName: string,
): void {
  const track = buildDrumTrack(drums, bpm, bars);
  downloadTrack(track, `edm-drums-${keyName}-${scaleName}-${bpm}bpm.mid`);
}

function getNoteLetter(noteIndex: number): string {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return notes[noteIndex] || 'C';
}

function buildMelodyTrack(melody: GeneratedMelody, bpm: number, label: string): MidiWriter.Track {
  const track = new MidiWriter.Track();
  track.setTempo(bpm);
  track.addTrackName(`EDM ${label} Melody`);
  track.setTimeSignature(4, 4);

  const ticksPer16th = 32;
  let cursor = 0;

  for (const note of melody.notes) {
    const waitSteps = note.step - cursor;
    const opts: Record<string, unknown> = {
      pitch: [getNoteLetter(note.midi % 12) + Math.floor(note.midi / 12 - 1)],
      duration: `T${note.duration * ticksPer16th}`,
      velocity: 80,
    };
    if (waitSteps > 0) {
      opts.wait = `T${waitSteps * ticksPer16th}`;
    }
    track.addEvent(new MidiWriter.NoteEvent(opts));
    cursor = note.step + note.duration;
  }

  return track;
}

function buildDrumTrack(drums: DrumPattern, bpm: number, bars: number): MidiWriter.Track {
  const track = new MidiWriter.Track();
  track.setTempo(bpm);
  track.addTrackName('Drums');
  track.setTimeSignature(4, 4);

  const ticksPer16th = 32;
  const totalSteps = Math.max(1, bars) * 16;

  for (let step = 0; step < totalSteps; step++) {
    const stepInPattern = step % 16;
    const events: Record<string, unknown>[] = [];

    if (drums.kick[stepInPattern]) {
      events.push({ pitch: 'C1', duration: 'T32', velocity: 100 });
    }
    if (drums.snare[stepInPattern]) {
      events.push({ pitch: 'D1', duration: 'T32', velocity: 90 });
    }
    if (drums.clap[stepInPattern]) {
      events.push({ pitch: 'E1', duration: 'T32', velocity: 85 });
    }
    if (drums.hat[stepInPattern]) {
      events.push({ pitch: 'G#5', duration: 'T32', velocity: 70 });
    }

    if (events.length > 0) {
      if (step > 0) {
        events[0].wait = `T${ticksPer16th}`;
      }
      events.forEach(e => track.addEvent(new MidiWriter.NoteEvent(e)));
    }
  }

  return track;
}

export interface ArrangementMidiOptions {
  sections?: SongSection[] | null;
  octaves?: TrackOctaves;
  swing?: number;
  humanize?: boolean;
}

function eventsToTrack(
  events: ScheduleEvent[],
  bpm: number,
  name: string,
  pitchFor: (event: ScheduleEvent) => string | string[],
  channel?: number,
): MidiWriter.Track | null {
  if (events.length === 0) return null;
  const track = new MidiWriter.Track();
  track.setTempo(bpm);
  track.addTrackName(name);
  track.setTimeSignature(4, 4);

  const ticksPer16th = 32;
  let cursor = 0;
  for (const event of events) {
    const tick = Math.round((event.step + event.offset) * ticksPer16th);
    const duration = Math.max(ticksPer16th, Math.round(event.durationSteps * ticksPer16th));
    const opts: Record<string, unknown> = {
      pitch: pitchFor(event),
      duration: `T${duration}`,
      velocity: 80,
    };
    if (channel !== undefined) opts.channel = channel;
    if (tick > cursor) opts.wait = `T${tick - cursor}`;
    track.addEvent(new MidiWriter.NoteEvent(opts));
    cursor = tick;
  }
  return track;
}

const NOTE_LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiToPitch = (midi: number): string => `${NOTE_LETTERS[midi % 12]}${Math.floor(midi / 12) - 1}`;

const DRUM_PITCH: Record<string, string> = {
  kick: 'C1',
  snare: 'D1',
  clap: 'E1',
  hat: 'G#5',
};

/**
 * Writes the same event schedule that is played live, so sections, octave
 * shifts, swing and humanising are all reflected in the exported MIDI.
 */
export function exportArrangementToMidi(
  chords: ChordInfo[],
  rhythm: RhythmPattern,
  bass: GeneratedMelody,
  lead: GeneratedMelody,
  bpm: number,
  keyName: string,
  scaleName: string,
  doubleTime = false,
  arpMelody?: GeneratedMelody | null,
  drums?: DrumPattern | null,
  options: ArrangementMidiOptions = {},
): void {
  void doubleTime;
  const events = buildSchedule({
    chords,
    rhythm,
    bass,
    lead,
    arpMelody,
    drums,
    sections: options.sections,
    octaves: options.octaves,
    swing: options.swing,
    humanize: options.humanize,
  });

  const chordEvents = events.filter(event => event.track === 'chord' || event.track === 'arp');
  const bassEvents = events.filter(event => event.track === 'bass');
  const leadEvents = events.filter(event => event.track === 'lead');
  const drumEvents = events.filter(event => event.track === 'drums');

  const tracks = [
    eventsToTrack(chordEvents, bpm, 'Chords', event => (
      event.track === 'chord' ? event.midis.map(midiToPitch) : ('midi' in event ? [midiToPitch(event.midi)] : [])
    )),
    eventsToTrack(bassEvents, bpm, 'Bass', event => (
      'midi' in event ? [midiToPitch(event.midi)] : []
    )),
    eventsToTrack(leadEvents, bpm, 'Lead', event => (
      'midi' in event ? [midiToPitch(event.midi)] : []
    )),
    eventsToTrack(drumEvents, bpm, 'Drums', event => (
      'instrument' in event ? [DRUM_PITCH[event.instrument]] : []
    ), 10),
  ].filter((track): track is MidiWriter.Track => track !== null);

  if (tracks.length === 0) return;

  const write = new MidiWriter.Writer(tracks);
  const link = document.createElement('a');
  link.href = write.dataUri();
  link.download = `edm-arrangement-${keyName}-${scaleName}-${bpm}bpm.mid`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
