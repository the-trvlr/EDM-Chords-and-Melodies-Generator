export type DrumKitId = 'acoustic' | '909' | '808' | 'trap' | 'breakbeat';

export interface DrumKit {
  id: DrumKitId;
  name: string;
  description: string;
}

export const DRUM_KITS: DrumKit[] = [
  {
    id: 'acoustic',
    name: 'Acoustic',
    description: 'Standard acoustic drum kit',
  },
  {
    id: '909',
    name: 'Roland TR-909',
    description: 'Classic house/techno drum machine',
  },
  {
    id: '808',
    name: 'Roland TR-808',
    description: 'Iconic hip-hop/electronic drum machine',
  },
  {
    id: 'trap',
    name: 'Trap',
    description: 'Modern trap hi-hats and snares',
  },
  {
    id: 'breakbeat',
    name: 'Breakbeat',
    description: 'Funky breakbeat kit',
  },
];

/** Genre-appropriate default kit so patterns do not all sound like the same drum machine. */
export const DEFAULT_DRUM_KIT_BY_GENRE: Record<string, DrumKitId> = {
  house: '909',
  techno: '909',
  trance: '909',
  dnb: 'breakbeat',
  dubstep: '808',
  futureBass: '808',
  progressiveHouse: '909',
  hardstyle: 'acoustic',
};
