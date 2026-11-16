import { useState } from 'react';
import type { SectionEnergy, SectionKind, SongSection } from '../types';
import { ARRANGEMENT_TEMPLATES, type TemplateSection } from '../data/arrangementTemplates';
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

const BARS = [2, 4, 6, 8, 12, 16];

function newSection(kind: SectionKind, bars: number, tracks: TrackId[], energy: SectionEnergy = 'medium', fill = false): SongSection {
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `section-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind,
    bars,
    tracks,
    energy,
    fill,
  };
}

function buildTemplate(template: TemplateSection[]): SongSection[] {
  return template.map(section => newSection(
    section.kind,
    section.bars,
    [...section.tracks],
    section.energy,
    section.fill,
  ));
}

function defaultStructure(): SongSection[] {
  return buildTemplate(ARRANGEMENT_TEMPLATES[0].sections);
}


interface SectionsTimelineProps {
  sections: SongSection[];
  bpm: number;
  onChange: (sections: SongSection[]) => void;
}

function durationLabel(bars: number, bpm: number): string {
  const seconds = Math.round(bars * 4 * 60 / Math.max(1, bpm));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function SectionsTimeline({ sections, bpm, onChange }: SectionsTimelineProps) {
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
          {sections.length === 0 ? 'Looping the progression' : `${totalBars} bars · ~${durationLabel(totalBars, bpm)}`}
        </span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <select
            value=""
            onChange={event => {
              const template = ARRANGEMENT_TEMPLATES.find(item => item.name === event.target.value);
              if (template) {
                update(buildTemplate(template.sections));
                setSelectedId(null);
              }
            }}
            aria-label="Arrangement template"
            className="h-11 rounded-md border border-gray-700 bg-gray-900 px-2 text-[11px] text-gray-200 sm:h-8"
          >
            <option value="">Template…</option>
            {(['sketch', 'song'] as const).map(group => (
              <optgroup key={group} label={group === 'sketch' ? 'Sketch' : 'Song'}>
                {ARRANGEMENT_TEMPLATES.filter(template => template.group === group).map(template => {
                  const bars = template.sections.reduce((sum, section) => sum + section.bars, 0);
                  return (
                    <option key={template.name} value={template.name}>
                      {template.name} · ~{durationLabel(bars, bpm)}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
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
                  <span className="block text-gray-400">{section.bars} bars · {section.energy ?? 'medium'}</span>
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
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-gray-400">Energy</span>
                <select
                  value={selected.energy ?? 'medium'}
                  onChange={event => patchSelected({ energy: event.target.value as SectionEnergy })}
                  className="h-11 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-200 sm:h-8"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-gray-400">Melody</span>
                <select
                  value={selected.density ?? 'medium'}
                  onChange={event => patchSelected({ density: event.target.value as SongSection['density'] })}
                  aria-label="Melody density"
                  className="h-11 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-200 sm:h-8"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-gray-400">Oct</span>
                <select
                  value={selected.octaveShift ?? 0}
                  onChange={event => patchSelected({ octaveShift: Number(event.target.value) })}
                  aria-label="Melody octave shift"
                  className="h-11 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-200 sm:h-8"
                >
                  <option value={-1}>−1</option>
                  <option value={0}>0</option>
                  <option value={1}>+1</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-gray-400">Drums</span>
                <select
                  value={selected.drumDensity ?? 'medium'}
                  onChange={event => patchSelected({ drumDensity: event.target.value as SongSection['drumDensity'] })}
                  aria-label="Drum density"
                  className="h-11 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-200 sm:h-8"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => patchSelected({ fill: !selected.fill })}
                aria-pressed={selected.fill === true}
                title="Add a drum fill in the last bar of this section"
                className={`h-11 rounded-md px-2 text-[11px] font-medium transition-colors sm:h-8 ${
                  selected.fill
                    ? 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/60'
                    : 'border border-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                Fill
              </button>

              <button
                type="button"
                onClick={() => patchSelected({ fx: selected.fx === false })}
                aria-pressed={selected.fx !== false}
                title="Automatic riser, impact and downlifter at section boundaries"
                className={`h-11 rounded-md px-2 text-[11px] font-medium transition-colors sm:h-8 ${
                  selected.fx !== false
                    ? 'bg-fuchsia-500/20 text-fuchsia-200 ring-1 ring-fuchsia-400/60'
                    : 'border border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                FX
              </button>

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
