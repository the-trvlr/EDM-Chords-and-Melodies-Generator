import { getKeyNamesForScale } from '../utils/musicTheory';

interface KeySelectorProps {
  selectedKey: string;
  selectedScale: string;
  onKeyChange: (key: string) => void;
  onScaleChange: (scale: string) => void;
}

const SCALES = [
  { id: 'major', name: 'Major' },
  { id: 'minor', name: 'Minor (Natural)' },
  { id: 'dorian', name: 'Dorian' },
  { id: 'phrygian', name: 'Phrygian' },
  { id: 'lydian', name: 'Lydian' },
  { id: 'mixolydian', name: 'Mixolydian' },
  { id: 'locrian', name: 'Locrian' },
  { id: 'harmonicMinor', name: 'Harmonic Minor' },
  { id: 'melodicMinor', name: 'Melodic Minor' },
];

export function KeySelector({ selectedKey, selectedScale, onKeyChange, onScaleChange }: KeySelectorProps) {
  const keyNames = getKeyNamesForScale(selectedScale);
  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Key &amp; Scale</label>
      <div className="flex gap-2">
        <select
          value={selectedKey}
          onChange={e => onKeyChange(e.target.value)}
          className="flex-1 rounded-lg bg-gray-800 px-3 py-2 text-sm text-white border border-gray-700 focus:border-purple-500 focus:outline-none transition-colors"
        >
          {keyNames.map(note => (
            <option key={note} value={note}>{note}</option>
          ))}
        </select>
        <select
          value={selectedScale}
          onChange={e => onScaleChange(e.target.value)}
          className="flex-1 rounded-lg bg-gray-800 px-3 py-2 text-sm text-white border border-gray-700 focus:border-purple-500 focus:outline-none transition-colors"
        >
          {SCALES.map(scale => (
            <option key={scale.id} value={scale.id}>{scale.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
