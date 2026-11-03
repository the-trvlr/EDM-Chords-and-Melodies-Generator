import type { ChordComplexity, ChordInfo } from './utils/musicTheory';
import type { ArpSettings } from './utils/arpeggiator';
import type { DrumKitId } from './data/drumKits';
import type { DrumPattern } from './utils/drumGenerator';
import type { SynthPresetId } from './utils/audioEngine';
import type { TrackId } from './utils/schedule';

export interface TrackMix {
  volume: number;
  mute: boolean;
  solo: boolean;
}

export type MixerState = Record<TrackId, TrackMix>;

export type SynthIds = {
  chord: SynthPresetId;
  bass: SynthPresetId;
  lead: SynthPresetId;
  drums: SynthPresetId;
};

/** Everything the Arranger needs, independent from the harmony screen. */
export interface MelodyState {
  bassStyleId: string;
  leadStyleId: string;
  bassSeed: number;
  leadSeed: number;
  arpEnabled: boolean;
  arpSettings: ArpSettings;
  arpSeed: number;
  drumKitId: DrumKitId;
  drumSeed: number;
  customDrumPattern: DrumPattern | null;
  synthIds: SynthIds;
  mixer: MixerState;
}

/** Full project snapshot: harmony + arranger, used by files, share links and storage. */
export interface ProjectSnapshot {
  key: string;
  scale: string;
  genreId: string;
  progressionIdx: number;
  rhythmName: string;
  synth: SynthPresetId;
  bpm: number;
  volume: number;
  loop: boolean;
  doubleTime: boolean;
  chordComplexity: ChordComplexity;
  customProgression: ChordInfo[] | null;
  melody: MelodyState;
}

export const emptyMixer = (): MixerState => ({
  chord: { volume: 0, mute: false, solo: false },
  bass: { volume: 0, mute: false, solo: false },
  lead: { volume: 0, mute: false, solo: false },
  drums: { volume: 0, mute: false, solo: false },
});

export const defaultMelodyState = (): MelodyState => ({
  bassStyleId: '',
  leadStyleId: '',
  bassSeed: 1,
  leadSeed: 1,
  arpEnabled: false,
  arpSettings: { pattern: 'up', rate: 'eighth', octaveRange: 1, gate: 0.8 },
  arpSeed: 1,
  drumKitId: 'acoustic',
  drumSeed: 1,
  customDrumPattern: null,
  synthIds: { chord: 'pad', bass: 'pluck', lead: 'supersaw', drums: 'piano' },
  mixer: emptyMixer(),
});
