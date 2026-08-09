// Seeded PRNG for reproducible drum patterns
class SeededRandom {
  private state: number;
  constructor(seed: number) {
    this.state = seed;
  }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  intRange(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

export interface DrumPattern {
  kick: number[]; // 16-step grid (0 = off, 1 = on)
  snare: number[];
  clap: number[];
  hat: number[];
}

export interface DrumPatternPreset {
  id: string;
  name: string;
  genreId: string;
  pattern: DrumPattern;
}

// Genre-specific drum pattern presets
const DRUM_PRESETS: DrumPatternPreset[] = [
  // House patterns
  {
    id: 'house-classic',
    name: 'Classic House',
    genreId: 'house',
    pattern: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      hat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    },
  },
  {
    id: 'house-offbeat',
    name: 'Off-beat Hat',
    genreId: 'house',
    pattern: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    },
  },
  // Techno patterns
  {
    id: 'techno-driving',
    name: 'Driving Techno',
    genreId: 'techno',
    pattern: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    },
  },
  {
    id: 'techno-minimal',
    name: 'Minimal Techno',
    genreId: 'techno',
    pattern: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      hat: [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
    },
  },
  // Trance patterns
  {
    id: 'trance-uplifting',
    name: 'Uplifting Trance',
    genreId: 'trance',
    pattern: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      hat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    },
  },
  {
    id: 'trance-gated',
    name: 'Gated Trance',
    genreId: 'trance',
    pattern: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      hat: [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
    },
  },
];

export function getDrumPatternsForGenre(genreId: string): DrumPatternPreset[] {
  return DRUM_PRESETS.filter(p => p.genreId === genreId);
}

export function generateDrums(
  genreId: string,
  bars: number,
  seed: number,
): DrumPattern {
  const rng = new SeededRandom(seed);
  const presets = getDrumPatternsForGenre(genreId);
  
  if (presets.length === 0) {
    // Fallback to a basic pattern
    return {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      hat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    };
  }

  const preset = rng.pick(presets);
  const basePattern = preset.pattern;
  
  // Extend pattern for multiple bars
  const kick: number[] = [];
  const snare: number[] = [];
  const clap: number[] = [];
  const hat: number[] = [];

  for (let bar = 0; bar < bars; bar++) {
    // Add some variation based on seed
    const variation = rng.chance(0.3);
    
    kick.push(...basePattern.kick.map((v) => {
      if (variation && rng.chance(0.2)) return 0;
      return v;
    }));

    snare.push(...basePattern.snare.map((v) => {
      if (variation && rng.chance(0.3)) return 1;
      return v;
    }));

    clap.push(...basePattern.clap.map((v) => {
      if (variation && rng.chance(0.2)) return 1;
      return v;
    }));

    hat.push(...basePattern.hat.map((v) => {
      if (variation && rng.chance(0.4)) return 1;
      return v;
    }));
  }

  return { kick, snare, clap, hat };
}
