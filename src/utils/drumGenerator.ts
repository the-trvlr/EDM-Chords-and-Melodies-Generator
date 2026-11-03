// Seeded PRNG for reproducible drum patterns
class SeededRandom {
  private state: number;
  constructor(seed: number) {
    this.state = seed % 2147483647;
    if (this.state <= 0) this.state += 2147483646;
  }
  next(): number {
    this.state = (this.state * 16807) % 2147483647;
    return (this.state - 1) / 2147483646;
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}

export interface DrumPattern {
  kick: number[]; // 16-step bar (0 = off, 1 = on)
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

export const DRUM_STEPS = 16;

const p = (
  kick: number[],
  snare: number[],
  clap: number[],
  hat: number[],
): DrumPattern => ({ kick, snare, clap, hat });

const FOUR_ON_FLOOR = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
const OFFBEAT_HATS = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
const BACKBEAT = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
const EMPTY = new Array(16).fill(0);

const DRUM_PRESETS: DrumPatternPreset[] = [
  // House
  {
    id: 'house-classic',
    name: 'Classic House',
    genreId: 'house',
    pattern: p(FOUR_ON_FLOOR, EMPTY, BACKBEAT, OFFBEAT_HATS),
  },
  {
    id: 'house-shuffle',
    name: 'Shuffle House',
    genreId: 'house',
    pattern: p(FOUR_ON_FLOOR, EMPTY, BACKBEAT, [0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1]),
  },
  // Techno
  {
    id: 'techno-driving',
    name: 'Driving Techno',
    genreId: 'techno',
    pattern: p(
      FOUR_ON_FLOOR,
      EMPTY,
      BACKBEAT,
      [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1],
    ),
  },
  {
    id: 'techno-minimal',
    name: 'Minimal Techno',
    genreId: 'techno',
    pattern: p(
      [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0],
      EMPTY,
      [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
    ),
  },
  // Trance
  {
    id: 'trance-uplifting',
    name: 'Uplifting Trance',
    genreId: 'trance',
    pattern: p(FOUR_ON_FLOOR, BACKBEAT, EMPTY, OFFBEAT_HATS),
  },
  {
    id: 'trance-gated',
    name: 'Gated Trance',
    genreId: 'trance',
    pattern: p(FOUR_ON_FLOOR, BACKBEAT, EMPTY, [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0]),
  },
  // Drum & Bass — two-step / breakbeat feel, not four-on-the-floor
  {
    id: 'dnb-liquid',
    name: 'Liquid DnB',
    genreId: 'dnb',
    pattern: p(
      [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      BACKBEAT,
      EMPTY,
      OFFBEAT_HATS,
    ),
  },
  {
    id: 'dnb-neuro',
    name: 'Neurofunk',
    genreId: 'dnb',
    pattern: p(
      [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
      BACKBEAT,
      EMPTY,
      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    ),
  },
  // Dubstep — half-time backbone
  {
    id: 'dubstep-half',
    name: 'Half-time Dubstep',
    genreId: 'dubstep',
    pattern: p(
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
    ),
  },
  {
    id: 'dubstep-wobble',
    name: 'Wobble Dubstep',
    genreId: 'dubstep',
    pattern: p(
      [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      EMPTY,
      [0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0],
    ),
  },
  // Future Bass
  {
    id: 'future-bass-bounce',
    name: 'Future Bass Bounce',
    genreId: 'futureBass',
    pattern: p(
      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      OFFBEAT_HATS,
    ),
  },
  {
    id: 'future-bass-trap',
    name: 'Future Bass Trap',
    genreId: 'futureBass',
    pattern: p(
      [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1],
    ),
  },
  // Progressive House
  {
    id: 'progressive-house',
    name: 'Progressive House',
    genreId: 'progressiveHouse',
    pattern: p(
      [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
      EMPTY,
      BACKBEAT,
      OFFBEAT_HATS,
    ),
  },
  // Hardstyle
  {
    id: 'hardstyle-euphoric',
    name: 'Euphoric Hardstyle',
    genreId: 'hardstyle',
    pattern: p(
      FOUR_ON_FLOOR,
      BACKBEAT,
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      OFFBEAT_HATS,
    ),
  },
  {
    id: 'hardstyle-raw',
    name: 'Raw Hardstyle',
    genreId: 'hardstyle',
    pattern: p(FOUR_ON_FLOOR, EMPTY, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], [0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1]),
  },
];

const FALLBACK_PATTERN: DrumPattern = p(FOUR_ON_FLOOR, BACKBEAT, EMPTY, OFFBEAT_HATS);

export function getDrumPatternsForGenre(genreId: string): DrumPatternPreset[] {
  return DRUM_PRESETS.filter(preset => preset.genreId === genreId);
}

/**
 * Generates one bar (16 steps) for the genre. The pattern repeats every bar,
 * which keeps the editor, playback and export on the same, predictable grid.
 */
export function generateDrums(genreId: string, seed: number): DrumPattern {
  const rng = new SeededRandom(seed);
  const presets = getDrumPatternsForGenre(genreId);
  const base = presets.length > 0 ? rng.pick(presets).pattern : FALLBACK_PATTERN;

  const mutate = (line: number[], offChance: number, onChance: number) =>
    line.map(v => (v ? (rng.chance(offChance) ? 0 : 1) : rng.chance(onChance) ? 1 : 0));

  return {
    // Keep the kick backbone intact — it defines the genre.
    kick: [...base.kick],
    snare: mutate(base.snare, 0.04, 0),
    clap: mutate(base.clap, 0.06, 0.04),
    hat: mutate(base.hat, 0.12, 0.08),
  };
}

export function emptyDrumPattern(): DrumPattern {
  return { kick: [...EMPTY], snare: [...EMPTY], clap: [...EMPTY], hat: [...EMPTY] };
}

export function isDrumPattern(value: unknown): value is DrumPattern {
  if (!value || typeof value !== 'object') return false;
  const pattern = value as Record<string, unknown>;
  return (['kick', 'snare', 'clap', 'hat'] as const).every(key => {
    const line = pattern[key];
    return Array.isArray(line) && line.length === DRUM_STEPS && line.every(step => step === 0 || step === 1);
  });
}
