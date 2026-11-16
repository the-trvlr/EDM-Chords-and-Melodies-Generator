import { getChordsInKey, getRomanNumeral, voiceLeading, type ChordComplexity, type ChordInfo } from './musicTheory';

export type ProgressionMood = 'uplifting' | 'dark' | 'deep' | 'energetic' | 'emotional';

export interface ProgressionOptions {
  mood: ProgressionMood;
  bars: 4 | 8;
  voiceLead: boolean;
  seed?: number;
}

export interface GeneratedProgression {
  id: string;
  name: string;
  degrees: number[];
  roman: string[];
  chords: ChordInfo[];
  description: string;
}

const TEMPLATES: Record<ProgressionMood, { major: number[][]; minor: number[][] }> = {
  uplifting: {
    minor: [[0, 5, 3, 6], [5, 3, 0, 6], [0, 3, 5, 6]],
    major: [[0, 4, 5, 3], [0, 5, 3, 4], [3, 4, 0, 5]],
  },
  dark: {
    minor: [[0, 5, 3, 6], [0, 6, 5, 4], [0, 3, 6, 4]],
    major: [[0, 5, 3, 4], [5, 3, 0, 4], [0, 2, 5, 4]],
  },
  deep: {
    minor: [[0, 3, 5, 4], [0, 5, 3, 4], [5, 3, 0, 4]],
    major: [[0, 5, 3, 3], [0, 3, 6, 2], [5, 3, 0, 4]],
  },
  energetic: {
    minor: [[0, 6, 5, 6], [0, 4, 5, 6], [0, 0, 5, 6]],
    major: [[0, 4, 5, 4], [0, 5, 3, 4], [3, 4, 0, 4]],
  },
  emotional: {
    minor: [[0, 5, 2, 6], [0, 3, 6, 5], [5, 3, 0, 3]],
    major: [[0, 5, 3, 4], [3, 4, 0, 4], [0, 3, 4, 5]],
  },
};

const MOOD_LABELS: Record<ProgressionMood, string> = {
  uplifting: 'Uplifting',
  dark: 'Dark',
  deep: 'Deep',
  energetic: 'Energetic',
  emotional: 'Emotional',
};

function rotate(degrees: number[], amount: number): number[] {
  const shift = amount % degrees.length;
  return [...degrees.slice(shift), ...degrees.slice(0, shift)];
}

function eightBars(degrees: number[]): number[] {
  return [...degrees, ...degrees.slice(1), degrees[0]];
}

export function generateProgressions(
  keyName: string,
  scaleName: string,
  complexity: ChordComplexity,
  options: ProgressionOptions,
): GeneratedProgression[] {
  const scaleChords = getChordsInKey(keyName, scaleName, complexity);
  const isMinor = scaleName.toLowerCase().includes('minor') || scaleName === 'phrygian' || scaleName === 'locrian';
  const pool = TEMPLATES[options.mood][isMinor ? 'minor' : 'major'];

  return pool.map((template, index) => {
    const rotated = rotate(template, index + (options.seed ?? 0));
    const degrees = options.bars === 8 ? eightBars(rotated) : rotated;
    const chords = degrees.map(degree => scaleChords[degree] ?? scaleChords[0]).filter(Boolean);
    const voiced = options.voiceLead ? voiceLeading(chords) : chords;
    const roman = degrees.map(degree => getRomanNumeral(degree, scaleName));
    return {
      id: `${options.mood}-${index}-${degrees.join('-')}`,
      name: `${MOOD_LABELS[options.mood]} ${index + 1}`,
      degrees,
      roman,
      chords: voiced.map(chord => ({ ...chord, notes: [...chord.notes], midiNotes: [...chord.midiNotes] })),
      description: roman.join(' – '),
    };
  });
}
