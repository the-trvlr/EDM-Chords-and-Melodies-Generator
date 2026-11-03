import { useState } from 'react';
import type { ChordInfo } from '../utils/musicTheory';
import { getRomanNumeral } from '../utils/musicTheory';

interface ChordPaletteProps {
  availableChords: ChordInfo[];
  progression: ChordInfo[];
  scaleName: string;
  onAddChord: (chord: ChordInfo) => void;
  onRemoveChord: (index: number) => void;
  onPreviewChord: (chord: ChordInfo) => void;
  onInversionChange: (index: number, inversion: number) => void;
  onAutoVoiceLead: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onReorderChord: (fromIndex: number, toIndex: number) => void;
}

export function ChordPalette({
  availableChords,
  progression,
  scaleName,
  onAddChord,
  onRemoveChord,
  onPreviewChord,
  onInversionChange,
  onAutoVoiceLead,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onReorderChord,
}: ChordPaletteProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      onReorderChord(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        Edit Progression
      </label>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="mb-1 block text-xs text-gray-400">Drag to reorder · ✕ removes a chord</span>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="h-11 rounded-md border border-gray-600 bg-gray-800 px-2 text-[11px] font-medium text-gray-200 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8"
              title="Undo (Cmd/Ctrl+Z)"
            >
              ↶ Undo
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className="h-11 rounded-md border border-gray-600 bg-gray-800 px-2 text-[11px] font-medium text-gray-200 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8"
              title="Redo (Cmd/Ctrl+Shift+Z)"
            >
              ↷ Redo
            </button>
            <button
              type="button"
              onClick={onAutoVoiceLead}
              className="h-11 rounded-md border border-cyan-500/40 bg-cyan-500/15 px-2 text-[11px] font-medium text-cyan-200 transition-colors hover:bg-cyan-500/25 sm:h-8"
              title="Smooth voice leading between chords"
            >
              Voice-lead
            </button>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap min-h-[44px] p-2 rounded-lg border border-gray-700/50 bg-gray-800/30">
          {progression.length === 0 ? (
            <span className="self-center text-xs text-gray-400">Add chords from the palette below</span>
          ) : (
            progression.map((chord, i) => (
              <div
                key={i}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, i)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-1 cursor-move transition-all ${
                  draggedIndex === i ? 'opacity-50' : 'opacity-100'
                }`}
              >
                <div className="flex items-center gap-0.5 rounded-lg border border-purple-500/30 bg-purple-500/15 pl-2">
                  <span className="text-xs font-medium text-purple-200">{chord.display}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveChord(i)}
                    aria-label={`Remove ${chord.display}`}
                    className="flex h-11 w-11 items-center justify-center rounded-md text-gray-300 transition-colors hover:bg-rose-500/20 hover:text-rose-200 sm:h-8 sm:w-8"
                    title={`Remove ${chord.display}`}
                  >
                    ✕
                  </button>
                </div>
                <div className="flex gap-0.5" role="group" aria-label={`Inversion for ${chord.display}`}>
                  {[0, 1, 2].map(inv => (
                    <button
                      key={inv}
                      type="button"
                      onClick={() => onInversionChange(i, inv)}
                      aria-pressed={(chord.inversion ?? 0) === inv}
                      aria-label={`${chord.display}: inversion ${inv}`}
                      className={`h-11 w-9 rounded text-[10px] font-medium transition-colors sm:h-8 sm:w-7 ${
                        (chord.inversion ?? 0) === inv
                          ? 'bg-cyan-500 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                      title={`Inversion ${inv}`}
                    >
                      {inv}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div>
          <span className="mb-1 block text-xs text-gray-400">Available chords in key · click to add</span>
          <div className="flex gap-2 flex-wrap">
            {availableChords.map((chord, i) => (
              <button
                key={i}
                onClick={() => {
                  onAddChord(chord);
                  onPreviewChord(chord);
                }}
                className="flex min-h-11 flex-col items-center rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 text-xs text-gray-200 transition-colors hover:border-cyan-500 hover:text-cyan-200"
              >
                <span className="font-semibold">{chord.display}</span>
                <span className="text-[10px] text-gray-400">{getRomanNumeral(i, scaleName)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
