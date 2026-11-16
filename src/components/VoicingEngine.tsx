import { useMemo, useState } from 'react';
import { midiToNote, type ChordInfo } from '../utils/musicTheory';
import { Drawer } from './Drawer';

type VoicingStyle = 'close' | 'open' | 'drop2' | 'spread';

const STYLES: { id: VoicingStyle; label: string; description: string }[] = [
  { id: 'close', label: 'Close', description: 'Root-position close voicing' },
  { id: 'open', label: 'Open', description: 'Middle note lifted an octave' },
  { id: 'drop2', label: 'Drop 2', description: 'Second-highest note dropped an octave' },
  { id: 'spread', label: 'Spread', description: 'Alternate notes lifted an octave' },
];

function makeVoicing(chord: ChordInfo, style: VoicingStyle): ChordInfo {
  const base = [...chord.midiNotes].sort((a, b) => a - b);
  let notes = [...base];
  if (style === 'open' && notes.length >= 3) {
    notes = [...notes];
    notes[Math.floor(notes.length / 2)] += 12;
  } else if (style === 'drop2' && notes.length >= 3) {
    notes = [...notes];
    notes[notes.length - 2] -= 12;
  } else if (style === 'spread') {
    notes = notes.map((midi, index) => midi + (index % 2 === 1 ? 12 : 0));
  }
  notes = [...new Set(notes)].sort((a, b) => a - b);
  return {
    ...chord,
    midiNotes: notes,
    notes: notes.map(midi => midiToNote(midi).note),
    inversion: undefined,
  };
}

interface VoicingEngineProps {
  open: boolean;
  onClose: () => void;
  chord: ChordInfo | null;
  onApply: (chord: ChordInfo) => void;
  onPreview: (chord: ChordInfo) => void;
}

export function VoicingEngine({ open, onClose, chord, onApply, onPreview }: VoicingEngineProps) {
  const [style, setStyle] = useState<VoicingStyle>('close');
  const candidates = useMemo(() => (
    chord ? STYLES.map(item => ({ ...item, chord: makeVoicing(chord, item.id) })) : []
  ), [chord]);
  const chosen = candidates.find(item => item.id === style) ?? candidates[0];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Voicing engine"
      description={chord ? `Reshape ${chord.display} while keeping its harmony.` : 'Select a chord first.'}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-md border border-gray-700 px-3 text-xs text-gray-300 hover:border-gray-500">Cancel</button>
          <button
            type="button"
            disabled={!chosen}
            onClick={() => { if (chosen) { onApply(chosen.chord); onClose(); } }}
            className="h-9 rounded-md bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-40"
          >
            Apply voicing
          </button>
        </div>
      }
    >
      {!chord ? (
        <p className="text-xs text-gray-400">Select a chord in the progression to edit its voicing.</p>
      ) : (
        <div className="space-y-2">
          {candidates.map(candidate => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => { setStyle(candidate.id); onPreview(candidate.chord); }}
              aria-pressed={candidate.id === style}
              className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors ${
                candidate.id === style ? 'border-purple-400/70 bg-purple-500/10' : 'border-gray-800 bg-gray-900/50 hover:border-gray-600'
              }`}
            >
              <span className={`grid h-8 w-8 place-items-center rounded-md text-[11px] font-semibold ${candidate.id === style ? 'bg-purple-400 text-gray-950' : 'bg-gray-800 text-gray-400'}`}>
                {candidate.label.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-gray-100">{candidate.label}</span>
                <span className="block text-[11px] text-gray-400">{candidate.description}</span>
              </span>
              <span className="text-right text-[10px] tabular-nums text-gray-300">
                {candidate.chord.midiNotes.map(midi => midiToNote(midi).note).join(' ')}
              </span>
            </button>
          ))}
          <p className="pt-1 text-[11px] leading-relaxed text-gray-400">
            Voicings move the existing chord tones only; root and chord type stay unchanged. Use Audition to compare.
          </p>
        </div>
      )}
    </Drawer>
  );
}
