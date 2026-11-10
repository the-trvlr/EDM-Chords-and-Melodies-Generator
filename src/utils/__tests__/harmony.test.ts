import { describe, expect, it } from 'vitest';
import { getChordNotes, getScaleNotes, noteNameToPc } from '../musicTheory';
import { detectKey, suggestNextChords } from '../harmony';
import type { HarmonySuggestion } from '../harmony';

const chord = (root: string, type = 'major', octave = 4, useFlats = false) =>
  getChordNotes(root, type, octave, useFlats);

const cMajorProgression = [
  chord('C'),
  chord('A', 'minor'),
  chord('F'),
  chord('G'),
];

function pitchClassFingerprint(suggestion: HarmonySuggestion): string {
  const pitchClasses = new Set(
    suggestion.chord.midiNotes.map(midi => ((midi % 12) + 12) % 12),
  );
  return [...pitchClasses].sort((a, b) => a - b).join(',');
}

function scalePcs(key: string, scale: string): Set<number> {
  return new Set(getScaleNotes(key, scale).map(noteNameToPc));
}

function expectUnique(suggestions: HarmonySuggestion[]): void {
  const fingerprints = suggestions.map(pitchClassFingerprint);
  expect(new Set(fingerprints).size).toBe(fingerprints.length);

  const rootAndType = suggestions.map(suggestion => `${suggestion.chord.root}:${suggestion.chord.type.name}`);
  expect(new Set(rootAndType).size).toBe(rootAndType.length);
}

describe('suggestNextChords', () => {
  it('returns tonic, subdominant, and dominant for an empty progression', () => {
    const suggestions = suggestNextChords([], 'C', 'major', 'basic');

    expect(suggestions).toHaveLength(3);
    expect(suggestions.map(suggestion => suggestion.chord.display)).toEqual(['C', 'F', 'G']);
    expect(suggestions.every(suggestion => suggestion.kind === 'diatonic')).toBe(true);
    expect(suggestions.every(suggestion => suggestion.reason.length > 0)).toBe(true);
    expect(suggestions[0].score).toBeGreaterThan(suggestions[1].score);
    expect(suggestions[1].score).toBeGreaterThan(suggestions[2].score);
  });

  it('includes diatonic, borrowed, and secondary candidates in C major', () => {
    const suggestions = suggestNextChords(cMajorProgression, 'C', 'major', '7ths', 50);

    expect(suggestions).toHaveLength(15);
    expectUnique(suggestions);

    const kinds = new Set(suggestions.map(suggestion => suggestion.kind));
    expect(kinds).toEqual(new Set(['diatonic', 'borrowed', 'secondary']));

    const borrowed = suggestions
      .filter(suggestion => suggestion.kind === 'borrowed')
      .map(suggestion => suggestion.chord.display)
      .sort();
    expect(borrowed).toEqual(['Ab', 'Bb', 'Fm']);

    const secondary = suggestions
      .filter(suggestion => suggestion.kind === 'secondary')
      .map(suggestion => suggestion.chord.display)
      .sort();
    expect(secondary).toEqual(['A7', 'B7', 'C7', 'D7', 'E7']);

    for (const suggestion of suggestions) {
      expect(Number.isFinite(suggestion.score)).toBe(true);
      expect(suggestion.reason.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic and honors the limit', () => {
    const first = suggestNextChords(cMajorProgression, 'C', 'major', '7ths', 50);
    const second = suggestNextChords(cMajorProgression, 'C', 'major', '7ths', 50);
    expect(second).toEqual(first);

    for (const limit of [1, 2, 3, 5, 10]) {
      const limited = suggestNextChords(cMajorProgression, 'C', 'major', '7ths', limit);
      expect(limited).toHaveLength(limit);
      expect(limited).toEqual(first.slice(0, limit));
      expectUnique(limited);
    }

    expect(suggestNextChords(cMajorProgression, 'C', 'major', '7ths', 0)).toEqual([]);
    expect(suggestNextChords(cMajorProgression, 'C', 'major', '7ths', -5)).toEqual([]);
    expect(suggestNextChords(cMajorProgression, 'C', 'major', '7ths', 100)).toHaveLength(first.length);
  });

  it('prefers a descending fifth / ascending fourth after a dominant', () => {
    const afterG = suggestNextChords(
      [chord('C'), chord('F'), chord('G')],
      'C',
      'major',
      'basic',
      5,
    );

    expect(afterG[0].chord.root).toBe('C');
    expect(afterG[0].kind).toBe('diatonic');
  });

  it('avoids a repeated root when a strong alternative exists', () => {
    const afterC = suggestNextChords([chord('C')], 'C', 'major', 'basic', 10);

    expect(afterC.length).toBeGreaterThan(0);
    expect(afterC[0].chord.root).not.toBe('C');
  });

  it('handles invalid keys and scales without throwing', () => {
    const suggestions = suggestNextChords([chord('C')], 'not-a-key', 'not-a-scale', 'basic', 5);

    expect(suggestions.length).toBeGreaterThan(0);
    expectUnique(suggestions);
    expect(suggestions.every(suggestion => Number.isFinite(suggestion.score))).toBe(true);
  });

  it('does not mutate the input progression', () => {
    const input = [chord('C'), chord('A', 'minor'), chord('F'), chord('G')];
    const snapshot = JSON.parse(JSON.stringify(input));

    suggestNextChords(input, 'C', 'major', '7ths', 20);
    suggestNextChords(input, 'C', 'major', '7ths', 3);

    expect(input).toEqual(snapshot);
  });
});

describe('detectKey', () => {
  it('returns null for an empty progression', () => {
    expect(detectKey([])).toBeNull();
  });

  it('detects C major from a I-vi-IV-V progression', () => {
    const detected = detectKey(cMajorProgression);

    expect(detected).not.toBeNull();
    expect(detected?.key).toBe('C');
    expect(detected?.scale).toBe('major');
    expect(detected?.confidence).toBeGreaterThan(0.5);
    expect(detected?.confidence).toBeLessThanOrEqual(1);

    const pcs = scalePcs('C', 'major');
    for (const source of cMajorProgression) {
      for (const midi of source.midiNotes) {
        expect(pcs.has(((midi % 12) + 12) % 12)).toBe(true);
      }
    }
  });

  it('chooses A minor for an Am-F-C-G progression', () => {
    const aMinorProgression = [chord('A', 'minor'), chord('F'), chord('C'), chord('G')];
    const detected = detectKey(aMinorProgression);

    expect(detected).not.toBeNull();
    expect(detected?.key).toBe('A');
    expect(detected?.scale).toBe('minor');
    expect(detected?.confidence).toBeGreaterThan(0.5);
    expect(detected?.confidence).toBeLessThanOrEqual(1);

    const pcs = scalePcs('A', 'minor');
    for (const source of aMinorProgression) {
      for (const midi of source.midiNotes) {
        expect(pcs.has(((midi % 12) + 12) % 12)).toBe(true);
      }
    }
  });

  it('recognizes a modal progression (D dorian)', () => {
    const dorianProgression = [
      chord('D', 'min7'),
      chord('G', 'dom7'),
      chord('A', 'min7'),
    ];
    const detected = detectKey(dorianProgression);

    expect(detected).not.toBeNull();
    expect(detected?.key).toBe('D');
    expect(detected?.scale).toBe('dorian');
  });

  it('does not mutate the input progression', () => {
    const input = [chord('A', 'minor'), chord('F'), chord('C'), chord('G')];
    const snapshot = JSON.parse(JSON.stringify(input));

    detectKey(input);

    expect(input).toEqual(snapshot);
  });
});
