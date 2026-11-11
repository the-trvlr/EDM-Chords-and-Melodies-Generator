import * as Tone from 'tone';
import type { ChordInfo } from './musicTheory';
import type { RhythmPattern } from '../data/genres';
import { PRESET_ENVELOPES, PRESET_VOICES, getChordEnvelope, type Envelope } from './audioProfiles';
import { prepareCountIn, startMetronome, stopMetronome } from './metronome';
export { getChordEnvelope, getVoiceBudget } from './audioProfiles';

export type SynthPresetId =
  | 'piano' | 'organ' | 'pad' | 'strings' | 'pluck' | 'bell'
  | 'supersaw' | 'dark' | 'violin' | 'flute'
  | 'sub' | 'reese' | 'acid' | 'bass808' | 'ebass' | 'upright';

export interface SynthPreset {
  id: SynthPresetId;
  name: string;
  description: string;
  category: 'simple' | 'genre';
}

export const SYNTH_PRESETS: SynthPreset[] = [
  { id: 'piano', name: 'Piano', description: 'Clean piano sound', category: 'simple' },
  { id: 'pad', name: 'Warm Pad', description: 'Smooth analog pad', category: 'simple' },
  { id: 'organ', name: 'Organ', description: 'Electric organ', category: 'simple' },
  { id: 'supersaw', name: 'Supersaw', description: 'Trance/Future Bass supersaw', category: 'genre' },
  { id: 'pluck', name: 'Pluck', description: 'Short plucky synth', category: 'genre' },
  { id: 'dark', name: 'Dark Lead', description: 'Dark techno/dubstep lead', category: 'genre' },
  { id: 'bell', name: 'Bells', description: 'Bell/xylophone', category: 'genre' },
  { id: 'strings', name: 'Strings', description: 'Cello/string ensemble', category: 'genre' },
  { id: 'violin', name: 'Violin', description: 'Solo violin', category: 'genre' },
  { id: 'flute', name: 'Flute', description: 'Airy flute', category: 'genre' },
  { id: 'upright', name: 'Upright Bass', description: 'Acoustic upright bass', category: 'genre' },
  { id: 'sub', name: 'Sub Bass', description: 'Clean sine sub', category: 'genre' },
  { id: 'reese', name: 'Reese', description: 'Detuned reese bass', category: 'genre' },
  { id: 'acid', name: 'Acid', description: '303-style acid bass', category: 'genre' },
  { id: 'bass808', name: '808', description: '808 sub with long tail', category: 'genre' },
  { id: 'ebass', name: 'Electric Bass', description: 'Sampled electric bass', category: 'genre' },
];

export const TRACK_SYNTH_IDS: Record<'chord' | 'bass' | 'lead', SynthPresetId[]> = {
  chord: ['piano', 'organ', 'pad', 'strings', 'pluck', 'bell'],
  bass: ['sub', 'reese', 'acid', 'bass808', 'ebass', 'upright'],
  lead: ['supersaw', 'dark', 'pluck', 'violin', 'flute', 'bell'],
};

function buildSynthOptions(presetId: SynthPresetId, envelope: Envelope): Record<string, unknown> {
  switch (presetId) {
    case 'piano':
      return { oscillator: { type: 'triangle8' }, envelope, volume: -10 };
    case 'pad':
      return { oscillator: { type: 'sawtooth4' }, envelope, volume: -14 };
    case 'organ':
      return { oscillator: { type: 'sine4' }, envelope, volume: -10 };
    case 'supersaw':
      return {
        oscillator: { type: 'fatsawtooth', spread: 20, count: 3 },
        envelope,
        volume: -13,
      };
    case 'pluck':
      return { oscillator: { type: 'triangle' }, envelope, volume: -10 };
    case 'dark':
      return { oscillator: { type: 'square8' }, envelope, volume: -14 };
    case 'bell':
      return {
        harmonicity: 3.01,
        modulationIndex: 14,
        envelope,
        modulation: { type: 'square' },
        modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.5 },
        volume: -12,
      };
    case 'strings':
      return { oscillator: { type: 'fatsawtooth', spread: 14, count: 3 }, envelope, volume: -16 };
    case 'violin':
      return { oscillator: { type: 'sawtooth4' }, envelope, volume: -13 };
    case 'flute':
      return { oscillator: { type: 'sine' }, envelope, volume: -12 };
    case 'upright':
      return { oscillator: { type: 'triangle' }, envelope, volume: -10 };
    case 'sub':
      return { oscillator: { type: 'sine' }, envelope, volume: -9 };
    case 'reese':
      return { oscillator: { type: 'fatsawtooth', spread: 12, count: 2 }, envelope, volume: -14 };
    case 'acid':
      return { oscillator: { type: 'square8' }, envelope, volume: -14 };
    case 'bass808':
      return { oscillator: { type: 'sine' }, envelope, volume: -8 };
    case 'ebass':
      return { oscillator: { type: 'triangle' }, envelope, volume: -9 };
    default:
      return { envelope, volume: -12 };
  }
}

export function createSynth(presetId: SynthPresetId, envelopeOverride?: Partial<Envelope>): Tone.PolySynth {
  const envelope: Envelope = { ...PRESET_ENVELOPES[presetId], ...envelopeOverride };
  const options = buildSynthOptions(presetId, envelope);
  const Voice = presetId === 'bell' ? Tone.FMSynth : Tone.Synth;
  const synth = new Tone.PolySynth(
    Voice as typeof Tone.Synth,
    options as unknown as Tone.SynthOptions,
  );
  synth.maxPolyphony = PRESET_VOICES[presetId];
  return synth;
}

let currentSynth: Tone.PolySynth | null = null;
let reverb: Tone.Reverb | null = null;
let limiter: Tone.Limiter | null = null;
let isPlaying = false;
let liveSynth: Tone.PolySynth | null = null;
let livePreset: SynthPresetId | null = null;
let loopRef: Tone.Loop | null = null;

export async function initAudio(): Promise<void> {
  await Tone.start();
}

function ensureOutput(): Tone.Limiter {
  if (!limiter) {
    // A master limiter keeps dense supersaw chords and fast rhythm patterns
    // below 0 dBFS instead of clipping the destination.
    limiter = new Tone.Limiter(-1).toDestination();
  }
  return limiter;
}

function ensureEffects(): Tone.Reverb {
  if (!reverb) {
    reverb = new Tone.Reverb({ decay: 2.5, wet: 0.3 }).connect(ensureOutput());
  }
  return reverb;
}

function getSynth(presetId: SynthPresetId, envelope?: Partial<Envelope>): Tone.PolySynth {
  if (currentSynth) {
    currentSynth.disconnect();
    currentSynth.dispose();
  }
  currentSynth = createSynth(presetId, envelope);
  currentSynth.connect(ensureEffects());
  return currentSynth;
}

export function playMidiNote(midi: number, presetId: SynthPresetId, duration = '8n'): void {
  if (!liveSynth || livePreset !== presetId) {
    liveSynth?.dispose();
    liveSynth = createSynth(presetId);
    liveSynth.connect(ensureEffects());
    livePreset = presetId;
  }
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  liveSynth.triggerAttackRelease(`${notes[midi % 12]}${octave}`, duration);
}

export function playChord(
  chord: ChordInfo,
  presetId: SynthPresetId,
  duration = '2n',
  rhythmName?: string,
  bpm?: number,
  pattern?: number[],
): void {
  const synth = getSynth(presetId, getChordEnvelope(rhythmName, bpm, pattern));
  const noteNames = chord.midiNotes.map(midi => {
    const octave = Math.floor(midi / 12) - 1;
    const noteIdx = midi % 12;
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${notes[noteIdx]}${octave}`;
  });
  synth.triggerAttackRelease(noteNames, duration);
}

export function playProgression(
  chords: ChordInfo[],
  presetId: SynthPresetId,
  bpm: number,
  rhythm: RhythmPattern,
  onChordChange?: (index: number) => void,
  onStop?: () => void,
  loop = false,
  doubleTime = false,
  metronome = false,
  countInBars = 0,
): void {
  stopPlayback();
  Tone.getTransport().bpm.value = bpm;

  const synth = getSynth(presetId, getChordEnvelope(rhythm.name, bpm, rhythm.pattern));
  let chordIndex = 0;
  const barsPerChord = doubleTime ? 2 : 1;
  const stepsPerChord = rhythm.subdivisions * barsPerChord;
  let stepInChord = 0;

  loopRef = new Tone.Loop((time) => {
    // Read the step length from the transport on every tick so tempo changes
    // are picked up live instead of freezing the duration of the notes.
    const sixteenthDuration = Tone.Time('16n').toSeconds();
    const patternStep = stepInChord % rhythm.pattern.length;
    if (rhythm.pattern[patternStep]) {
      const chord = chords[chordIndex];
      const noteNames = chord.midiNotes.map(midi => {
        const octave = Math.floor(midi / 12) - 1;
        const noteIdx = midi % 12;
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return `${notes[noteIdx]}${octave}`;
      });

      let nextHit = rhythm.pattern.length;
      for (let i = patternStep + 1; i < rhythm.pattern.length; i++) {
        if (rhythm.pattern[i]) { nextHit = i - patternStep; break; }
      }
      const noteDuration = sixteenthDuration * nextHit * 0.9;

      synth.triggerAttackRelease(noteNames, noteDuration, time);
    }

    stepInChord++;
    if (stepInChord >= stepsPerChord) {
      stepInChord = 0;
      chordIndex = (chordIndex + 1) % chords.length;
      if (onChordChange) {
        Tone.getDraw().schedule(() => onChordChange(chordIndex), time);
      }
      if (chordIndex === 0 && stepInChord === 0) {
        if (!loop) {
          Tone.getDraw().schedule(() => {
            if (onStop) onStop();
          }, time);
          stopPlayback();
          return;
        }
      }
    }
  }, '16n');

  const transportStart = prepareCountIn(bpm, countInBars);
  if (metronome) startMetronome(bpm);

  if (onChordChange) onChordChange(0);
  loopRef.start(0);
  Tone.getTransport().start(transportStart);
  isPlaying = true;
}

export function stopPlayback(): void {
  stopMetronome();
  if (loopRef) {
    loopRef.stop();
    loopRef.dispose();
    loopRef = null;
  }
  Tone.getTransport().stop();
  Tone.getTransport().position = 0;
  isPlaying = false;
}

export function getIsPlaying(): boolean {
  return isPlaying;
}

/** Live tempo change without restarting the chord loop. */
export function setPlaybackBpm(bpm: number): void {
  Tone.getTransport().bpm.value = bpm;
}

export function setVolume(db: number): void {
  Tone.getDestination().volume.value = db;
}
