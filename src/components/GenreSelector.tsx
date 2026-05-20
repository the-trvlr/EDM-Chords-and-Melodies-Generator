import { GENRES } from '../data/genres';
import type { Genre } from '../data/genres';

interface GenreSelectorProps {
  selectedGenre: Genre;
  onGenreChange: (genre: Genre) => void;
}

export function GenreSelector({ selectedGenre, onGenreChange }: GenreSelectorProps) {
  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Genre</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {GENRES.map(genre => (
          <button
            key={genre.id}
            onClick={() => onGenreChange(genre)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
              selectedGenre.id === genre.id
                ? 'border-transparent text-white shadow-lg scale-105'
                : 'border-gray-700 text-gray-300 hover:border-gray-500 bg-gray-800/50'
            }`}
            style={selectedGenre.id === genre.id ? { backgroundColor: genre.color } : undefined}
          >
            {genre.name}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">{selectedGenre.description} · {selectedGenre.bpmRange[0]}-{selectedGenre.bpmRange[1]} BPM</p>
    </div>
  );
}
