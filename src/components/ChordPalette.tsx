import type { ChordInfo } from '../utils/musicTheory';
import { getRomanNumeral } from '../utils/musicTheory';

interface ChordPaletteProps {
  availableChords: ChordInfo[];
  progression: ChordInfo[];
  scaleName: string;
  onAddChord: (chord: ChordInfo) => void;
  onRemoveChord: (index: number) => void;
  onPreviewChord: (chord: ChordInfo) => void;
}

export function ChordPalette({
  availableChords,
  progression,
  scaleName,
  onAddChord,
  onRemoveChord,
  onPreviewChord,
}: ChordPaletteProps) {
  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        Edit Progression
      </label>

      <div className="flex flex-col gap-3">
        <div>
          <span className="text-xs text-gray-500 mb-1 block">Current sequence (click to remove)</span>
          <div className="flex gap-2 flex-wrap min-h-[44px] p-2 rounded-lg border border-gray-700/50 bg-gray-800/30">
            {progression.length === 0 ? (
              <span className="text-xs text-gray-600 self-center">Add chords from the palette below</span>
            ) : (
              progression.map((chord, i) => (
                <button
                  key={i}
                  onClick={() => onRemoveChord(i)}
                  className="group px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-300 transition-all"
                  title="Click to remove"
                >
                  <span className="group-hover:hidden">{chord.display}</span>
                  <span className="hidden group-hover:inline">✕ {chord.display}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div>
          <span className="text-xs text-gray-500 mb-1 block">Available chords in key (click to add)</span>
          <div className="flex gap-2 flex-wrap">
            {availableChords.map((chord, i) => (
              <button
                key={i}
                onClick={() => {
                  onAddChord(chord);
                  onPreviewChord(chord);
                }}
                className="flex flex-col items-center px-3 py-2 rounded-lg text-xs border border-gray-700 bg-gray-800/50 text-gray-300 hover:border-cyan-500 hover:text-cyan-300 transition-all"
              >
                <span className="font-semibold">{chord.display}</span>
                <span className="text-[10px] opacity-40">{getRomanNumeral(i, scaleName)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
