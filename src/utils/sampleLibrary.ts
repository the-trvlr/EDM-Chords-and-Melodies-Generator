import * as Tone from 'tone';
import type { SynthPresetId } from './audioEngine';
import type { TrackId } from './schedule';

type SampleInstrumentId = 'piano' | 'organ' | 'guitar' | 'bass' | 'harmonium' | 'cello' | 'xylophone';
export type SoundVariant = 'acoustic' | 'edm';

const SAMPLE_SETS: Record<SampleInstrumentId, { folder: string; notes: string[] }> = {
  piano: { folder: 'piano', notes: ['C2', 'C3', 'C4', 'C5', 'C6', 'C7'] },
  organ: { folder: 'organ', notes: ['C2', 'C3', 'C4', 'C5', 'C6'] },
  guitar: { folder: 'guitar-nylon', notes: ['A2', 'A3', 'A4', 'A5', 'Cs3', 'Cs4'] },
  bass: { folder: 'bass-electric', notes: ['As1', 'Cs2', 'E2', 'As2', 'Cs3', 'E3'] },
  harmonium: { folder: 'harmonium', notes: ['C3', 'C4', 'C5'] },
  cello: { folder: 'cello', notes: ['C3', 'C4', 'C5'] },
  xylophone: { folder: 'xylophone', notes: ['C5', 'C6', 'C7'] },
};

const PRESET_SAMPLE: Record<SynthPresetId, SampleInstrumentId> = {
  piano: 'piano',
  organ: 'organ',
  pluck: 'guitar',
  pad: 'harmonium',
  supersaw: 'cello',
  dark: 'cello',
  bell: 'xylophone',
};

// EDM keeps its electronic identity for synth presets; acoustic instruments
// are sampled in both variants. Acoustic mode samples everything.
const EDM_SAMPLED_PRESETS = new Set<SynthPresetId>(['piano', 'organ', 'pluck']);

const samplers = new Map<string, Tone.Sampler>();
const loading = new Map<string, Promise<Tone.Sampler | null>>();

function keyOf(track: TrackId, preset: SynthPresetId): string {
  return `${track}:${preset}`;
}

export function sampleFor(preset: SynthPresetId, variant: SoundVariant): SampleInstrumentId | null {
  if (variant === 'edm' && !EDM_SAMPLED_PRESETS.has(preset)) return null;
  return PRESET_SAMPLE[preset];
}

export function loadTrackSampler(
  track: Extract<TrackId, 'chord' | 'bass' | 'lead'>,
  preset: SynthPresetId,
): Promise<Tone.Sampler | null> {
  const key = keyOf(track, preset);
  const existing = samplers.get(key);
  if (existing) return Promise.resolve(existing);
  const pending = loading.get(key);
  if (pending) return pending;

  const sampleId = PRESET_SAMPLE[preset];
  const set = SAMPLE_SETS[sampleId];
  const toneName = (file: string) => file.length > 1 && file[1] === 's'
    ? `${file[0]}#${file.slice(2)}`
    : file;
  const urls = Object.fromEntries(set.notes.map(file => [toneName(file), `${file}.mp3`]));
  const baseUrl = `${import.meta.env.BASE_URL}samples/${set.folder}/`;

  const promise = new Promise<Tone.Sampler | null>((resolve) => {
    try {
      const sampler = new Tone.Sampler({
        urls,
        baseUrl,
        release: 0.8,
        onload: () => {
          samplers.set(key, sampler);
          resolve(sampler);
        },
        onerror: () => resolve(null),
      });
    } catch {
      resolve(null);
    }
  });
  loading.set(key, promise);
  void promise.finally(() => loading.delete(key));
  return promise;
}

export function getTrackSampler(
  track: Extract<TrackId, 'chord' | 'bass' | 'lead'>,
  preset: SynthPresetId,
  variant: SoundVariant,
): Tone.Sampler | null {
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
