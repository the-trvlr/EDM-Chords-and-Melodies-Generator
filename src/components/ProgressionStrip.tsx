import type { ChordInfo } from '../utils/musicTheory';
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
}: ProgressionStripProps) {
  const degreeOf = (chord: ChordInfo): string => {
    const index = scaleChords.findIndex(item => item.root === chord.root && item.type.name === chord.type.name);
    return index >= 0 ? getRomanNumeral(index, scaleName) : '?';
  };

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-2" aria-label="Chord progression">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Progression</span>
        <div className="ml-auto flex items-center gap-1">
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
