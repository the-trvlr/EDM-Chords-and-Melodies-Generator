import { useRef, useState } from 'react';
import type { ChordInfo } from '../utils/musicTheory';
import type { MelodyNote } from '../utils/melodyGenerator';
import type { DrumPattern } from '../utils/drumGenerator';
import { STEPS_PER_CHORD } from '../utils/schedule';

const LANE_HEIGHT = 'h-24 sm:h-[68px]';

function Playhead({ position }: { position: number }) {
  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-white/70 shadow-[0_0_6px_rgba(255,255,255,0.5)]"
      style={{ left: `${Math.max(0, Math.min(1, position)) * 100}%` }}
      aria-hidden="true"
    />
  );
}

function BarLines({ bars }: { bars: number }) {
  if (bars <= 1) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      {Array.from({ length: bars - 1 }, (_, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 w-px bg-white/10"
          style={{ left: `${((i + 1) / bars) * 100}%` }}
        />
      ))}
    </div>
  );
}

export function BarRuler({ bars }: { bars: number }) {
  return (
    <div className="flex h-4 items-end text-[10px] text-gray-400" aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className="flex-1 border-l border-white/10 pl-1 tabular-nums">
          {i + 1}
        </span>
      ))}
    </div>
  );
}

interface LaneProps {
  totalSteps: number;
  bars: number;
  activeStep: number | null;
}

export function ChordLane({
  chords,
  activeStep,
  totalSteps,
  bars,
}: LaneProps & { chords: ChordInfo[] }) {
  const activeChord = activeStep !== null ? Math.floor(activeStep / STEPS_PER_CHORD) : -1;
  return (
    <div className="min-w-0">
      <BarRuler bars={bars} />
      <div className={`relative ${LANE_HEIGHT} w-full min-w-0 overflow-hidden rounded-lg border border-gray-700/60 bg-gray-950/60`}>
        <BarLines bars={bars} />
        {chords.map((chord, index) => (
          <div
            key={index}
            className={`absolute top-0 bottom-0 flex flex-col items-center justify-center gap-0.5 border-r border-gray-800 text-[11px] transition-colors ${
              index === activeChord
                ? 'bg-purple-500/40 text-white'
                : index % 2 === 0
                  ? 'bg-purple-500/10 text-purple-200'
                  : 'text-purple-200/80'
            }`}
            style={{ left: `${(index / chords.length) * 100}%`, width: `${100 / chords.length}%` }}
          >
            <span className="font-semibold">{chord.display}</span>
            <span className="text-[9px] opacity-60">{chord.notes.join(' ')}</span>
          </div>
        ))}
        {activeStep !== null && <Playhead position={activeStep / totalSteps} />}
      </div>
    </div>
  );
}

export function PianoRollLane({
  notes,
  activeStep,
  totalSteps,
  bars,
  color,
  activeColor,
  label,
}: LaneProps & {
  notes: MelodyNote[];
  color: string;
  activeColor: string;
  label: string;
}) {
  const midis = notes.map(note => note.midi);
  const minMidi = midis.length ? Math.min(...midis) : 48;
  const maxMidi = midis.length ? Math.max(...midis) : 60;
  const range = Math.max(maxMidi - minMidi, 12);

  return (
    <div className="min-w-0">
      <BarRuler bars={bars} />
      <div
        className={`relative ${LANE_HEIGHT} w-full min-w-0 overflow-hidden rounded-lg border border-gray-700/60 bg-gray-950/60`}
        role="img"
        aria-label={`${label}: ${notes.length} notes over ${bars} bars`}
      >
        <BarLines bars={bars} />
        {notes.length === 0 && (
          <div className="flex h-full items-center justify-center text-[11px] text-gray-400">
            No notes — press Regenerate
          </div>
        )}
        {notes.map((note, index) => {
          const isActive =
            activeStep !== null && activeStep >= note.step && activeStep < note.step + note.duration;
          const left = (note.step / totalSteps) * 100;
          const width = Math.max((note.duration / totalSteps) * 100, 0.6);
          const top = ((maxMidi - note.midi) / range) * 70 + 12;
          return (
            <div
              key={`${note.step}-${note.midi}-${index}`}
              className={`absolute rounded-sm transition-colors ${isActive ? activeColor : color}`}
              style={{ left: `${left}%`, width: `${width}%`, top: `${top}%`, height: 7 }}
              aria-hidden="true"
            />
          );
        })}
        {activeStep !== null && <Playhead position={activeStep / totalSteps} />}
      </div>
    </div>
  );
}

const DRUM_ROWS: { id: keyof DrumPattern; label: string; color: string }[] = [
  { id: 'kick', label: 'Kick', color: 'bg-rose-400' },
  { id: 'snare', label: 'Snare', color: 'bg-orange-400' },
  { id: 'clap', label: 'Clap', color: 'bg-amber-300' },
  { id: 'hat', label: 'Hi-Hat', color: 'bg-emerald-400' },
  { id: 'lowHat', label: 'Low Hat', color: 'bg-teal-400' },
  { id: 'crash', label: 'Crash', color: 'bg-sky-300' },
  { id: 'ride', label: 'Ride', color: 'bg-indigo-300' },
];

export function DrumGrid({
  pattern,
  activeStep,
  onToggle,
}: {
  pattern: DrumPattern;
  activeStep: number | null;
  onToggle: (instrument: keyof DrumPattern, step: number) => void;
}) {
  const stepInBar = activeStep !== null ? activeStep % 16 : -1;

  return (
    <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-gray-700/60 bg-gray-950/60 p-2">
      <div className="min-w-[420px]">
        {DRUM_ROWS.map(row => (
          <div key={row.id} className="mb-1 flex items-center gap-2 last:mb-0">
            <span className="w-10 shrink-0 text-[10px] uppercase tracking-wide text-gray-400">{row.label}</span>
            <div className="grid min-w-0 flex-1 gap-1" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
              {pattern[row.id].map((value, step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => onToggle(row.id, step)}
                  aria-label={`${row.label}, step ${step + 1}`}
                  aria-pressed={value === 1}
                  className={`h-6 min-h-6 rounded-sm transition-colors sm:h-5 ${
                    value ? row.color : 'bg-gray-800 hover:bg-gray-700'
                  } ${stepInBar === step ? 'ring-1 ring-white/80' : ''}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface EditableLaneProps extends LaneProps {
  notes: MelodyNote[];
  onChange: (notes: MelodyNote[]) => void;
  color: string;
  activeColor: string;
  label: string;
}

/**
 * Minimal piano-roll editor: drag a note to move it, drag its right edge to
 * resize, double-click (or right-click) to delete, click empty space to add.
 */
export function EditablePianoRoll({
  notes,
  onChange,
  activeStep,
  totalSteps,
  bars,
  color,
  activeColor,
  label,
}: EditableLaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: 'move' | 'resize';
    index: number;
    startX: number;
    startY: number;
    note: MelodyNote;
    moved: boolean;
    added: boolean;
  } | null>(null);
  const [draft, setDraft] = useState<MelodyNote[] | null>(null);

  const rendered = draft ?? notes;
  const midis = rendered.map(note => note.midi);
  const minMidi = midis.length ? Math.min(...midis) : 48;
  const maxMidi = midis.length ? Math.max(...midis) : 60;
  const range = Math.max(maxMidi - minMidi + 10, 12);
  const topMidi = maxMidi + 5;

  const positionFromEvent = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return { step: 0, midi: topMidi - 5 };
    const step = Math.max(0, Math.min(totalSteps - 1, Math.round(((clientX - rect.left) / rect.width) * totalSteps)));
    const midi = Math.max(12, Math.min(108, Math.round(topMidi - ((clientY - rect.top) / rect.height) * range)));
    return { step, midi };
  };

  const startMove = (event: React.PointerEvent, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    containerRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode: 'move',
      index,
      startX: event.clientX,
      startY: event.clientY,
      note: { ...rendered[index] },
      moved: false,
      added: false,
    };
    setDraft(rendered.map(note => ({ ...note })));
  };

  const startResize = (event: React.PointerEvent, index: number) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    containerRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode: 'resize',
      index,
      startX: event.clientX,
      startY: event.clientY,
      note: { ...rendered[index] },
      moved: false,
      added: false,
    };
    setDraft(rendered.map(note => ({ ...note })));
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    const { step, midi } = positionFromEvent(event.clientX, event.clientY);
    const next = [...rendered, { step, midi, duration: 1, velocity: 0.8 }].sort((a, b) => a.step - b.step);
    const index = next.findIndex(note => note.step === step && note.midi === midi);
    containerRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = { mode: 'move', index, startX: event.clientX, startY: event.clientY, note: { ...next[index] }, moved: false, added: true };
    setDraft(next);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dxSteps = Math.round(((event.clientX - drag.startX) / rect.width) * totalSteps);
    const dyMidi = Math.round(((event.clientY - drag.startY) / rect.height) * range);
    if (dxSteps !== 0 || dyMidi !== 0) drag.moved = true;
    setDraft(prev => {
      if (!prev) return prev;
      return prev.map((note, index) => {
        if (index !== drag.index) return note;
        if (drag.mode === 'resize') {
          return { ...note, duration: Math.max(1, Math.min(64, drag.note.duration + dxSteps)) };
        }
        return {
          ...note,
          step: Math.max(0, Math.min(totalSteps - 1, drag.note.step + dxSteps)),
          midi: Math.max(12, Math.min(108, drag.note.midi - dyMidi)),
        };
      });
    });
  };

  const handlePointerUp = () => {
    if (!dragRef.current || !draft) {
      dragRef.current = null;
      setDraft(null);
      return;
    }
    const drag = dragRef.current;
    // A plain click (no drag) on an existing note removes it. Clicking empty
    // space creates a note, so that gesture must not delete it again.
    if (drag.mode === 'move' && !drag.moved && !drag.added) {
      const next = draft.filter((_, index) => index !== drag.index).sort((a, b) => a.step - b.step);
      dragRef.current = null;
      setDraft(null);
      onChange(next);
      return;
    }
    const next = [...draft]
      .filter((note, index, list) => list.findIndex(other => other.step === note.step && other.midi === note.midi && other.duration === note.duration) === index)
      .sort((a, b) => a.step - b.step);
    dragRef.current = null;
    setDraft(null);
    onChange(next);
  };

  const removeNote = (index: number) => {
    onChange(rendered.filter((_, i) => i !== index));
  };

  return (
    <div className="min-w-0">
      <BarRuler bars={bars} />
      <div
        ref={containerRef}
        role="application"
        aria-label={`${label} piano roll editor, ${notes.length} notes`}
        className={`relative ${LANE_HEIGHT} w-full min-w-0 touch-none select-none overflow-hidden rounded-lg border border-gray-700/60 bg-gray-950/60`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <BarLines bars={bars} />
        {rendered.length === 0 && (
          <div className="pointer-events-none flex h-full items-center justify-center text-[11px] text-gray-400">
            Click to draw a note
          </div>
        )}
        {rendered.map((note, index) => {
          const isActive =
            activeStep !== null && activeStep >= note.step && activeStep < note.step + note.duration;
          const left = (note.step / totalSteps) * 100;
          const width = Math.max((note.duration / totalSteps) * 100, 0.6);
          const top = ((topMidi - note.midi) / range) * 100;
          return (
            <div
              key={`${note.step}-${note.midi}-${index}`}
              className={`absolute rounded-sm ${isActive ? activeColor : color}`}
              style={{ left: `${left}%`, width: `${width}%`, top: `${top}%`, height: 8 }}
              onPointerDown={event => {
                if (event.button !== 0) return;
                startMove(event, index);
              }}
              onContextMenu={event => {
                event.preventDefault();
                removeNote(index);
              }}
              title={`MIDI ${note.midi} · step ${note.step + 1} · ${note.duration} step(s)`}
            >
              <span
                className="absolute -right-1 top-0 h-full w-2 cursor-ew-resize rounded-r-sm bg-white/20"
                onPointerDown={event => startResize(event, index)}
                aria-hidden="true"
              />
            </div>
          );
        })}
        {activeStep !== null && <Playhead position={activeStep / totalSteps} />}
      </div>
    </div>
  );
}

interface VelocityLaneProps {
  notes: MelodyNote[];
  onChange: (notes: MelodyNote[]) => void;
  totalSteps: number;
  label: string;
  color: string;
}

/** Compact velocity lane: drag a bar (or use arrow keys) to set note velocity. */
export function VelocityLane({ notes, onChange, totalSteps, label, color }: VelocityLaneProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ index: number } | null>(null);
  const [draft, setDraft] = useState<MelodyNote[] | null>(null);
  const rendered = draft ?? notes;

  const velocityFromY = (clientY: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return 0.8;
    const value = 1 - (clientY - rect.top) / rect.height;
    return Math.max(0.05, Math.min(1, Math.round(value * 100) / 100));
  };

  const start = (event: React.PointerEvent, index: number) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    trackRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = { index };
    const velocity = velocityFromY(event.clientY);
    setDraft(notes.map((note, i) => i === index ? { ...note, velocity } : { ...note }));
  };

  const move = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const velocity = velocityFromY(event.clientY);
    setDraft(prev => prev?.map((note, i) => i === drag.index ? { ...note, velocity } : note) ?? prev);
  };

  const finish = () => {
    if (draft) onChange(draft);
    dragRef.current = null;
    setDraft(null);
  };

  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="w-10 shrink-0 text-[10px] uppercase tracking-wide text-gray-400">Vel</span>
      <div
        ref={trackRef}
        className="relative h-10 min-w-0 flex-1 overflow-hidden rounded border border-gray-700/60 bg-gray-950/60"
        role="group"
        aria-label={`${label} velocity lane`}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
      >
        {rendered.map((note, index) => {
          const velocity = Math.round((note.velocity ?? 0.8) * 100);
          return (
            <div
              key={`${note.step}-${note.midi}-${index}`}
              role="slider"
              tabIndex={0}
              aria-label={`${label} note at step ${note.step + 1} velocity`}
              aria-valuemin={5}
              aria-valuemax={100}
              aria-valuenow={velocity}
              title={`Velocity ${velocity}%`}
              onPointerDown={event => start(event, index)}
              onKeyDown={event => {
                if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                event.preventDefault();
                const next = event.key === 'ArrowUp' ? Math.min(1, (note.velocity ?? 0.8) + 0.05) : Math.max(0.05, (note.velocity ?? 0.8) - 0.05);
                onChange(notes.map((item, i) => i === index ? { ...item, velocity: Math.round(next * 100) / 100 } : item));
              }}
              className={`absolute bottom-0 w-1.5 cursor-ns-resize rounded-t ${color} hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white`}
              style={{
                left: `${(note.step / totalSteps) * 100}%`,
                height: `${velocity}%`,
                opacity: 0.55 + velocity / 200,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
