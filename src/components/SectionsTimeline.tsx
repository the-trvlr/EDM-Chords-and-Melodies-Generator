import { useState } from 'react';
import type { SectionKind, SongSection } from '../types';
import type { TrackId } from '../utils/schedule';

const KINDS: { id: SectionKind; label: string }[] = [
  { id: 'intro', label: 'Intro' },
  { id: 'build', label: 'Build' },
  { id: 'drop', label: 'Drop' },
  { id: 'break', label: 'Break' },
  { id: 'outro', label: 'Outro' },
];

const TRACKS: { id: TrackId; label: string }[] = [
  { id: 'chord', label: 'Chords' },
  { id: 'bass', label: 'Bass' },
  { id: 'lead', label: 'Lead' },
  { id: 'drums', label: 'Drums' },
];

const BARS = [2, 4, 8, 16];

function newSection(kind: SectionKind, bars: number, tracks: TrackId[]): SongSection {
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `section-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind,
    bars,
    tracks,
  };
}

function defaultStructure(): SongSection[] {
  return [
    newSection('intro', 4, ['chord']),
    newSection('build', 8, ['chord', 'drums']),
    newSection('drop', 8, ['chord', 'bass', 'lead', 'drums']),
    newSection('break', 4, ['chord', 'lead']),
    newSection('outro', 4, ['chord']),
  ];
}

interface SectionsTimelineProps {
  sections: SongSection[];
  onChange: (sections: SongSection[]) => void;
}

export function SectionsTimeline({ sections, onChange }: SectionsTimelineProps) {
  const [selectedId, setSelectedId] = useState<string | null>(sections[0]?.id ?? null);
  const totalBars = sections.reduce((sum, section) => sum + section.bars, 0);
  const selected = sections.find(section => section.id === selectedId) ?? sections[0] ?? null;

  const update = (next: SongSection[]) => onChange(next);

  const patchSelected = (patch: Partial<SongSection>) => {
    if (!selected) return;
    update(sections.map(section => section.id === selected.id ? { ...section, ...patch } : section));
  };

  const toggleTrack = (track: TrackId) => {
    if (!selected) return;
    const tracks = selected.tracks.includes(track)
      ? selected.tracks.filter(item => item !== track)
      : [...selected.tracks, track];
    patchSelected({ tracks });
  };

  const move = (direction: -1 | 1) => {
    if (!selected) return;
    const index = sections.findIndex(section => section.id === selected.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  };

  return (
    <section className="min-w-0 rounded-xl border border-gray-800 bg-gray-900/50 p-2 sm:p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-white">Song sections</h2>
        <span className="text-xs text-gray-400">
          {sections.length === 0 ? 'Looping the progression' : `${totalBars} bars total`}
        </span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {sections.length === 0 ? (
            <button
              type="button"
              onClick={() => update(defaultStructure())}
              className="h-11 rounded-md border border-purple-500/50 bg-purple-500/15 px-2 text-[11px] font-medium text-purple-200 hover:bg-purple-500/25 sm:h-8"
            >
              Create structure
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                const section = newSection('drop', 4, ['chord', 'bass', 'lead', 'drums']);
                update([...sections, section]);
                setSelectedId(section.id);
              }}
              className="h-11 rounded-md border border-gray-700 px-2 text-[11px] font-medium text-gray-200 hover:border-gray-500 sm:h-8"
            >
              + Section
            </button>
          )}
        </div>
      </div>

      {sections.length > 0 && (
        <>
          <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
            {sections.map(section => {
              const kind = KINDS.find(item => item.id === section.kind) ?? KINDS[2];
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setSelectedId(section.id)}
                  aria-pressed={selected?.id === section.id}
                  style={{ flexGrow: section.bars }}
                  className={`min-h-11 min-w-[4.5rem] rounded-md border px-2 text-left text-[11px] transition-colors ${
                    selected?.id === section.id
                      ? 'border-purple-500 bg-purple-500/20 text-purple-100'
                      : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <span className="block font-semibold">{kind.label}</span>
                  <span className="block text-gray-400">{section.bars} bars</span>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-gray-400">Type</span>
                <select
                  value={selected.kind}
                  onChange={event => patchSelected({ kind: event.target.value as SectionKind })}
                  className="h-11 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-200 sm:h-8"
                >
                  {KINDS.map(kind => <option key={kind.id} value={kind.id}>{kind.label}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-gray-400">Length</span>
                <select
                  value={selected.bars}
                  onChange={event => patchSelected({ bars: Number(event.target.value) })}
                  className="h-11 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-200 sm:h-8"
                >
                  {BARS.map(bars => <option key={bars} value={bars}>{bars} bars</option>)}
                </select>
              </label>

              <div className="flex flex-wrap gap-1" role="group" aria-label="Tracks in this section">
                {TRACKS.map(track => (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => toggleTrack(track.id)}
                    aria-pressed={selected.tracks.includes(track.id)}
                    className={`h-11 rounded-md px-2 text-[11px] font-medium transition-colors sm:h-8 ${
                      selected.tracks.includes(track.id)
                        ? 'bg-cyan-600/25 text-cyan-100 ring-1 ring-cyan-500/60'
                        : 'border border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    {track.label}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => move(-1)}
                  aria-label="Move section left"
                  className="h-11 rounded-md border border-gray-700 px-2 text-xs text-gray-200 hover:border-gray-500 sm:h-8"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => move(1)}
                  aria-label="Move section right"
                  className="h-11 rounded-md border border-gray-700 px-2 text-xs text-gray-200 hover:border-gray-500 sm:h-8"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const section = { ...newSection(selected.kind, selected.bars, selected.tracks) };
                    const index = sections.findIndex(item => item.id === selected.id);
                    const next = [...sections];
                    next.splice(index + 1, 0, section);
                    update(next);
                    setSelectedId(section.id);
                  }}
                  className="h-11 rounded-md border border-gray-700 px-2 text-[11px] text-gray-200 hover:border-gray-500 sm:h-8"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    update(sections.filter(item => item.id !== selected.id));
                    setSelectedId(null);
                  }}
                  className="h-11 rounded-md border border-rose-700/60 px-2 text-[11px] text-rose-300 hover:border-rose-500 sm:h-8"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
