import { useMemo, useState } from 'react';
import { getChordsInKey, getKeyNamesForScale, getRomanNumeral } from '../utils/musicTheory';
import { Drawer } from './Drawer';

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

interface KeyExplorerProps {
  open: boolean;
  onClose: () => void;
  keyName: string;
  scaleName: string;
  onApply: (keyName: string, scaleName: string) => void;
}

export function KeyExplorer({ open, onClose, keyName, scaleName, onApply }: KeyExplorerProps) {
  const [draftKey, setDraftKey] = useState(keyName);
  const [draftScale, setDraftScale] = useState(scaleName);

  const keyNames = getKeyNamesForScale(draftScale);
  const chords = useMemo(() => getChordsInKey(draftKey, draftScale), [draftKey, draftScale]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Key & scale explorer"
      description="Change tonality, inspect the diatonic chords and apply both at once."
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-md border border-gray-700 px-3 text-xs text-gray-300 hover:border-gray-500">Cancel</button>
          <button type="button" onClick={() => { onApply(draftKey, draftScale); onClose(); }} className="h-9 rounded-md bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-500">
            Apply key & scale
          </button>
        </div>
      }
    >
      <div>
        <p className="text-[10px] uppercase tracking-wide text-gray-400">Key</p>
        <div className="mt-1.5 grid grid-cols-6 gap-1 sm:grid-cols-12">
          {keyNames.map(note => (
            <button
              key={note}
              type="button"
              onClick={() => setDraftKey(note)}
              aria-pressed={draftKey === note}
              className={`h-9 rounded-md text-xs font-medium transition-colors ${
                draftKey === note ? 'bg-purple-500/25 text-purple-100 ring-1 ring-purple-400/60' : 'border border-gray-700 text-gray-300 hover:border-gray-500'
              }`}
            >
              {note}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-wide text-gray-400">Scale</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {SCALES.map(scale => (
            <button
              key={scale.id}
              type="button"
              onClick={() => setDraftScale(scale.id)}
              aria-pressed={draftScale === scale.id}
              className={`h-8 rounded-md px-2 text-[11px] font-medium transition-colors ${
                draftScale === scale.id ? 'bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/60' : 'border border-gray-700 text-gray-300 hover:border-gray-500'
              }`}
            >
              {scale.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-gray-800 bg-gray-900/50 p-2">
        <p className="text-[10px] uppercase tracking-wide text-gray-400">Diatonic chords · {draftKey} {SCALES.find(scale => scale.id === draftScale)?.name}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {chords.map((chord, index) => (
            <span key={`${chord.display}-${index}`} className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-center">
              <span className="block text-xs font-semibold text-gray-100">{chord.display}</span>
              <span className="block text-[9px] text-gray-400">{getRomanNumeral(index, draftScale)}</span>
            </span>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
        Changing key/scale keeps the current progression if it is custom; otherwise the genre template follows the new tonality.
      </p>
    </Drawer>
  );
}
