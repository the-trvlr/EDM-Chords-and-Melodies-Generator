interface TransportControlsProps {
  isPlaying: boolean;
  bpm: number;
  bpmRange: [number, number];
  volume: number;
  loop: boolean;
  doubleTime: boolean;
  onPlay: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
  onVolumeChange: (vol: number) => void;
  onLoopChange: (loop: boolean) => void;
  onDoubleTimeChange: (doubleTime: boolean) => void;
  onExportMidi: () => void;
}

export function TransportControls({
  isPlaying,
  bpm,
  bpmRange,
  volume,
  loop,
  doubleTime,
  onPlay,
  onStop,
  onBpmChange,
  onVolumeChange,
  onLoopChange,
  onDoubleTimeChange,
  onExportMidi,
}: TransportControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
      <button
        onClick={isPlaying ? onStop : onPlay}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
          isPlaying
            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30'
            : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30'
        }`}
      >
        {isPlaying ? (
          <>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            Stop
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
            Play
          </>
        )}
      </button>

      <label className="flex items-center gap-1.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={loop}
          onChange={e => onLoopChange(e.target.checked)}
          className="w-3.5 h-3.5 accent-purple-500 rounded"
        />
        <span className="text-xs text-gray-300">Loop</span>
      </label>

      <label className="flex items-center gap-1.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={doubleTime}
          onChange={e => onDoubleTimeChange(e.target.checked)}
          className="w-3.5 h-3.5 accent-purple-500 rounded"
        />
        <span className="text-xs text-gray-300">Half Time</span>
      </label>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400">BPM</label>
        <input
          type="range"
          min={Math.max(60, bpmRange[0] - 20)}
          max={Math.min(200, bpmRange[1] + 20)}
          value={bpm}
          onChange={e => onBpmChange(Number(e.target.value))}
          className="w-24 accent-purple-500"
        />
        <input
          type="number"
          min={60}
          max={200}
          value={bpm}
          onChange={e => onBpmChange(Number(e.target.value))}
          className="w-14 rounded bg-gray-900 border border-gray-700 text-center text-sm text-white px-1 py-1 focus:border-purple-500 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400">Vol</label>
        <input
          type="range"
          min={-30}
          max={0}
          value={volume}
          onChange={e => onVolumeChange(Number(e.target.value))}
          className="w-20 accent-purple-500"
        />
      </div>

      <button
        onClick={onExportMidi}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-600 text-gray-300 hover:border-purple-500 hover:text-purple-300 transition-all ml-auto"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Export MIDI
      </button>
    </div>
  );
}
