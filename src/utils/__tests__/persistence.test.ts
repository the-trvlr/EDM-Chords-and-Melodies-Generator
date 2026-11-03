import { describe, expect, it } from 'vitest';
import { getChordNotes, invertChord, keyPrefersFlats, voiceLeading } from '../musicTheory';
import { parseProjectFile, sanitizeProject, serializeProject } from '../persistence';
import { defaultMelodyState } from '../../types';

describe('music theory helpers', () => {
  it('builds an inversion by moving the lowest note up an octave', () => {
    const chord = getChordNotes('A', 'minor', 4, false);
    const inverted = invertChord(chord, 1);
    expect(inverted.inversion).toBe(1);
    expect(inverted.midiNotes).toHaveLength(chord.midiNotes.length);
    expect(Math.min(...inverted.midiNotes)).toBeGreaterThan(Math.min(...chord.midiNotes));
  });

  it('returns the same chord for inversion 0', () => {
    const chord = getChordNotes('C', 'major', 4, false);
    expect(invertChord(chord, 0).midiNotes).toEqual(chord.midiNotes);
  });

  it('smooths voice leading without changing chord count', () => {
    const progression = [
      getChordNotes('A', 'minor', 4, false),
      getChordNotes('F', 'major', 4, false),
      getChordNotes('D', 'minor', 4, false),
      getChordNotes('E', 'major', 4, false),
    ];
    const voiced = voiceLeading(progression);
    expect(voiced).toHaveLength(4);
    voiced.forEach(chord => expect(chord.midiNotes).toHaveLength(3));
  });

  it('spells flat keys with flats', () => {
    expect(keyPrefersFlats(3, 'minor')).toBe(true); // Eb minor
    expect(keyPrefersFlats(9, 'minor')).toBe(false); // A minor
  });
});

describe('project files', () => {
  const project = {
    key: 'F',
    scale: 'minor',
    genreId: 'trance',
    progressionIdx: 2,
    rhythmName: 'Gated',
    synth: 'supersaw' as const,
    bpm: 138,
    volume: -6,
    loop: true,
    doubleTime: true,
    chordComplexity: '9ths' as const,
    customProgression: [getChordNotes('F', 'minor', 4, true)],
    melody: defaultMelodyState(),
  };

  it('round-trips a project file', () => {
    const parsed = parseProjectFile(serializeProject('Demo', project));
    expect(parsed?.name).toBe('Demo');
    expect(parsed?.project).toMatchObject({
      key: 'F',
      scale: 'minor',
      genreId: 'trance',
      bpm: 138,
      doubleTime: true,
      chordComplexity: '9ths',
    });
    expect(parsed?.project.customProgression?.[0].display).toBe('Fm');
  });

  it('reads legacy project files', () => {
    const legacy = JSON.stringify({
      name: 'Old',
      data: {
        selectedKey: 'G',
        selectedScale: 'major',
        genreId: 'house',
        selectedProgressionIdx: 1,
        selectedSynth: 'piano',
        bpm: 120,
        volume: -6,
        loop: true,
        doubleTime: false,
        chordComplexity: 'basic',
        activeTab: 'chords',
        customProgression: null,
        selectedRhythmName: 'Straight',
      },
    });
    const parsed = parseProjectFile(legacy);
    expect(parsed?.name).toBe('Old');
    expect(parsed?.project).toMatchObject({ key: 'G', scale: 'major', synth: 'piano', bpm: 120 });
  });

  it('rejects broken files', () => {
    expect(parseProjectFile('not json')).toBeNull();
    expect(parseProjectFile('[]')).toBeNull();
    expect(parseProjectFile('{"project": 42}')).toBeNull();
  });

  it('sanitizes out-of-range values', () => {
    const sanitized = sanitizeProject({ bpm: 999, volume: 40, key: 'A', scale: 'weird' });
    expect(sanitized?.bpm).toBe(124);
    expect(sanitized?.volume).toBe(-6);
    expect(sanitized?.scale).toBe('minor');
  });
});
