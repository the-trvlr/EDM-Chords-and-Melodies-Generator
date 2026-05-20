import { useEffect, useRef } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow';
import type { ChordInfo } from '../utils/musicTheory';
import { midiToNote } from '../utils/musicTheory';

interface StaffNotationProps {
  progression: ChordInfo[];
  activeIndex: number;
  isPlaying: boolean;
}

function midiToVexKey(midi: number): { key: string; accidental: string | null } {
  const { note, octave } = midiToNote(midi);
  const map: Record<string, { letter: string; acc: string | null }> = {
    'C':  { letter: 'c',  acc: null },
    'C#': { letter: 'c',  acc: '#' },
    'D':  { letter: 'd',  acc: null },
    'D#': { letter: 'd',  acc: '#' },
    'E':  { letter: 'e',  acc: null },
    'F':  { letter: 'f',  acc: null },
    'F#': { letter: 'f',  acc: '#' },
    'G':  { letter: 'g',  acc: null },
    'G#': { letter: 'g',  acc: '#' },
    'A':  { letter: 'a',  acc: null },
    'A#': { letter: 'a',  acc: '#' },
    'B':  { letter: 'b',  acc: null },
  };

  const entry = map[note] || { letter: 'c', acc: null };
  return { key: `${entry.letter}/${octave}`, accidental: entry.acc };
}

export function StaffNotation({ progression, activeIndex, isPlaying }: StaffNotationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || progression.length === 0) return;

    const container = containerRef.current;
    container.innerHTML = '';

    const width = Math.max(600, progression.length * 150 + 80);
    const renderer = new Renderer(container, Renderer.Backends.SVG);
    renderer.resize(width, 160);
    const context = renderer.getContext();

    const stave = new Stave(10, 20, width - 20);
    stave.addClef('treble');
    stave.setContext(context).draw();

    try {
      const staveNotes = progression.map((chord, chordIdx) => {
        const vexKeys = chord.midiNotes.map(midi => midiToVexKey(midi));
        const keys = vexKeys.map(v => v.key);

        const sn = new StaveNote({
          keys,
          duration: 'w',
        });

        vexKeys.forEach((v, i) => {
          if (v.accidental) {
            sn.addModifier(new Accidental(v.accidental), i);
          }
        });

        if (isPlaying && chordIdx === activeIndex) {
          sn.setStyle({ fillStyle: '#a855f7', strokeStyle: '#a855f7' });
        }

        return sn;
      });

      const voice = new Voice({
        numBeats: progression.length * 4,
        beatValue: 4,
      });
      voice.setStrict(false);
      voice.addTickables(staveNotes);

      new Formatter().joinVoices([voice]).format([voice], width - 80);
      voice.draw(context, stave);
    } catch {
      // VexFlow may throw on edge cases
    }
  }, [progression, activeIndex, isPlaying]);

  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Staff Notation</label>
      <div
        ref={containerRef}
        className="overflow-x-auto rounded-xl border border-gray-700/50 bg-white/5 p-2"
        style={{ minHeight: '160px' }}
      />
    </div>
  );
}
