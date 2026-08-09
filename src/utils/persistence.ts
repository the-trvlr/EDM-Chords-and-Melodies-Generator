import type { ChordComplexity } from './musicTheory';
import type { SynthPresetId } from './audioEngine';
import type { ArpSettings } from './arpeggiator';
import type { DrumKitId } from '../data/drumKits';

const STORAGE_KEY = 'edm-chordgen-state-v1';
const ARRANGEMENTS_KEY = 'edm-chordgen-arrangements-v1';

export interface PersistedState {
  selectedKey: string;
  selectedScale: string;
  genreId: string;
  selectedProgressionIdx: number;
  selectedSynth: SynthPresetId;
  bpm: number;
  volume: number;
  loop: boolean;
  doubleTime: boolean;
  chordComplexity: ChordComplexity;
  activeTab: 'chords' | 'melodies' | 'mix';
}

export interface SavedArrangement {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  data: {
    rootKey: string;
    scaleType: string;
    genreId: string;
    bpm: number;
    progressionIndex: number;
    bassStyleId: string;
    leadStyleId: string;
    bassSeed: number;
    leadSeed: number;
    arpEnabled: boolean;
    arpSettings: ArpSettings;
    arpSeed: number;
    drumKitId: DrumKitId;
    drumSeed: number;
    synthIds: { chord: SynthPresetId; bass: SynthPresetId; lead: SynthPresetId; drums: SynthPresetId };
  };
}

export function loadPersistedState(): Partial<PersistedState> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
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

export function getSavedArrangements(): SavedArrangement[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ARRANGEMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveArrangement(arrangement: Omit<SavedArrangement, 'id' | 'createdAt' | 'updatedAt'>): SavedArrangement {
  const arrangements = getSavedArrangements();
  const now = Date.now();
  const newArrangement: SavedArrangement = {
    ...arrangement,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  arrangements.push(newArrangement);
  localStorage.setItem(ARRANGEMENTS_KEY, JSON.stringify(arrangements));
  return newArrangement;
}

export function updateArrangement(id: string, updates: Partial<Omit<SavedArrangement, 'id' | 'createdAt' | 'updatedAt'>>): SavedArrangement | null {
  const arrangements = getSavedArrangements();
  const index = arrangements.findIndex(a => a.id === id);
  if (index === -1) return null;
  const updated: SavedArrangement = {
    ...arrangements[index],
    ...updates,
    updatedAt: Date.now(),
  };
  arrangements[index] = updated;
  localStorage.setItem(ARRANGEMENTS_KEY, JSON.stringify(arrangements));
  return updated;
}

export function deleteArrangement(id: string): boolean {
  const arrangements = getSavedArrangements();
  const filtered = arrangements.filter(a => a.id !== id);
  if (filtered.length === arrangements.length) return false;
  localStorage.setItem(ARRANGEMENTS_KEY, JSON.stringify(filtered));
  return true;
}
