import { useState } from 'react';
import { Drawer } from './Drawer';
import type { TrackGroove } from '../types';
import type { TrackId } from '../utils/schedule';

const TRACKS: { id: TrackId; label: string }[] = [
  { id: 'chord', label: 'Chords' },
  { id: 'bass', label: 'Bass' },
  { id: 'lead', label: 'Lead' },
  { id: 'drums', label: 'Drums' },
];

interface GrooveEngineProps {
  open: boolean;
  onClose: () => void;
  globalSwing: number;
  groove?: TrackGroove;
  onApply: (groove: TrackGroove) => void;
}

export function GrooveEngine({ open, onClose, globalSwing, groove, onApply }: GrooveEngineProps) {
  const [draft, setDraft] = useState<TrackGroove>(() => ({
    chord: groove?.chord ?? globalSwing,
    bass: groove?.bass ?? globalSwing,
    lead: groove?.lead ?? globalSwing,
    drums: groove?.drums ?? globalSwing,
  }));

  const percent = (value: number) => Math.round(value * 100);
  const set = (id: TrackId, value: number) => setDraft(current => ({ ...current, [id]: value }));
  const reset = () => setDraft({ chord: globalSwing, bass: globalSwing, lead: globalSwing, drums: globalSwing });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Groove engine"
      description="Fine-tune swing per track. Undefined tracks follow the global Swing control."
      footer={
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={reset} className="h-9 rounded-md border border-gray-700 px-3 text-xs text-gray-300 hover:border-gray-500">Reset to global</button>
          <button type="button" onClick={() => { onApply(draft); onClose(); }} className="h-9 rounded-md bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-500">Apply groove</button>
        </div>
      }
    >
      <div className="space-y-3">
        {TRACKS.map(track => (
          <label key={track.id} className="block rounded-lg border border-gray-800 bg-gray-900/50 p-2">
            <span className="flex items-center justify-between text-xs text-gray-200">
              <span>{track.label}</span>
              <span className="tabular-nums text-gray-400">{percent(draft[track.id])}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={60}
              step={1}
              value={percent(draft[track.id])}
              onChange={event => set(track.id, Number(event.target.value) / 100)}
              aria-label={`${track.label} swing`}
              className="mt-2 w-full accent-purple-500"
            />
          </label>
        ))}
        <div className="flex flex-wrap gap-1">
          {[
            { label: 'Tight', value: 0 },
            { label: 'Pocket', value: 0.08 },
            { label: 'Loose', value: 0.18 },
            { label: 'Shuffle', value: 0.3 },
          ].map(preset => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setDraft({ chord: preset.value, bass: preset.value, lead: preset.value, drums: preset.value })}
              className="h-8 rounded-md border border-gray-700 px-2 text-[11px] text-gray-300 hover:border-gray-500"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-gray-400">
          Swing delays odd sixteenths. Use a tighter grid on drums and more swing on chords for a human pocket; keep the kick steady.
        </p>
      </div>
    </Drawer>
  );
}
