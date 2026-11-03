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
  { id: 'hat', label: 'Hat', color: 'bg-emerald-400' },
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
