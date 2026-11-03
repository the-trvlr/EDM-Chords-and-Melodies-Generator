import { CHORD_TYPES, SCALE_INTERVALS, type ChordComplexity, type ChordInfo } from './musicTheory';
import { DRUM_KITS, type DrumKitId } from '../data/drumKits';
import { isDrumPattern } from './drumGenerator';
import { defaultMelodyState, emptyMixer, type MelodyState, type MixerState, type TrackMix } from '../types';
import type { SynthPresetId } from './audioEngine';
import type { TrackId } from './schedule';

export const SYNTH_IDS: SynthPresetId[] = ['piano', 'pad', 'organ', 'supersaw', 'pluck', 'dark', 'bell'];
export const TRACK_IDS: TrackId[] = ['chord', 'bass', 'lead', 'drums'];
export const SCALES = Object.keys(SCALE_INTERVALS);
export const COMPLEXITIES: ChordComplexity[] = ['basic', '7ths', '9ths', 'jazzy'];
export const DRUM_KIT_IDS: DrumKitId[] = DRUM_KITS.map(kit => kit.id);
export const ARP_PATTERNS = ['up', 'down', 'up-down', 'random'] as const;
export const ARP_RATES = ['eighth', 'sixteenth'] as const;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function numIn(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

export function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function sanitizeSynthId(value: unknown, fallback: SynthPresetId): SynthPresetId {
  return typeof value === 'string' && (SYNTH_IDS as string[]).includes(value) ? (value as SynthPresetId) : fallback;
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
