import * as Tone from 'tone';
import type { ChordInfo } from './musicTheory';
import type { RhythmPattern } from '../data/genres';

export type SynthPresetId = 'piano' | 'pad' | 'supersaw' | 'pluck' | 'dark' | 'bell' | 'organ';

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
  { id: 'bell', name: 'Bell', description: 'FM bell sound', category: 'genre' },
];

export function createSynth(presetId: SynthPresetId): Tone.PolySynth {
  switch (presetId) {
    case 'piano':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle8' },
        envelope: { attack: 0.005, decay: 0.3, sustain: 0.4, release: 1.2 },
        volume: -8,
      });
    case 'pad':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth4' },
        envelope: { attack: 0.4, decay: 0.5, sustain: 0.8, release: 2.0 },
        volume: -12,
      });
    case 'supersaw':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', spread: 40, count: 5 } as unknown as Tone.OmniOscillatorOptions,
        envelope: { attack: 0.05, decay: 0.3, sustain: 0.7, release: 1.5 },
        volume: -14,
      });
    case 'pluck':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.001, decay: 0.2, sustain: 0.1, release: 0.4 },
        volume: -8,
      });
    case 'dark':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'square8' },
        envelope: { attack: 0.1, decay: 0.4, sustain: 0.5, release: 1.0 },
        volume: -12,
      });
    case 'bell':
      return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01,
        modulationIndex: 14,
        envelope: { attack: 0.002, decay: 0.5, sustain: 0.2, release: 1.5 },
        modulation: { type: 'square' },
        modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.5 },
        volume: -10,
      } as unknown as Tone.FMSynthOptions);
    case 'organ':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine4' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.3 },
        volume: -8,
      });
    default:
      return new Tone.PolySynth(Tone.Synth, { volume: -8 });
  }
}

let currentSynth: Tone.PolySynth | null = null;
let reverb: Tone.Reverb | null = null;
let isPlaying = false;
let loopRef: Tone.Loop | null = null;

export async function initAudio(): Promise<void> {
  await Tone.start();
}

function ensureEffects(): Tone.Reverb {
  if (!reverb) {
    reverb = new Tone.Reverb({ decay: 2.5, wet: 0.3 }).toDestination();
  }
  return reverb;
}

function getSynth(presetId: SynthPresetId): Tone.PolySynth {
  if (currentSynth) {
    currentSynth.disconnect();
    currentSynth.dispose();
  }
  currentSynth = createSynth(presetId);
  currentSynth.connect(ensureEffects());
  return currentSynth;
}

export function playChord(chord: ChordInfo, presetId: SynthPresetId, duration = '2n'): void {
  const synth = getSynth(presetId);
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
): void {
  stopPlayback();
  Tone.getTransport().bpm.value = bpm;

  const synth = getSynth(presetId);
  let chordIndex = 0;
  const barsPerChord = doubleTime ? 2 : 1;
  const stepsPerChord = rhythm.subdivisions * barsPerChord;
  let stepInChord = 0;

  const sixteenthDuration = Tone.Time('16n').toSeconds();

  loopRef = new Tone.Loop((time) => {
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

  if (onChordChange) onChordChange(0);
  loopRef.start(0);
  Tone.getTransport().start();
  isPlaying = true;
}

export function stopPlayback(): void {
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

export function setVolume(db: number): void {
  Tone.getDestination().volume.value = db;
}
