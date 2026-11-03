import { describe, expect, it } from 'vitest';
import { PRESET_ENVELOPES, PRESET_VOICES, getChordEnvelope } from '../audioProfiles';

describe('audio profiles', () => {
  it('gives dense presets a bounded polyphony budget', () => {
    expect(PRESET_VOICES.supersaw).toBeLessThanOrEqual(16);
    expect(PRESET_VOICES.pluck).toBeLessThanOrEqual(6);
    // Dense 16th patterns need two chord generations of headroom.
    expect(PRESET_VOICES.supersaw).toBeGreaterThanOrEqual(12);
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

  it('caps the release to the shortest hit gap at the current tempo', () => {
    const pulsing = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    const pumping = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
    const fast = getChordEnvelope('Pulsing', 130, pulsing);
    const slow = getChordEnvelope('Pulsing', 60, pulsing);
    const pump = getChordEnvelope('Pumping', 130, pumping);
    expect(fast.release).toBeLessThan(0.12);
    expect(slow.release).toBeGreaterThan(fast.release ?? 0);
    // Pumping hits every 8th note, so the cap is longer than for 16ths.
    expect(pump.release).toBeGreaterThan(fast.release ?? 0);
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
