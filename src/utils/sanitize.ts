import { CHORD_TYPES, SCALE_INTERVALS, type ChordComplexity, type ChordInfo } from './musicTheory';
import { DRUM_KITS, type DrumKitId } from '../data/drumKits';
import { isDrumPattern } from './drumGenerator';
import { defaultMelodyState, emptyMixer, type MelodyState, type MixerState, type SongSection, type TrackMix } from '../types';
import type { SynthPresetId } from './audioEngine';
import type { TrackId } from './schedule';
import type { MelodyDensity, MelodyNote } from './melodyGenerator';

export const SYNTH_IDS: SynthPresetId[] = ['piano', 'pad', 'organ', 'supersaw', 'pluck', 'dark', 'bell'];
export const TRACK_IDS: TrackId[] = ['chord', 'bass', 'lead', 'drums'];
export const SCALES = Object.keys(SCALE_INTERVALS);
export const COMPLEXITIES: ChordComplexity[] = ['basic', '7ths', '9ths', 'jazzy'];
export const DRUM_KIT_IDS: DrumKitId[] = DRUM_KITS.map(kit => kit.id);
export const ARP_PATTERNS = ['up', 'down', 'up-down', 'random'] as const;
export const ARP_RATES = ['eighth', 'sixteenth'] as const;
export const MELODY_DENSITIES: MelodyDensity[] = ['sparse', 'medium', 'busy'];
export const SECTION_KINDS = ['intro', 'build', 'drop', 'break', 'outro'] as const;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function numIn(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

/** Clamps a numeric value into range (unlike numIn, which rejects it). */
export function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, number));
}

export function clampIn(value: unknown, min: number, max: number, fallback: number): number {
  return Math.round(clampNum(value, min, max, fallback));
}

export function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function sanitizeSynthId(value: unknown, fallback: SynthPresetId): SynthPresetId {
  return typeof value === 'string' && (SYNTH_IDS as string[]).includes(value) ? (value as SynthPresetId) : fallback;
}

export function sanitizeSections(value: unknown): SongSection[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 16).flatMap((raw, index) => {
    if (!isRecord(raw)) return [];
    const kind = (SECTION_KINDS as readonly string[]).includes(String(raw.kind))
      ? (raw.kind as SongSection['kind'])
      : 'drop';
    const tracks = Array.isArray(raw.tracks)
      ? raw.tracks.filter((track): track is TrackId => TRACK_IDS.includes(track as TrackId))
      : [...TRACK_IDS];
    return [{
      id: typeof raw.id === 'string' ? raw.id.slice(0, 64) : `section-${index}`,
      kind,
      bars: clampIn(raw.bars, 1, 32, 4),
      tracks: [...new Set(tracks)],
    }];
  });
}

/** Returns null only when the value is not an array (i.e. "use generated notes"). */
export function sanitizeNotes(value: unknown): MelodyNote[] | null {
  if (!Array.isArray(value)) return null;
  return value.slice(0, 512).flatMap(raw => {
    if (!isRecord(raw)) return [];
    const step = clampIn(raw.step, 0, 4096, 0);
    const midi = clampIn(raw.midi, 0, 127, 60);
    const duration = clampIn(raw.duration, 1, 64, 1);
    return [{ step, midi, duration, velocity: clampNum(raw.velocity, 0.05, 1, 0.8) }];
  });
}

function sanitizeTimeScales(value: unknown): MelodyState['timeScales'] {
  const record = isRecord(value) ? value : {};
  const read = (key: TrackId) => {
    const scale = Number(record[key]);
    return scale === 0.5 || scale === 2 ? scale : 1;
  };
  return {
    chord: read('chord'),
    bass: read('bass'),
    lead: read('lead'),
    drums: read('drums'),
  };
}

function sanitizeDensity(value: unknown): MelodyDensity {
  return (MELODY_DENSITIES as string[]).includes(String(value)) ? (value as MelodyDensity) : 'medium';
}

function sanitizeRangeSpans(value: unknown): MelodyState['rangeSpans'] {
  const range = Array.isArray(value) ? value : [];
  const record = isRecord(value) ? value : {};
  return {
    bass: clampIn(record.bass ?? range[0], 1, 3, 1),
    lead: clampIn(record.lead ?? range[1], 1, 3, 1),
  };
}

function sanitizeOctaves(value: unknown): MelodyState['octaves'] {
  if (!isRecord(value)) return { chord: 0, bass: 0, lead: 0 };
  return {
    chord: clampIn(value.chord, -2, 2, 0),
    bass: clampIn(value.bass, -2, 2, 0),
    lead: clampIn(value.lead, -2, 2, 0),
  };
}

export function sanitizeMixer(value: unknown): MixerState {
  const mixer = emptyMixer();
  if (!isRecord(value)) return mixer;
  for (const track of TRACK_IDS) {
    const entry = value[track];
    if (Array.isArray(entry)) {
      const [volume, mute, solo] = entry;
      const mix: TrackMix = { volume: numIn(volume, -60, 12, 0), mute: mute === true, solo: solo === true };
      mixer[track] = mix;
      continue;
    }
    if (isRecord(entry)) {
      const mix: TrackMix = {
        volume: numIn(entry.volume, -60, 12, 0),
        mute: entry.mute === true,
        solo: entry.solo === true,
      };
      mixer[track] = mix;
    }
  }
  return mixer;
}

/**
 * Accepts the legacy flat melody shape (bs/ls/ae/...) used by old share links,
 * saved arrangements and localStorage, and returns a fully populated state.
 */
export function sanitizeMelody(value: unknown): MelodyState {
  const melody = defaultMelodyState();
  if (!isRecord(value)) return melody;

  const arp = isRecord(value.as)
    ? value.as
    : isRecord(value.arpSettings)
      ? value.arpSettings
      : {};
  const octaveTuple = Array.isArray(value.oc) ? value.oc : null;

  return {
    ...melody,
    bassStyleId: typeof value.bs === 'string' ? value.bs.slice(0, 64)
      : typeof value.bassStyleId === 'string' ? value.bassStyleId.slice(0, 64) : melody.bassStyleId,
    leadStyleId: typeof value.ls === 'string' ? value.ls.slice(0, 64)
      : typeof value.leadStyleId === 'string' ? value.leadStyleId.slice(0, 64) : melody.leadStyleId,
    bassSeed: Math.round(numIn(value.bsd ?? value.bassSeed, 1, 1_000_000, melody.bassSeed)),
    leadSeed: Math.round(numIn(value.lsd ?? value.leadSeed, 1, 1_000_000, melody.leadSeed)),
    arpEnabled: boolOr(value.ae ?? value.arpEnabled, false),
    arpSettings: {
      pattern: (ARP_PATTERNS as readonly string[]).includes(String(arp.pattern))
        ? (arp.pattern as MelodyState['arpSettings']['pattern'])
        : melody.arpSettings.pattern,
      rate: (ARP_RATES as readonly string[]).includes(String(arp.rate))
        ? (arp.rate as MelodyState['arpSettings']['rate'])
        : melody.arpSettings.rate,
      octaveRange: numIn(arp.octaveRange, 1, 3, melody.arpSettings.octaveRange),
      gate: numIn(arp.gate, 0.1, 1, melody.arpSettings.gate),
    },
    arpSeed: Math.round(numIn(value.asd ?? value.arpSeed, 1, 1_000_000, melody.arpSeed)),
    drumKitId: (DRUM_KIT_IDS as string[]).includes(String(value.dk ?? value.drumKitId))
      ? ((value.dk ?? value.drumKitId) as DrumKitId)
      : melody.drumKitId,
    drumSeed: Math.round(numIn(value.dsd ?? value.drumSeed, 1, 1_000_000, melody.drumSeed)),
    customDrumPattern: isDrumPattern(value.dp) ? value.dp
      : isDrumPattern(value.customDrumPattern) ? value.customDrumPattern : null,
    synthIds: isRecord(value.si)
      ? {
          chord: sanitizeSynthId(value.si.chord, melody.synthIds.chord),
          bass: sanitizeSynthId(value.si.bass, melody.synthIds.bass),
          lead: sanitizeSynthId(value.si.lead, melody.synthIds.lead),
          drums: sanitizeSynthId(value.si.drums, melody.synthIds.drums),
        }
      : isRecord(value.synthIds)
        ? {
            chord: sanitizeSynthId(value.synthIds.chord, melody.synthIds.chord),
            bass: sanitizeSynthId(value.synthIds.bass, melody.synthIds.bass),
            lead: sanitizeSynthId(value.synthIds.lead, melody.synthIds.lead),
            drums: sanitizeSynthId(value.synthIds.drums, melody.synthIds.drums),
          }
        : melody.synthIds,
    mixer: sanitizeMixer(value.mx ?? value.mixer ?? value.mixerSettings),
    octaves: octaveTuple
      ? sanitizeOctaves({ chord: octaveTuple[0], bass: octaveTuple[1], lead: octaveTuple[2] })
      : sanitizeOctaves(value.octaves),
    rangeSpans: sanitizeRangeSpans(value.rangeSpans ?? value.rs),
    bassDensity: sanitizeDensity(value.bassDensity ?? value.bd),
    leadDensity: sanitizeDensity(value.leadDensity ?? value.ld),
    bassIdea: clampIn(value.bassIdea ?? value.bi, 1, 3, 1),
    leadIdea: clampIn(value.leadIdea ?? value.li, 1, 3, 1),
    timeScales: sanitizeTimeScales(value.timeScales ?? value.ts),
    sections: sanitizeSections(value.sections ?? value.sc),
    swing: clampNum(value.swing ?? value.sw, 0, 0.6, 0),
    humanize: boolOr(value.humanize ?? value.hu, false),
    bassNotes: sanitizeNotes(value.bassNotes ?? value.bn),
    leadNotes: sanitizeNotes(value.leadNotes ?? value.ln),
  };
}

export function isChordInfo(value: unknown): value is ChordInfo {
  if (!isRecord(value) || !isRecord(value.type)) return false;
  return (
    typeof value.root === 'string' &&
    typeof value.display === 'string' &&
    Array.isArray(value.notes) && value.notes.every(note => typeof note === 'string') &&
    Array.isArray(value.midiNotes) && value.midiNotes.every(midi => typeof midi === 'number') &&
    typeof value.type.name === 'string' &&
    Array.isArray(value.type.intervals)
  );
}

export function sanitizeChords(value: unknown): ChordInfo[] | null {
  if (!Array.isArray(value) || value.length > 64) return null;
  const chords = value.filter(isChordInfo);
  if (chords.length !== value.length) return null;
  return chords.map(chord => ({
    ...chord,
    type: CHORD_TYPES[Object.keys(CHORD_TYPES).find(key => CHORD_TYPES[key].name === chord.type.name) ?? 'major'],
    inversion: numIn(chord.inversion, 0, 3, 0),
  }));
}

export function isSynthPresetId(value: unknown): value is SynthPresetId {
  return typeof value === 'string' && (SYNTH_IDS as string[]).includes(value);
}
