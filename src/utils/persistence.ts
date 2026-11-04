import type { ChordComplexity, ChordInfo } from './musicTheory';
import { GENRES } from '../data/genres';
import type { MelodyState, ProjectSnapshot } from '../types';
import { defaultMelodyState } from '../types';
import {
  COMPLEXITIES,
  SCALES,
  isRecord,
  numIn,
  sanitizeChords,
  sanitizeMelody,
  sanitizeSynthId,
} from './sanitize';

const STORAGE_KEY = 'edm-chordgen-state-v1';
const ARRANGEMENTS_KEY = 'edm-chordgen-arrangements-v1';

export interface PersistedState {
  selectedKey: string;
  selectedScale: string;
  genreId: string;
  selectedProgressionIdx: number;
  selectedSynth: ProjectSnapshot['synth'];
  bpm: number;
  volume: number;
  loop: boolean;
  doubleTime: boolean;
  chordComplexity: ChordComplexity;
  /** Full arranger state (styles, seeds, mixer, drum edits, sections). */
  melody: MelodyState;
  /** Manual chord edits; restored on reload like the rest of the session. */
  customProgression?: ChordInfo[] | null;
  metronome?: boolean;
  countInBars?: number;
}

export interface SavedArrangement {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  data: { project: ProjectSnapshot };
}

/** Validates and fills defaults for a project snapshot coming from disk/URL/storage. */
export function sanitizeProject(value: unknown): ProjectSnapshot | null {
  if (!isRecord(value)) return null;

  const key = typeof value.key === 'string' && value.key.length <= 8 ? value.key : 'A';
  const scale = typeof value.scale === 'string' && SCALES.includes(value.scale) ? value.scale : 'minor';
  const genreId = typeof value.genreId === 'string' && GENRES.some(genre => genre.id === value.genreId)
    ? value.genreId
    : GENRES[0].id;

  return {
    key,
    scale,
    genreId,
    progressionIdx: Math.round(numIn(value.progressionIdx, 0, 4, 0)),
    rhythmName: typeof value.rhythmName === 'string' ? value.rhythmName.slice(0, 64) : '',
    synth: sanitizeSynthId(value.synth, 'pad'),
    bpm: Math.round(numIn(value.bpm, 40, 300, 124)),
    volume: numIn(value.volume, -60, 6, -6),
    loop: value.loop !== false,
    doubleTime: value.doubleTime === true,
    chordComplexity: (COMPLEXITIES as string[]).includes(String(value.chordComplexity))
      ? (value.chordComplexity as ChordComplexity)
      : 'basic',
    customProgression: sanitizeChords(value.customProgression),
    melody: sanitizeMelody(isRecord(value.melody) ? value.melody : value),
  };
}

/** Maps the legacy project file shape (selectedKey, selectedRhythmName, ...). */
function projectFromLegacyData(data: Record<string, unknown>): ProjectSnapshot {
  return {
    key: typeof data.selectedKey === 'string' ? data.selectedKey : 'A',
    scale: typeof data.selectedScale === 'string' ? data.selectedScale : 'minor',
    genreId: typeof data.genreId === 'string' ? data.genreId : GENRES[0].id,
    progressionIdx: Math.round(numIn(data.selectedProgressionIdx, 0, 4, 0)),
    rhythmName: typeof data.selectedRhythmName === 'string' ? data.selectedRhythmName : '',
    synth: sanitizeSynthId(data.selectedSynth, 'pad'),
    bpm: Math.round(numIn(data.bpm, 40, 300, 124)),
    volume: numIn(data.volume, -60, 6, -6),
    loop: data.loop !== false,
    doubleTime: data.doubleTime === true,
    chordComplexity: (COMPLEXITIES as string[]).includes(String(data.chordComplexity))
      ? (data.chordComplexity as ChordComplexity)
      : 'basic',
    customProgression: sanitizeChords(data.customProgression),
    melody: sanitizeMelody(isRecord(data.melody) ? data.melody : data),
  };
}

export function loadPersistedState(): Partial<PersistedState> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    return {
      selectedKey: typeof parsed.selectedKey === 'string' ? parsed.selectedKey : undefined,
      selectedScale: typeof parsed.selectedScale === 'string' ? parsed.selectedScale : undefined,
      genreId: typeof parsed.genreId === 'string' ? parsed.genreId : undefined,
      selectedProgressionIdx: Math.round(numIn(parsed.selectedProgressionIdx, 0, 4, 0)),
      selectedSynth: sanitizeSynthId(parsed.selectedSynth, 'pad'),
      bpm: Math.round(numIn(parsed.bpm, 40, 300, 124)),
      volume: numIn(parsed.volume, -60, 6, -6),
      loop: parsed.loop !== false,
      doubleTime: parsed.doubleTime === true,
      chordComplexity: (COMPLEXITIES as string[]).includes(String(parsed.chordComplexity))
        ? (parsed.chordComplexity as ChordComplexity)
        : 'basic',
      melody: sanitizeMelody(isRecord(parsed.melody) ? parsed.melody : parsed),
      customProgression: sanitizeChords(parsed.customProgression),
      metronome: parsed.metronome === true,
      countInBars: Math.round(numIn(parsed.countInBars, 0, 2, 0)),
    };
  } catch {
    return {};
  }
}

export function savePersistedState(state: PersistedState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors (e.g. private mode / quota).
  }
}

function normalizeArrangement(raw: unknown): SavedArrangement | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !isRecord(raw.data)) return null;
  const data = raw.data;
  const project = isRecord(data.project)
    ? sanitizeProject(data.project)
    : projectFromLegacyData(data);
  if (!project) return null;
  return {
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : 'Untitled',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
    data: { project },
  };
}

export function getSavedArrangements(): SavedArrangement[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ARRANGEMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeArrangement).filter((item): item is SavedArrangement => item !== null);
  } catch {
    return [];
  }
}

function writeArrangements(arrangements: SavedArrangement[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(ARRANGEMENTS_KEY, JSON.stringify(arrangements));
}

export function saveArrangement(name: string, project: ProjectSnapshot): SavedArrangement {
  const arrangements = getSavedArrangements();
  const now = Date.now();
  const arrangement: SavedArrangement = {
    id: crypto.randomUUID(),
    name: name.trim() || 'Untitled arrangement',
    createdAt: now,
    updatedAt: now,
    data: { project },
  };
  arrangements.push(arrangement);
  writeArrangements(arrangements);
  return arrangement;
}

export function renameArrangement(id: string, name: string): SavedArrangement | null {
  const arrangements = getSavedArrangements();
  const index = arrangements.findIndex(arrangement => arrangement.id === id);
  const trimmed = name.trim().slice(0, 80);
  if (index === -1 || trimmed.length === 0) return null;
  const updated: SavedArrangement = { ...arrangements[index], name: trimmed, updatedAt: Date.now() };
  arrangements[index] = updated;
  writeArrangements(arrangements);
  return updated;
}

export function duplicateArrangement(id: string): SavedArrangement | null {
  const source = getSavedArrangements().find(arrangement => arrangement.id === id);
  if (!source) return null;
  return saveArrangement(`${source.name} copy`, source.data.project);
}

export function deleteArrangement(id: string): boolean {
  const arrangements = getSavedArrangements();
  const filtered = arrangements.filter(arrangement => arrangement.id !== id);
  if (filtered.length === arrangements.length) return false;
  writeArrangements(filtered);
  return true;
}

export interface ProjectFile {
  schemaVersion: 2;
  name: string;
  savedAt: string;
  project: ProjectSnapshot;
}

export function serializeProject(name: string, project: ProjectSnapshot): string {
  const file: ProjectFile = {
    schemaVersion: 2,
    name: name.trim() || 'Untitled project',
    savedAt: new Date().toISOString(),
    project,
  };
  return JSON.stringify(file, null, 2);
}

export function parseProjectFile(text: string): { name: string; project: ProjectSnapshot } | null {
  try {
    const parsed = JSON.parse(text);
    if (!isRecord(parsed)) return null;
    if (parsed.project !== undefined && !isRecord(parsed.project)) return null;
    if (parsed.data !== undefined && !isRecord(parsed.data)) return null;
    const project = isRecord(parsed.project)
      ? sanitizeProject(parsed.project)
      : isRecord(parsed.data)
        ? projectFromLegacyData(parsed.data)
        : sanitizeProject(parsed);
    if (!project) return null;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : 'Imported project',
      project,
    };
  } catch {
    return null;
  }
}

export function getDefaultMelodyState(): MelodyState {
  return defaultMelodyState();
}
