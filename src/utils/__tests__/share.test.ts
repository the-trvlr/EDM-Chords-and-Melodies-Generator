import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare, chordTypeKey } from '../share';
import { defaultMelodyState, emptyMixer, type ProjectSnapshot } from '../../types';
import { getChordNotes } from '../musicTheory';

function snapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    key: 'A',
    scale: 'minor',
    genreId: 'house',
    progressionIdx: 1,
    rhythmName: 'Straight',
    synth: 'pad',
    bpm: 124,
    volume: -6,
    loop: true,
    doubleTime: false,
    chordComplexity: 'basic',
    customProgression: null,
    melody: defaultMelodyState(),
    ...overrides,
  };
}

describe('share codec', () => {
  it('round-trips the project context', () => {
    const input = snapshot();
    const decoded = decodeShare(encodeShare(input));
    expect(decoded).not.toBeNull();
    expect(decoded).toMatchObject({
      key: 'A',
      scale: 'minor',
      genreId: 'house',
      progressionIdx: 1,
      rhythmName: 'Straight',
      synth: 'pad',
      bpm: 124,
      chordComplexity: 'basic',
      doubleTime: false,
    });
  });

  it('keeps custom chords and inversions', () => {
    const custom = [
      getChordNotes('A', 'minor', 4, false),
      getChordNotes('F', 'maj7', 4, false),
      getChordNotes('D', 'minor', 4, false),
    ];
    const encoded = encodeShare(snapshot({ customProgression: custom }));
    const decoded = decodeShare(encoded);
    expect(decoded?.customProgression).toHaveLength(3);
    expect(decoded?.customProgression?.[1].display).toBe('Fmaj7');
    expect(decoded?.customProgression?.[1].type.name).toBe('Major 7th');
  });

  it('keeps mixer settings and drum edits', () => {
    const melody = {
      ...defaultMelodyState(),
      mixer: {
        ...emptyMixer(),
        chord: { volume: -8, mute: true, solo: false },
        drums: { volume: 3, mute: false, solo: true },
      },
      customDrumPattern: {
        kick: [1, ...new Array(15).fill(0)],
        snare: new Array(16).fill(0),
        clap: new Array(16).fill(0),
        hat: [0, 1, ...new Array(14).fill(0)],
      },
    };
    const decoded = decodeShare(encodeShare(snapshot({ melody })));
    expect(decoded?.melody.mixer.chord).toEqual({ volume: -8, mute: true, solo: false });
    expect(decoded?.melody.mixer.drums.solo).toBe(true);
    expect(decoded?.melody.customDrumPattern?.kick[0]).toBe(1);
    expect(decoded?.melody.customDrumPattern?.hat[1]).toBe(1);
  });

  it('decodes legacy flat payloads', () => {
    const legacy = {
      k: 'C',
      s: 'minor',
      g: 'techno',
      p: 0,
      y: 'pluck',
      b: 130,
      c: '7ths',
      r: 'Driving',
      bs: 'tech-groove',
      ls: 'tech-lead',
      bsd: 4,
      lsd: 5,
      ae: true,
      as: { pattern: 'down', rate: 'sixteenth', octaveRange: 2, gate: 0.6 },
      asd: 9,
      dk: '909',
      dsd: 2,
      si: { chord: 'pad', bass: 'pluck', lead: 'supersaw', drums: 'piano' },
    };
    const encoded = Buffer.from(JSON.stringify(legacy)).toString('base64url');
    const decoded = decodeShare(encoded);
    expect(decoded).toMatchObject({ key: 'C', scale: 'minor', genreId: 'techno', synth: 'pluck', bpm: 130 });
    expect(decoded?.customProgression).toBeNull();
    expect(decoded?.melody.bassStyleId).toBe('tech-groove');
    expect(decoded?.melody.arpSettings.pattern).toBe('down');
    expect(decoded?.melody.drumKitId).toBe('909');
  });

  it('rejects malformed input', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('!!!not-base64!!!')).toBeNull();
    expect(decodeShare(Buffer.from('[]').toString('base64url'))).toBeNull();
    expect(decodeShare(Buffer.from('{"g":"nope","s":"nope","k":"H"}').toString('base64url')))
      .toMatchObject({ genreId: 'house', scale: 'minor', key: 'A' });
    expect(decodeShare('a'.repeat(9000))).toBeNull();
  });

  it('keeps sections, octaves, edited notes and groove', () => {
    const melody = {
      ...defaultMelodyState(),
      octaves: { chord: 1, bass: -1, lead: 2 },
      ranges: { bass: 3, lead: 6 },
      swing: 0.3,
      humanize: true,
      sections: [
        { id: 's1', kind: 'intro' as const, bars: 4, tracks: ['chord' as const] },
        { id: 's2', kind: 'drop' as const, bars: 8, tracks: ['chord' as const, 'bass' as const, 'lead' as const, 'drums' as const] },
      ],
      bassNotes: [{ step: 0, midi: 40, duration: 2 }, { step: 4, midi: 43, duration: 1 }],
    };
    const decoded = decodeShare(encodeShare(snapshot({ melody })));
    expect(decoded?.melody.octaves).toEqual({ chord: 1, bass: -1, lead: 2 });
    expect(decoded?.melody.ranges).toEqual({ bass: 3, lead: 6 });
    expect(decoded?.melody.swing).toBe(0.3);
    expect(decoded?.melody.humanize).toBe(true);
    expect(decoded?.melody.sections).toHaveLength(2);
    expect(decoded?.melody.sections[1]).toMatchObject({ kind: 'drop', bars: 8 });
    expect(decoded?.melody.sections[1].tracks).toHaveLength(4);
    expect(decoded?.melody.bassNotes).toEqual(melody.bassNotes);
    expect(decoded?.melody.leadNotes).toBeNull();
    expect(encodeShare(snapshot({ melody })).length).toBeLessThan(4000);
  });

  it('maps chord types to stable keys', () => {
    expect(chordTypeKey(getChordNotes('A', 'min7', 4))).toBe('min7');
    expect(chordTypeKey(getChordNotes('C', 'maj9', 4))).toBe('maj9');
    expect(chordTypeKey(getChordNotes('G', 'dom7', 4))).toBe('dom7');
  });
});
