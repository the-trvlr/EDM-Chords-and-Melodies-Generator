import { GENRES, type Genre } from '../data/genres';
import { getKeyNamesForScale, type ChordComplexity } from '../utils/musicTheory';
import type { SoundVariant } from '../utils/sampleLibrary';

const SCALES = [
  { id: 'major', name: 'Major' },
  { id: 'minor', name: 'Minor' },
  { id: 'dorian', name: 'Dorian' },
  { id: 'phrygian', name: 'Phrygian' },
  { id: 'lydian', name: 'Lydian' },
  { id: 'mixolydian', name: 'Mixolydian' },
  { id: 'locrian', name: 'Locrian' },
  { id: 'harmonicMinor', name: 'Harmonic Minor' },
  { id: 'melodicMinor', name: 'Melodic Minor' },
];

const COMPLEXITY: { id: ChordComplexity; name: string }[] = [
  { id: 'basic', name: 'Triads' },
  { id: '7ths', name: '7ths' },
  { id: '9ths', name: '9ths' },
  { id: 'jazzy', name: 'Jazzy' },
];

interface ProjectBarProps {
  selectedKey: string;
  selectedScale: string;
  selectedGenre: Genre;
  chordComplexity: ChordComplexity;
  soundVariant: SoundVariant;
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onSoundVariantChange: (variant: SoundVariant) => void;
  onKeyChange: (key: string) => void;
  onScaleChange: (scale: string) => void;
  onGenreChange: (genre: Genre) => void;
  onComplexityChange: (complexity: ChordComplexity) => void;
}

export function ProjectBar({
  selectedKey,
  selectedScale,
  selectedGenre,
  chordComplexity,
  soundVariant,
  onSoundVariantChange,
  projectName,
  onProjectNameChange,
  onKeyChange,
  onScaleChange,
  onGenreChange,
  onComplexityChange,
}: ProjectBarProps) {
  const keyNames = getKeyNamesForScale(selectedScale);

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-800 bg-gray-900/60 px-2 py-1.5">
      <span className="mr-1 hidden text-[10px] font-semibold uppercase tracking-wider text-gray-500 sm:inline">Project</span>
      <input
        value={projectName}
        onChange={event => onProjectNameChange(event.target.value.slice(0, 80))}
        aria-label="Project name"
        placeholder="Untitled project"
        className="h-9 w-32 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-100 placeholder:text-gray-500 focus:border-purple-500 focus:outline-none sm:h-8"
      />

      <label className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wide text-gray-400">Key</span>
        <select
          value={selectedKey}
          onChange={event => onKeyChange(event.target.value)}
          aria-label="Project key"
          className="h-9 rounded-md border border-gray-700 bg-gray-900 px-1.5 text-xs text-gray-100 focus:border-purple-500 focus:outline-none sm:h-8"
        >
          {keyNames.map(note => <option key={note} value={note}>{note}</option>)}
        </select>
      </label>

      <label className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wide text-gray-400">Scale</span>
        <select
          value={selectedScale}
          onChange={event => onScaleChange(event.target.value)}
          aria-label="Project scale"
          className="h-9 rounded-md border border-gray-700 bg-gray-900 px-1.5 text-xs text-gray-100 focus:border-purple-500 focus:outline-none sm:h-8"
        >
          {SCALES.map(scale => <option key={scale.id} value={scale.id}>{scale.name}</option>)}
        </select>
      </label>

      <label className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wide text-gray-400">Genre</span>
        <select
          value={selectedGenre.id}
          onChange={event => {
            const genre = GENRES.find(item => item.id === event.target.value);
            if (genre) onGenreChange(genre);
          }}
          aria-label="Project genre"
          className="h-9 max-w-[8.5rem] rounded-md border border-gray-700 bg-gray-900 px-1.5 text-xs text-gray-100 focus:border-purple-500 focus:outline-none sm:h-8"
        >
          {GENRES.map(genre => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
        </select>
      </label>

      <label className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wide text-gray-400">Chords</span>
        <select
          value={chordComplexity}
          onChange={event => onComplexityChange(event.target.value as ChordComplexity)}
          aria-label="Chord complexity"
          className="h-9 rounded-md border border-gray-700 bg-gray-900 px-1.5 text-xs text-gray-100 focus:border-purple-500 focus:outline-none sm:h-8"
        >
          {COMPLEXITY.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </label>

      <label className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wide text-gray-400">Sound</span>
        <select
          value={soundVariant}
          onChange={event => onSoundVariantChange(event.target.value as SoundVariant)}
          aria-label="Sound character"
          className="h-9 rounded-md border border-gray-700 bg-gray-900 px-1.5 text-xs text-gray-100 focus:border-purple-500 focus:outline-none sm:h-8"
        >
          <option value="edm">EDM</option>
          <option value="acoustic">Acoustic</option>
        </select>
      </label>

      <span className="hidden text-[10px] text-gray-500 lg:inline">
        {selectedGenre.bpmRange[0]}–{selectedGenre.bpmRange[1]} BPM
      </span>
    </div>
  );
}
