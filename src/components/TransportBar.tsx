import { useRef } from 'react';

interface TransportBarProps {
  isPlaying: boolean;
  onToggle: () => void;
  bpm: number;
  bpmRange: [number, number];
  onBpmChange: (bpm: number) => void;
  loop: boolean;
  onLoopChange: (loop: boolean) => void;
  loopBars: number;
  onLoopBarsChange: (bars: number) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  metronome: boolean;
  onMetronomeChange: (enabled: boolean) => void;
  countIn: number;
  onCountInChange: (bars: number) => void;
  position: { bar: number; totalBars: number } | null;
  midiEnabled: boolean;
  onMidiToggle: () => void;
  midiSupported: boolean;
}

export function TransportBar({
  isPlaying,
  onToggle,
  bpm,
  bpmRange,
  onBpmChange,
  loop,
  onLoopChange,
  loopBars,
  onLoopBarsChange,
  volume,
  onVolumeChange,
  metronome,
  onMetronomeChange,
  countIn,
  onCountInChange,
  position,
  midiEnabled,
  onMidiToggle,
  midiSupported,
}: TransportBarProps) {
  const taps = useRef<number[]>([]);
  const minBpm = Math.max(60, bpmRange[0] - 20);
  const maxBpm = Math.min(200, bpmRange[1] + 20);

  const tapTempo = () => {
    const now = performance.now();
    if (taps.current.length > 0 && now - taps.current[taps.current.length - 1] > 3000) {
      taps.current = [];
    }
    taps.current = [...taps.current.slice(-4), now];
    if (taps.current.length < 2) return;
    const intervals = taps.current.slice(1).map((time, index) => time - taps.current[index]);
    const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    if (average <= 0) return;
    onBpmChange(Math.max(40, Math.min(220, Math.round(60000 / average))));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2" role="group" aria-label="Transport">
      <button
        type="button"
        onClick={onToggle}
        aria-label={isPlaying ? 'Stop playback' : 'Play'}
        className={`flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-white transition-colors sm:h-10 sm:px-4 ${
          isPlaying
            ? 'bg-rose-500 hover:bg-rose-600'
            : 'bg-emerald-500 hover:bg-emerald-600'
        }`}
      >
        {isPlaying ? (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
        <span className="hidden sm:inline">{isPlaying ? 'Stop' : 'Play'}</span>
      </button>

      <span className="min-w-14 rounded-md bg-gray-900/80 px-2 py-1 text-center text-[11px] tabular-nums text-gray-300" aria-live="off">
        {position ? `${position.bar}/${position.totalBars}` : '—'}
      </span>

      <div className="flex items-center gap-1.5">
        <label htmlFor="master-bpm" className="text-[11px] uppercase tracking-wide text-gray-400">
          BPM
        </label>
        <input
          id="master-bpm-slider"
          type="range"
          min={minBpm}
          max={maxBpm}
          value={bpm}
          onChange={event => onBpmChange(Number(event.target.value))}
          aria-label="Tempo in BPM"
          className="hidden w-20 accent-purple-500 sm:block"
        />
        <input
          id="master-bpm"
          type="number"
          min={60}
          max={200}
          value={bpm}
          onChange={event => onBpmChange(Number(event.target.value))}
          className="h-11 w-14 rounded-md border border-gray-700 bg-gray-900 px-1 text-center text-sm tabular-nums text-white sm:h-8 focus:border-purple-500 focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={tapTempo}
        aria-label="Tap tempo"
        title="Tap four times to set the tempo"
        className="h-11 rounded-md bg-gray-800 px-2 text-[11px] font-medium text-gray-300 transition-colors hover:bg-gray-700 sm:h-8"
      >
        Tap
      </button>

      <button
        type="button"
        onClick={onMidiToggle}
        aria-pressed={midiEnabled}
        aria-label="MIDI input"
        disabled={!midiSupported}
        title={midiSupported ? 'Play notes from a Web MIDI controller' : 'Web MIDI is not available in this browser'}
        className={`h-11 rounded-md px-2 text-[11px] font-medium transition-colors disabled:opacity-40 sm:h-8 ${
          midiEnabled
            ? 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-500/60'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`}
      >
        MIDI
      </button>

      <button
        type="button"
        onClick={() => onLoopChange(!loop)}
        aria-pressed={loop}
        aria-label="Loop playback"
        className={`h-11 rounded-md px-2 text-[11px] font-medium transition-colors sm:h-8 ${
          loop
            ? 'bg-purple-500/25 text-purple-200 ring-1 ring-purple-500/60'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`}
      >
        Loop
      </button>

      <label className="flex items-center gap-1">
        <span className="sr-only">Loop region</span>
        <select
          value={loopBars}
          onChange={event => onLoopBarsChange(Number(event.target.value))}
          aria-label="Loop region"
          title="Loop the first 2, 4 or 8 bars"
          className="h-11 rounded-md border border-gray-700 bg-gray-900 px-1.5 text-[11px] text-gray-200 sm:h-8"
        >
          <option value={0}>Region: off</option>
          <option value={2}>Region: 2 bars</option>
          <option value={4}>Region: 4 bars</option>
          <option value={8}>Region: 8 bars</option>
        </select>
      </label>

      <button
        type="button"
        onClick={() => onMetronomeChange(!metronome)}
        aria-pressed={metronome}
        aria-label="Metronome"
        className={`h-11 rounded-md px-2 text-[11px] font-medium transition-colors sm:h-8 ${
          metronome
            ? 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/60'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`}
      >
        Click
      </button>

      <label className="flex items-center gap-1">
        <span className="sr-only">Count-in bars</span>
        <select
          value={countIn}
          onChange={event => onCountInChange(Number(event.target.value))}
          aria-label="Count-in bars"
          title="Count-in before playback"
          className="h-11 rounded-md border border-gray-700 bg-gray-900 px-1.5 text-[11px] text-gray-200 sm:h-8"
        >
          <option value={0}>Count-in: off</option>
          <option value={1}>Count-in: 1 bar</option>
          <option value={2}>Count-in: 2 bars</option>
        </select>
      </label>

      <div className="flex items-center gap-1.5">
        <label htmlFor="master-volume" className="text-[11px] uppercase tracking-wide text-gray-400">
          Vol
        </label>
        <input
          id="master-volume"
          type="range"
          min={-30}
          max={0}
          value={volume}
          onChange={event => onVolumeChange(Number(event.target.value))}
          aria-label="Master volume"
          className="w-16 accent-purple-500 sm:w-20"
        />
      </div>
    </div>
  );
}
