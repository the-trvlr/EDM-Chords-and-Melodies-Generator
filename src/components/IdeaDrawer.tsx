import { useMemo, useState } from 'react';
import { Drawer } from './Drawer';
import type { ArpPattern, ArpRate, ArpSettings } from '../utils/arpeggiator';
import type { MelodyNote } from '../utils/melodyGenerator';
import { extractMotif, repeatMotif, transformMotif, type MotifTransform } from '../utils/motif';

interface IdeaDrawerProps {
  onClose: () => void;
  bassNotes: MelodyNote[];
  leadNotes: MelodyNote[];
  bars: number;
  seeds: { bass: number; lead: number; drums: number };
  seedLocks: { bass: boolean; lead: boolean; drums: boolean };
  arpEnabled: boolean;
  arpSettings: ArpSettings;
  arpSeed: number;
  onApplyNotes: (track: 'bass' | 'lead', notes: MelodyNote[]) => void;
  onPreviewNotes: (track: 'bass' | 'lead' | 'arp', notes: MelodyNote[]) => void;
  onPreviewTrack: (track: 'bass' | 'lead' | 'drums') => void;
  onPreviewArp: (settings: ArpSettings, seed: number) => void;
  onSeedsChange: (seeds: { bass: number; lead: number; drums: number }) => void;
  onSeedLocksChange: (locks: { bass: boolean; lead: boolean; drums: boolean }) => void;
  onArpChange: (enabled: boolean, settings: ArpSettings, seed: number) => void;
}

const TRANSFORMS: { id: MotifTransform; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: 'invert', label: 'Invert' },
  { id: 'retrograde', label: 'Retrograde' },
  { id: 'augment', label: 'Augment' },
  { id: 'diminish', label: 'Diminish' },
];

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}

export function IdeaDrawer({
  onClose,
  bassNotes,
  leadNotes,
  bars,
  seeds,
  seedLocks,
  arpEnabled,
  arpSettings,
  arpSeed,
  onApplyNotes,
  onPreviewNotes,
  onPreviewTrack,
  onPreviewArp,
  onSeedsChange,
  onSeedLocksChange,
  onArpChange,
}: IdeaDrawerProps) {
  const [source, setSource] = useState<'bass' | 'lead'>('lead');
  const [transform, setTransform] = useState<MotifTransform>('original');
  const [transpose, setTranspose] = useState(0);
  const [repeat, setRepeat] = useState(true);
  const [locks, setLocks] = useState(seedLocks);
  const [arpOn, setArpOn] = useState(arpEnabled);
  const [settings, setSettings] = useState(arpSettings);
  const [aSeed, setASeed] = useState(arpSeed);

  const sourceNotes = source === 'bass' ? bassNotes : leadNotes;
  const motif = useMemo(() => extractMotif(sourceNotes), [sourceNotes]);
  const transformed = useMemo(() => {
    const next = transformMotif(motif, transform, transpose);
    return repeat ? repeatMotif(next, bars) : next;
  }, [motif, transform, transpose, repeat, bars]);

  const mutate = () => {
    onSeedsChange({
      bass: locks.bass ? seeds.bass : randomSeed(),
      lead: locks.lead ? seeds.lead : randomSeed(),
      drums: locks.drums ? seeds.drums : randomSeed(),
    });
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="Idea lab"
      description="Develop a motif, lock seeds and design the arpeggio — one drawer, no lost context."
      widthClassName="sm:max-w-lg"
      footer={<button type="button" onClick={onClose} className="ml-auto h-9 rounded-md bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-500">Done</button>}
    >
      <details open className="rounded-xl border border-gray-800 bg-gray-900/40 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-gray-100">Motif Lab</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-gray-400">Source</span>
            <select value={source} onChange={event => setSource(event.target.value as 'bass' | 'lead')} aria-label="Motif source" className="h-9 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-100">
              <option value="bass">Bass</option>
              <option value="lead">Lead</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-gray-400">Transpose</span>
            <select value={transpose} onChange={event => setTranspose(Number(event.target.value))} aria-label="Motif transpose" className="h-9 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-100">
              <option value={-12}>−12</option>
              <option value={-5}>−5</option>
              <option value={0}>0</option>
              <option value={5}>+5</option>
              <option value={12}>+12</option>
            </select>
          </label>
        </div>
        <p className="mt-2 rounded-md border border-purple-500/20 bg-purple-500/10 p-2 text-[11px] leading-relaxed text-purple-100">
          <strong className="font-semibold">Why Motif Lab:</strong> a motif is your one-bar hook. Transformations keep its shape while making a related variation, so a bass answer or lead hook sounds composed instead of regenerated. Try Retrograde for call/response, Augment for a build, Invert for a darker answer.
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {TRANSFORMS.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTransform(item.id)}
              aria-pressed={transform === item.id}
              className={`h-8 rounded-md px-2 text-[11px] font-medium ${transform === item.id ? 'bg-purple-500/20 text-purple-100 ring-1 ring-purple-400/60' : 'border border-gray-700 text-gray-300 hover:border-gray-500'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 text-[11px] text-gray-300">
          <input type="checkbox" checked={repeat} onChange={event => setRepeat(event.target.checked)} className="accent-purple-500" />
          Repeat motif across {bars} bars
        </label>
        <div className="mt-2 rounded-md border border-gray-800 bg-gray-950/60 p-2 text-[10px] text-gray-400">
          {motif.length} notes in the first bar · {transformed.length} after transform
          {motif.length > 0 && <span className="mt-1 block truncate text-gray-300">{motif.slice(0, 6).map(note => note.midi).join(' · ')}</span>}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={transformed.length === 0}
            onClick={() => onPreviewNotes(source, transformed)}
            className="h-9 flex-1 rounded-md border border-cyan-600/50 bg-cyan-500/10 px-3 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-40"
          >
            Preview variation
          </button>
          <button
            type="button"
            disabled={transformed.length === 0}
            onClick={() => onApplyNotes(source, transformed)}
            className="h-9 flex-1 rounded-md bg-purple-600 px-3 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-40"
          >
            Apply to {source}
          </button>
        </div>
      </details>

      <details open className="mt-2 rounded-xl border border-gray-800 bg-gray-900/40 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-gray-100">Seeds</summary>
        <p className="mt-2 text-[11px] leading-relaxed text-gray-400">Lock the parts you like; Mutate changes only unlocked seeds.</p>
        <div className="mt-2 space-y-1.5">
          {(['bass', 'lead', 'drums'] as const).map(track => (
            <div key={track} className="flex items-center gap-2 rounded-md border border-gray-800 bg-gray-950/50 px-2 py-1.5">
              <span className="w-12 text-[11px] font-medium capitalize text-gray-200">{track}</span>
              <span className="min-w-0 flex-1 truncate text-[10px] tabular-nums text-gray-400">{seeds[track]}</span>
              <button
                type="button"
                onClick={() => setLocks(current => ({ ...current, [track]: !current[track] }))}
                aria-pressed={locks[track]}
                className={`h-7 rounded px-2 text-[10px] font-semibold ${locks[track] ? 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/60' : 'border border-gray-700 text-gray-400'}`}
              >
                {locks[track] ? 'Locked' : 'Lock'}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={mutate} className="h-9 flex-1 rounded-md bg-cyan-600 px-3 text-xs font-semibold text-white hover:bg-cyan-500">Mutate unlocked</button>
          <button type="button" onClick={() => { onSeedLocksChange(locks); onSeedsChange(seeds); }} className="h-9 rounded-md border border-gray-700 px-3 text-xs text-gray-300 hover:border-gray-500">Save locks</button>
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-1">
          {(['bass', 'lead', 'drums'] as const).map(track => (
            <button key={track} type="button" onClick={() => onPreviewTrack(track)} className="h-8 rounded-md border border-cyan-700/40 text-[10px] text-cyan-200 hover:border-cyan-500">
              Preview {track}
            </button>
          ))}
        </div>
      </details>

      <details className="mt-2 rounded-xl border border-gray-800 bg-gray-900/40 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-gray-100">Arp Designer</summary>
        <label className="mt-3 flex items-center gap-2 text-xs text-gray-300">
          <input type="checkbox" checked={arpOn} onChange={event => setArpOn(event.target.checked)} className="accent-purple-500" />
          Enable arpeggio
        </label>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-gray-400">Pattern</span>
            <select value={settings.pattern} onChange={event => setSettings({ ...settings, pattern: event.target.value as ArpPattern })} className="h-9 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-100">
              <option value="up">Up</option>
              <option value="down">Down</option>
              <option value="up-down">Up / down</option>
              <option value="random">Random</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-gray-400">Rate</span>
            <select value={settings.rate} onChange={event => setSettings({ ...settings, rate: event.target.value as ArpRate })} className="h-9 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-100">
              <option value="eighth">Eighth</option>
              <option value="sixteenth">Sixteenth</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-gray-400">Octaves</span>
            <select value={settings.octaveRange} onChange={event => setSettings({ ...settings, octaveRange: Number(event.target.value) })} className="h-9 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-100">
              {[1, 2, 3].map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-gray-400">Gate</span>
            <input type="range" min={0.5} max={1} step={0.05} value={settings.gate} onChange={event => setSettings({ ...settings, gate: Number(event.target.value) })} className="accent-purple-500" />
          </label>
        </div>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => setASeed(randomSeed())} className="h-9 rounded-md border border-gray-700 px-3 text-xs text-gray-300 hover:border-gray-500">New seed</button>
          <button type="button" onClick={() => onPreviewArp(settings, aSeed)} className="h-9 rounded-md border border-cyan-600/50 bg-cyan-500/10 px-3 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20">Preview arp</button>
          <button type="button" onClick={() => onArpChange(arpOn, settings, aSeed)} className="h-9 flex-1 rounded-md bg-purple-600 px-3 text-xs font-semibold text-white hover:bg-purple-500">Apply arp</button>
        </div>
      </details>
    </Drawer>
  );
}
