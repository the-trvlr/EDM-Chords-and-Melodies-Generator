import { describe, expect, it } from 'vitest';
import { ARRANGEMENT_TEMPLATES } from '../../data/arrangementTemplates';

describe('arrangement templates', () => {
  it('match their advertised bar counts', () => {
    for (const template of ARRANGEMENT_TEMPLATES) {
      const total = template.sections.reduce((sum, section) => sum + section.bars, 0);
      const advertised = Number(template.name.match(/(\d+) bars/)?.[1]);
      expect(total, template.name).toBe(advertised);
    }
  });

  it('contain two drops with every track enabled', () => {
    for (const template of ARRANGEMENT_TEMPLATES) {
      const drops = template.sections.filter(section => section.kind === 'drop');
      expect(drops.length, template.name).toBeGreaterThanOrEqual(2);
      for (const drop of drops) {
        expect(drop.tracks, template.name).toEqual(['chord', 'bass', 'lead', 'drums']);
        expect(drop.energy).toBe('high');
      }
    }
  });

  it('introduce drums only after an intro', () => {
    for (const template of ARRANGEMENT_TEMPLATES) {
      const intro = template.sections[0];
      expect(intro.kind).toBe('intro');
      expect(intro.tracks).not.toContain('drums');
      const firstDrums = template.sections.findIndex(section => section.tracks.includes('drums'));
      expect(firstDrums, template.name).toBeGreaterThan(0);
      expect(template.sections[firstDrums].kind).toBe('build');
    }
  });

  it('use fills on builds and no fills on drops', () => {
    for (const template of ARRANGEMENT_TEMPLATES) {
      for (const section of template.sections) {
        if (section.kind === 'drop') expect(section.fill).toBe(false);
        if (section.kind === 'build') expect(section.fill).toBe(true);
      }
    }
  });
});
