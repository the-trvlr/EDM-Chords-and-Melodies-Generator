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
