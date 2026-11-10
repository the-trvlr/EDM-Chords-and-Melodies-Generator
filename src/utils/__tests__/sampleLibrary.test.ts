import { describe, expect, it } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { sampleFor } from '../sampleLibrary';

describe('sample library', () => {
  it('uses samples for acoustic instruments in EDM mode and synths for electronic ones', () => {
    expect(sampleFor('piano', 'edm')).toBe('piano');
    expect(sampleFor('organ', 'edm')).toBe('organ');
    expect(sampleFor('pluck', 'edm')).toBe('guitar');
    expect(sampleFor('supersaw', 'edm')).toBeNull();
    expect(sampleFor('pad', 'edm')).toBeNull();
  });

  it('uses the acoustic sample map for every preset in acoustic mode', () => {
    expect(sampleFor('pad', 'acoustic')).toBe('harmonium');
    expect(sampleFor('supersaw', 'acoustic')).toBe('cello');
    expect(sampleFor('dark', 'acoustic')).toBe('cello');
    expect(sampleFor('bell', 'acoustic')).toBe('xylophone');
  });

  it('ships the referenced sample files locally', () => {
    const root = join(process.cwd(), 'public', 'samples');
    const files = [
      'piano/C2.mp3', 'piano/C4.mp3', 'piano/C7.mp3',
      'organ/C2.mp3', 'organ/C6.mp3',
      'guitar-nylon/A2.mp3', 'guitar-nylon/Cs4.mp3',
      'bass-electric/As1.mp3', 'bass-electric/E3.mp3',
      'harmonium/C4.mp3', 'cello/C4.mp3', 'xylophone/C6.mp3',
    ];
    for (const file of files) {
      const path = join(root, file);
      expect(existsSync(path), file).toBe(true);
      expect(statSync(path).size, file).toBeGreaterThan(1000);
    }
  });
});
