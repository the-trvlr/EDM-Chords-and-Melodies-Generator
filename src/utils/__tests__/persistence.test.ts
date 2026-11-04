import { describe, expect, it, vi } from 'vitest';
import { getChordNotes, invertChord, keyPrefersFlats, voiceLeading } from '../musicTheory';
import { duplicateArrangement, getSavedArrangements, loadPersistedState, parseProjectFile, renameArrangement, sanitizeProject, saveArrangement, savePersistedState, serializeProject } from '../persistence';
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

  it('sanitises octaves, sections and edited notes', () => {
    const sanitized = sanitizeProject({
      key: 'A',
      scale: 'minor',
      melody: {
        octaves: { chord: 9, bass: -9, lead: 1 },
        rangeSpans: { bass: 9, lead: -1 },
        sections: [
          { kind: 'drop', bars: 999, tracks: ['chord', 'nope'] },
          { kind: 'unknown', bars: -2, tracks: [] },
        ],
        swing: 5,
        humanize: true,
        bassNotes: [{ step: -1, midi: 200, duration: 0 }],
        leadNotes: 'not-an-array',
      },
    });
    expect(sanitized?.melody.octaves).toEqual({ chord: 2, bass: -2, lead: 1 });
    expect(sanitized?.melody.rangeSpans).toEqual({ bass: 3, lead: 1 });
    expect(sanitized?.melody.sections).toHaveLength(2);
    expect(sanitized?.melody.sections[0]).toMatchObject({ kind: 'drop', bars: 32, tracks: ['chord'] });
    expect(sanitized?.melody.sections[1].kind).toBe('drop');
    expect(sanitized?.melody.swing).toBe(0.6);
    expect(sanitized?.melody.humanize).toBe(true);
    expect(sanitized?.melody.bassNotes).toEqual([{ step: 0, midi: 127, duration: 1 }]);
    expect(sanitized?.melody.leadNotes).toBeNull();
  });

  it('restores the nested melody state, sections and manual chords', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
    });
    const melody = {
      ...defaultMelodyState(),
      octaves: { chord: 1, bass: -1, lead: 0 },
      sections: [{ id: 's1', kind: 'drop' as const, bars: 8, tracks: ['chord' as const, 'drums' as const] }],
      swing: 0.25,
    };
    savePersistedState({
      selectedKey: 'A',
      selectedScale: 'minor',
      genreId: 'house',
      selectedProgressionIdx: 0,
      selectedSynth: 'pad',
      bpm: 124,
      volume: -6,
      loop: true,
      doubleTime: false,
      chordComplexity: 'basic',
      activeTab: 'melodies',
      melody,
      customProgression: [getChordNotes('A', 'minor', 4, false)],
    });
    const loaded = loadPersistedState();
    expect(loaded.melody?.sections).toHaveLength(1);
    expect(loaded.melody?.octaves).toEqual({ chord: 1, bass: -1, lead: 0 });
    expect(loaded.melody?.swing).toBe(0.25);
    expect(loaded.customProgression).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it('duplicates a saved arrangement', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    });
    const project = sanitizeProject({ key: 'A', scale: 'minor', genreId: 'house' })!;
    const saved = saveArrangement('Night drive', project);
    const copy = duplicateArrangement(saved.id);
    expect(copy?.name).toBe('Night drive copy');
    expect(getSavedArrangements()).toHaveLength(2);
    expect(getSavedArrangements()[1].data.project.key).toBe('A');
    vi.unstubAllGlobals();
  });

  it('renames a saved arrangement and rejects empty names', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    });
    const project = sanitizeProject({ key: 'A', scale: 'minor', genreId: 'house' })!;
    const saved = saveArrangement('Demo', project);
    const renamed = renameArrangement(saved.id, 'Night drive');
    expect(renamed?.name).toBe('Night drive');
    expect(getSavedArrangements()[0].name).toBe('Night drive');
    expect(renameArrangement(saved.id, '   ')).toBeNull();
    vi.unstubAllGlobals();
  });
});
