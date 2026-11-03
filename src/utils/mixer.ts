import * as Tone from 'tone';
import type { ChordInfo } from './musicTheory';
import { midiNoteToToneName } from './musicTheory';
import type { RhythmPattern } from '../data/genres';
import type { GeneratedMelody } from './melodyGenerator';
import type { DrumPattern } from './drumGenerator';
import { createSynth, type SynthPresetId } from './audioEngine';
import type { DrumKitId } from '../data/drumKits';
import {
  buildSchedule,
  eventsForTrack,
  groupByStep,
  totalSteps,
  type DrumInstrument,
  type ScheduleEvent,
  type TrackId,
} from './schedule';

export type { TrackId } from './schedule';
export const TRACK_IDS: TrackId[] = ['chord', 'bass', 'lead', 'drums'];

const GATE = 0.9;

interface DrumSynths {
  kick: Tone.MembraneSynth;
  snare: Tone.NoiseSynth;
  clap: Tone.NoiseSynth;
  hat: Tone.MetalSynth;
}

interface MixerNodes {
  reverb: Tone.Freeverb;
  channels: Record<TrackId, Tone.Channel>;
  synths: Record<'chord' | 'bass' | 'lead', Tone.PolySynth | null>;
  drumSynths: DrumSynths | null;
}

let mixer: MixerNodes | null = null;
let arrLoop: Tone.Loop | null = null;
let arrPlaying = false;
let arrLoopEnabled = false;
let arrTotalSteps = 0;
let currentKitId: DrumKitId = 'acoustic';
let previewLoop: Tone.Loop | null = null;
let previewPlaying = false;

function getDrumSynthParams(kitId: DrumKitId) {
  switch (kitId) {
    case '909':
      return {
        kick: { pitchDecay: 0.02, octaves: 12, envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 0.5 } },
        snare: { noise: { type: 'white' as const }, envelope: { attack: 0.001, decay: 0.15, sustain: 0 } },
        clap: { noise: { type: 'pink' as const }, envelope: { attack: 0.001, decay: 0.1, sustain: 0 } },
        hat: { envelope: { attack: 0.001, decay: 0.08, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 6000, octaves: 1.5 },
      };
    case '808':
      return {
        kick: { pitchDecay: 0.08, octaves: 10, envelope: { attack: 0.001, decay: 0.5, sustain: 0.01, release: 1.5 } },
        snare: { noise: { type: 'white' as const }, envelope: { attack: 0.001, decay: 0.25, sustain: 0 } },
        clap: { noise: { type: 'pink' as const }, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } },
        hat: { envelope: { attack: 0.001, decay: 0.05, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 8000, octaves: 1.5 },
      };
    case 'trap':
      return {
        kick: { pitchDecay: 0.03, octaves: 12, envelope: { attack: 0.001, decay: 0.2, sustain: 0.01, release: 0.8 } },
        snare: { noise: { type: 'white' as const }, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } },
        clap: { noise: { type: 'pink' as const }, envelope: { attack: 0.001, decay: 0.08, sustain: 0 } },
        hat: { envelope: { attack: 0.001, decay: 0.03, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 10000, octaves: 1.5 },
      };
    case 'breakbeat':
      return {
        kick: { pitchDecay: 0.04, octaves: 10, envelope: { attack: 0.001, decay: 0.35, sustain: 0.01, release: 1.0 } },
        snare: { noise: { type: 'white' as const }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 } },
        clap: { noise: { type: 'pink' as const }, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } },
        hat: { envelope: { attack: 0.001, decay: 0.07, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 5000, octaves: 1.5 },
      };
    default: // acoustic
      return {
        kick: { pitchDecay: 0.05, octaves: 10, envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 } },
        snare: { noise: { type: 'white' as const }, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } },
        clap: { noise: { type: 'pink' as const }, envelope: { attack: 0.001, decay: 0.15, sustain: 0 } },
        hat: { envelope: { attack: 0.001, decay: 0.1, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 },
      };
  }
}

function ensureMixer(): MixerNodes {
  if (mixer) return mixer;
  // Freeverb is deterministic and works synchronously in both live playback and
  // offline rendering, so the exported WAV matches what the user hears.
  const reverb = new Tone.Freeverb({ roomSize: 0.7, dampening: 3000, wet: 0.25 }).toDestination();
  const channels: Record<TrackId, Tone.Channel> = {
    chord: new Tone.Channel({ volume: 0 }).connect(reverb),
    bass: new Tone.Channel({ volume: 0 }).connect(reverb),
    lead: new Tone.Channel({ volume: 0 }).connect(reverb),
    drums: new Tone.Channel({ volume: 0 }).connect(reverb),
  };

  mixer = {
    reverb,
    channels,
    synths: { chord: null, bass: null, lead: null },
    drumSynths: null,
  };
  return mixer;
}

function createDrumSynths(kitId: DrumKitId, destination: Tone.InputNode): DrumSynths {
  const params = getDrumSynthParams(kitId);
  return {
    kick: new Tone.MembraneSynth(params.kick).connect(destination),
    snare: new Tone.NoiseSynth(params.snare).connect(destination),
    clap: new Tone.NoiseSynth(params.clap).connect(destination),
    hat: new Tone.MetalSynth(params.hat).connect(destination),
  };
}

function disposeDrums(drums: DrumSynths | null): void {
  if (!drums) return;
  for (const node of [drums.kick, drums.snare, drums.clap, drums.hat]) {
    node.disconnect();
    node.dispose();
  }
}

export function updateDrumKit(kitId: DrumKitId): void {
  currentKitId = kitId;
  const m = ensureMixer();
  disposeDrums(m.drumSynths);
  m.drumSynths = createDrumSynths(kitId, m.channels.drums);
}

function disposeMelodicSynths(m: MixerNodes): void {
  for (const id of ['chord', 'bass', 'lead'] as const) {
    const synth = m.synths[id];
    if (synth) {
      synth.disconnect();
      synth.dispose();
      m.synths[id] = null;
    }
  }
}

function createTrackSynth(synthId: SynthPresetId): Tone.PolySynth {
  return createSynth(synthId);
}

function ensureDrumKit(m: MixerNodes, kitId: DrumKitId): DrumSynths {
  if (!m.drumSynths || currentKitId !== kitId) {
    disposeDrums(m.drumSynths);
    currentKitId = kitId;
    m.drumSynths = createDrumSynths(kitId, m.channels.drums);
  }
  return m.drumSynths;
}

function triggerDrum(drums: DrumSynths, instrument: DrumInstrument, sixteenth: number, time: number): void {
  switch (instrument) {
    case 'kick':
      drums.kick.triggerAttackRelease('C1', sixteenth * 0.8, time);
      break;
    case 'snare':
      drums.snare.triggerAttackRelease(sixteenth * 0.6, time);
      break;
    case 'clap':
      drums.clap.triggerAttackRelease(sixteenth * 0.5, time);
      break;
    case 'hat':
      drums.hat.triggerAttackRelease('32n', sixteenth * 0.3, time);
      break;
  }
}

function playEvent(
  m: MixerNodes,
  event: ScheduleEvent,
  sixteenth: number,
  time: number,
): void {
  switch (event.track) {
    case 'chord':
      m.synths.chord?.triggerAttackRelease(
        event.midis.map(midiNoteToToneName),
        sixteenth * event.durationSteps * GATE,
        time,
      );
      break;
    case 'arp':
      m.synths.chord?.triggerAttackRelease(
        midiNoteToToneName(event.midi),
        sixteenth * event.durationSteps * GATE,
        time,
      );
      break;
    case 'bass':
      m.synths.bass?.triggerAttackRelease(
        midiNoteToToneName(event.midi),
        sixteenth * event.durationSteps * GATE,
        time,
      );
      break;
    case 'lead':
      m.synths.lead?.triggerAttackRelease(
        midiNoteToToneName(event.midi),
        sixteenth * event.durationSteps * GATE,
        time,
      );
      break;
    case 'drums':
      if (m.drumSynths) triggerDrum(m.drumSynths, event.instrument, sixteenth, time);
      break;
  }
}

interface ArrangementInput {
  chords: ChordInfo[];
  rhythm: RhythmPattern;
  bass: GeneratedMelody;
  lead: GeneratedMelody;
  arpMelody?: GeneratedMelody | null;
  drums?: DrumPattern | null;
  synthIds: { chord: SynthPresetId; bass: SynthPresetId; lead: SynthPresetId; drums: SynthPresetId };
  bpm: number;
  drumKitId?: DrumKitId;
  masterVolume?: number;
}

export interface ArrangementOptions extends ArrangementInput {
  loop: boolean;
  onStep?: (step: number) => void;
  onStop?: () => void;
}

export interface TrackPreviewOptions extends ArrangementInput {
  trackId: TrackId;
  onStep?: (step: number) => void;
  onStop?: () => void;
}

function prepareMixer(input: ArrangementInput): { mixer: MixerNodes; byStep: Map<number, ScheduleEvent[]>; steps: number } {
  const m = ensureMixer();
  Tone.getTransport().bpm.value = input.bpm;
  if (typeof input.masterVolume === 'number') Tone.getDestination().volume.value = input.masterVolume;

  disposeMelodicSynths(m);
  for (const id of ['chord', 'bass', 'lead'] as const) {
    const synth = createTrackSynth(input.synthIds[id]);
    synth.connect(m.channels[id]);
    m.synths[id] = synth;
  }
  ensureDrumKit(m, input.drumKitId ?? currentKitId);

  const events = buildSchedule(input);
  return { mixer: m, byStep: groupByStep(events), steps: totalSteps(input.chords) };
}

export function playArrangement(opts: ArrangementOptions): void {
  stopArrangement();
  const { mixer: m, byStep, steps } = prepareMixer(opts);

  arrLoopEnabled = opts.loop;
  arrTotalSteps = steps;

  let step = 0;
  arrLoop = new Tone.Loop((time) => {
    const sixteenth = Tone.Time('16n').toSeconds();
    for (const event of byStep.get(step) ?? []) playEvent(m, event, sixteenth, time);

    const currentStep = step;
    if (opts.onStep) Tone.getDraw().schedule(() => opts.onStep!(currentStep), time);

    step++;
    if (step >= arrTotalSteps) {
      if (arrLoopEnabled) {
        step = 0;
      } else {
        Tone.getDraw().schedule(() => opts.onStop?.(), time);
        stopArrangement();
      }
    }
  }, '16n');

  opts.onStep?.(0);
  arrLoop.start(0);
  Tone.getTransport().start();
  arrPlaying = true;
}

export function stopArrangement(): void {
  if (arrLoop) {
    arrLoop.stop();
    arrLoop.dispose();
    arrLoop = null;
  }
  Tone.getTransport().stop();
  Tone.getTransport().position = 0;
  arrPlaying = false;
}

export function isArrangementPlaying(): boolean {
  return arrPlaying;
}

export function setArrangementLoop(enabled: boolean): void {
  arrLoopEnabled = enabled;
}

export function setArrangementBpm(bpm: number): void {
  Tone.getTransport().bpm.value = bpm;
}

export function playTrackPreview(opts: TrackPreviewOptions): void {
  stopTrackPreview();
  stopArrangement();
  const { mixer: m, steps } = prepareMixer(opts);
  const previewEvents = new Map<number, ScheduleEvent[]>();
  const trackEvents = eventsForTrack(buildSchedule(opts), opts.trackId);
  const filtered = groupByStep(trackEvents);
  for (const [step, events] of filtered) previewEvents.set(step, events);

  let step = 0;
  previewLoop = new Tone.Loop((time) => {
    const sixteenth = Tone.Time('16n').toSeconds();
    for (const event of previewEvents.get(step) ?? []) playEvent(m, event, sixteenth, time);

    const currentStep = step;
    if (opts.onStep) Tone.getDraw().schedule(() => opts.onStep!(currentStep), time);

    step++;
    if (step >= steps) {
      Tone.getDraw().schedule(() => opts.onStop?.(), time);
      stopTrackPreview();
    }
  }, '16n');

  opts.onStep?.(0);
  previewLoop.start(0);
  Tone.getTransport().start();
  previewPlaying = true;
}

export function stopTrackPreview(): void {
  if (previewLoop) {
    previewLoop.stop();
    previewLoop.dispose();
    previewLoop = null;
  }
  Tone.getTransport().stop();
  Tone.getTransport().position = 0;
  previewPlaying = false;
}

export function isTrackPreviewPlaying(): boolean {
  return previewPlaying;
}

export function setTrackVolume(track: TrackId, db: number): void {
  ensureMixer().channels[track].volume.value = db;
}

export function setTrackMute(track: TrackId, muted: boolean): void {
  ensureMixer().channels[track].mute = muted;
}

export function setTrackSolo(track: TrackId, soloed: boolean): void {
  ensureMixer().channels[track].solo = soloed;
}

export interface RenderOptions {
  chords: ChordInfo[];
  rhythm: RhythmPattern;
  bass: GeneratedMelody;
  lead: GeneratedMelody;
  arpMelody?: GeneratedMelody | null;
  drums?: DrumPattern | null;
  synthIds: { chord: SynthPresetId; bass: SynthPresetId; lead: SynthPresetId; drums: SynthPresetId };
  bpm: number;
  tracks: Record<TrackId, { volume: number; mute: boolean; solo: boolean }>;
  drumKitId?: DrumKitId;
  masterVolume?: number;
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const blockAlign = numCh * 2;
  const dataSize = numFrames * blockAlign;
  const arr = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arr);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  const channels: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numCh; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}

function trackIsAudible(
  eventTrack: ScheduleEvent['track'],
  tracks: RenderOptions['tracks'],
): boolean {
  const id: TrackId = eventTrack === 'arp' ? 'chord' : eventTrack;
  const anySolo = TRACK_IDS.some(track => tracks[track].solo);
  return anySolo ? tracks[id].solo : !tracks[id].mute;
}

export async function renderArrangementToWav(opts: RenderOptions): Promise<Blob> {
  const steps = totalSteps(opts.chords);
  const secPer16 = 60 / opts.bpm / 4;
  const duration = steps * secPer16 + 2.5;
  const events = buildSchedule(opts);

  const rendered = await Tone.Offline(() => {
    if (typeof opts.masterVolume === 'number') Tone.getDestination().volume.value = opts.masterVolume;
    const reverb = new Tone.Freeverb({ roomSize: 0.7, dampening: 3000, wet: 0.25 }).toDestination();
    const channels: Record<TrackId, Tone.Channel> = {
      chord: new Tone.Channel({ volume: opts.tracks.chord.volume }).connect(reverb),
      bass: new Tone.Channel({ volume: opts.tracks.bass.volume }).connect(reverb),
      lead: new Tone.Channel({ volume: opts.tracks.lead.volume }).connect(reverb),
      drums: new Tone.Channel({ volume: opts.tracks.drums.volume }).connect(reverb),
    };
    const synths = {
      chord: createTrackSynth(opts.synthIds.chord).connect(channels.chord),
      bass: createTrackSynth(opts.synthIds.bass).connect(channels.bass),
      lead: createTrackSynth(opts.synthIds.lead).connect(channels.lead),
    };
    const drums = createDrumSynths(opts.drumKitId ?? currentKitId, channels.drums);

    for (const event of events) {
      if (!trackIsAudible(event.track, opts.tracks)) continue;
      const time = event.step * secPer16;
      switch (event.track) {
        case 'chord':
          synths.chord.triggerAttackRelease(
            event.midis.map(midiNoteToToneName),
            secPer16 * event.durationSteps * GATE,
            time,
          );
          break;
        case 'arp':
          synths.chord.triggerAttackRelease(
            midiNoteToToneName(event.midi),
            secPer16 * event.durationSteps * GATE,
            time,
          );
          break;
        case 'bass':
          synths.bass.triggerAttackRelease(
            midiNoteToToneName(event.midi),
            secPer16 * event.durationSteps * GATE,
            time,
          );
          break;
        case 'lead':
          synths.lead.triggerAttackRelease(
            midiNoteToToneName(event.midi),
            secPer16 * event.durationSteps * GATE,
            time,
          );
          break;
        case 'drums':
          triggerDrum(drums, event.instrument, secPer16, time);
          break;
      }
    }
  }, duration);

  return audioBufferToWav(rendered.get() as unknown as AudioBuffer);
}

export function getCurrentDrumKit(): DrumKitId {
  return currentKitId;
}

export function getArrangementTotalSteps(): number {
  return arrTotalSteps;
}
