import { SYNTH_PRESETS } from '../utils/audioEngine';
import type { SynthPresetId } from '../utils/audioEngine';

interface SynthSelectorProps {
  selectedSynth: SynthPresetId;
  onSynthChange: (synth: SynthPresetId) => void;
}

export function SynthSelector({ selectedSynth, onSynthChange }: SynthSelectorProps) {
  const simple = SYNTH_PRESETS.filter(s => s.category === 'simple');
  const genre = SYNTH_PRESETS.filter(s => s.category === 'genre');

  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Synth Sound</label>
      <div className="flex flex-col gap-2">
        <span className="text-xs text-gray-500">Simple</span>
        <div className="flex gap-2 flex-wrap">
          {simple.map(preset => (
            <button
              key={preset.id}
              onClick={() => onSynthChange(preset.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                selectedSynth === preset.id
                  ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
              title={preset.description}
            >
              {preset.name}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-500">Genre</span>
        <div className="flex gap-2 flex-wrap">
          {genre.map(preset => (
            <button
              key={preset.id}
              onClick={() => onSynthChange(preset.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                selectedSynth === preset.id
                  ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
              title={preset.description}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
