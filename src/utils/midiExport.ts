// @ts-expect-error midi-writer-js has types but exports resolution fails
import MidiWriter from 'midi-writer-js';
import type { ChordInfo } from './musicTheory';
import type { RhythmPattern } from '../data/genres';
import type { GeneratedMelody } from './melodyGenerator';
import type { DrumPattern } from './drumGenerator';
import { buildSchedule, type ScheduleEvent } from './schedule';
import type { SongSection, TrackOctaves } from '../types';

/** Ticks per 16th note in the exported files. */
const TICKS_PER_16 = 32;

/** GM drum notes: C2 = 36 (kick), D2 = 38 (snare), D#2 = 39 (clap), F#2 = 42 (closed hat). */
const DRUM_PITCH: Record<string, string> = {
  kick: 'C2',
  snare: 'D2',
  clap: 'D#2',
  hat: 'F#2',
};

const NOTE_LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToPitch(midi: number): string {
  return `${NOTE_LETTERS[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function tickOf(event: ScheduleEvent): number {
  return Math.round((event.step + event.offset) * TICKS_PER_16);
}

function newTrack(name: string, bpm: number): MidiWriter.Track {
  const track = new MidiWriter.Track();
  track.setTempo(bpm);
  track.addTrackName(name);
  track.setTimeSignature(4, 4);
  return track;
}

function addEvent(
  track: MidiWriter.Track,
  pitch: string | string[],
  tick: number,
  durationTicks: number,
  velocity: number,
  channel?: number,
): void {
  const options: Record<string, unknown> = {
    pitch,
    duration: `T${Math.max(1, Math.round(durationTicks))}`,
    velocity,
    tick: Math.max(0, Math.round(tick)),
  };
  if (channel !== undefined) options.channel = channel;
  track.addEvent(new MidiWriter.NoteEvent(options));
}

function download(tracks: MidiWriter.Track[], filename: string): void {
  const write = new MidiWriter.Writer(tracks);
  const link = document.createElement('a');
  link.href = write.dataUri();
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Chord MIDI for the harmony screen. Notes are placed on absolute ticks so
 * consecutive chords are contiguous (no empty bar between them), and double
 * time is expressed by giving every chord two bars.
 */
export function buildProgressionTracks(
  chords: ChordInfo[],
  bpm: number,
  rhythm: RhythmPattern,
  doubleTime = false,
): MidiWriter.Track[] {
  const scheduleChords = doubleTime ? chords.flatMap(chord => [chord, chord]) : chords;
  const events = buildSchedule({ chords: scheduleChords, rhythm })
    .filter((event): event is Extract<ScheduleEvent, { track: 'chord' }> => event.track === 'chord');
  if (events.length === 0) return [];

  const track = newTrack('Chords', bpm);
  for (const event of events) {
    addEvent(
      track,
      event.midis.map(midiToPitch),
      tickOf(event),
      event.durationSteps * TICKS_PER_16 * 0.98,
      80,
    );
  }
  return [track];
}

export function exportProgressionToMidi(
  chords: ChordInfo[],
  bpm: number,
  rhythm: RhythmPattern,
  keyName: string,
  scaleName: string,
  doubleTime = false,
): void {
  const tracks = buildProgressionTracks(chords, bpm, rhythm, doubleTime);
  if (tracks.length === 0) return;
  download(tracks, `chord-progression-${keyName}-${scaleName}-${bpm}bpm.mid`);
}

/** Exports a single melody (bass/lead/arp) as its own MIDI file. */
export function exportMelodyToMidi(
  melody: GeneratedMelody,
  bpm: number,
  label: string,
  keyName: string,
  scaleName: string,
): void {
  const track = newTrack(`${label} ${keyName} ${scaleName}`, bpm);
  for (const note of melody.notes) {
    addEvent(
      track,
      midiToPitch(note.midi),
      note.step * TICKS_PER_16,
      note.duration * TICKS_PER_16 * 0.98,
      80,
    );
  }
  download([track], `edm-${label.toLowerCase()}-${keyName}-${scaleName}-${bpm}bpm.mid`);
}

/**
 * One MIDI track per drum instrument (Kick/Snare/Clap/Hat) on GM channel 10,
 * so each part can be routed to its own sampler or replaced with samples.
 */
export function buildDrumTracks(drums: DrumPattern, bpm: number, bars: number): MidiWriter.Track[] {
  const instruments: { id: keyof DrumPattern; name: string; velocity: number }[] = [
    { id: 'kick', name: 'Kick', velocity: 100 },
    { id: 'snare', name: 'Snare', velocity: 90 },
    { id: 'clap', name: 'Clap', velocity: 85 },
    { id: 'hat', name: 'Hat', velocity: 70 },
  ];

  return instruments.flatMap(({ id, name, velocity }) => {
    const track = newTrack(name, bpm);
    let hasNotes = false;
    for (let bar = 0; bar < Math.max(1, bars); bar++) {
      for (let step = 0; step < 16; step++) {
        if (!drums[id][step]) continue;
        hasNotes = true;
        addEvent(
          track,
          DRUM_PITCH[id],
          (bar * 16 + step) * TICKS_PER_16,
          TICKS_PER_16,
          velocity,
          10,
        );
      }
    }
    return hasNotes ? [track] : [];
  });
}

/** Exports the drum bar, repeated for the whole progression, as 4 GM tracks. */
export function exportDrumsToMidi(
  drums: DrumPattern,
  bpm: number,
  bars: number,
  keyName: string,
  scaleName: string,
): void {
  const tracks = buildDrumTracks(drums, bpm, bars);
  if (tracks.length === 0) return;
  download(tracks, `edm-drums-${keyName}-${scaleName}-${bpm}bpm.mid`);
}

export interface ArrangementMidiOptions {
  sections?: SongSection[] | null;
  octaves?: TrackOctaves;
  swing?: number;
  humanize?: boolean;
}

/**
 * Full arrangement MIDI from the same schedule as playback: chords, bass,
 * lead and one track per drum instrument. Explicit ticks keep every part on
 * the grid, including sections, octave shifts, swing and humanize.
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
  if (events.length === 0) return;

  const chordEvents = events.filter(event => event.track === 'chord' || event.track === 'arp');
  const bassEvents = events.filter(event => event.track === 'bass');
  const leadEvents = events.filter(event => event.track === 'lead');
  const drumEvents = events.filter(event => event.track === 'drums');

  const tracks: MidiWriter.Track[] = [];

  if (chordEvents.length > 0) {
    const chordTrack = newTrack('Chords', bpm);
    for (const event of chordEvents) {
      if (event.track === 'chord') {
        addEvent(chordTrack, event.midis.map(midiToPitch), tickOf(event), event.durationSteps * TICKS_PER_16 * 0.98, 80);
      } else if (event.track === 'arp') {
        addEvent(chordTrack, midiToPitch(event.midi), tickOf(event), event.durationSteps * TICKS_PER_16 * 0.98, 80);
      }
    }
    tracks.push(chordTrack);
  }

  for (const [eventsForTrack, name] of [[bassEvents, 'Bass'], [leadEvents, 'Lead']] as const) {
    if (eventsForTrack.length === 0) continue;
    const track = newTrack(name, bpm);
    for (const event of eventsForTrack) {
      if (event.track === 'bass' || event.track === 'lead') {
        addEvent(track, midiToPitch(event.midi), tickOf(event), event.durationSteps * TICKS_PER_16 * 0.98, 80);
      }
    }
    tracks.push(track);
  }

  if (drumEvents.length > 0) {
    const instruments: { id: string; name: string; velocity: number }[] = [
      { id: 'kick', name: 'Kick', velocity: 100 },
      { id: 'snare', name: 'Snare', velocity: 90 },
      { id: 'clap', name: 'Clap', velocity: 85 },
      { id: 'hat', name: 'Hat', velocity: 70 },
    ];
    for (const instrument of instruments) {
      const drumTrack = newTrack(instrument.name, bpm);
      const matching = drumEvents.filter(event => event.track === 'drums' && event.instrument === instrument.id);
      if (matching.length === 0) continue;
      for (const event of matching) {
        addEvent(
          drumTrack,
          DRUM_PITCH[instrument.id],
          tickOf(event),
          TICKS_PER_16,
          instrument.velocity,
          10,
        );
      }
      tracks.push(drumTrack);
    }
  }

  if (tracks.length === 0) return;

  if (options.sections && options.sections.length > 0) {
    const markerTrack = newTrack('Sections', bpm);
    let tick = 0;
    options.sections.forEach((section, index) => {
      markerTrack.addEvent(new MidiWriter.MarkerEvent({
        text: `${section.kind.toUpperCase()} ${index + 1} (${section.bars} bars)`,
        delta: tick,
      }));
      tick += section.bars * 16 * TICKS_PER_16;
    });
    tracks.push(markerTrack);
  }

  download(tracks, `edm-arrangement-${keyName}-${scaleName}-${bpm}bpm.mid`);
}
