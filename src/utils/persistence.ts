import type { ChordComplexity, ChordInfo } from './musicTheory';
import type { SynthPresetId } from './audioEngine';
import type { ArpSettings } from './arpeggiator';
import type { DrumKitId } from '../data/drumKits';

const STORAGE_KEY = 'edm-chordgen-state-v1';
const ARRANGEMENTS_KEY = 'edm-chordgen-arrangements-v1';
const PROJECTS_KEY = 'edm-chordgen-projects-v1';

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
    // Chord inversions (optional for backward compatibility)
    chordInversions?: number[];
    // Per-track mixer settings (optional for backward compatibility)
    mixerSettings?: Record<string, { volume: number; mute: boolean; solo: boolean }>;
  };
}

export interface SavedProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  data: {
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
    customProgression: ChordInfo[] | null;
    selectedRhythmName: string;
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

export function getSavedProjects(): SavedProject[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProject(project: Omit<SavedProject, 'id' | 'createdAt' | 'updatedAt'>): SavedProject {
  const projects = getSavedProjects();
  const now = Date.now();
  const newProject: SavedProject = {
    ...project,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  projects.push(newProject);
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  return newProject;
}

export function updateProject(id: string, updates: Partial<Omit<SavedProject, 'id' | 'createdAt' | 'updatedAt'>>): SavedProject | null {
  const projects = getSavedProjects();
  const index = projects.findIndex(p => p.id === id);
  if (index === -1) return null;
  const updated: SavedProject = {
    ...projects[index],
    ...updates,
    updatedAt: Date.now(),
  };
  projects[index] = updated;
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  return updated;
}

export function deleteProject(id: string): boolean {
  const projects = getSavedProjects();
  const filtered = projects.filter(p => p.id !== id);
  if (filtered.length === projects.length) return false;
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(filtered));
  return true;
}

export function loadProject(project: SavedProject): Partial<PersistedState> & {
  customProgression: ChordInfo[] | null;
  selectedRhythmName: string;
} {
  return {
    selectedKey: project.data.selectedKey,
    selectedScale: project.data.selectedScale,
    genreId: project.data.genreId,
    selectedProgressionIdx: project.data.selectedProgressionIdx,
    selectedSynth: project.data.selectedSynth,
    bpm: project.data.bpm,
    volume: project.data.volume,
    loop: project.data.loop,
    doubleTime: project.data.doubleTime,
    chordComplexity: project.data.chordComplexity,
    activeTab: project.data.activeTab,
    customProgression: project.data.customProgression,
    selectedRhythmName: project.data.selectedRhythmName,
  };
}

export interface ShareablePreset {
  k: string; // key
  s: string; // scale
  g: string; // genre
  p: number; // progression index
  y: string; // synth
  b: number; // bpm
  c: string; // complexity
  r: string; // rhythm name
}

export function encodeShareablePreset(data: ShareablePreset): string {
  const json = JSON.stringify(data);
  const base64 = btoa(json);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShareablePreset(encoded: string): ShareablePreset | null {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json) as ShareablePreset;
  } catch {
    return null;
  }
}
