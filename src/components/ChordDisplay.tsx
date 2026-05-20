import type { ChordInfo } from '../utils/musicTheory';
import { getRomanNumeral } from '../utils/musicTheory';

interface ChordDisplayProps {
  progression: ChordInfo[];
  activeIndex: number;
  selectedIndex: number | null;
  scaleName: string;
  scaleChords: ChordInfo[];
  onChordClick: (index: number) => void;
  onPreviewChord: (chord: ChordInfo) => void;
  isPlaying: boolean;
}

export function ChordDisplay({
  progression,
  activeIndex,
  selectedIndex,
  scaleName,
  scaleChords,
  onChordClick,
  onPreviewChord,
  isPlaying,
}: ChordDisplayProps) {
  const getDegreeIndex = (chord: ChordInfo): number => {
    return scaleChords.findIndex(sc => sc.root === chord.root && sc.type.name === chord.type.name);
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        Chord Progression
      </label>
      <div className="flex gap-3 flex-wrap">
        {progression.map((chord, i) => {
          const degreeIdx = getDegreeIndex(chord);
          const roman = degreeIdx >= 0 ? getRomanNumeral(degreeIdx, scaleName) : '?';
          const isActive = isPlaying && activeIndex === i;
          const isSelected = selectedIndex === i;

          return (
            <button
              key={i}
              onClick={() => {
                onChordClick(i);
                onPreviewChord(chord);
              }}
              className={`relative flex flex-col items-center gap-1 px-5 py-4 rounded-xl transition-all border min-w-[90px] ${
                isActive
                  ? 'border-green-400 bg-green-500/20 text-green-300 shadow-lg shadow-green-500/20 scale-110'
                  : isSelected
                  ? 'border-purple-400 bg-purple-500/15 text-purple-200 shadow-md'
                  : 'border-gray-700 bg-gray-800/60 text-gray-200 hover:border-gray-500 hover:bg-gray-700/60'
              }`}
            >
              <span className="text-lg font-bold">{chord.display}</span>
              <span className="text-xs opacity-50">{roman}</span>
              {isActive && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {selectedIndex !== null && progression[selectedIndex] && (
        <ChordDetail chord={progression[selectedIndex]} />
      )}
    </div>
  );
}

function ChordDetail({ chord }: { chord: ChordInfo }) {
  return (
    <div className="mt-2 p-4 rounded-xl bg-gray-800/50 border border-gray-700/50">
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <span className="text-xs text-gray-500 uppercase">Chord</span>
          <p className="text-lg font-bold text-white">{chord.display}</p>
        </div>
        <div>
          <span className="text-xs text-gray-500 uppercase">Type</span>
          <p className="text-sm text-gray-300">{chord.type.name}</p>
        </div>
        <div>
          <span className="text-xs text-gray-500 uppercase">Notes</span>
          <div className="flex gap-1.5 mt-0.5">
            {chord.notes.map((note, i) => (
              <span key={i} className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-sm font-mono">
                {note}
              </span>
            ))}
          </div>
        </div>
        <div>
          <span className="text-xs text-gray-500 uppercase">Intervals</span>
          <p className="text-sm text-gray-400 font-mono">{chord.type.intervals.join(' - ')}</p>
        </div>
      </div>
    </div>
  );
}
