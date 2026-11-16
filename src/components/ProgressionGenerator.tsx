import { useMemo, useState } from 'react';
import type { ChordComplexity, ChordInfo } from '../utils/musicTheory';
import { generateProgressions, type GeneratedProgression, type ProgressionMood } from '../utils/progressionGenerator';
import { Drawer } from './Drawer';

interface ProgressionGeneratorProps {
  open: boolean;
  onClose: () => void;
  keyName: string;
  scaleName: string;
  complexity: ChordComplexity;
  onApply: (chords: ChordInfo[]) => void;
  onPreview: (chord: ChordInfo) => void;
}

const MOODS: { id: ProgressionMood; label: string }[] = [
  { id: 'uplifting', label: 'Uplifting' },
  { id: 'dark', label: 'Dark' },
  { id: 'deep', label: 'Deep' },
  { id: 'energetic', label: 'Energetic' },
  { id: 'emotional', label: 'Emotional' },
];

export function ProgressionGenerator({ open, onClose, keyName, scaleName, complexity, onApply, onPreview }: ProgressionGeneratorProps) {
  const [mood, setMood] = useState<ProgressionMood>('uplifting');
  const [bars, setBars] = useState<4 | 8>(4);
  const [voiceLead, setVoiceLead] = useState(true);
  const [selected, setSelected] = useState(0);
  const [seed, setSeed] = useState(0);

  const candidates = useMemo(
    () => generateProgressions(keyName, scaleName, complexity, { mood, bars, voiceLead, seed }),
    [keyName, scaleName, complexity, mood, bars, voiceLead, seed],
  );

  const chosen = candidates[selected] ?? candidates[0];
  const apply = () => {
    if (chosen) onApply(chosen.chords);
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Generate progression"
      description="Pick a mood and length; audition three voice-led options, then apply one."
      footer={
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setSeed(value => value + 1)} className="h-9 rounded-md border border-gray-700 px-3 text-xs text-gray-300 hover:border-gray-500">
            Regenerate
          </button>
          <button type="button" onClick={apply} disabled={!chosen} className="h-9 rounded-md bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-40">
            Apply progression
          </button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-gray-400">Mood</span>
          <select value={mood} onChange={event => setMood(event.target.value as ProgressionMood)} aria-label="Progression mood" className="h-10 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-100">
            {MOODS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-gray-400">Length</span>
          <select value={bars} onChange={event => setBars(Number(event.target.value) as 4 | 8)} aria-label="Progression length" className="h-10 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-100">
            <option value={4}>4 bars</option>
            <option value={8}>8 bars</option>
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-xs text-gray-300">
          <input type="checkbox" checked={voiceLead} onChange={event => setVoiceLead(event.target.checked)} className="accent-purple-500" />
          Voice leading
        </label>
      </div>

      <div className="mt-4 space-y-2">
        {candidates.map((candidate: GeneratedProgression, index) => {
          const active = index === selected;
          return (
            <div key={`${candidate.id}-${seed}`} className={`rounded-xl border p-2 transition-colors ${active ? 'border-purple-400/70 bg-purple-500/10' : 'border-gray-800 bg-gray-900/50'}`}>
              <button type="button" onClick={() => setSelected(index)} className="flex w-full items-center gap-2 text-left" aria-pressed={active}>
                <span className={`grid h-6 w-6 place-items-center rounded-md text-[10px] font-semibold ${active ? 'bg-purple-400 text-gray-950' : 'bg-gray-800 text-gray-400'}`}>
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-gray-100">{candidate.name}</span>
                  <span className="block text-[11px] text-gray-400">{candidate.description}</span>
                </span>
              </button>
              <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
                {candidate.chords.map((chord, chordIndex) => (
                  <button
                    key={`${chord.display}-${chordIndex}`}
                    type="button"
                    onClick={() => onPreview(chord)}
                    className="min-w-[54px] shrink-0 rounded-md border border-gray-700 bg-gray-900 px-1.5 py-1 text-center hover:border-purple-400"
                    title={`Audition ${chord.display}`}
                  >
                    <span className="block text-[11px] font-semibold text-gray-100">{chord.display}</span>
                    <span className="block text-[9px] text-gray-400">{candidate.roman[chordIndex]}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
        Generated inside the current key and scale, using the selected chord complexity. Apply replaces the progression and is one Undo step.
      </p>
    </Drawer>
  );
}
