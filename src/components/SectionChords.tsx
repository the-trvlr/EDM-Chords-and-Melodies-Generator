import { useState } from 'react';
import { Drawer } from './Drawer';
import type { ChordInfo } from '../utils/musicTheory';

interface SectionChordsProps {
  open: boolean;
  onClose: () => void;
  sectionLabel: string;
  chords: ChordInfo[];
  availableChords: ChordInfo[];
  onApply: (chords: ChordInfo[]) => void;
}

export function SectionChords({ open, onClose, sectionLabel, chords, availableChords, onApply }: SectionChordsProps) {
  const [draft, setDraft] = useState<ChordInfo[]>(() => chords.map(chord => ({ ...chord, midiNotes: [...chord.midiNotes], notes: [...chord.notes] })));
  const [addIndex, setAddIndex] = useState(0);

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft];
    [next[index], next[target]] = [next[target], next[index]];
    setDraft(next);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Section chords"
      description={`${sectionLabel} · a separate chord clip for this section.`}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-md border border-gray-700 px-3 text-xs text-gray-300 hover:border-gray-500">Cancel</button>
          <button type="button" onClick={() => { onApply(draft); onClose(); }} className="h-9 rounded-md bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-500">Apply section chords</button>
        </div>
      }
    >
      <div className="space-y-1.5">
        {draft.map((chord, index) => (
          <div key={`${chord.display}-${index}`} className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/50 p-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-100">{chord.display}</span>
            <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${chord.display} earlier`} className="h-7 w-7 rounded border border-gray-700 text-xs text-gray-300 disabled:opacity-30">↑</button>
            <button type="button" onClick={() => move(index, 1)} disabled={index === draft.length - 1} aria-label={`Move ${chord.display} later`} className="h-7 w-7 rounded border border-gray-700 text-xs text-gray-300 disabled:opacity-30">↓</button>
            <button type="button" onClick={() => setDraft(current => current.filter((_, i) => i !== index))} disabled={draft.length <= 1} aria-label={`Remove ${chord.display}`} className="h-7 rounded border border-rose-700/50 px-2 text-[10px] text-rose-300 disabled:opacity-30">Remove</button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <select
          value={addIndex}
          onChange={event => setAddIndex(Number(event.target.value))}
          aria-label="Chord to add to section"
          className="h-9 min-w-0 flex-1 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-200"
        >
          {availableChords.map((chord, index) => <option key={`${chord.display}-${index}`} value={index}>{chord.display}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setDraft(current => [...current, availableChords[addIndex]].filter(Boolean))}
          className="h-9 rounded-md border border-gray-700 px-3 text-xs text-gray-200 hover:border-purple-500"
        >
          Add chord
        </button>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
        This clip replaces the section’s chord timeline. The rhythm and chord complexity still come from the track settings.
      </p>
    </Drawer>
  );
}
