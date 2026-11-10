import {
  CHORD_TYPES,
  FLAT_NAMES,
  NOTE_NAMES,
  SCALE_INTERVALS,
  getChordNotes,
  getChordsInKey,
  getPreferredKeyName,
  getRomanNumeral,
  keyPrefersFlats,
  noteNameToPc,
} from './musicTheory';
import type { ChordComplexity, ChordInfo } from './musicTheory';

export type HarmonySuggestionKind = 'diatonic' | 'borrowed' | 'secondary';

export interface HarmonySuggestion {
  chord: ChordInfo;
  kind: HarmonySuggestionKind;
  reason: string;
  score: number;
}

export interface DetectedKey {
  key: string;
  scale: string;
  confidence: number;
}

const COMPLEXITIES: readonly ChordComplexity[] = ['basic', '7ths', '9ths', 'jazzy'];

// The major-scale degrees (ii, iii, IV, V, vi) that receive secondary dominants.
const SECONDARY_TARGET_DEGREES = [1, 2, 3, 4, 5] as const;

const KIND_PRIOR: Record<HarmonySuggestionKind, number> = {
  diatonic: 1.2,
  borrowed: 0.35,
  secondary: 0.4,
};

interface Candidate {
  chord: ChordInfo;
  kind: HarmonySuggestionKind;
  reason: string;
  order: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function toPc(value: number): number {
  return ((value % 12) + 12) % 12;
}

function normalizeScale(scale: string): string {
  return Object.prototype.hasOwnProperty.call(SCALE_INTERVALS, scale) ? scale : 'major';
}

function normalizeComplexity(complexity: ChordComplexity): ChordComplexity {
  return COMPLEXITIES.includes(complexity) ? complexity : 'basic';
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 3;
  return Math.max(0, Math.floor(limit));
}

/**
 * Pitch classes of a chord, using its voicing when available and falling back
 * to the chord notes or root + interval definition. Never mutates the chord.
 */
function chordPitchClasses(chord: ChordInfo): number[] {
  const pitchClasses = new Set<number>();

  for (const midi of chord.midiNotes ?? []) {
    if (Number.isFinite(midi)) pitchClasses.add(toPc(midi));
  }
  for (const note of chord.notes ?? []) {
    pitchClasses.add(noteNameToPc(note));
  }

  if (pitchClasses.size === 0) {
    const rootPc = noteNameToPc(chord.root);
    const intervals = chord.type?.intervals ?? CHORD_TYPES.major.intervals;
    for (const interval of intervals) pitchClasses.add(toPc(rootPc + interval));
  }

  return [...pitchClasses].sort((a, b) => a - b);
}

function scalePitchClasses(tonicPc: number, scale: string): Set<number> {
  const intervals = SCALE_INTERVALS[scale] ?? SCALE_INTERVALS.major;
  return new Set(intervals.map(interval => toPc(tonicPc + interval)));
}

function pitchClassDistance(a: number, b: number): number {
  const distance = Math.abs(a - b) % 12;
  return Math.min(distance, 12 - distance);
}

/**
 * Sum of the nearest semitone distance from each tone of one chord to the
 * closest tone of the other. Octave and inversion independent, so borrowed or
 * widely voiced chords are compared on their actual harmonic movement.
 */
function voiceLeadingCost(previous: number[], next: number[]): number {
  if (previous.length === 0 || next.length === 0) return 0;

  let total = 0;
  for (const pc of previous) {
    let nearest = 6;
    for (const nextPc of next) {
      nearest = Math.min(nearest, pitchClassDistance(pc, nextPc));
    }
    total += nearest;
  }
  return total;
}

function commonToneCount(previous: number[], next: number[]): number {
  const nextSet = new Set(next);
  return previous.filter(pc => nextSet.has(pc)).length;
}

/**
 * Root-motion score from the previous chord to a candidate. The strong motion
 * is a descending fifth / ascending fourth (five semitones up), followed by
 * stepwise motion; unison and tritone motion are discouraged.
 */
function rootMotionScore(previousRootPc: number, candidateRootPc: number): number {
  const motion = toPc(candidateRootPc - previousRootPc);

  switch (motion) {
    case 5: // descending fifth / ascending fourth
      return 5;
    case 7: // ascending fifth / descending fourth
      return 2.5;
    case 2:
    case 10: // whole-tone step
      return 2.4;
    case 1:
    case 11: // chromatic step
      return 1.2;
    case 3:
    case 4:
    case 8:
    case 9: // thirds
      return 1.3;
    case 6: // tritone
      return -3;
    case 0: // repeated root
      return -4;
    default:
      return 0;
  }
}

function scaleFitScore(pitchClasses: number[], scalePcs: Set<number>): number {
  if (pitchClasses.length === 0) return 0;

  const inScale = pitchClasses.filter(pc => scalePcs.has(pc)).length;
  const outOfScale = pitchClasses.length - inScale;
  return (inScale / pitchClasses.length) * 1.5 - (outOfScale / pitchClasses.length) * 0.6;
}

function scoreCandidate(
  candidate: Candidate,
  lastChord: ChordInfo,
  lastPitchClasses: number[],
  keyPc: number,
  scalePcs: Set<number>,
): number {
  const pitchClasses = chordPitchClasses(candidate.chord);
  const rootPc = noteNameToPc(candidate.chord.root);

  let score = KIND_PRIOR[candidate.kind] + scaleFitScore(pitchClasses, scalePcs);
  score += rootMotionScore(noteNameToPc(lastChord.root), rootPc);
  score -= voiceLeadingCost(lastPitchClasses, pitchClasses) * 0.45;
  score += commonToneCount(lastPitchClasses, pitchClasses) * 0.35;

  // A gentle pull toward the tonic and dominant keeps the result tonal without
  // overpowering the voice-leading and root-motion terms.
  if (rootPc === keyPc) score += 0.4;
  if (rootPc === toPc(keyPc + 7)) score += 0.15;

  return score;
}

function emptyProgressionSuggestions(
  keyName: string,
  scale: string,
  complexity: ChordComplexity,
  limit: number,
): HarmonySuggestion[] {
  const chords = getChordsInKey(keyName, scale, complexity);
  const anchors = [
    { index: 0, label: 'Tonic', score: 3 },
    { index: 3, label: 'Subdominant', score: 2.5 },
    { index: 4, label: 'Dominant', score: 2 },
  ];

  const suggestions: HarmonySuggestion[] = [];
  for (const anchor of anchors) {
    const chord = chords[anchor.index];
    if (!chord) continue;

    suggestions.push({
      chord,
      kind: 'diatonic',
      reason: `${anchor.label} ${getRomanNumeral(anchor.index, scale)} (${chord.display}) of ${keyName} ${scale}.`,
      score: anchor.score,
    });
  }

  return suggestions.slice(0, limit);
}

/**
 * Rank likely continuations for a chord progression. The function is pure and
 * deterministic: no randomness, no mutation of the input progression or its
 * chords, and ties are broken by the stable candidate order.
 */
export function suggestNextChords(
  progression: ChordInfo[],
  key: string,
  scale: string,
  complexity: ChordComplexity,
  limit = 3,
): HarmonySuggestion[] {
  const maxResults = normalizeLimit(limit);
  if (maxResults === 0) return [];

  const history = Array.isArray(progression) ? progression : [];
  const effectiveScale = normalizeScale(scale);
  const effectiveComplexity = normalizeComplexity(complexity);

  const keyPc = noteNameToPc(key);
  const keyName = getPreferredKeyName(keyPc, effectiveScale);
  const useFlatsForKey = keyPrefersFlats(keyPc, effectiveScale);

  if (history.length === 0) {
    return emptyProgressionSuggestions(keyName, effectiveScale, effectiveComplexity, maxResults);
  }

  const diatonicChords = getChordsInKey(keyName, effectiveScale, effectiveComplexity);
  const candidates: Candidate[] = diatonicChords.map((chord, index) => ({
    chord,
    kind: 'diatonic',
    reason: `Diatonic ${getRomanNumeral(index, effectiveScale)} (${chord.display}) in ${keyName} ${effectiveScale}.`,
    order: index,
  }));

  // Borrowed bVI and bVII major triads. The iv minor subdominant is a
  // major-key borrowing; in minor-family scales it is either diatonic or not a
  // conventional borrowing, so it is only added for major.
  const borrowedDegrees: { degree: string; pc: number; type: string }[] = [
    { degree: 'bVI', pc: toPc(keyPc + 8), type: 'major' },
    { degree: 'bVII', pc: toPc(keyPc + 10), type: 'major' },
  ];
  if (effectiveScale === 'major') {
    borrowedDegrees.push({ degree: 'iv', pc: toPc(keyPc + 5), type: 'minor' });
  }

  borrowedDegrees.forEach((borrowed, index) => {
    // Flat-degree borrowings are always spelled with flats, even in sharp
    // keys: bVI of C is Ab, not G#. keyPrefersFlats still governs the
    // diatonic and secondary-dominant spellings.
    const rootName = FLAT_NAMES[borrowed.pc];
    const chord = getChordNotes(rootName, borrowed.type, 4, true);
    candidates.push({
      chord,
      kind: 'borrowed',
      reason: `Borrowed ${borrowed.degree} (${chord.display}) from the parallel minor.`,
      order: diatonicChords.length + index,
    });
  });

  const secondaryType = effectiveComplexity === 'basic' ? 'major' : 'dom7';
  const spellingNames = useFlatsForKey ? FLAT_NAMES : NOTE_NAMES;

  SECONDARY_TARGET_DEGREES.forEach((degreeIndex, index) => {
    const target = diatonicChords[degreeIndex];
    if (!target) return;

    const fifthPc = toPc(noteNameToPc(target.root) + 7);
    const rootName = spellingNames[fifthPc];
    const chord = getChordNotes(rootName, secondaryType, 4, useFlatsForKey);

    candidates.push({
      chord,
      kind: 'secondary',
      reason: `Secondary dominant V/${getRomanNumeral(degreeIndex, effectiveScale)} resolving to ${target.display}.`,
      order: diatonicChords.length + borrowedDegrees.length + index,
    });
  });

  const seenFingerprints = new Set<string>();
  const uniqueCandidates = candidates.filter(candidate => {
    const fingerprint = chordPitchClasses(candidate.chord).join('-');
    if (seenFingerprints.has(fingerprint)) return false;
    seenFingerprints.add(fingerprint);
    return true;
  });

  const lastChord = history[history.length - 1];
  const lastPitchClasses = chordPitchClasses(lastChord);
  const scalePcs = scalePitchClasses(keyPc, effectiveScale);

  const ranked = uniqueCandidates
    .map(candidate => ({
      candidate,
      score: scoreCandidate(candidate, lastChord, lastPitchClasses, keyPc, scalePcs),
    }))
    .sort((a, b) => b.score - a.score || a.candidate.order - b.candidate.order);

  return ranked.slice(0, maxResults).map(({ candidate, score }) => ({
    chord: candidate.chord,
    kind: candidate.kind,
    reason: candidate.reason,
    score,
  }));
}

interface KeyCandidate {
  key: string;
  scale: string;
  score: number;
  fitRatio: number;
  order: number;
}

/**
 * Detect the most likely key/scale of a progression by checking every tonic
 * pitch class against every scale in SCALE_INTERVALS. Chords that fit the
 * scale, roots in the scale, and tonic/dominant emphasis raise the score;
 * out-of-scale chord tones lower it.
 */
export function detectKey(progression: ChordInfo[]): DetectedKey | null {
  const history = Array.isArray(progression) ? progression : [];
  if (history.length === 0) return null;

  const chordPitchClassSets = history.map(chordPitchClasses);
  const roots = history.map(chord => noteNameToPc(chord.root));
  const scaleNames = Object.keys(SCALE_INTERVALS);
  const keyCandidates: KeyCandidate[] = [];

  let order = 0;
  for (const scale of scaleNames) {
    const intervals = SCALE_INTERVALS[scale];
    for (let tonicPc = 0; tonicPc < 12; tonicPc++) {
      const scalePcs = new Set(intervals.map(interval => toPc(tonicPc + interval)));

      let inScalePcs = 0;
      let totalPcs = 0;
      let rootsInScale = 0;
      let tonicHits = 0;
      let dominantHits = 0;

      for (let i = 0; i < history.length; i++) {
        const pcs = chordPitchClassSets[i];
        totalPcs += pcs.length;
        for (const pc of pcs) {
          if (scalePcs.has(pc)) inScalePcs++;
        }

        if (scalePcs.has(roots[i])) rootsInScale++;
        if (roots[i] === tonicPc) tonicHits++;
        if (roots[i] === toPc(tonicPc + 7)) dominantHits++;
      }

      const fitRatio = totalPcs > 0 ? inScalePcs / totalPcs : 0;
      const outOfScaleRatio = 1 - fitRatio;
      const rootRatio = rootsInScale / history.length;
      const tonicRatio = tonicHits / history.length;
      const dominantRatio = dominantHits / history.length;
      const firstChordIsTonic = roots[0] === tonicPc;
      const lastChordIsTonic = roots[history.length - 1] === tonicPc;

      const score =
        fitRatio * 5 +
        rootRatio * 1.5 +
        tonicRatio * 2.5 +
        dominantRatio * 0.5 +
        (firstChordIsTonic ? 1 : 0) +
        (lastChordIsTonic ? 0.5 : 0) -
        outOfScaleRatio * 1.5;

      keyCandidates.push({
        key: getPreferredKeyName(tonicPc, scale),
        scale,
        score,
        fitRatio,
        order,
      });
      order++;
    }
  }

  keyCandidates.sort((a, b) => b.score - a.score || a.order - b.order);

  const best = keyCandidates[0];
  if (!best) return null;

  const runnerUp = keyCandidates[1];
  const margin = runnerUp ? best.score - runnerUp.score : 0;
  const marginFactor = clamp01(margin / 1.5);
  const confidence = clamp01(0.1 + best.fitRatio * 0.6 + marginFactor * 0.3);

  return {
    key: best.key,
    scale: best.scale,
    confidence: Math.round(confidence * 1000) / 1000,
  };
}
