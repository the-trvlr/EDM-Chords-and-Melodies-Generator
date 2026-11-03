import { describe, expect, it } from 'vitest';
import { PRESET_ENVELOPES, PRESET_VOICES, getChordEnvelope } from '../audioProfiles';

describe('audio profiles', () => {
  it('caps supersaw polyphony to avoid clipping stacks', () => {
    expect(PRESET_VOICES.supersaw).toBeLessThanOrEqual(8);
    expect(PRESET_VOICES.pluck).toBeLessThanOrEqual(6);
    expect(PRESET_VOICES.supersaw).toBeLessThan(PRESET_VOICES.pad);
  });

  it('keeps the supersaw release short enough for fast patterns', () => {
    expect(PRESET_ENVELOPES.supersaw.release).toBeLessThanOrEqual(0.8);
  });

  it('uses short releases for stabs and long tails for sustained patterns', () => {
    const stab = getChordEnvelope('Stab');
    const pump = getChordEnvelope('Pumping');
    const whole = getChordEnvelope('Whole Note');
    expect(stab.release).toBeLessThan(0.2);
    expect(pump.release).toBeLessThan(0.3);
    expect(whole.release).toBeGreaterThan(1.5);
  });

  it('gives every rhythm a usable envelope', () => {
    for (const rhythm of ['Straight', 'Off-beat', 'Gated', 'Syncopated', 'Wobble', 'Half-time', 'Arpeggio', '']) {
      const envelope = getChordEnvelope(rhythm);
      expect(envelope.attack).toBeGreaterThanOrEqual(0);
      expect(envelope.release).toBeGreaterThan(0);
      expect(envelope.sustain).toBeLessThanOrEqual(1);
    }
  });
});
