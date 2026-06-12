import * as Tone from 'tone';
import type { ChordInfo } from './musicTheory';
import { midiNoteToToneName } from './musicTheory';
import type { RhythmPattern } from '../data/genres';
import type { GeneratedMelody, MelodyNote } from './melodyGenerator';
import { createSynth, type SynthPresetId } from './audioEngine';

export type TrackId = 'chord' | 'bass' | 'lead';
export const TRACK_IDS: TrackId[] = ['chord', 'bass', 'lead'];

const STEPS_PER_CHORD = 16; // melodies are generated on a fixed 16-step (1 bar) grid

interface MixerNodes {
  reverb: Tone.Reverb;
  channels: Record<TrackId, Tone.Channel>;
  synths: Record<TrackId, Tone.PolySynth | null>;
}

let mixer: MixerNodes | null = null;
let arrLoop: Tone.Loop | null = null;
let arrPlaying = false;

function ensureMixer(): MixerNodes {
  if (mixer) return mixer;
  // Each track -> its own channel (volume/mute/solo) -> shared reverb -> master output.
  const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.25 }).toDestination();
  const channels: Record<TrackId, Tone.Channel> = {
    chord: new Tone.Channel({ volume: 0 }).connect(reverb),
    bass: new Tone.Channel({ volume: 0 }).connect(reverb),
    lead: new Tone.Channel({ volume: 0 }).connect(reverb),
  };
  mixer = { reverb, channels, synths: { chord: null, bass: null, lead: null } };
  return mixer;
}

function disposeSynths(m: MixerNodes): void {
  for (const id of TRACK_IDS) {
    const s = m.synths[id];
    if (s) { s.disconnect(); s.dispose(); m.synths[id] = null; }
  }
}

function createTrackSynth(track: TrackId, chordSynthId: SynthPresetId): Tone.PolySynth {
  if (track === 'chord') return createSynth(chordSynthId);
  if (track === 'bass') {
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth4' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.5 },
      volume: -8,
    });
  }
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle8' },
    envelope: { attack: 0.01, decay: 0.15, sustain: 0.3, release: 0.8 },
    volume: -10,
  });
}

export interface ArrangementOptions {
  chords: ChordInfo[];
  rhythm: RhythmPattern;
  bass: GeneratedMelody;
  lead: GeneratedMelody;
  synthIds: { chord: SynthPresetId; bass: SynthPresetId; lead: SynthPresetId };
  bpm: number;
  loop: boolean;
  onStep?: (step: number) => void;
  onStop?: () => void;
}

export function playArrangement(opts: ArrangementOptions): void {
  stopArrangement();
  const m = ensureMixer();
  Tone.getTransport().bpm.value = opts.bpm;

  disposeSynths(m);
  for (const id of TRACK_IDS) {
    const synth = createTrackSynth(id, opts.synthIds[id]);
    synth.connect(m.channels[id]);
    m.synths[id] = synth;
  }

  const totalSteps = opts.chords.length * STEPS_PER_CHORD;
  const sixteenth = Tone.Time('16n').toSeconds();
  const pattern = opts.rhythm.pattern;
  const plen = pattern.length;

  const bassMap = new Map<number, MelodyNote>();
  for (const n of opts.bass.notes) bassMap.set(n.step, n);
  const leadMap = new Map<number, MelodyNote>();
  for (const n of opts.lead.notes) leadMap.set(n.step, n);

  const chordNames = opts.chords.map(c => c.midiNotes.map(midiNoteToToneName));

  let step = 0;
  arrLoop = new Tone.Loop((time) => {
    const chordIdx = Math.floor(step / STEPS_PER_CHORD);
    const sic = step % STEPS_PER_CHORD;
    const ps = sic % plen;

    if (pattern[ps]) {
      let nextHit = plen - ps;
      for (let i = ps + 1; i < plen; i++) {
        if (pattern[i]) { nextHit = i - ps; break; }
      }
      const names = chordNames[chordIdx];
      if (names && m.synths.chord) {
        m.synths.chord.triggerAttackRelease(names, sixteenth * nextHit * 0.9, time);
      }
    }

    const bn = bassMap.get(step);
    if (bn && m.synths.bass) {
      m.synths.bass.triggerAttackRelease(midiNoteToToneName(bn.midi), sixteenth * bn.duration * 0.9, time);
    }
    const ln = leadMap.get(step);
    if (ln && m.synths.lead) {
      m.synths.lead.triggerAttackRelease(midiNoteToToneName(ln.midi), sixteenth * ln.duration * 0.9, time);
    }

    const currentStep = step;
    if (opts.onStep) Tone.getDraw().schedule(() => opts.onStep!(currentStep), time);

    step++;
    if (step >= totalSteps) {
      if (opts.loop) {
        step = 0;
      } else {
        Tone.getDraw().schedule(() => { if (opts.onStop) opts.onStop(); }, time);
        stopArrangement();
      }
    }
  }, '16n');

  if (opts.onStep) opts.onStep(0);
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
  synthIds: { chord: SynthPresetId; bass: SynthPresetId; lead: SynthPresetId };
  bpm: number;
  tracks: Record<TrackId, { volume: number; mute: boolean; solo: boolean }>;
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const blockAlign = numCh * 2;
  const dataSize = numFrames * blockAlign;
  const arr = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arr);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
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
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}

export async function renderArrangementToWav(opts: RenderOptions): Promise<Blob> {
  const totalSteps = opts.chords.length * STEPS_PER_CHORD;
  const secPer16 = (60 / opts.bpm) / 4;
  const duration = totalSteps * secPer16 + 1.5; // trailing tail for releases
  const pattern = opts.rhythm.pattern;
  const plen = pattern.length;
  const chordNames = opts.chords.map(c => c.midiNotes.map(midiNoteToToneName));

  const bassMap = new Map<number, MelodyNote>();
  for (const n of opts.bass.notes) bassMap.set(n.step, n);
  const leadMap = new Map<number, MelodyNote>();
  for (const n of opts.lead.notes) leadMap.set(n.step, n);

  const anySolo = TRACK_IDS.some(id => opts.tracks[id].solo);
  const isAudible = (id: TrackId) => (anySolo ? opts.tracks[id].solo : !opts.tracks[id].mute);

  const rendered = await Tone.Offline(() => {
    const verb = new Tone.Freeverb({ roomSize: 0.7, dampening: 3000, wet: 0.2 }).toDestination();
    const synths: Record<TrackId, Tone.PolySynth> = {
      chord: createTrackSynth('chord', opts.synthIds.chord).connect(verb),
      bass: createTrackSynth('bass', opts.synthIds.bass).connect(verb),
      lead: createTrackSynth('lead', opts.synthIds.lead).connect(verb),
    };
    for (const id of TRACK_IDS) synths[id].volume.value += opts.tracks[id].volume;

    for (let step = 0; step < totalSteps; step++) {
      const t = step * secPer16;
      const chordIdx = Math.floor(step / STEPS_PER_CHORD);
      const sic = step % STEPS_PER_CHORD;
      const ps = sic % plen;

      if (isAudible('chord') && pattern[ps]) {
        let nextHit = plen - ps;
        for (let i = ps + 1; i < plen; i++) { if (pattern[i]) { nextHit = i - ps; break; } }
        const names = chordNames[chordIdx];
        if (names) synths.chord.triggerAttackRelease(names, secPer16 * nextHit * 0.9, t);
      }
      const bn = bassMap.get(step);
      if (bn && isAudible('bass')) synths.bass.triggerAttackRelease(midiNoteToToneName(bn.midi), secPer16 * bn.duration * 0.9, t);
      const ln = leadMap.get(step);
      if (ln && isAudible('lead')) synths.lead.triggerAttackRelease(midiNoteToToneName(ln.midi), secPer16 * ln.duration * 0.9, t);
    }
  }, duration);

  return audioBufferToWav(rendered.get() as unknown as AudioBuffer);
}
