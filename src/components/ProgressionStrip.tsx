import { useState } from 'react';
import type { ChordInfo } from '../utils/musicTheory';
import type { HarmonySuggestion } from '../utils/harmony';
import { getRomanNumeral } from '../utils/musicTheory';
import { Menu } from './Menu';

interface ProgressionStripProps {
  progression: ChordInfo[];
  activeIndex: number;
  selectedIndex: number | null;
  scaleName: string;
  scaleChords: ChordInfo[];
  availableChords: ChordInfo[];
  templates: { label: string; hint?: string }[];
  selectedTemplate: number;
  isPlaying: boolean;
  isPreviewing: boolean;
  custom: boolean;
  onSelect: (index: number) => void;
  onPreviewChord: (chord: ChordInfo) => void;
  onAddChord: (chord: ChordInfo) => void;
  onTemplateSelect: (index: number) => void;
  onTogglePreview: () => void;
  onResetToTemplate: () => void;
  suggestions: HarmonySuggestion[];
  onAddSuggestion: (suggestion: HarmonySuggestion) => void;
  onDetectKey: () => void;
}

export function ProgressionStrip({
  progression,
  activeIndex,
  selectedIndex,
  scaleName,
  scaleChords,
  availableChords,
  templates,
  selectedTemplate,
  isPlaying,
  isPreviewing,
  custom,
  onSelect,
  onPreviewChord,
  onAddChord,
  onTemplateSelect,
  onTogglePreview,
  onResetToTemplate,
  suggestions,
  onAddSuggestion,
  onDetectKey,
}: ProgressionStripProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const degreeOf = (chord: ChordInfo): string => {
    const index = scaleChords.findIndex(item => item.root === chord.root && item.type.name === chord.type.name);
    return index >= 0 ? getRomanNumeral(index, scaleName) : '?';
  };

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-2" aria-label="Chord progression">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Progression</span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
          <button
            type="button"
            onClick={onTogglePreview}
            className={`h-9 rounded-md px-2 text-[11px] font-medium transition-colors sm:h-8 ${
              isPreviewing
                ? 'bg-green-500/20 text-green-200 ring-1 ring-green-500/60'
                : 'border border-gray-700 text-gray-300 hover:border-gray-500'
            }`}
          >
            {isPreviewing ? 'Stop' : 'Preview'}
          </button>
          <button
            type="button"
            onClick={() => setShowSuggestions(value => !value)}
            aria-expanded={showSuggestions}
            className="h-9 rounded-md border border-cyan-700/60 px-2 text-[11px] font-medium text-cyan-200 transition-colors hover:border-cyan-500 sm:h-8"
          >
            Suggest
          </button>
          <button
            type="button"
            onClick={onDetectKey}
            title="Detect key and scale from the progression"
            className="h-9 rounded-md border border-gray-700 px-2 text-[11px] text-gray-300 transition-colors hover:border-gray-500 sm:h-8"
          >
            Detect
          </button>
          <Menu
            label="Template"
            items={templates.map((template, index) => ({
              label: template.label,
              hint: template.hint,
              onSelect: () => onTemplateSelect(index),
              disabled: selectedTemplate === index,
            }))}
          />
          <Menu
            label="+ Add chord"
            tone="primary"
            items={availableChords.map(chord => ({
              label: chord.display,
              hint: degreeOf(chord),
              onSelect: () => onAddChord(chord),
            }))}
          />
        </div>
      </div>

      {showSuggestions && (
        <div className="mt-1.5 rounded-lg border border-cyan-800/50 bg-cyan-950/20 p-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">Next chord ideas</span>
            <button type="button" onClick={() => setShowSuggestions(false)} className="text-[10px] text-gray-400 hover:text-gray-200">Close</button>
          </div>
          {suggestions.length === 0 && <p className="px-1 py-1 text-[11px] text-gray-400">No suggestions.</p>}
          {suggestions.map((suggestion, index) => (
            <div key={`${suggestion.chord.display}-${index}`} className="mt-1 flex items-center gap-1 rounded-md bg-gray-900/70 px-1.5 py-1">
              <button
                type="button"
                onClick={() => onAddSuggestion(suggestion)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="text-sm font-semibold text-white">{suggestion.chord.display}</span>
                <span className="truncate text-[10px] text-gray-400">{suggestion.kind} · {suggestion.reason}</span>
              </button>
              <button
                type="button"
                onClick={() => onPreviewChord(suggestion.chord)}
                aria-label={`Audition ${suggestion.chord.display}`}
                className="h-7 rounded border border-gray-700 px-1.5 text-[10px] text-gray-300 hover:border-gray-500"
              >
                ▶
              </button>
              <button
                type="button"
                onClick={() => onAddSuggestion(suggestion)}
                className="h-7 rounded bg-cyan-500/15 px-1.5 text-[10px] font-medium text-cyan-200 hover:bg-cyan-500/25"
              >
                Add
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1" role="list">
        {progression.map((chord, index) => {
          const active = isPlaying && activeIndex === index;
          const selected = selectedIndex === index;
          return (
            <button
              key={`${chord.root}-${chord.type.name}-${index}`}
              type="button"
              role="listitem"
              onClick={() => {
                onSelect(index);
                onPreviewChord(chord);
              }}
              aria-label={`${chord.display}, ${degreeOf(chord)}`}
              aria-pressed={selected}
              className={`flex min-w-[74px] shrink-0 flex-col items-center rounded-lg border px-2.5 py-1.5 transition-colors ${
                active
                  ? 'border-green-400 bg-green-500/20 text-green-200'
                  : selected
                    ? 'border-purple-400 bg-purple-500/15 text-purple-100'
                    : 'border-gray-700 bg-gray-800/60 text-gray-200 hover:border-gray-500'
              }`}
            >
              <span className="text-sm font-semibold leading-tight">{chord.display}</span>
              <span className="text-[10px] opacity-60">{degreeOf(chord)}</span>
            </button>
          );
        })}
        {progression.length === 0 && (
          <span className="py-2 text-xs text-gray-400">No chords yet — use “+ Add chord”.</span>
        )}
      </div>

      {custom && (
        <button
          type="button"
          onClick={onResetToTemplate}
          className="mt-0.5 text-[10px] text-gray-400 underline-offset-2 hover:text-gray-200 hover:underline"
        >
          Reset to genre template
        </button>
      )}
    </section>
  );
}
