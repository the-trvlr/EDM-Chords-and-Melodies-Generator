import type { ChordInfo } from './musicTheory';
import type { GeneratedMelody, MelodyNote } from './melodyGenerator';

export type ArpPattern = 'up' | 'down' | 'up-down' | 'random';
export type ArpRate = 'eighth' | 'sixteenth';

export interface ArpSettings {
  pattern: ArpPattern;
  rate: ArpRate;
  octaveRange: number; // 1-3 octaves
  gate: number; // 0.5-1.0 (note duration as fraction of step)
}

// Seeded PRNG for reproducible arpeggiation
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
}

function getArpNotes(chord: ChordInfo, octaveRange: number): number[] {
  const baseNotes = chord.midiNotes;
  const notes: number[] = [];
  
  for (let oct = 0; oct < octaveRange; oct++) {
    for (const note of baseNotes) {
      notes.push(note + (oct * 12));
    }
  }
  
  return notes.sort((a, b) => a - b);
}

function applyPattern(notes: number[], pattern: ArpPattern, rng: SeededRandom): number[] {
  if (notes.length === 0) return [];

  switch (pattern) {
    case 'up':
      return [...notes];
    case 'down':
      return [...notes].reverse();
    case 'up-down':
      return [...notes, ...notes.slice(1, -1).reverse()];
    case 'random': {
      const shuffled = [...notes];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }
    default:
      return notes;
  }
}

export function arpeggiate(
  progression: ChordInfo[],
  settings: ArpSettings,
  seed: number,
  stepsPerChord: number = 16,
): GeneratedMelody {
  const rng = new SeededRandom(seed);
  const notes: MelodyNote[] = [];
  
  const stepsPerArpNote = settings.rate === 'eighth' ? 2 : 1; // 2 steps for eighth, 1 for sixteenth
  const noteDuration = Math.max(1, Math.floor(stepsPerArpNote * settings.gate));
  
  let currentStep = 0;
  
  for (const chord of progression) {
    const arpNotes = getArpNotes(chord, settings.octaveRange);
    const patternedNotes = applyPattern(arpNotes, settings.pattern, rng);
    
    let noteIndex = 0;
    for (let step = 0; step < stepsPerChord; step += stepsPerArpNote) {
      if (noteIndex < patternedNotes.length) {
        notes.push({
          midi: patternedNotes[noteIndex],
          step: currentStep + step,
          duration: noteDuration,
        });
        noteIndex++;
      }
    }
    
    currentStep += stepsPerChord;
  }
  
  return {
    notes,
    type: 'lead', // Arpeggiated chords are treated as melody
    styleId: 'arpeggiator',
    stepsPerChord,
  };
}
