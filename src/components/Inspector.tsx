import { Suspense, lazy, useState } from 'react';
import type { ChordInfo } from '../utils/musicTheory';
import { PianoKeyboard } from './PianoKeyboard';
import { StaffSkeleton } from './Skeleton';

const StaffNotation = lazy(() => import('./StaffNotation'));

interface InspectorProps {
  className?: string;
  chord: ChordInfo | null;
  chordIndex: number | null;
  progression: ChordInfo[];
  activeIndex: number;
  scaleName: string;
  isPlaying: boolean;
  onInversion: (index: number, inversion: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
  onVoiceLead: () => void;
  onPreview: (chord: ChordInfo) => void;
  pinned: boolean;
  onTogglePin: () => void;
}

export function Inspector({
  className = '',
  chord,
  chordIndex,
  progression,
  activeIndex,
  scaleName,
  isPlaying,
  onInversion,
  onMove,
  onRemove,
  onVoiceLead,
  onPreview,
  pinned,
  onTogglePin,
}: InspectorProps) {
  const [showNotation, setShowNotation] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      aria-label="Chord inspector"
      className={`min-w-0 rounded-xl border border-gray-800 bg-gray-900/50 p-3 xl:sticky xl:top-36 xl:self-start ${className}`}
    >
      <div className="flex items-center gap-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Inspector</h2>
        {chord && <span className="text-sm font-semibold text-white xl:hidden">{chord.display}</span>}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => setExpanded(value => !value)}
            aria-expanded={expanded}
            className="h-8 rounded-md border border-gray-700 px-2 text-[11px] text-gray-300 hover:border-gray-500 xl:hidden"
          >
            {expanded ? 'Hide' : 'Show'}
          </button>
          {chord && (
            <button
              type="button"
              onClick={() => onPreview(chord)}
              className="h-8 rounded-md border border-gray-700 px-2 text-[11px] text-gray-300 hover:border-gray-500"
            >
              Audition
            </button>
          )}
        </div>
      </div>

      <div className={`${expanded ? 'block' : 'hidden'} xl:block`}>
      {!chord ? (
        <p className="mt-3 text-xs leading-relaxed text-gray-400">
          Select a chord in the progression to see its notes, voicing and notation.
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          <div>
            <p className="text-2xl font-bold text-white">{chord.display}</p>
            <p className="text-[11px] text-gray-400">
              {chord.type.name} · {scaleName} · {chord.notes.join(' ')}
            </p>
          </div>

          <PianoKeyboard chord={chord} startOctave={3} numOctaves={2} />

          <div className="flex flex-wrap gap-1">
            {chord.notes.map(note => (
              <span key={note} className="rounded bg-purple-500/20 px-1.5 py-0.5 font-mono text-[11px] text-purple-200">
                {note}
              </span>
            ))}
            <span className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
              {chord.type.intervals.join(' · ')}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-gray-400">Inversion</span>
            <div className="flex gap-1" role="group" aria-label="Chord inversion">
              {[0, 1, 2].map(inversion => (
                <button
                  key={inversion}
                  type="button"
                  onClick={() => chordIndex !== null && onInversion(chordIndex, inversion)}
                  aria-pressed={(chord.inversion ?? 0) === inversion}
                  disabled={inversion >= chord.midiNotes.length}
                  className={`h-8 flex-1 rounded-md text-[11px] font-medium transition-colors disabled:opacity-30 ${
                    (chord.inversion ?? 0) === inversion
                      ? 'bg-purple-500/20 text-purple-200 ring-1 ring-purple-500/60'
                      : 'border border-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {inversion === 0 ? 'Root' : `${inversion}${inversion === 1 ? 'st' : 'nd'}`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => chordIndex !== null && onMove(chordIndex, -1)}
              disabled={chordIndex === null || chordIndex === 0}
              className="h-8 rounded-md border border-gray-700 px-2 text-[11px] text-gray-300 hover:border-gray-500 disabled:opacity-30"
              aria-label="Move chord left"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => chordIndex !== null && onMove(chordIndex, 1)}
              disabled={chordIndex === null || chordIndex >= progression.length - 1}
              className="h-8 rounded-md border border-gray-700 px-2 text-[11px] text-gray-300 hover:border-gray-500 disabled:opacity-30"
              aria-label="Move chord right"
            >
              →
            </button>
            <button
              type="button"
              onClick={onVoiceLead}
              className="h-8 rounded-md border border-gray-700 px-2 text-[11px] text-gray-300 hover:border-gray-500"
            >
              Voice lead
            </button>
            <button
              type="button"
              onClick={onTogglePin}
              aria-pressed={pinned}
              title="Keep this chord's voicing when using Voice lead"
              className={`h-8 rounded-md border px-2 text-[11px] transition-colors ${
                pinned
                  ? 'border-amber-500/60 bg-amber-400/15 text-amber-200'
                  : 'border-gray-700 text-gray-300 hover:border-gray-500'
              }`}
            >
              Pin
            </button>
            <button
              type="button"
              onClick={() => chordIndex !== null && onRemove(chordIndex)}
              className="h-8 rounded-md border border-rose-700/60 px-2 text-[11px] text-rose-200 hover:border-rose-500"
            >
              Remove
            </button>
          </div>

          <div className="border-t border-gray-800 pt-2">
            <button
              type="button"
              onClick={() => setShowNotation(value => !value)}
              aria-pressed={showNotation}
              aria-label="Show staff notation"
              className={`h-9 w-full rounded-md text-[11px] font-medium transition-colors ${
                showNotation
                  ? 'bg-gray-700 text-white'
                  : 'border border-gray-700 text-gray-300 hover:border-gray-500'
              }`}
            >
              {showNotation ? 'Hide notation' : 'Show notation'}
            </button>
            {showNotation && (
              <div className="mt-2 overflow-x-auto">
                <Suspense fallback={<StaffSkeleton />}>
                  <StaffNotation progression={progression} activeIndex={activeIndex} isPlaying={isPlaying} />
                </Suspense>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </aside>
  );
}
