import * as Tone from 'tone';
import type { ChordInfo } from './musicTheory';
import { midiNoteToToneName } from './musicTheory';
import type { RhythmPattern } from '../data/genres';
import type { GeneratedMelody, MelodyNote } from './melodyGenerator';
import type { DrumPattern } from './drumGenerator';
import { createSynth, type SynthPresetId } from './audioEngine';
import type { DrumKitId } from '../data/drumKits';

export type TrackId = 'chord' | 'bass' | 'lead' | 'drums';
export const TRACK_IDS: TrackId[] = ['chord', 'bass', 'lead', 'drums'];

const STEPS_PER_CHORD = 16; // melodies are generated on a fixed 16-step (1 bar) grid

interface MixerNodes {
  reverb: Tone.Reverb;
  channels: Record<TrackId, Tone.Channel>;
  synths: Record<TrackId, Tone.PolySynth | null>;
  drumSynths: {
    kick: Tone.MembraneSynth;
    snare: Tone.NoiseSynth;
    clap: Tone.NoiseSynth;
    hat: Tone.MetalSynth;
  } | null;
}

let mixer: MixerNodes | null = null;
let arrLoop: Tone.Loop | null = null;
let arrPlaying = false;

function getDrumSynthParams(kitId: DrumKitId) {
  switch (kitId) {
    case '909':
      return {
        kick: { pitchDecay: 0.02, octaves: 12, envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 0.5 } },
        snare: { noise: { type: 'white' as const }, envelope: { attack: 0.001, decay: 0.15, sustain: 0 } },
        clap: { noise: { type: 'pink' as const }, envelope: { attack: 0.001, decay: 0.1, sustain: 0 } },
        hat: { envelope: { attack: 0.001, decay: 0.08, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 6000, octaves: 1.5 }
      };
    case '808':
      return {
        kick: { pitchDecay: 0.08, octaves: 10, envelope: { attack: 0.001, decay: 0.5, sustain: 0.01, release: 1.5 } },
        snare: { noise: { type: 'white' as const }, envelope: { attack: 0.001, decay: 0.25, sustain: 0 } },
        clap: { noise: { type: 'pink' as const }, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } },
        hat: { envelope: { attack: 0.001, decay: 0.05, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 8000, octaves: 1.5 }
      };
    case 'trap':
      return {
        kick: { pitchDecay: 0.03, octaves: 12, envelope: { attack: 0.001, decay: 0.2, sustain: 0.01, release: 0.8 } },
        snare: { noise: { type: 'white' as const }, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } },
        clap: { noise: { type: 'pink' as const }, envelope: { attack: 0.001, decay: 0.08, sustain: 0 } },
        hat: { envelope: { attack: 0.001, decay: 0.03, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 10000, octaves: 1.5 }
      };
    case 'breakbeat':
      return {
        kick: { pitchDecay: 0.04, octaves: 10, envelope: { attack: 0.001, decay: 0.35, sustain: 0.01, release: 1.0 } },
        snare: { noise: { type: 'white' as const }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 } },
        clap: { noise: { type: 'pink' as const }, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } },
        hat: { envelope: { attack: 0.001, decay: 0.07, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 5000, octaves: 1.5 }
      };
    default: // acoustic
      return {
        kick: { pitchDecay: 0.05, octaves: 10, envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 } },
        snare: { noise: { type: 'white' as const }, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } },
        clap: { noise: { type: 'pink' as const }, envelope: { attack: 0.001, decay: 0.15, sustain: 0 } },
        hat: { envelope: { attack: 0.001, decay: 0.1, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }
      };
  }
}

function ensureMixer(): MixerNodes {
  if (mixer) return mixer;
  // Each track -> its own channel (volume/mute/solo) -> shared reverb -> master output.
  const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.25 }).toDestination();
  const channels: Record<TrackId, Tone.Channel> = {
    chord: new Tone.Channel({ volume: 0 }).connect(reverb),
    bass: new Tone.Channel({ volume: 0 }).connect(reverb),
    lead: new Tone.Channel({ volume: 0 }).connect(reverb),
    drums: new Tone.Channel({ volume: 0 }).connect(reverb),
  };
  
  mixer = { reverb, channels, synths: { chord: null, bass: null, lead: null, drums: null }, drumSynths: null };
  return mixer;
}

function createDrumSynths(kitId: DrumKitId, channel: Tone.Channel) {
  const params = getDrumSynthParams(kitId);
  
  const kick = new Tone.MembraneSynth(params.kick).connect(channel);
  const snare = new Tone.NoiseSynth(params.snare).connect(channel);
  const clap = new Tone.NoiseSynth(params.clap).connect(channel);
  const hat = new Tone.MetalSynth(params.hat).connect(channel);
  
  return { kick, snare, clap, hat };
}

export function updateDrumKit(kitId: DrumKitId): void {
  const m = ensureMixer();
  
  // Dispose existing drum synths
  if (m.drumSynths) {
    m.drumSynths.kick.disconnect();
    m.drumSynths.kick.dispose();
    m.drumSynths.snare.disconnect();
    m.drumSynths.snare.dispose();
    m.drumSynths.clap.disconnect();
    m.drumSynths.clap.dispose();
    m.drumSynths.hat.disconnect();
    m.drumSynths.hat.dispose();
  }
  
  // Create new drum synths with the selected kit
  m.drumSynths = createDrumSynths(kitId, m.channels.drums);
}

function disposeSynths(m: MixerNodes): void {
  for (const id of TRACK_IDS) {
    const s = m.synths[id];
    if (s) { s.disconnect(); s.dispose(); m.synths[id] = null; }
  }
  if (m.drumSynths) {
    m.drumSynths.kick.disconnect();
    m.drumSynths.kick.dispose();
    m.drumSynths.snare.disconnect();
    m.drumSynths.snare.dispose();
    m.drumSynths.clap.disconnect();
    m.drumSynths.clap.dispose();
    m.drumSynths.hat.disconnect();
    m.drumSynths.hat.dispose();
    m.drumSynths = null;
  }
}

function createTrackSynth(track: TrackId, synthId: SynthPresetId): Tone.PolySynth {
  if (track === 'chord') return createSynth(synthId);
  if (track === 'bass') return createSynth(synthId);
  if (track === 'lead') return createSynth(synthId);
  if (track === 'drums') {
    // Return a placeholder synth for drums - actual drum sounds will be synthesized
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
      volume: -5,
    });
  }
  return createSynth(synthId);
}

export interface ArrangementOptions {
  chords: ChordInfo[];
  rhythm: RhythmPattern;
  bass: GeneratedMelody;
  lead: GeneratedMelody;
  arpMelody?: GeneratedMelody | null;
  drums?: DrumPattern | null;
  synthIds: { chord: SynthPresetId; bass: SynthPresetId; lead: SynthPresetId; drums: SynthPresetId };
  bpm: number;
  loop: boolean;
  onStep?: (step: number) => void;
  onStop?: () => void;
}

export interface TrackPreviewOptions {
  chords: ChordInfo[];
  rhythm: RhythmPattern;
  bass: GeneratedMelody;
  lead: GeneratedMelody;
  arpMelody?: GeneratedMelody | null;
  drums?: DrumPattern | null;
  synthIds: { chord: SynthPresetId; bass: SynthPresetId; lead: SynthPresetId; drums: SynthPresetId };
  bpm: number;
  trackId: TrackId;
  onStep?: (step: number) => void;
  onStop?: () => void;
}

export function playArrangement(opts: ArrangementOptions): void {
  stopArrangement();
  const m = ensureMixer();
  Tone.getTransport().bpm.value = opts.bpm;

  disposeSynths(m);
  for (const id of TRACK_IDS) {
    if (id === 'drums') continue; // Skip drums - handled separately
    const synth = createTrackSynth(id, opts.synthIds[id]);
    synth.connect(m.channels[id]);
    m.synths[id] = synth;
  }
  
  // Create drum synths with default kit
  if (!m.drumSynths) {
    m.drumSynths = createDrumSynths('acoustic', m.channels.drums);
  }

  const totalSteps = opts.chords.length * STEPS_PER_CHORD;
  const sixteenth = Tone.Time('16n').toSeconds();
  const pattern = opts.rhythm.pattern;
  const plen = pattern.length;

  const bassMap = new Map<number, MelodyNote>();
  for (const n of opts.bass.notes) bassMap.set(n.step, n);
  const leadMap = new Map<number, MelodyNote>();
  for (const n of opts.lead.notes) leadMap.set(n.step, n);
  const arpMap = new Map<number, MelodyNote>();
  if (opts.arpMelody) {
    for (const n of opts.arpMelody.notes) arpMap.set(n.step, n);
  }

  const chordNames = opts.chords.map(c => c.midiNotes.map(midiNoteToToneName));

  let step = 0;
  arrLoop = new Tone.Loop((time) => {
    const chordIdx = Math.floor(step / STEPS_PER_CHORD);
    const sic = step % STEPS_PER_CHORD;
    const ps = sic % plen;

    // Play arpeggiated chords if arp is enabled, otherwise play block chords
    if (opts.arpMelody) {
      const an = arpMap.get(step);
      if (an && m.synths.chord) {
        m.synths.chord.triggerAttackRelease(midiNoteToToneName(an.midi), sixteenth * an.duration * 0.9, time);
      }
    } else {
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
    }

    const bn = bassMap.get(step);
    if (bn && m.synths.bass) {
      m.synths.bass.triggerAttackRelease(midiNoteToToneName(bn.midi), sixteenth * bn.duration * 0.9, time);
    }
    const ln = leadMap.get(step);
    if (ln && m.synths.lead) {
      m.synths.lead.triggerAttackRelease(midiNoteToToneName(ln.midi), sixteenth * ln.duration * 0.9, time);
    }

    // Play drums if pattern is provided
    if (opts.drums && m.drumSynths) {
      const stepInPattern = step % 16;
      if (opts.drums.kick[stepInPattern]) {
        m.drumSynths.kick.triggerAttackRelease('C1', sixteenth * 0.8, time);
      }
      if (opts.drums.snare[stepInPattern]) {
        m.drumSynths.snare.triggerAttackRelease(sixteenth * 0.6, time);
      }
      if (opts.drums.clap[stepInPattern]) {
        m.drumSynths.clap.triggerAttackRelease(sixteenth * 0.5, time);
      }
      if (opts.drums.hat[stepInPattern]) {
        m.drumSynths.hat.triggerAttackRelease('32n', sixteenth * 0.3, time);
      }
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

let previewLoop: Tone.Loop | null = null;
let previewPlaying = false;

export function playTrackPreview(opts: TrackPreviewOptions): void {
  stopTrackPreview();
  stopArrangement();
  const m = ensureMixer();
  Tone.getTransport().bpm.value = opts.bpm;

  // Only create synth for the previewed track
  disposeSynths(m);
  if (opts.trackId !== 'drums') {
    const synth = createTrackSynth(opts.trackId, opts.synthIds[opts.trackId]);
    synth.connect(m.channels[opts.trackId]);
    m.synths[opts.trackId] = synth;
  }
  
  // Create drum synths if previewing drums
  if (opts.trackId === 'drums') {
    m.drumSynths = createDrumSynths('acoustic', m.channels.drums);
  }

  const totalSteps = opts.chords.length * STEPS_PER_CHORD;
  const sixteenth = Tone.Time('16n').toSeconds();
  const pattern = opts.rhythm.pattern;
  const plen = pattern.length;

  let step = 0;
  previewLoop = new Tone.Loop((time) => {
    const chordIdx = Math.floor(step / STEPS_PER_CHORD);
    const sic = step % STEPS_PER_CHORD;
    const ps = sic % plen;

    if (opts.trackId === 'chord') {
      // Play arpeggiated chords if arp is enabled, otherwise play block chords
      if (opts.arpMelody) {
        const an = opts.arpMelody.notes.find(n => n.step === step);
        if (an && m.synths.chord) {
          m.synths.chord.triggerAttackRelease(midiNoteToToneName(an.midi), sixteenth * an.duration * 0.9, time);
        }
      } else {
        if (pattern[ps]) {
          let nextHit = plen - ps;
          for (let i = ps + 1; i < plen; i++) {
            if (pattern[i]) { nextHit = i - ps; break; }
          }
          const chordNames = opts.chords.map(c => c.midiNotes.map(midiNoteToToneName));
          const names = chordNames[chordIdx];
          if (names && m.synths.chord) {
            m.synths.chord.triggerAttackRelease(names, sixteenth * nextHit * 0.9, time);
          }
        }
      }
    } else if (opts.trackId === 'bass') {
      const bn = opts.bass.notes.find(n => n.step === step);
      if (bn && m.synths.bass) {
        m.synths.bass.triggerAttackRelease(midiNoteToToneName(bn.midi), sixteenth * bn.duration * 0.9, time);
      }
    } else if (opts.trackId === 'lead') {
      const ln = opts.lead.notes.find(n => n.step === step);
      if (ln && m.synths.lead) {
        m.synths.lead.triggerAttackRelease(midiNoteToToneName(ln.midi), sixteenth * ln.duration * 0.9, time);
      }
    } else if (opts.trackId === 'drums' && opts.drums && m.drumSynths) {
      const stepInPattern = step % 16;
      if (opts.drums.kick[stepInPattern]) {
        m.drumSynths.kick.triggerAttackRelease('C1', sixteenth * 0.8, time);
      }
      if (opts.drums.snare[stepInPattern]) {
        m.drumSynths.snare.triggerAttackRelease(sixteenth * 0.6, time);
      }
      if (opts.drums.clap[stepInPattern]) {
        m.drumSynths.clap.triggerAttackRelease(sixteenth * 0.5, time);
      }
      if (opts.drums.hat[stepInPattern]) {
        m.drumSynths.hat.triggerAttackRelease('32n', sixteenth * 0.3, time);
      }
    }

    const currentStep = step;
    if (opts.onStep) Tone.getDraw().schedule(() => opts.onStep!(currentStep), time);

    step++;
    if (step >= totalSteps) {
      Tone.getDraw().schedule(() => { if (opts.onStop) opts.onStop(); }, time);
      stopTrackPreview();
    }
  }, '16n');

  if (opts.onStep) opts.onStep(0);
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
  drums?: DrumPattern | null;
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
      drums: createTrackSynth('drums', opts.synthIds.chord).connect(verb),
    };
    
    // Create drum synths for rendering
    const drumSynths = {
      kick: new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 10,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 }
      }).connect(verb),
      snare: new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
      }).connect(verb),
      clap: new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.001, decay: 0.15, sustain: 0 }
      }).connect(verb),
      hat: new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5
      }).connect(verb),
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
      
      // Play drums
      if (opts.drums && isAudible('drums')) {
        const stepInPattern = step % 16;
        if (opts.drums.kick[stepInPattern]) {
          drumSynths.kick.triggerAttackRelease('C1', secPer16 * 0.8, t);
        }
        if (opts.drums.snare[stepInPattern]) {
          drumSynths.snare.triggerAttackRelease(secPer16 * 0.6, t);
        }
        if (opts.drums.clap[stepInPattern]) {
          drumSynths.clap.triggerAttackRelease(secPer16 * 0.5, t);
        }
        if (opts.drums.hat[stepInPattern]) {
          drumSynths.hat.triggerAttackRelease('32n', secPer16 * 0.3, t);
        }
      }
    }
  }, duration);

  return audioBufferToWav(rendered.get() as unknown as AudioBuffer);
}
