import { useMemo } from 'react';
import type { ChordInfo } from '../utils/musicTheory';

interface PianoKeyboardProps {
  chord: ChordInfo | null;
  startOctave?: number;
  numOctaves?: number;
}

const WHITE_KEYS = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
const BLACK_KEY_MAP: Record<number, { offset: number; note: number }> = {
  0: { offset: 0.6, note: 1 },   // C#
  1: { offset: 1.6, note: 3 },   // D#
  3: { offset: 3.6, note: 6 },   // F#
  4: { offset: 4.6, note: 8 },   // G#
  5: { offset: 5.6, note: 10 },  // A#
};

const NOTE_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function PianoKeyboard({ chord, startOctave = 3, numOctaves = 3 }: PianoKeyboardProps) {
  const highlightedNotes = useMemo(() => {
    if (!chord) return new Set<number>();
    return new Set(chord.midiNotes);
  }, [chord]);

  const highlightedNoteClasses = useMemo(() => {
    if (!chord) return new Set<number>();
    return new Set(chord.midiNotes.map(m => m % 12));
  }, [chord]);

  const whiteKeyWidth = 28;
  const blackKeyWidth = 18;
  const whiteKeyHeight = 100;
  const blackKeyHeight = 62;
  const totalWhiteKeys = numOctaves * 7;
  const svgWidth = totalWhiteKeys * whiteKeyWidth;

  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Piano Keyboard</label>
      <div className="overflow-x-auto rounded-xl border border-gray-700/50 bg-gray-900 p-3">
        <svg
          viewBox={`0 0 ${svgWidth} ${whiteKeyHeight + 20}`}
          className="w-full max-w-full"
          style={{ minWidth: '400px' }}
        >
          {Array.from({ length: numOctaves }, (_, octaveIdx) => {
            const octave = startOctave + octaveIdx;
            return WHITE_KEYS.map((noteInOctave, whiteIdx) => {
              const midi = (octave + 1) * 12 + noteInOctave;
              const x = (octaveIdx * 7 + whiteIdx) * whiteKeyWidth;
              const isHighlighted = highlightedNotes.has(midi);
              const isInChordClass = highlightedNoteClasses.has(noteInOctave);

              return (
                <g key={`white-${midi}`}>
                  <rect
                    x={x}
                    y={0}
                    width={whiteKeyWidth - 1}
                    height={whiteKeyHeight}
                    rx={3}
                    fill={isHighlighted ? '#a855f7' : isInChordClass ? '#7c3aed44' : '#f8f8f8'}
                    stroke="#444"
                    strokeWidth={0.5}
                  />
                  {isHighlighted && (
                    <text
                      x={x + whiteKeyWidth / 2}
                      y={whiteKeyHeight - 8}
                      textAnchor="middle"
                      fill="white"
                      fontSize="8"
                      fontWeight="bold"
                    >
                      {NOTE_LABELS[noteInOctave]}
                    </text>
                  )}
                  {noteInOctave === 0 && (
                    <text
                      x={x + whiteKeyWidth / 2}
                      y={whiteKeyHeight + 14}
                      textAnchor="middle"
                      fill="#666"
                      fontSize="9"
                    >
                      C{octave}
                    </text>
                  )}
                </g>
              );
            });
          })}

          {Array.from({ length: numOctaves }, (_, octaveIdx) => {
            const octave = startOctave + octaveIdx;
            return Object.entries(BLACK_KEY_MAP).map(([whiteIdxStr, { offset, note }]) => {
              const midi = (octave + 1) * 12 + note;
              const x = (octaveIdx * 7 + offset) * whiteKeyWidth - blackKeyWidth / 2 + whiteKeyWidth / 2;
              const isHighlighted = highlightedNotes.has(midi);
              const isInChordClass = highlightedNoteClasses.has(note);

              return (
                <g key={`black-${midi}-${whiteIdxStr}`}>
                  <rect
                    x={x}
                    y={0}
                    width={blackKeyWidth}
                    height={blackKeyHeight}
                    rx={2}
                    fill={isHighlighted ? '#c084fc' : isInChordClass ? '#4c1d95' : '#1a1a2e'}
                    stroke="#333"
                    strokeWidth={0.5}
                  />
                  {isHighlighted && (
                    <text
                      x={x + blackKeyWidth / 2}
                      y={blackKeyHeight - 6}
                      textAnchor="middle"
                      fill="white"
                      fontSize="7"
                      fontWeight="bold"
                    >
                      {NOTE_LABELS[note]}
                    </text>
                  )}
                </g>
              );
            });
          })}
        </svg>
      </div>
    </div>
  );
}
