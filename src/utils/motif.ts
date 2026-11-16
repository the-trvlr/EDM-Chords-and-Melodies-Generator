import type { MelodyNote } from './melodyGenerator';

export type MotifTransform = 'original' | 'invert' | 'retrograde' | 'augment' | 'diminish';

/** Take the first bar of a melody as a motif. */
export function extractMotif(notes: MelodyNote[], barSteps = 16): MelodyNote[] {
  return notes
    .filter(note => note.step < barSteps)
    .map(note => ({ ...note }))
    .sort((a, b) => a.step - b.step);
}

export function transformMotif(
  motif: MelodyNote[],
  transform: MotifTransform,
  transpose = 0,
): MelodyNote[] {
  if (motif.length === 0) return [];
  const anchor = motif[0].midi;
  const span = Math.max(...motif.map(note => note.step + note.duration));
  const transformed = motif.map(note => {
    const next = { ...note, midi: note.midi + transpose };
    if (transform === 'invert') next.midi = anchor - (note.midi - anchor) + transpose;
    if (transform === 'retrograde') next.step = Math.max(0, span - (note.step + note.duration));
    if (transform === 'augment') {
      next.step = note.step * 2;
      next.duration = note.duration * 2;
    }
    if (transform === 'diminish') {
      next.step = Math.floor(note.step / 2);
      next.duration = Math.max(1, Math.round(note.duration / 2));
    }
    return next;
  });
  return transformed.sort((a, b) => a.step - b.step);
}

export function repeatMotif(motif: MelodyNote[], bars: number, barSteps = 16): MelodyNote[] {
  const repeats = Math.max(1, Math.ceil(bars));
  const notes: MelodyNote[] = [];
  for (let bar = 0; bar < repeats; bar++) {
    for (const note of motif) {
      notes.push({ ...note, step: note.step + bar * barSteps });
    }
  }
  return notes.sort((a, b) => a.step - b.step);
}
