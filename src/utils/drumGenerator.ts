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

export const DRUM_STEPS = 16;

export const DRUM_INSTRUMENTS = ['kick', 'snare', 'clap', 'hat', 'lowHat', 'crash', 'ride'] as const;
export type DrumInstrumentName = (typeof DRUM_INSTRUMENTS)[number];

export interface DrumPattern {
  kick: number[];
  snare: number[];
  clap: number[];
  /** Closed/high hat. */
  hat: number[];
  /** Low hat / pedal hat. */
  lowHat: number[];
  crash: number[];
  ride: number[];
}

export interface DrumPatternPreset {
  id: string;
  name: string;
  genreId: string;
  pattern: DrumPattern;
}

const empty = (): number[] => new Array(DRUM_STEPS).fill(0);
const EMPTY = empty();

const p = (
  kick: number[],
  snare: number[],
  clap: number[],
  hat: number[],
  lowHat: number[] = EMPTY,
  crash: number[] = EMPTY,
  ride: number[] = EMPTY,
): DrumPattern => ({ kick, snare, clap, hat, lowHat, crash, ride });

const FOUR_ON_FLOOR = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
const OFFBEAT_HATS = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
const HATS_16 = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
const BACKBEAT = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
const RIDE_8 = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

const DRUM_PRESETS: DrumPatternPreset[] = [
  // House
  {
    id: 'house-classic',
    name: 'Classic House',
    genreId: 'house',
    pattern: p(FOUR_ON_FLOOR, empty(), BACKBEAT, OFFBEAT_HATS, EMPTY, [1, ...new Array(15).fill(0)]),
  },
  {
    id: 'house-shuffle',
    name: 'Shuffle House',
    genreId: 'house',
    pattern: p(FOUR_ON_FLOOR, empty(), BACKBEAT, [0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1], [0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]),
  },
  // Techno
  {
    id: 'techno-driving',
    name: 'Driving Techno',
    genreId: 'techno',
    pattern: p(FOUR_ON_FLOOR, empty(), BACKBEAT, [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1], EMPTY, [1, ...new Array(15).fill(0)], RIDE_8),
  },
  {
    id: 'techno-minimal',
    name: 'Minimal Techno',
    genreId: 'techno',
    pattern: p(
      [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0],
      empty(),
      [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
      [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
    ),
  },
  // Trance
  {
    id: 'trance-uplifting',
    name: 'Uplifting Trance',
    genreId: 'trance',
    pattern: p(FOUR_ON_FLOOR, BACKBEAT, empty(), OFFBEAT_HATS, EMPTY, [1, ...new Array(15).fill(0)], [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]),
  },
  {
    id: 'trance-gated',
    name: 'Gated Trance',
    genreId: 'trance',
    pattern: p(FOUR_ON_FLOOR, BACKBEAT, empty(), [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0], EMPTY, [1, ...new Array(15).fill(0)]),
  },
  // Drum & Bass — classic two-step: kick 1, kick 3.5, snare 2 & 4, 16th hats
  {
    id: 'dnb-liquid',
    name: 'Liquid DnB',
    genreId: 'dnb',
    pattern: p(
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      empty(),
      HATS_16,
      [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
      [1, ...new Array(15).fill(0)],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    ),
  },
  {
    id: 'dnb-neuro',
    name: 'Neurofunk',
    genreId: 'dnb',
    pattern: p(
      [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
      [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      empty(),
      HATS_16,
      [0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1],
      [1, ...new Array(15).fill(0)],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    ),
  },
  // Dubstep — half-time: kick 1, snare 3, sparse 8th hats
  {
    id: 'dubstep-half',
    name: 'Half-time Dubstep',
    genreId: 'dubstep',
    pattern: p(
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      empty(),
      [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
      [1, ...new Array(15).fill(0)],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    ),
  },
  {
    id: 'dubstep-wobble',
    name: 'Wobble Dubstep',
    genreId: 'dubstep',
    pattern: p(
      [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      empty(),
      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
      [1, ...new Array(15).fill(0)],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
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
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      [1, ...new Array(15).fill(0)],
    ),
  },
  // Progressive House
  {
    id: 'progressive-house',
    name: 'Progressive House',
    genreId: 'progressiveHouse',
    pattern: p(
      [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
      empty(),
      BACKBEAT,
      OFFBEAT_HATS,
      EMPTY,
      [1, ...new Array(15).fill(0)],
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
      EMPTY,
      [1, ...new Array(15).fill(0)],
    ),
  },
  {
    id: 'hardstyle-raw',
    name: 'Raw Hardstyle',
    genreId: 'hardstyle',
    pattern: p(FOUR_ON_FLOOR, EMPTY, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], [0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1]),
  },
];

const FALLBACK_PATTERN = p(FOUR_ON_FLOOR, BACKBEAT, empty(), OFFBEAT_HATS);

export function getDrumPatternsForGenre(genreId: string): DrumPatternPreset[] {
  return DRUM_PRESETS.filter(preset => preset.genreId === genreId);
}

const clone = (line: number[]): number[] => [...line];

const setIfEmpty = (line: number[], step: number): void => {
  if (step >= 0 && step < DRUM_STEPS) line[step] = 1;
};

/**
 * Meaningful variation: keeps the genre backbone (kick + backbeat) and adds
 * ghost notes, hat rolls, open-hat accents and fills. Different seeds should
 * produce audibly different one-bar patterns, not just one flipped hat.
 */
export function generateDrums(genreId: string, seed: number): DrumPattern {
  const rng = new SeededRandom(seed);
  const presets = getDrumPatternsForGenre(genreId);
  const base = presets.length > 0 ? rng.pick(presets).pattern : FALLBACK_PATTERN;
  const out: DrumPattern = {
    kick: clone(base.kick),
    snare: clone(base.snare),
    clap: clone(base.clap),
    hat: clone(base.hat),
    lowHat: clone(base.lowHat),
    crash: clone(base.crash),
    ride: clone(base.ride),
  };

  const profile = Math.floor(rng.next() * 4);
  switch (profile) {
    case 0:
      // Ghost-note pocket.
      setIfEmpty(out.snare, 7);
      if (rng.chance(0.5)) setIfEmpty(out.snare, 15);
      setIfEmpty(out.lowHat, 6);
      break;
    case 1:
      // End-of-bar hat fill.
      for (const step of [12, 13, 14, 15]) setIfEmpty(out.hat, step);
      setIfEmpty(out.kick, 14);
      break;
    case 2:
      // Open-hat / ride accent.
      setIfEmpty(out.lowHat, 6);
      if (rng.chance(0.6)) setIfEmpty(out.lowHat, 14);
      for (let step = 2; step < 16; step += 4) setIfEmpty(out.ride, step);
      break;
    default:
      // Busy hats + pickup.
      for (let step = 0; step < 16; step += 2) setIfEmpty(out.hat, step);
      setIfEmpty(out.kick, 15);
      break;
  }

  // Per-seed accents beyond the four profiles, so Regenerate is audible.
  if (rng.chance(0.5)) setIfEmpty(out.snare, rng.pick([3, 7, 11, 15]));
  if (rng.chance(0.45)) setIfEmpty(out.lowHat, rng.pick([2, 6, 10, 14]));
  if (rng.chance(0.4)) setIfEmpty(out.kick, rng.pick([13, 14, 15]));
  if (rng.chance(0.35)) setIfEmpty(out.crash, 8);
  if (rng.chance(0.3)) setIfEmpty(out.ride, 15);
  if (rng.chance(0.35)) setIfEmpty(out.crash, 0);
  if (rng.chance(0.4)) out.clap[12] = 1;

  return out;
}

export function emptyDrumPattern(): DrumPattern {
  return {
    kick: empty(),
    snare: empty(),
    clap: empty(),
    hat: empty(),
    lowHat: empty(),
    crash: empty(),
    ride: empty(),
  };
}

function line(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value) || value.length !== DRUM_STEPS) return [...fallback];
  return value.map(step => step === 1 ? 1 : 0);
}

/** Accepts old 4-lane patterns (kick/snare/clap/hat) and fills the new lanes. */
export function normalizeDrumPattern(value: unknown): DrumPattern | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const kick = line(record.kick, []);
  const snare = line(record.snare, []);
  const clap = line(record.clap, []);
  if (!kick.some(Boolean) && !snare.some(Boolean) && !clap.some(Boolean)) return null;
  return {
    kick,
    snare,
    clap,
    hat: line(record.hat, []),
    lowHat: line(record.lowHat, []),
    crash: line(record.crash, []),
    ride: line(record.ride, []),
  };
}

export function isDrumPattern(value: unknown): value is DrumPattern {
  return normalizeDrumPattern(value) !== null;
}

export function drumPatternHasContent(pattern: DrumPattern): boolean {
  return DRUM_INSTRUMENTS.some(id => pattern[id].some(Boolean));
}
