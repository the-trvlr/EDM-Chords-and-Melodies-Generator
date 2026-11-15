import type { SectionEnergy, SectionKind } from '../types';
import type { TrackId } from '../utils/schedule';

export interface TemplateSection {
  kind: SectionKind;
  bars: number;
  tracks: TrackId[];
  energy: SectionEnergy;
  fill: boolean;
}

export interface ArrangementTemplate {
  name: string;
  sections: TemplateSection[];
}

const ALL: TrackId[] = ['chord', 'bass', 'lead', 'drums'];

/**
 * Typical EDM sketches with two drops. The first build is drums/chords only;
 * the second build adds the lead before the final drop.
 */
export const ARRANGEMENT_TEMPLATES: ArrangementTemplate[] = [
  {
    name: 'Club · 64 bars',
    sections: [
      { kind: 'intro', bars: 4, tracks: ['chord'], energy: 'low', fill: false },
      { kind: 'build', bars: 8, tracks: ['chord', 'drums'], energy: 'medium', fill: true },
      { kind: 'drop', bars: 16, tracks: ALL, energy: 'high', fill: false },
      { kind: 'break', bars: 8, tracks: ['chord', 'lead'], energy: 'low', fill: false },
      { kind: 'build', bars: 8, tracks: ['chord', 'drums', 'lead'], energy: 'medium', fill: true },
      { kind: 'drop', bars: 16, tracks: ALL, energy: 'high', fill: false },
      { kind: 'outro', bars: 4, tracks: ['chord'], energy: 'low', fill: false },
    ],
  },
  {
    name: 'Radio · 36 bars',
    sections: [
      { kind: 'intro', bars: 4, tracks: ['chord'], energy: 'low', fill: false },
      { kind: 'build', bars: 4, tracks: ['chord', 'drums'], energy: 'medium', fill: true },
      { kind: 'drop', bars: 8, tracks: ALL, energy: 'high', fill: false },
      { kind: 'break', bars: 4, tracks: ['chord', 'lead'], energy: 'low', fill: false },
      { kind: 'build', bars: 4, tracks: ['chord', 'drums', 'lead'], energy: 'medium', fill: true },
      { kind: 'drop', bars: 8, tracks: ALL, energy: 'high', fill: false },
      { kind: 'outro', bars: 4, tracks: ['chord'], energy: 'low', fill: false },
    ],
  },
  {
    name: 'Festival · 72 bars',
    sections: [
      { kind: 'intro', bars: 8, tracks: ['chord'], energy: 'low', fill: false },
      { kind: 'build', bars: 8, tracks: ['chord', 'drums'], energy: 'medium', fill: true },
      { kind: 'drop', bars: 16, tracks: ALL, energy: 'high', fill: false },
      { kind: 'break', bars: 8, tracks: ['chord', 'lead'], energy: 'low', fill: false },
      { kind: 'build', bars: 8, tracks: ['chord', 'drums', 'lead'], energy: 'medium', fill: true },
      { kind: 'drop', bars: 16, tracks: ALL, energy: 'high', fill: false },
      { kind: 'outro', bars: 8, tracks: ['chord'], energy: 'low', fill: false },
    ],
  },
];
