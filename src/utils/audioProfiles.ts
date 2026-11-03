import type { SynthPresetId } from './audioEngine';

export type Envelope = { attack: number; decay: number; sustain: number; release: number };

export const PRESET_ENVELOPES: Record<SynthPresetId, Envelope> = {
  piano: { attack: 0.005, decay: 0.3, sustain: 0.4, release: 1.2 },
  pad: { attack: 0.4, decay: 0.5, sustain: 0.8, release: 2.0 },
  organ: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.3 },
  // Supersaw is dense by nature: fewer detuned voices and a short release keep
  // chords from stacking into clipping on fast rhythm patterns.
  supersaw: { attack: 0.03, decay: 0.22, sustain: 0.5, release: 0.55 },
  pluck: { attack: 0.001, decay: 0.2, sustain: 0.1, release: 0.3 },
  dark: { attack: 0.08, decay: 0.35, sustain: 0.45, release: 0.7 },
  bell: { attack: 0.002, decay: 0.5, sustain: 0.2, release: 1.2 },
};

/** Maximum simultaneous voices per preset (a 5-note supersaw chord fits in 8). */
export const PRESET_VOICES: Record<SynthPresetId, number> = {
  piano: 16,
  pad: 16,
  organ: 12,
  supersaw: 8,
  pluck: 6,
  dark: 10,
  bell: 8,
};

export function getVoiceBudget(presetId: SynthPresetId): number {
  return PRESET_VOICES[presetId];
}

/**
 * Chord ADSR is derived from the selected rhythm: short stabs must release
 * before the next hit, sustained patterns need a long tail.
 */
export function getChordEnvelope(rhythmName?: string | null): Partial<Envelope> {
  const name = (rhythmName ?? '').toLowerCase();
  if (name.includes('whole') || name.includes('sustain')) {
    return { attack: 0.25, decay: 0.4, sustain: 0.85, release: 2.2 };
  }
  if (name.includes('stab') || name.includes('chop') || name.includes('pluck') || name.includes('syncop')) {
    return { attack: 0.003, decay: 0.12, sustain: 0.04, release: 0.14 };
  }
  if (name.includes('gated') || name.includes('gate')) {
    return { attack: 0.01, decay: 0.08, sustain: 0.55, release: 0.18 };
  }
  if (name.includes('arp') || name.includes('roll') || name.includes('pulse') || name.includes('pump')) {
    return { attack: 0.005, decay: 0.14, sustain: 0.2, release: 0.26 };
  }
  if (name.includes('wobble')) {
    return { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.4 };
  }
  if (name.includes('half-time') || name.includes('half time')) {
    return { attack: 0.01, decay: 0.25, sustain: 0.3, release: 0.5 };
  }
  return { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.35 };
}

