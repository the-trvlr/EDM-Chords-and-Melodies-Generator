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
          <span className="text-xs text-gray-500 mb-1 block">Current sequence (drag to reorder, click to remove)</span>
          <div className="flex gap-1">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="px-2 py-1 rounded text-[10px] font-medium bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Undo (Cmd/Ctrl+Z)"
            >
              ↶ Undo
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="px-2 py-1 rounded text-[10px] font-medium bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Redo (Cmd/Ctrl+Shift+Z)"
            >
              ↷ Redo
            </button>
            <button
              onClick={onAutoVoiceLead}
              className="px-2 py-1 rounded text-[10px] font-medium bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 transition-all"
              title="Auto voice-lead progression"
            >
              Auto Voice-Lead
            </button>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap min-h-[44px] p-2 rounded-lg border border-gray-700/50 bg-gray-800/30">
          {progression.length === 0 ? (
            <span className="text-xs text-gray-600 self-center">Add chords from the palette below</span>
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
                <button
                  onClick={() => onRemoveChord(i)}
                  className="group px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-300 transition-all"
                  title="Click to remove"
                >
                  <span className="group-hover:hidden">{chord.display}</span>
                  <span className="hidden group-hover:inline">✕ {chord.display}</span>
                </button>
                <div className="flex gap-0.5">
                  {[0, 1, 2].map(inv => (
                    <button
                      key={inv}
                      onClick={() => onInversionChange(i, inv)}
                      className={`w-5 h-5 rounded text-[9px] font-medium transition-all ${
                        chord.inversion === inv
                          ? 'bg-cyan-500 text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
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
          <span className="text-xs text-gray-500 mb-1 block">Available chords in key (click to add)</span>
          <div className="flex gap-2 flex-wrap">
            {availableChords.map((chord, i) => (
              <button
                key={i}
                onClick={() => {
                  onAddChord(chord);
                  onPreviewChord(chord);
                }}
                className="flex flex-col items-center px-3 py-2 rounded-lg text-xs border border-gray-700 bg-gray-800/50 text-gray-300 hover:border-cyan-500 hover:text-cyan-300 transition-all"
              >
                <span className="font-semibold">{chord.display}</span>
                <span className="text-[10px] opacity-40">{getRomanNumeral(i, scaleName)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
