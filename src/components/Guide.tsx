import { useMemo, useState } from 'react';
import { Drawer } from './Drawer';

interface GuideEntry {
  id: string;
  title: string;
  target?: string;
  body: string;
  steps?: string[];
}

const QUICK_START = [
  { title: '1. Harmony', body: 'Choose key, scale and genre. Pick a progression or generate one, then audition chords.', target: 'harmony' },
  { title: '2. Idea', body: 'Generate bass and lead, edit notes, audition motifs and lock the parts you like.', target: 'tracks' },
  { title: '3. Groove', body: 'Set swing, humanize and per-track time feel so the parts sit together.', target: 'groove' },
  { title: '4. Arrange', body: 'Build sections, set energy/density, call & response, FX and fills.', target: 'arrangement' },
  { title: '5. Export', body: 'Save the project, then export MIDI, WAV, stems or a DAW pack.', target: 'export-actions' },
];

const ENTRIES: GuideEntry[] = [
  {
    id: 'harmony',
    title: 'Harmony and progression',
    target: 'harmony',
    body: 'The top bar sets key, scale, genre and chord complexity. The progression strip holds four chord cards by default. Select a card to edit it in the Inspector, or use Suggest / Detect / Template.',
    steps: [
      'Click a chord card to open its notes, inversion and voicing controls.',
      'Use Preview to hear the progression on its own.',
      'Add chord opens the chord picker; Undo is always available.',
      'Pinned chords survive Voice lead changes.',
    ],
  },
  {
    id: 'generate',
    title: 'Generate a progression',
    target: 'harmony',
    body: 'Generate opens a drawer with mood, 4/8-bar length and voice-leading. Three options are shown as A/B/C; audition any chord, then Apply. It replaces the current progression as one Undo step.',
  },
  {
    id: 'keys',
    title: 'Key & scale explorer',
    target: 'harmony',
    body: 'Keys opens the tonality drawer: pick any key and scale, inspect the seven diatonic chords, then apply both at once. Custom progressions stay in their current voicing unless you change the key.',
  },
  {
    id: 'voicing',
    title: 'Voicing engine',
    target: 'inspector',
    body: 'Select a chord and open Voicing in the Inspector. Close, Open, Drop 2 and Spread move the same chord tones without changing root or chord type; Audition compares them.',
  },
  {
    id: 'tracks',
    title: 'Bass, lead and drums',
    target: 'tracks',
    body: 'Every track has its own generator, instrument and piano roll. Generate or Regenerate, then edit notes directly. Drum lanes are edited in the step grid.',
    steps: [
      'Pick a style, density and variation, then Generate.',
      'Drag notes in the piano roll; shift-drag selects, Delete removes.',
      'Use the velocity lane below the roll for accents.',
      'Track Preview auditions the pattern without the arrangement.',
    ],
  },
  {
    id: 'idea',
    title: 'Idea Lab — motif, seeds and arp',
    target: 'tracks',
    body: 'Open Idea lab above the tracks. Select a section first to edit its clip; Whole song edits the global line. Motif has separate Source and Target (Lead→Bass or Bass→Lead), 1/2/4-bar phrase capture and non-cumulative Invert/Retrograde/Augment/Diminish. Seeds locks individual parts; Arp Designer controls pattern, rate, octaves and gate.',
  },
  {
    id: 'sections',
    title: 'Song sections and arrangement',
    target: 'arrangement',
    body: 'Sections define bar length, active tracks, energy, melody density, octave, drum density/energy, call & response and transition FX. Select a section chip to edit it; the bass/lead lanes switch to that section clip (or the global line repeated), and edits stay inside the section.',
    steps: [
      'Create structure or pick a Sketch/Song template.',
      'Select a section chip to edit its settings.',
      'FX adds a riser, impact and downlifter at boundaries.',
      'Use Fill on a build to add a snare/hat roll in its last bar.',
    ],
  },
  {
    id: 'groove',
    title: 'Groove and time feel',
    target: 'groove',
    body: 'Swing delays odd sixteenths; Humanize adds small timing offsets. Per-track ½ / 1× / 2× changes note density without touching the underlying pattern.',
    steps: [
      'Start with 0–15% swing for house, more for hip-hop feel.',
      'Use 2× on hats/ride for double-time energy; kick/snare stay grounded.',
      'Humanize is musical randomness — keep it off for tight EDM drops.',
    ],
  },
  {
    id: 'export',
    title: 'Export and DAW hand-off',
    target: 'export-actions',
    body: 'Export MIDI, a WAV mix, dry stems or a DAW pack. The bottom progress bar stays visible during rendering; stems are rendered in one pass and DAW pack includes MIDI, stems, project.json and README.',
    steps: [
      'DAW pack is the recommended hand-off.',
      'MIDI uses channels 1/2/3/10 plus GM programs; the Sections track carries markers.',
      'Stems are dry (no reverb/FX) so you can process them in the DAW.',
      'Project JSON restores the whole session, including sections and edited notes.',
    ],
  },
  {
    id: 'groove-engine',
    title: 'Groove engine',
    target: 'groove',
    body: 'Groove opens per-track swing controls. Give drums a tighter grid and chords more swing for a human pocket; presets Tight/Pocket/Loose/Shuffle set all four tracks at once.',
  },
  {
    id: 'energy-curve',
    title: 'Energy curve',
    target: 'arrangement',
    body: 'Energy curve opens from Song sections. Set each section Low/Medium/High, use Auto shape for a classic intro→build→drop arc, then Apply curve.',
  },
  {
    id: 'reference',
    title: 'Reference analysis',
    target: 'export-actions',
    body: 'Reference opens from the header. Drop a MIDI or audio file to estimate BPM/key; MIDI also yields chord ideas. Choose which parts to use and apply them as a starting point. Audio analysis is approximate; MIDI is more precise.',
  },
  {
    id: 'shortcuts',
    title: 'Keyboard and MIDI',
    body: 'Space starts/stops. Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z undo/redo. Cmd/Ctrl+S saves a project JSON, Cmd/Ctrl+O opens one. A–K plays notes from C4; connect a MIDI controller with the MIDI button.',
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    body: 'FL Studio imports only Chords from arrangement.mid? Use the separate midi/chords.mid, bass.mid, lead.mid and drums.mid files in the DAW pack. Export taking a while? The progress bar shows the current stage; stems render once. Safari playhead drift is a known Safari-only issue; Chrome/Edge are the reference browsers.',
  },
  {
    id: 'next',
    title: 'Coming next',
    body: 'Harmony, Idea Lab, Groove engine, Energy curve and Reference analysis are live. Remaining: final polish, more e2e coverage and performance.',
  },
];

interface GuideProps {
  open: boolean;
  onClose: () => void;
  onShowTarget: (target: string) => void;
}

export function Guide({ open, onClose, onShowTarget }: GuideProps) {
  const [query, setQuery] = useState('');
  const [openEntry, setOpenEntry] = useState<string | null>('harmony');

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return ENTRIES;
    return ENTRIES.filter(entry =>
      `${entry.title} ${entry.body} ${(entry.steps ?? []).join(' ')}`.toLowerCase().includes(term),
    );
  }, [query]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Guide"
      description="A short workflow, the controls you need, and answers without leaving the studio."
      widthClassName="sm:max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-gray-500">All processing stays local.</span>
          <button type="button" onClick={onClose} className="h-9 rounded-md bg-purple-600 px-3 text-xs font-semibold text-white hover:bg-purple-500">
            Back to studio
          </button>
        </div>
      }
    >
      <div className="mb-4 rounded-xl border border-purple-500/30 bg-purple-500/10 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-200">Quick start</p>
        <div className="mt-2 grid gap-1.5">
          {QUICK_START.map(step => (
            <button
              key={step.title}
              type="button"
              onClick={() => onShowTarget(step.target)}
              className="flex items-start gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-purple-500/10"
            >
              <span className="mt-0.5 text-[11px] font-semibold text-purple-200">{step.title.split('.')[0]}</span>
              <span className="min-w-0">
                <span className="block text-xs font-medium text-gray-100">{step.title.replace(/^\d+\.\s*/, '')}</span>
                <span className="block text-[11px] leading-snug text-gray-400">{step.body}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <label className="mb-3 flex items-center gap-2 rounded-md border border-gray-700 bg-gray-900 px-2">
        <span className="text-gray-500" aria-hidden="true">⌕</span>
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search the guide…"
          aria-label="Search guide"
          className="h-9 min-w-0 flex-1 bg-transparent text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none"
        />
      </label>

      <div className="space-y-2">
        {filtered.length === 0 && <p className="py-6 text-center text-xs text-gray-400">No guide entries match “{query}”.</p>}
        {filtered.map(entry => {
          const expanded = openEntry === entry.id || query.trim().length > 0;
          return (
            <div key={entry.id} className="rounded-lg border border-gray-800 bg-gray-900/50">
              <button
                type="button"
                onClick={() => setOpenEntry(current => current === entry.id ? null : entry.id)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                <span className="min-w-0 flex-1 text-xs font-semibold text-gray-100">{entry.title}</span>
                <span className="text-gray-500" aria-hidden="true">{expanded ? '−' : '+'}</span>
              </button>
              {expanded && (
                <div className="px-3 pb-3">
                  <p className="text-[11px] leading-relaxed text-gray-400">{entry.body}</p>
                  {entry.steps && (
                    <ul className="mt-2 space-y-1">
                      {entry.steps.map(step => (
                        <li key={step} className="flex gap-1.5 text-[11px] leading-snug text-gray-300">
                          <span className="text-purple-300">•</span>{step}
                        </li>
                      ))}
                    </ul>
                  )}
                  {entry.target && (
                    <button
                      type="button"
                      onClick={() => onShowTarget(entry.target!)}
                      className="mt-2 rounded-md border border-gray-700 px-2 py-1 text-[11px] text-purple-200 hover:border-purple-500"
                    >
                      Show me
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}
