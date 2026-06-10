import type { ChordComplexity } from './musicTheory';
import type { SynthPresetId } from './audioEngine';

const STORAGE_KEY = 'edm-chordgen-state-v1';

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
  activeTab: 'chords' | 'melodies';
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
