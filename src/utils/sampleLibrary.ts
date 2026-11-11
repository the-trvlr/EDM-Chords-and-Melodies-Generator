import * as Tone from 'tone';
import type { SynthPresetId } from './audioEngine';
import type { TrackId } from './schedule';

type SampleInstrumentId = 'piano' | 'organ' | 'guitar' | 'bass' | 'harmonium' | 'cello' | 'xylophone' | 'violin' | 'flute' | 'contrabass';
export type SoundVariant = 'acoustic' | 'edm';

const SAMPLE_SETS: Record<SampleInstrumentId, { folder: string; notes: string[]; release: number }> = {
  piano: { folder: 'piano', notes: ['C2', 'C3', 'C4', 'C5', 'C6', 'C7'], release: 2.2 },
  organ: { folder: 'organ', notes: ['C2', 'C3', 'C4', 'C5', 'C6'], release: 0.6 },
  guitar: { folder: 'guitar-nylon', notes: ['A2', 'A3', 'A4', 'A5', 'Cs3', 'Cs4'], release: 1.0 },
  bass: { folder: 'bass-electric', notes: ['As1', 'Cs2', 'E2', 'As2', 'Cs3', 'E3'], release: 0.5 },
  harmonium: { folder: 'harmonium', notes: ['C3', 'C4', 'C5'], release: 1.2 },
  cello: { folder: 'cello', notes: ['C3', 'C4', 'C5'], release: 1.2 },
  xylophone: { folder: 'xylophone', notes: ['C5', 'C6', 'C7'], release: 1.2 },
  violin: { folder: 'violin', notes: ['C4', 'E4', 'G4', 'C5', 'E5'], release: 1.2 },
  flute: { folder: 'flute', notes: ['C4', 'E4', 'C5', 'E5', 'C6'], release: 0.7 },
  contrabass: { folder: 'contrabass', notes: ['C2', 'E2', 'A2'], release: 0.6 },
};

const PRESET_SAMPLE: Partial<Record<SynthPresetId, SampleInstrumentId>> = {
  piano: 'piano',
  organ: 'organ',
  pluck: 'guitar',
  pad: 'harmonium',
  strings: 'cello',
  violin: 'violin',
  flute: 'flute',
  upright: 'contrabass',
  ebass: 'bass',
  supersaw: 'cello',
  dark: 'cello',
  bell: 'xylophone',
};

// EDM keeps its electronic identity for bass/supersaw/pad/bell; the acoustic
// instrument presets stay sampled in both variants.
const EDM_SAMPLED_PRESETS = new Set<SynthPresetId>(['piano', 'organ', 'pluck', 'strings', 'violin', 'flute', 'ebass']);

/**
 * Two-layer velocity mapping: the soft layer shares the samples but runs
 * through a low-pass, so quiet notes are darker as well as quieter.
 */
export class LayeredSampler {
  private soft: Tone.Sampler;
  private hard: Tone.Sampler;
  private softFilter: Tone.Filter;

  constructor(soft: Tone.Sampler, hard: Tone.Sampler) {
    this.soft = soft;
    this.hard = hard;
    this.softFilter = new Tone.Filter({ type: 'lowpass', frequency: 2400, rolloff: -24 });
    this.soft.connect(this.softFilter);
    this.soft.volume.value = -5;
  }

  connect(destination: Tone.InputNode): this {
    this.softFilter.connect(destination);
    this.hard.connect(destination);
    return this;
  }

  disconnect(): void {
    this.softFilter.disconnect();
    this.hard.disconnect();
    this.soft.disconnect();
  }

  dispose(): void {
    this.disconnect();
    this.soft.dispose();
    this.hard.dispose();
    this.softFilter.dispose();
  }

  triggerAttackRelease(
    notes: Tone.Unit.Frequency | Tone.Unit.Frequency[],
    duration: Tone.Unit.Time | Tone.Unit.Time[],
    time?: Tone.Unit.Time,
    velocity = 0.8,
  ): this {
    const target = velocity < 0.55 ? this.soft : this.hard;
    if (Array.isArray(notes)) target.triggerAttackRelease(notes, duration, time, velocity);
    else target.triggerAttackRelease(notes, duration, time, velocity);
    return this;
  }
}

const samplers = new Map<string, LayeredSampler>();
const loading = new Map<string, Promise<LayeredSampler | null>>();

function keyOf(track: TrackId, preset: SynthPresetId): string {
  return `${track}:${preset}`;
}

export function sampleFor(preset: SynthPresetId, variant: SoundVariant): SampleInstrumentId | null {
  if (variant === 'edm' && !EDM_SAMPLED_PRESETS.has(preset)) return null;
  return PRESET_SAMPLE[preset] ?? null;
}

async function buildSampler(sampleId: SampleInstrumentId): Promise<LayeredSampler | null> {
  const set = SAMPLE_SETS[sampleId];
  const toneName = (file: string) => file.length > 1 && file[1] === 's'
    ? `${file[0]}#${file.slice(2)}`
    : file;
  const baseUrl = `${import.meta.env.BASE_URL}samples/${set.folder}/`;

  try {
    // Load each file once and share the decoded AudioBuffer between the soft
    // and hard samplers. Loading two independent samplers doubled first-load
    // time and decoded the same audio twice.
    const buffers = await Promise.all(set.notes.map(async file => {
      const buffer = await Tone.ToneAudioBuffer.load(`${baseUrl}${file}.mp3`);
      return [toneName(file), buffer] as const;
    }));
    const soft = new Tone.Sampler({ release: set.release });
    const hard = new Tone.Sampler({ release: set.release });
    for (const [note, buffer] of buffers) {
      soft.add(note as Parameters<Tone.Sampler['add']>[0], buffer);
      hard.add(note as Parameters<Tone.Sampler['add']>[0], buffer);
    }
    return new LayeredSampler(soft, hard);
  } catch {
    return null;
  }
}

export function createSamplerForPreset(preset: SynthPresetId): Promise<LayeredSampler | null> {
  const sampleId = PRESET_SAMPLE[preset];
  return sampleId ? buildSampler(sampleId) : Promise.resolve(null);
}

export function loadTrackSampler(
  track: Extract<TrackId, 'chord' | 'bass' | 'lead'>,
  preset: SynthPresetId,
): Promise<LayeredSampler | null> {
  const key = keyOf(track, preset);
  const existing = samplers.get(key);
  if (existing) return Promise.resolve(existing);
  const pending = loading.get(key);
  if (pending) return pending;

  const sampleId = PRESET_SAMPLE[preset];
  if (!sampleId) return Promise.resolve(null);

  const promise = buildSampler(sampleId).then(sampler => {
    if (sampler) samplers.set(key, sampler);
    return sampler;
  });
  loading.set(key, promise);
  void promise.finally(() => loading.delete(key));
  return promise;
}

export function getTrackSampler(
  track: Extract<TrackId, 'chord' | 'bass' | 'lead'>,
  preset: SynthPresetId,
  variant: SoundVariant,
): LayeredSampler | null {
  if (!sampleFor(preset, variant)) return null;
  return samplers.get(keyOf(track, preset)) ?? null;
}

export async function preloadTrackSamplers(
  entries: Array<[Extract<TrackId, 'chord' | 'bass' | 'lead'>, SynthPresetId]>,
): Promise<void> {
  await Promise.all(entries.map(([track, preset]) => loadTrackSampler(track, preset).catch(() => null)));
}

export function samplerCount(): number {
  return samplers.size;
}
