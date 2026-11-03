import type { Genre } from '../data/genres';

interface ProgressionSelectorProps {
  genre: Genre;
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function ProgressionSelector({ genre, selectedIndex, onSelect }: ProgressionSelectorProps) {
  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Progression Template</label>
      <div className="flex flex-col gap-1.5">
        {genre.progressions.map((prog, i) => (
          <button
            key={`${genre.id}-${i}`}
            onClick={() => onSelect(i)}
            className={`flex min-h-11 items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all border text-left ${
              selectedIndex === i
                ? 'border-purple-500 bg-purple-500/10 text-white'
                : 'border-gray-700/50 text-gray-300 hover:border-gray-600 hover:text-white'
            }`}
          >
            <span className="font-semibold min-w-[100px]">{prog.name}</span>
            <span className="text-xs text-gray-400">{prog.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
