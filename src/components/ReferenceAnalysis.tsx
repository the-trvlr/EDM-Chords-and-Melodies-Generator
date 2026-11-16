import { useState } from 'react';
import { Drawer } from './Drawer';
import { analyzeReference, type ReferenceResult } from '../utils/referenceAnalysis';

interface ReferenceAnalysisProps {
  open: boolean;
  onClose: () => void;
  onApply: (result: ReferenceResult, options: { bpm: boolean; key: boolean; chords: boolean }) => void;
}

function duration(seconds: number): string {
  const value = Math.round(seconds);
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function ReferenceAnalysis({ open, onClose, onApply }: ReferenceAnalysisProps) {
  const [result, setResult] = useState<ReferenceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useBpm, setUseBpm] = useState(true);
  const [useKey, setUseKey] = useState(true);
  const [useChords, setUseChords] = useState(true);

  const analyze = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const next = await analyzeReference(file);
      setResult(next);
      setUseBpm(true);
      setUseKey(true);
      setUseChords(next.chords.length > 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not analyze that file.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Reference analysis"
      description="Start from a MIDI or audio file: tempo, key and, for MIDI, chord ideas."
      widthClassName="sm:max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-gray-400">Analysis happens in this browser.</span>
          <button
            type="button"
            disabled={!result || loading}
            onClick={() => { if (result) onApply(result, { bpm: useBpm, key: useKey, chords: useChords && result.chords.length > 0 }); onClose(); }}
            className="h-9 rounded-md bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-40"
          >
            Use as starting point
          </button>
        </div>
      }
    >
      <label
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-900/50 px-4 py-8 text-center hover:border-purple-500/60"
        onDragOver={event => event.preventDefault()}
        onDrop={event => { event.preventDefault(); void analyze(event.dataTransfer.files[0]); }}
      >
        <span className="text-xs font-semibold text-gray-100">Drop a reference or choose a file</span>
        <span className="mt-1 text-[11px] text-gray-400">.mid, .midi, .wav, .mp3, .m4a, .ogg, .aac</span>
        <input
          type="file"
          accept=".mid,.midi,.wav,.mp3,.m4a,.ogg,.aac"
          className="sr-only"
          onChange={event => void analyze(event.target.files?.[0])}
        />
      </label>

      {loading && <p className="mt-3 text-center text-xs text-purple-200">Analyzing reference…</p>}
      {error && <p className="mt-3 rounded-md border border-rose-700/50 bg-rose-500/10 p-2 text-xs text-rose-200">{error}</p>}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-3">
            <p className="truncate text-xs font-semibold text-gray-100">{result.fileName}</p>
            <p className="mt-1 text-[11px] text-gray-400">{result.note}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'BPM', value: result.bpm },
                { label: 'Key', value: `${result.key} ${result.scale}` },
                { label: 'Length', value: duration(result.durationSec) },
                { label: 'Energy', value: `${Math.round(result.energy * 100)}%` },
              ].map(item => (
                <div key={item.label} className="rounded-md border border-gray-800 bg-gray-950/60 p-2">
                  <span className="block text-[9px] uppercase tracking-wide text-gray-500">{item.label}</span>
                  <span className="block text-xs font-semibold text-gray-100">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 rounded-xl border border-gray-800 bg-gray-900/50 p-3">
            <label className="flex items-center gap-2 text-xs text-gray-200">
              <input type="checkbox" checked={useBpm} onChange={event => setUseBpm(event.target.checked)} className="accent-purple-500" />
              Use tempo
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-200">
              <input type="checkbox" checked={useKey} onChange={event => setUseKey(event.target.checked)} className="accent-purple-500" />
              Use key & scale
            </label>
            <label className={`flex items-center gap-2 text-xs ${result.chords.length ? 'text-gray-200' : 'text-gray-500'}`}>
              <input type="checkbox" disabled={!result.chords.length} checked={useChords} onChange={event => setUseChords(event.target.checked)} className="accent-purple-500" />
              Use detected chords {result.chords.length ? `(${result.chords.length})` : '(MIDI only)'}
            </label>
          </div>

          {result.chords.length > 0 && (
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-3">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Detected chords</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {result.chords.map((chord, index) => (
                  <span key={`${chord.display}-${index}`} className="rounded-md border border-gray-700 bg-gray-950 px-2 py-1 text-[11px] text-gray-200">{chord.display}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
