import type { RhythmPattern, Genre } from '../data/genres';

interface RhythmSelectorProps {
  genre: Genre;
  selectedRhythm: RhythmPattern;
  onRhythmChange: (rhythm: RhythmPattern) => void;
}

export function RhythmSelector({ genre, selectedRhythm, onRhythmChange }: RhythmSelectorProps) {
  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Rhythm Pattern</label>
      <div className="flex flex-col gap-2">
        {genre.rhythmPatterns.map((rhythm, i) => (
          <button
            key={`${genre.id}-rhythm-${i}`}
            onClick={() => onRhythmChange(rhythm)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all border text-left ${
              selectedRhythm.name === rhythm.name
                ? 'border-purple-500 bg-purple-500/10 text-white'
                : 'border-gray-700/50 text-gray-400 hover:border-gray-600 hover:text-gray-200'
            }`}
          >
            <span className="font-semibold min-w-[80px]">{rhythm.name}</span>
            <div className="flex gap-0.5">
              {rhythm.pattern.map((hit, j) => (
                <div
                  key={j}
                  className={`w-3 h-3 rounded-sm transition-colors ${
                    hit ? 'bg-purple-400' : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs opacity-40 ml-auto">{rhythm.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
