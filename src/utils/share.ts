import {
  CHORD_TYPES,
  FLAT_NAMES,
  NOTE_NAMES,
  SCALE_INTERVALS,
  getChordNotes,
  invertChord,
  keyPrefersFlats,
  noteNameToPc,
  type ChordComplexity,
  type ChordInfo,
} from './musicTheory';
import { GENRES } from '../data/genres';
import type { DrumPattern } from './drumGenerator';
import type { MelodyState, ProjectSnapshot } from '../types';
import type { TrackId } from './schedule';
import {
  COMPLEXITIES,
  isRecord,
  numIn,
  sanitizeMelody,
  sanitizeSynthId,
  TRACK_IDS,
} from './sanitize';

type CompactChord = [root: string, typeKey: string, inversion: number];

interface SharePayloadV2 {
  v: 2;
  k: string;
  s: string;
  g: string;
  p: number;
  y: string;
  b: number;
  c: string;
  r: string;
  dt: boolean;
  cp: CompactChord[] | null;
  mx: Partial<Record<TrackId, [volume: number, mute: boolean, solo: boolean]>>;
  m: {
    bs: string;
    ls: string;
    bsd: number;
    lsd: number;
    ae: boolean;
    as: { pattern: string; rate: string; octaveRange: number; gate: number };
    asd: number;
    dk: string;
    dsd: number;
    dp: DrumPattern | null;
    si: { chord: string; bass: string; lead: string; drums: string };
  };
}

function isNoteName(value: unknown): value is string {
  return typeof value === 'string'
    && ((NOTE_NAMES as readonly string[]).includes(value) || (FLAT_NAMES as readonly string[]).includes(value));
}

export function chordTypeKey(chord: ChordInfo): string {
  const byName = Object.entries(CHORD_TYPES).find(([, type]) => type.name === chord.type.name);
  if (byName) return byName[0];
  const byIntervals = Object.entries(CHORD_TYPES).find(
    ([, type]) => type.intervals.join(',') === chord.type.intervals.join(','),
  );
  return byIntervals?.[0] ?? 'major';
}

function compactChord(chord: ChordInfo): CompactChord {
  return [chord.root, chordTypeKey(chord), Math.max(0, Math.min(chord.inversion ?? 0, chord.midiNotes.length - 1))];
}

/** Rebuilds a chord from its compact form, using the project's enharmonic spelling. */
export function expandChord([root, typeKey, inversion]: CompactChord, useFlats: boolean): ChordInfo | null {
  if (!isNoteName(root) || typeof typeKey !== 'string' || !(typeKey in CHORD_TYPES)) return null;
  const base = getChordNotes(root, typeKey, 4, useFlats);
  const safeInversion = Math.round(numIn(inversion, 0, 3, 0));
  return safeInversion > 0 ? invertChord(base, safeInversion) : base;
}

function decodeCustomProgression(value: unknown, key: string, scale: string): ChordInfo[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 64) return null;
  const useFlats = keyPrefersFlats(noteNameToPc(key), scale);
  const chords: ChordInfo[] = [];
  for (const item of value) {
    if (!Array.isArray(item) || item.length < 3) return null;
    const chord = expandChord([item[0] as string, item[1] as string, item[2] as number], useFlats);
    if (!chord) return null;
    chords.push(chord);
  }
  return chords;
}

function toBase64Url(json: string): string {
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
}

export function encodeShare(snapshot: ProjectSnapshot): string {
  const melody = snapshot.melody;
  const mixerEntries: SharePayloadV2['mx'] = {};
  for (const track of TRACK_IDS) {
    const mix = melody.mixer[track];
    mixerEntries[track] = [mix.volume, mix.mute, mix.solo];
  }

  const payload: SharePayloadV2 = {
    v: 2,
    k: snapshot.key,
    s: snapshot.scale,
    g: snapshot.genreId,
    p: snapshot.progressionIdx,
    y: snapshot.synth,
    b: snapshot.bpm,
    c: snapshot.chordComplexity,
    r: snapshot.rhythmName,
    dt: snapshot.doubleTime,
    cp: snapshot.customProgression ? snapshot.customProgression.map(compactChord) : null,
    mx: mixerEntries,
    m: {
      bs: melody.bassStyleId,
      ls: melody.leadStyleId,
      bsd: melody.bassSeed,
      lsd: melody.leadSeed,
      ae: melody.arpEnabled,
      as: { ...melody.arpSettings },
      asd: melody.arpSeed,
      dk: melody.drumKitId,
      dsd: melody.drumSeed,
      dp: melody.customDrumPattern,
      si: { ...melody.synthIds },
    },
  };

  return toBase64Url(JSON.stringify(payload));
}

/**
 * Decodes both the current (v2) payload and the legacy flat payload that shipped
 * before share links carried the full project. Returns null for malformed input.
 */
export function decodeShare(encoded: string): ProjectSnapshot | null {
  if (typeof encoded !== 'string' || encoded.length === 0 || encoded.length > 8000) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(encoded));
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  const isV2 = parsed.v === 2;
  const genreId = typeof parsed.g === 'string' && GENRES.some(genre => genre.id === parsed.g)
    ? parsed.g
    : GENRES[0].id;
  const scale = typeof parsed.s === 'string' && Object.keys(SCALE_INTERVALS).includes(parsed.s)
    ? parsed.s
    : 'minor';
  const key = isNoteName(parsed.k) ? parsed.k : 'A';

  const melodyValue = isV2 && isRecord(parsed.m) ? { ...parsed.m, mx: parsed.mx } : parsed;
  const melody: MelodyState = sanitizeMelody(melodyValue);

  return {
    key,
    scale,
    genreId,
    progressionIdx: Math.round(numIn(parsed.p, 0, 4, 0)),
    rhythmName: typeof parsed.r === 'string' ? parsed.r.slice(0, 64) : '',
    synth: sanitizeSynthId(parsed.y, 'pad'),
    bpm: Math.round(numIn(parsed.b, 40, 300, 124)),
    volume: -6,
    loop: true,
    doubleTime: parsed.dt === true,
    chordComplexity: (COMPLEXITIES as string[]).includes(String(parsed.c))
      ? (parsed.c as ChordComplexity)
      : 'basic',
    customProgression: isV2 ? decodeCustomProgression(parsed.cp, key, scale) : null,
    melody,
  };
}
