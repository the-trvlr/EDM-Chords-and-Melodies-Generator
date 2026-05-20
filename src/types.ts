import type { ChordInfo } from './utils/musicTheory';
import type { Genre, RhythmPattern } from './data/genres';
import type { SynthPresetId } from './utils/audioEngine';

export interface AppState {
  selectedKey: string;
  selectedScale: string;
  selectedGenre: Genre;
  selectedProgression: number;
  selectedRhythm: RhythmPattern;
  selectedSynth: SynthPresetId;
  bpm: number;
  progression: ChordInfo[];
  availableChords: ChordInfo[];
  activeChordIndex: number;
  selectedChordForView: number | null;
  isPlaying: boolean;
  volume: number;
}
