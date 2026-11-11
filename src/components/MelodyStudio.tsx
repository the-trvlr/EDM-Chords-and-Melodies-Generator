import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ChordInfo } from '../utils/musicTheory';
import { SYNTH_PRESETS, TRACK_SYNTH_IDS, type SynthPresetId } from '../utils/audioEngine';
import { fitNotesToSpan, generateMelody, getGenreMelodyStyles, melodySpanLabel, type GeneratedMelody, type MelodyContour, type MelodyDensity, type MelodyNote, type MelodyStyle, type MelodyVariation } from '../utils/melodyGenerator';
import type { RhythmPattern } from '../data/genres';
import { DRUM_KITS, type DrumKitId } from '../data/drumKits';
import {
  playArrangement,
  playTrackPreview,
  renderArrangementToWav,
  setArrangementBpm,
  setArrangementLoop,
  setTrackMute,
  setTrackSolo,
  setTrackVolume,
  stopArrangement,
  stopTrackPreview,
  getArrangementTotalSteps,
  getTransportStep,
  updateDrumKit,
  type TrackId,
} from '../utils/mixer';
import { buildArrangementMidiBytes, exportArrangementToMidi, exportDrumsToMidi, exportMelodyToMidi } from '../utils/midiExport';
import { stopPlayback } from '../utils/audioEngine';
import { arpeggiate, type ArpPattern, type ArpRate } from '../utils/arpeggiator';
import { generateDrums, type DrumPattern } from '../utils/drumGenerator';
import { deleteArrangement, duplicateArrangement, getSavedArrangements, renameArrangement, saveArrangement, serializeProject, type SavedArrangement } from '../utils/persistence';
import type { MelodyState, MixerState, ProjectSnapshot, SongSection, TrackMix } from '../types';
import { Modal } from './Modal';
import { ChordLane, DrumGrid, EditablePianoRoll, PianoRollLane, VelocityLane } from './lanes';
import { useToast } from '../hooks/useToast';
import { SectionsTimeline } from './SectionsTimeline';
import { songBars } from '../utils/schedule';
import { zipSync } from 'fflate';

function quantizeNotes(notes: MelodyNote[], grid = 2): MelodyNote[] {
  const byKey = new Map<string, MelodyNote>();
  for (const note of notes) {
    const step = Math.max(0, Math.round(note.step / grid) * grid);
    const duration = Math.max(grid, Math.round(note.duration / grid) * grid);
    byKey.set(`${step}-${note.midi}`, { ...note, step, duration });
  }
  return [...byKey.values()].sort((a, b) => a.step - b.step);
}

function repeatFirstBar(notes: MelodyNote[], bars: number): MelodyNote[] {
  const first = notes.filter(note => note.step < 16);
  if (first.length === 0) return notes;
  const result: MelodyNote[] = [];
  for (let bar = 0; bar < Math.max(1, bars); bar++) {
    for (const note of first) {
      result.push({ ...note, step: bar * 16 + (note.step % 16) });
    }
  }
  return result.sort((a, b) => a.step - b.step);
}

export interface MelodyStudioHandle {
  undo: () => void;
  redo: () => void;
  openSaveDialog: () => void;
  openLoadDialog: () => void;
  exportMidi: () => void;
  exportWav: () => void;
  exportStems: () => void;
  exportDawPack: () => void;
}

interface MelodyStudioProps {
  progression: ChordInfo[];
  rhythm: RhythmPattern;
  rhythms: RhythmPattern[];
  onRhythmChange: (rhythm: RhythmPattern) => void;
  rootKey: string;
  scaleType: string;
  bpm: number;
  genreId: string;
  loop: boolean;
  doubleTime: boolean;
  masterVolume: number;
  metronome: boolean;
  countInBars: number;
  loopBars: number;
  projectName: string;
  isPlaying: boolean;
  onPlayingChange: (playing: boolean) => void;
  melody: MelodyState;
  onMelodyChange: (melody: MelodyState) => void;
  onStepChange?: (step: number | null) => void;
  project: ProjectSnapshot;
  onApplyProject: (project: ProjectSnapshot) => void;
  onStopOtherPlayback?: () => void;
}

interface MelodyHistory {
  list: MelodyState[];
  index: number;
}

const TRACK_COLORS: Record<TrackId, { text: string; dot: string }> = {
  chord: { text: 'text-purple-300', dot: 'bg-purple-400' },
  bass: { text: 'text-orange-300', dot: 'bg-orange-400' },
  lead: { text: 'text-cyan-300', dot: 'bg-cyan-400' },
  drums: { text: 'text-rose-300', dot: 'bg-rose-400' },
};

const labelClass = 'text-[11px] uppercase tracking-wide text-gray-400';

function TrackHeader({
  trackId,
  label,
  mix,
  synthId,
  onMixChange,
  onSynthChange,
  onPreview,
  previewing,
  busy,
  timeScale,
  onTimeScaleChange,
  extra,
}: {
  trackId: TrackId;
  label: string;
  mix: TrackMix;
  synthId?: SynthPresetId;
  onMixChange: (patch: Partial<TrackMix>) => void;
  onSynthChange?: (id: SynthPresetId) => void;
  onPreview: () => void;
  previewing: boolean;
  busy: boolean;
  timeScale: number;
  onTimeScaleChange: (scale: number) => void;
  extra?: ReactNode;
}) {
  const colors = TRACK_COLORS[trackId];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colors.dot}`} aria-hidden="true" />
      <h3 className={`w-16 shrink-0 text-sm font-semibold ${colors.text}`}>{label}</h3>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onMixChange({ mute: !mix.mute })}
          aria-pressed={mix.mute}
          aria-label={`Mute ${label}`}
          className={`h-11 w-11 rounded-md text-[11px] font-bold transition-colors sm:h-7 sm:w-7 ${
            mix.mute ? 'bg-rose-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          M
        </button>
        <button
          type="button"
          onClick={() => onMixChange({ solo: !mix.solo })}
          aria-pressed={mix.solo}
          aria-label={`Solo ${label}`}
          className={`h-11 w-11 rounded-md text-[11px] font-bold transition-colors sm:h-7 sm:w-7 ${
            mix.solo ? 'bg-amber-400 text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          S
        </button>
      </div>

      <div className="flex items-center gap-0.5" role="group" aria-label={`${label} time feel`}>
        {[
          { value: 0.5, label: '½', title: trackId === 'drums' ? 'Half-time hats/ride; kick & snare stay' : 'Half time' },
          { value: 1, label: '1×', title: 'Normal time' },
          { value: 2, label: '2×', title: trackId === 'drums' ? 'Double-time hats/ride; kick & snare stay' : 'Double time' },
        ].map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => onTimeScaleChange(option.value)}
            aria-pressed={timeScale === option.value}
            aria-label={`${label} ${option.title.toLowerCase()}`}
            title={option.title}
            className={`h-9 w-6 rounded text-[10px] font-semibold transition-colors sm:h-7 ${
              timeScale === option.value
                ? 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-500/60'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {synthId && onSynthChange && (
        <label className="flex min-w-0 items-center gap-1">
          <span className="sr-only">{label} instrument</span>
          <select
            value={synthId}
            onChange={event => onSynthChange(event.target.value as SynthPresetId)}
            aria-label={`${label} instrument`}
            className="h-11 max-w-[9rem] rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-200 focus:border-purple-500 focus:outline-none sm:h-8"
          >
            {SYNTH_PRESETS.filter(preset =>
              trackId === 'drums'
                ? true
                : (TRACK_SYNTH_IDS[trackId].includes(preset.id) || preset.id === synthId),
            ).map(preset => (
              <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
          </select>
        </label>
      )}

      <label className="flex min-w-0 items-center gap-1.5">
        <span className="sr-only">{label} volume</span>
        <input
          type="range"
          min={-30}
          max={6}
          step={1}
          value={mix.volume}
          onChange={event => onMixChange({ volume: Number(event.target.value) })}
          aria-label={`${label} volume`}
          className="w-20 accent-purple-500 sm:w-24"
        />
        <span className="w-12 text-[11px] tabular-nums text-gray-400">
          {mix.volume > 0 ? '+' : ''}{mix.volume} dB
        </span>
      </label>

      {extra}

      <button
        type="button"
        onClick={onPreview}
        disabled={busy || previewing}
        aria-label={`Preview ${label}`}
        className="ml-auto h-11 rounded-md border border-gray-700 px-3 text-xs font-semibold text-gray-200 transition-colors hover:border-gray-500 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8"
      >
        {previewing ? 'Playing…' : 'Preview'}
      </button>
    </div>
  );
}

function OctaveStepper({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={`${label} octave`}>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= -2}
        aria-label={`Octave down for ${label}`}
        className="h-11 w-8 rounded-md border border-gray-700 text-sm text-gray-200 hover:border-gray-500 disabled:opacity-40 sm:h-8"
      >
        −
      </button>
      <span className="w-11 text-center text-[11px] tabular-nums text-gray-300">
        Oct {value > 0 ? '+' : ''}{value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= 2}
        aria-label={`Octave up for ${label}`}
        className="h-11 w-8 rounded-md border border-gray-700 text-sm text-gray-200 hover:border-gray-500 disabled:opacity-40 sm:h-8"
      >
        +
      </button>
    </div>
  );
}

export const MelodyStudio = forwardRef<MelodyStudioHandle, MelodyStudioProps>(function MelodyStudio({
  progression,
  rhythm,
  rhythms,
  onRhythmChange,
  rootKey,
  scaleType,
  bpm,
  genreId,
  loop,
  doubleTime,
  masterVolume,
  metronome,
  countInBars,
  loopBars,
  projectName,
  isPlaying,
  onPlayingChange,
  melody,
  onMelodyChange,
  onStepChange,
  project,
  onApplyProject,
  onStopOtherPlayback,
}, ref) {
  const toast = useToast();
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [previewingTrack, setPreviewingTrack] = useState<TrackId | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderingStems, setRenderingStems] = useState(false);
  const [history, setHistory] = useState<MelodyHistory>({ list: [melody], index: 0 });
  const [saveDialog, setSaveDialog] = useState(false);
  const [loadDialog, setLoadDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedArrangements, setSavedArrangements] = useState<SavedArrangement[]>([]);
  const [renameTarget, setRenameTarget] = useState<SavedArrangement | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const liveRef = useRef({ bpm, loop, drumKitId: melody.drumKitId, metronome, countInBars });
  useEffect(() => {
    liveRef.current = { bpm, loop, drumKitId: melody.drumKitId, metronome, countInBars };
  }, [bpm, loop, melody.drumKitId, metronome, countInBars]);

  const bassStyles = getGenreMelodyStyles(genreId, 'bass');
  const leadStyles = getGenreMelodyStyles(genreId, 'lead');
  const bassStyleId = bassStyles.some(style => style.id === melody.bassStyleId)
    ? melody.bassStyleId
    : bassStyles[0]?.id ?? '';
  const leadStyleId = leadStyles.some(style => style.id === melody.leadStyleId)
    ? melody.leadStyleId
    : leadStyles[0]?.id ?? '';

  const generatedBass = useMemo(
    () => generateMelody(progression, 'bass', bassStyleId, rootKey, scaleType, melody.bassSeed, melody.rangeSpans.bass, { density: melody.bassDensity, idea: melody.bassIdea, contour: melody.bassContour, variation: melody.bassVariation, barFilter: melody.callResponse ? 0 : undefined }),
    // Melodies are pure functions of these values; memoisation keeps the
    // playhead (16 updates per bar) from regenerating them on every tick.
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    [progression, bassStyleId, rootKey, scaleType, melody.bassSeed, melody.rangeSpans.bass, melody.bassDensity, melody.bassIdea, melody.bassContour, melody.bassVariation, melody.callResponse],
  );
  const generatedLead = useMemo(
    () => generateMelody(progression, 'lead', leadStyleId, rootKey, scaleType, melody.leadSeed, melody.rangeSpans.lead, { density: melody.leadDensity, idea: melody.leadIdea, contour: melody.leadContour, variation: melody.leadVariation, barFilter: melody.callResponse ? 1 : undefined }),
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    [progression, leadStyleId, rootKey, scaleType, melody.leadSeed, melody.rangeSpans.lead, melody.leadDensity, melody.leadIdea, melody.leadContour, melody.leadVariation, melody.callResponse],
  );
  const bassMelody: GeneratedMelody = useMemo(() => (
    melody.bassNotes
      ? { notes: melody.bassNotes, type: 'bass', styleId: 'edited', stepsPerChord: 16 }
      : generatedBass
  ), [melody.bassNotes, generatedBass]);
  const leadMelody: GeneratedMelody = useMemo(() => (
    melody.leadNotes
      ? { notes: melody.leadNotes, type: 'lead', styleId: 'edited', stepsPerChord: 16 }
      : generatedLead
  ), [melody.leadNotes, generatedLead]);
  const arpMelody = useMemo(
    () => melody.arpEnabled ? arpeggiate(progression, melody.arpSettings, melody.arpSeed) : null,
    [progression, melody.arpEnabled, melody.arpSettings, melody.arpSeed],
  );
  const drumPattern = useMemo(
    () => melody.customDrumPattern ?? generateDrums(genreId, melody.drumSeed),
    [melody.customDrumPattern, genreId, melody.drumSeed],
  );

  const bars = Math.max(1, songBars({ chords: progression, sections: melody.sections }));
  const laneBars = Math.max(1, progression.length);
  const laneSteps = laneBars * 16;

  const apply = useCallback((patch: Partial<MelodyState>) => {
    const next: MelodyState = { ...melody, ...patch };
    setHistory(prev => {
      const list = [...prev.list.slice(0, prev.index + 1), next].slice(-50);
      return { list, index: list.length - 1 };
    });
    onMelodyChange(next);
  }, [melody, onMelodyChange]);

  const undo = useCallback(() => {
    if (history.index <= 0) return;
    const index = history.index - 1;
    onMelodyChange(history.list[index]);
    setHistory({ list: history.list, index });
  }, [history, onMelodyChange]);

  const redo = useCallback(() => {
    if (history.index >= history.list.length - 1) return;
    const index = history.index + 1;
    onMelodyChange(history.list[index]);
    setHistory({ list: history.list, index });
  }, [history, onMelodyChange]);

  const startEngine = useCallback(() => {
    stopPlayback();
    onStopOtherPlayback?.();
    playArrangement({
      chords: progression,
      rhythm,
      bass: bassMelody,
      lead: leadMelody,
      arpMelody,
      drums: drumPattern,
      synthIds: melody.synthIds,
      bpm: liveRef.current.bpm,
      loop: liveRef.current.loop,
      drumKitId: liveRef.current.drumKitId,
      metronome: liveRef.current.metronome,
      countInBars: liveRef.current.countInBars,
      loopBars,
      sections: melody.sections,
      octaves: melody.octaves,
      swing: melody.swing,
      humanize: melody.humanize,
      timeScales: melody.timeScales,
      bassGlide: melody.bassGlide,
      soundVariant: melody.soundVariant,
      onStop: () => {
        setActiveStep(null);
        onStepChange?.(null);
        onPlayingChange(false);
      },
    });
  // Restart when the sounding configuration changes (structure, octaves, groove),
  // but not when unrelated melody state (e.g. preview dialogs) changes.
  }, [progression, rhythm, bassMelody, leadMelody, arpMelody, drumPattern, melody.synthIds, melody.sections, melody.octaves, melody.swing, melody.humanize, melody.timeScales, melody.bassGlide, melody.soundVariant, loopBars, onPlayingChange, onStepChange, onStopOtherPlayback]);

  useEffect(() => {
    if (!isPlaying) {
      stopArrangement();
      return;
    }
    startEngine();
    return () => stopArrangement();
  }, [isPlaying, startEngine]);

  useEffect(() => {
    if (isPlaying) setArrangementBpm(bpm);
  }, [bpm, isPlaying]);

  // The playhead follows the audio transport clock instead of Tone.Draw
  // callbacks, so it starts with the first sound and does not drift.
  const songLengthSteps = Math.max(1, songBars({ chords: progression, sections: melody.sections }) * 16);
  useEffect(() => {
    if (!isPlaying && previewingTrack === null) return;
    let frame = 0;
    let last = -1;
    const tick = () => {
      const step = getTransportStep(bpm) % (isPlaying ? Math.max(1, getArrangementTotalSteps()) : songLengthSteps);
      if (step !== last) {
        last = step;
        setActiveStep(step);
        onStepChange?.(step);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, previewingTrack, bpm, songLengthSteps, onStepChange]);

  useEffect(() => {
    setArrangementLoop(loop);
  }, [loop]);

  useEffect(() => {
    updateDrumKit(melody.drumKitId);
  }, [melody.drumKitId]);

  useEffect(() => {
    (Object.keys(melody.mixer) as TrackId[]).forEach(track => {
      setTrackVolume(track, melody.mixer[track].volume);
      setTrackMute(track, melody.mixer[track].mute);
      setTrackSolo(track, melody.mixer[track].solo);
    });
  }, [melody.mixer]);

  useEffect(() => () => {
    stopArrangement();
    stopTrackPreview();
  }, []);

  const updateMix = useCallback((track: TrackId, patch: Partial<TrackMix>) => {
    const mixer: MixerState = {
      ...melody.mixer,
      [track]: { ...melody.mixer[track], ...patch },
    };
    apply({ mixer });
  }, [apply, melody.mixer]);

  const handlePreview = useCallback((trackId: TrackId) => {
    stopPlayback();
    onStopOtherPlayback?.();
    stopArrangement();
    setPreviewingTrack(trackId);
    playTrackPreview({
      chords: progression,
      rhythm,
      bass: bassMelody,
      lead: leadMelody,
      arpMelody,
      drums: drumPattern,
      synthIds: melody.synthIds,
      bpm,
      drumKitId: melody.drumKitId,
      sections: melody.sections,
      octaves: melody.octaves,
      swing: melody.swing,
      humanize: melody.humanize,
      timeScales: melody.timeScales,
      bassGlide: melody.bassGlide,
      soundVariant: melody.soundVariant,
      trackId,
      onStop: () => {
        setPreviewingTrack(null);
        setActiveStep(null);
        onStepChange?.(null);
      },
    });
  }, [progression, rhythm, bassMelody, leadMelody, arpMelody, drumPattern, melody.synthIds, melody.drumKitId, melody.sections, melody.octaves, melody.swing, melody.humanize, melody.timeScales, melody.bassGlide, melody.soundVariant, bpm, onStepChange, onStopOtherPlayback]);

  const handleToggleDrumNote = useCallback((instrument: keyof DrumPattern, step: number) => {
    const base = melody.customDrumPattern ?? generateDrums(genreId, melody.drumSeed);
    const nextPattern: DrumPattern = {
      ...base,
      [instrument]: base[instrument].map((value, index) => index === step ? (value ? 0 : 1) : value),
    };
    apply({ customDrumPattern: nextPattern });
  }, [apply, genreId, melody.customDrumPattern, melody.drumSeed]);

  const handleSectionsChange = useCallback((sections: SongSection[]) => {
    apply({ sections });
  }, [apply]);

  const handleBassNotes = useCallback((notes: MelodyNote[]) => {
    apply({ bassNotes: notes });
  }, [apply]);

  const handleLeadNotes = useCallback((notes: MelodyNote[]) => {
    apply({ leadNotes: notes });
  }, [apply]);

  const handleSpanChange = useCallback((track: 'bass' | 'lead', span: number) => {
    const fitEdited = (notes: MelodyNote[] | null) => notes ? fitNotesToSpan(notes, track, span) : null;

    if (track === 'bass') {
      apply({ rangeSpans: { ...melody.rangeSpans, bass: span }, bassNotes: fitEdited(melody.bassNotes) });
    } else {
      apply({ rangeSpans: { ...melody.rangeSpans, lead: span }, leadNotes: fitEdited(melody.leadNotes) });
    }
  }, [apply, melody.rangeSpans, melody.bassNotes, melody.leadNotes]);

  const spanOptions = [1, 2, 3].map(span => (
    <option key={span} value={span}>{melodySpanLabel(span)}</option>
  ));

  const densityOptions = (['sparse', 'medium', 'busy'] as MelodyDensity[]).map(density => (
    <option key={density} value={density}>{density[0].toUpperCase() + density.slice(1)}</option>
  ));
  const contourOptions = (['low', 'mid', 'high'] as MelodyContour[]).map(contour => (
    <option key={contour} value={contour}>{contour[0].toUpperCase() + contour.slice(1)}</option>
  ));
  const variationOptions = (['off', 'repeat', 'transpose', 'invert'] as MelodyVariation[]).map(variation => (
    <option key={variation} value={variation}>{variation[0].toUpperCase() + variation.slice(1)}</option>
  ));

  const handleExportStems = useCallback(async () => {
    setRenderingStems(true);
    try {
      const files: Record<string, Uint8Array> = {};
      for (const track of ['chord', 'bass', 'lead', 'drums'] as TrackId[]) {
        const tracks = { ...melody.mixer };
        for (const id of Object.keys(tracks) as TrackId[]) {
          tracks[id] = { ...tracks[id], mute: false, solo: id === track };
        }
        const blob = await renderArrangementToWav({
          chords: progression,
          rhythm,
          bass: bassMelody,
          lead: leadMelody,
          arpMelody,
          drums: drumPattern,
          synthIds: melody.synthIds,
          bpm,
          tracks,
          drumKitId: melody.drumKitId,
          masterVolume,
          sections: melody.sections,
          octaves: melody.octaves,
          swing: melody.swing,
          humanize: melody.humanize,
          timeScales: melody.timeScales,
          bassGlide: melody.bassGlide,
          soundVariant: melody.soundVariant,
        });
        files[`${track}.wav`] = new Uint8Array(await blob.arrayBuffer());
      }
      const zipped = zipSync(files, { level: 0 });
      const blob = new Blob([zipped], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `edm-stems-${rootKey}-${scaleType}-${bpm}bpm.zip`;
      link.click();
      URL.revokeObjectURL(url);
      toast.show('Stems exported (chords, bass, lead, drums)', 'success');
    } catch (error) {
      console.error('Stem render failed', error);
      toast.show('Could not render stems. Try again.', 'error');
    } finally {
      setRenderingStems(false);
    }
  }, [progression, rhythm, bassMelody, leadMelody, arpMelody, drumPattern, melody.synthIds, melody.mixer, melody.drumKitId, melody.sections, melody.octaves, melody.swing, melody.humanize, melody.timeScales, melody.bassGlide, melody.soundVariant, bpm, rootKey, scaleType, masterVolume, toast]);

  const handleExportMidi = useCallback(() => {
    exportArrangementToMidi(
      progression, rhythm, bassMelody, leadMelody, bpm, rootKey, scaleType, doubleTime, arpMelody, drumPattern,
      { sections: melody.sections, octaves: melody.octaves, swing: melody.swing, humanize: melody.humanize, timeScales: melody.timeScales, bassGlide: melody.bassGlide },
    );
    toast.show('Arrangement MIDI exported', 'success');
  }, [progression, rhythm, bassMelody, leadMelody, bpm, rootKey, scaleType, doubleTime, arpMelody, drumPattern, melody.sections, melody.octaves, melody.swing, melody.humanize, melody.timeScales, melody.bassGlide, toast]);

  const handleExportWav = useCallback(async () => {
    setRendering(true);
    try {
      const blob = await renderArrangementToWav({
        chords: progression,
        rhythm,
        bass: bassMelody,
        lead: leadMelody,
        arpMelody,
        drums: drumPattern,
        synthIds: melody.synthIds,
        bpm,
        tracks: melody.mixer,
        drumKitId: melody.drumKitId,
        masterVolume,
        sections: melody.sections,
        octaves: melody.octaves,
        swing: melody.swing,
        humanize: melody.humanize,
        timeScales: melody.timeScales,
        bassGlide: melody.bassGlide,
        soundVariant: melody.soundVariant,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `edm-mix-${rootKey}-${scaleType}-${bpm}bpm.wav`;
      link.click();
      URL.revokeObjectURL(url);
      toast.show('WAV mix rendered', 'success');
    } catch (error) {
      console.error('WAV render failed', error);
      toast.show('Could not render WAV. Try again.', 'error');
    } finally {
      setRendering(false);
    }
  }, [progression, rhythm, bassMelody, leadMelody, arpMelody, drumPattern, melody.synthIds, melody.mixer, melody.drumKitId, melody.sections, melody.octaves, melody.swing, melody.humanize, melody.timeScales, melody.bassGlide, melody.soundVariant, bpm, rootKey, scaleType, masterVolume, toast]);

  const handleExportDawPack = useCallback(async () => {
    setRenderingStems(true);
    try {
      const files: Record<string, Uint8Array> = {};
      for (const track of ['chord', 'bass', 'lead', 'drums'] as TrackId[]) {
        const tracks = { ...melody.mixer };
        for (const id of Object.keys(tracks) as TrackId[]) {
          tracks[id] = { ...tracks[id], mute: false, solo: id === track };
        }
        const blob = await renderArrangementToWav({
          chords: progression,
          rhythm,
          bass: bassMelody,
          lead: leadMelody,
          arpMelody,
          drums: drumPattern,
          synthIds: melody.synthIds,
          bpm,
          tracks,
          drumKitId: melody.drumKitId,
          masterVolume,
          sections: melody.sections,
          octaves: melody.octaves,
          swing: melody.swing,
          humanize: melody.humanize,
          timeScales: melody.timeScales,
          bassGlide: melody.bassGlide,
          soundVariant: melody.soundVariant,
        });
        files[`stems/${track}.wav`] = new Uint8Array(await blob.arrayBuffer());
      }

      const midi = buildArrangementMidiBytes(
        progression, rhythm, bassMelody, leadMelody, bpm, rootKey, scaleType, doubleTime, arpMelody, drumPattern,
        { sections: melody.sections, octaves: melody.octaves, swing: melody.swing, humanize: melody.humanize, timeScales: melody.timeScales, bassGlide: melody.bassGlide },
      );
      if (midi) files['midi/arrangement.mid'] = midi;

      const text = (value: string) => new TextEncoder().encode(value);
      files['project.json'] = text(serializeProject(projectName.trim() || `${rootKey} ${scaleType} · ${bpm} BPM`, project));
      files['README.txt'] = text([
        `∞ Melodies — ${projectName.trim() || 'Untitled project'}`,
        '',
        `Key: ${rootKey} ${scaleType}`,
        `BPM: ${bpm}`,
        `Chords: ${melody.synthIds.chord}`,
        `Bass: ${melody.synthIds.bass}`,
        `Lead: ${melody.synthIds.lead}`,
        `Drums: ${melody.drumKitId}`,
        `Sound: ${melody.soundVariant}`,
        '',
        'Files:',
        '- midi/arrangement.mid — full arrangement, drums on GM channel 10',
        '- stems/*.wav — chords, bass, lead, drums',
        '- project.json — reopen in ∞ Melodies',
        '',
        'Import the MIDI at bar 1 with 4/4 and let the DAW map drums to its GM kit.',
        'Instrument samples: CC-BY 3.0, see docs/SAMPLES.md in the app repository.',
      ].join('\n'));

      const zipped = zipSync(files, { level: 0 });
      const blob = new Blob([zipped], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const slug = (projectName.trim() || `infinite-melodies-${rootKey}-${scaleType}`).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
      link.download = `${slug || 'infinite-melodies'}-${bpm}bpm.zip`;
      link.click();
      URL.revokeObjectURL(url);
      toast.show('DAW pack exported (MIDI, stems, project, README)', 'success');
    } catch (error) {
      console.error('DAW pack failed', error);
      toast.show('Could not build the DAW pack. Try again.', 'error');
    } finally {
      setRenderingStems(false);
    }
  }, [progression, rhythm, bassMelody, leadMelody, arpMelody, drumPattern, melody.synthIds, melody.mixer, melody.drumKitId, melody.sections, melody.octaves, melody.swing, melody.humanize, melody.timeScales, melody.bassGlide, melody.soundVariant, bpm, rootKey, scaleType, masterVolume, doubleTime, project, projectName, toast]);

  const handleSaveArrangement = useCallback(() => {
    const saved = saveArrangement(saveName, project);
    setSavedArrangements(prev => [...prev, saved]);
    setSaveDialog(false);
    setSaveName('');
    toast.show(`Arrangement “${saved.name}” saved`, 'success');
  }, [saveName, project, toast]);

  const handleLoadArrangement = useCallback((arrangement: SavedArrangement) => {
    onApplyProject(arrangement.data.project);
    setHistory({ list: [arrangement.data.project.melody], index: 0 });
    setLoadDialog(false);
    toast.show(`Loaded “${arrangement.name}”`, 'success');
  }, [onApplyProject, toast]);

  const handleDeleteArrangement = useCallback((id: string) => {
    if (deleteArrangement(id)) {
      setSavedArrangements(prev => prev.filter(item => item.id !== id));
      toast.show('Arrangement deleted');
    }
  }, [toast]);

  const openSaveDialog = useCallback(() => {
    setSaveName(projectName.trim() || `${rootKey} ${scaleType} · ${bpm} BPM`);
    setSaveDialog(true);
  }, [rootKey, scaleType, bpm, projectName]);

  const openLoadDialog = useCallback(() => {
    setSavedArrangements(getSavedArrangements());
    setLoadDialog(true);
  }, []);

  useImperativeHandle(ref, () => ({
    undo,
    redo,
    openSaveDialog,
    openLoadDialog,
    exportMidi: handleExportMidi,
    exportWav: handleExportWav,
    exportStems: handleExportStems,
    exportDawPack: handleExportDawPack,
  }), [undo, redo, openSaveDialog, openLoadDialog, handleExportMidi, handleExportWav, handleExportStems, handleExportDawPack]);

  if (progression.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-8 text-center">
        <h2 className="text-lg font-semibold text-white">Nothing to arrange yet</h2>
        <p className="mt-1 text-sm text-gray-400">Add at least one chord on the Harmony tab to generate bass, lead and drums.</p>
      </div>
    );
  }

  // Arrangement playback blocks previews, but switching between previews is allowed.
  const busy = isPlaying;
  const displayStep = isPlaying || previewingTrack !== null ? activeStep : null;
  const laneStep = displayStep !== null ? displayStep % laneSteps : null;

  const styleChips = (styles: MelodyStyle[], selected: string, onPick: (id: string) => void, onRegenerate: () => void, label: string) => (
    <div className="flex flex-wrap items-center gap-1.5">
      {styles.map(style => (
        <button
          key={style.id}
          type="button"
          onClick={() => onPick(style.id)}
          title={style.description}
          aria-pressed={selected === style.id}
          className={`h-11 rounded-md px-2 text-[11px] font-medium transition-colors sm:h-8 ${
            selected === style.id
              ? 'bg-purple-500/20 text-purple-200 ring-1 ring-purple-500/60'
              : 'border border-gray-700/70 text-gray-300 hover:border-gray-500'
          }`}
        >
          {style.name}
        </button>
      ))}
      <button
        type="button"
        onClick={onRegenerate}
        aria-label={`Regenerate ${label}`}
        className="h-11 rounded-md border border-gray-700/70 px-2 text-[11px] text-gray-300 transition-colors hover:border-gray-500 sm:h-8"
      >
        Regenerate
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <div>
        <h2 className="text-lg font-semibold text-white">Tracks</h2>
        <p className="text-xs text-gray-400">
          {bars} {bars === 1 ? 'bar' : 'bars'}{melody.sections.length > 0 ? ` · ${laneBars}-bar pattern` : ''} · {bpm} BPM · {genresLabel(genreId)} · edits are saved in the project
        </p>
      </div>

      <SectionsTimeline sections={melody.sections} onChange={handleSectionsChange} />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-800 bg-gray-900/50 p-2">
        <label className="flex items-center gap-2 text-xs text-gray-300">
          Swing
          <input
            type="range"
            min={0}
            max={60}
            step={5}
            value={Math.round(melody.swing * 100)}
            onChange={event => apply({ swing: Number(event.target.value) / 100 })}
            aria-label="Swing amount"
            className="w-24 accent-purple-500"
          />
          <span className="w-9 text-right text-[11px] tabular-nums text-gray-400">{Math.round(melody.swing * 100)}%</span>
        </label>
        <button
          type="button"
          onClick={() => apply({ humanize: !melody.humanize })}
          aria-pressed={melody.humanize}
          className={`h-11 rounded-md px-2 text-[11px] font-medium transition-colors sm:h-8 ${
            melody.humanize
              ? 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/60'
              : 'border border-gray-700 text-gray-300 hover:border-gray-500'
          }`}
        >
          Humanize
        </button>
        <button
          type="button"
          onClick={() => apply({ callResponse: !melody.callResponse })}
          aria-pressed={melody.callResponse}
          title="Bass answers on even bars, lead on odd bars"
          className={`h-11 rounded-md px-2 text-[11px] font-medium transition-colors sm:h-8 ${
            melody.callResponse
              ? 'bg-purple-500/20 text-purple-200 ring-1 ring-purple-500/60'
              : 'border border-gray-700 text-gray-300 hover:border-gray-500'
          }`}
        >
          Call &amp; response
        </button>
        <span className="hidden text-[11px] text-gray-400 sm:inline">Groove applies to playback, WAV, stems and MIDI</span>
      </div>

      {/* Chords */}
      <section className="min-w-0 rounded-xl border border-gray-800 bg-gray-900/50 p-2 sm:p-3">
        <TrackHeader
          trackId="chord"
          label="Chords"
          mix={melody.mixer.chord}
          synthId={melody.synthIds.chord}
          onMixChange={patch => updateMix('chord', patch)}
          onSynthChange={id => apply({ synthIds: { ...melody.synthIds, chord: id } })}
          onPreview={() => handlePreview('chord')}
          previewing={previewingTrack === 'chord'}
          busy={busy}
          timeScale={melody.timeScales.chord}
          onTimeScaleChange={scale => apply({ timeScales: { ...melody.timeScales, chord: scale } })}
          extra={(
            <>
              <label className="flex items-center gap-1">
                <span className="sr-only">Chord rhythm</span>
                <select
                  value={rhythm.name}
                  onChange={event => {
                    const next = rhythms.find(item => item.name === event.target.value);
                    if (next) onRhythmChange(next);
                  }}
                  aria-label="Rhythm pattern"
                  title="Global chord rhythm"
                  className="h-11 rounded-md border border-gray-700 bg-gray-900 px-1.5 text-[11px] text-gray-200 sm:h-8"
                >
                  {rhythms.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
                </select>
              </label>
              <OctaveStepper
                label="Chords"
                value={melody.octaves.chord}
                onChange={value => apply({ octaves: { ...melody.octaves, chord: value } })}
              />
              <button
                type="button"
                onClick={() => apply({ arpEnabled: !melody.arpEnabled })}
                aria-pressed={melody.arpEnabled}
                className={`h-11 rounded-md px-2 text-[11px] font-medium transition-colors sm:h-8 ${
                  melody.arpEnabled
                    ? 'bg-purple-500/20 text-purple-200 ring-1 ring-purple-500/60'
                    : 'border border-gray-700/70 text-gray-300 hover:border-gray-500'
                }`}
              >
                Arp {melody.arpEnabled ? 'ON' : 'OFF'}
              </button>
            </>
          )}
        />
        <div className="mt-2">
          {arpMelody ? (
            <PianoRollLane
              notes={arpMelody.notes}
              activeStep={displayStep}
              totalSteps={laneSteps}
              bars={laneBars}
              color="bg-purple-400/80"
              activeColor="bg-purple-300"
              label="Arpeggiated chords"
            />
          ) : (
            <ChordLane chords={progression} activeStep={laneStep} totalSteps={laneSteps} bars={laneBars} />
          )}
        </div>
        {melody.arpEnabled && (
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Pattern</span>
              <select
                value={melody.arpSettings.pattern}
                onChange={event => apply({ arpSettings: { ...melody.arpSettings, pattern: event.target.value as ArpPattern } })}
                className="h-11 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-200 sm:h-8"
              >
                <option value="up">Up</option>
                <option value="down">Down</option>
                <option value="up-down">Up-Down</option>
                <option value="random">Random</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Rate</span>
              <select
                value={melody.arpSettings.rate}
                onChange={event => apply({ arpSettings: { ...melody.arpSettings, rate: event.target.value as ArpRate } })}
                className="h-11 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-200 sm:h-8"
              >
                <option value="eighth">1/8</option>
                <option value="sixteenth">1/16</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Octaves</span>
              <select
                value={melody.arpSettings.octaveRange}
                onChange={event => apply({ arpSettings: { ...melody.arpSettings, octaveRange: Number(event.target.value) } })}
                className="h-11 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-200 sm:h-8"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Gate</span>
              <input
                type="range"
                min={0.5}
                max={1}
                step={0.1}
                value={melody.arpSettings.gate}
                onChange={event => apply({ arpSettings: { ...melody.arpSettings, gate: Number(event.target.value) } })}
                aria-label="Arpeggiator gate length"
                className="w-24 accent-purple-500"
              />
            </label>
            <button
              type="button"
              onClick={() => apply({ arpSeed: melody.arpSeed + 1 })}
              className="h-11 rounded-md border border-gray-700/70 px-2 text-[11px] text-gray-300 hover:border-gray-500 sm:h-8"
            >
              Regenerate
            </button>
          </div>
        )}
      </section>

      {/* Bass */}
      <section className="min-w-0 rounded-xl border border-gray-800 bg-gray-900/50 p-2 sm:p-3">
        <TrackHeader
          trackId="bass"
          label="Bass"
          mix={melody.mixer.bass}
          synthId={melody.synthIds.bass}
          onMixChange={patch => updateMix('bass', patch)}
          onSynthChange={id => apply({ synthIds: { ...melody.synthIds, bass: id } })}
          onPreview={() => handlePreview('bass')}
          previewing={previewingTrack === 'bass'}
          busy={busy}
          timeScale={melody.timeScales.bass}
          onTimeScaleChange={scale => apply({ timeScales: { ...melody.timeScales, bass: scale } })}
          extra={(
            <>
              <label className="flex items-center gap-1">
                <span className="sr-only">Bass range width</span>
                <select
                  value={melody.rangeSpans.bass}
                  onChange={event => handleSpanChange('bass', Number(event.target.value))}
                  aria-label="Bass range width"
                  title="How many octaves the generated bass may use"
                  className="h-11 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-200 sm:h-8"
                >
                  {spanOptions}
                </select>
              </label>
              <OctaveStepper
                label="Bass"
                value={melody.octaves.bass}
                onChange={value => apply({ octaves: { ...melody.octaves, bass: value } })}
              />
              {styleChips(bassStyles, bassStyleId, id => apply({ bassStyleId: id, bassNotes: null }), () => apply({ bassSeed: melody.bassSeed + 1, bassNotes: null }), 'bass')}
              {melody.bassNotes && (
                <button
                  type="button"
                  onClick={() => apply({ bassNotes: null })}
                  className="h-11 rounded-md border border-amber-500/50 px-2 text-[11px] text-amber-200 hover:border-amber-400 sm:h-8"
                >
                  Reset edits
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  exportMelodyToMidi(bassMelody, bpm, 'Bass', rootKey, scaleType);
                  toast.show('Bass MIDI exported', 'success');
                }}
                className="h-11 rounded-md border border-gray-700/70 px-2 text-[11px] text-gray-300 hover:border-gray-500 sm:h-8"
              >
                MIDI
              </button>
            </>
          )}
        />
        <div className="mt-2">
          <EditablePianoRoll
            notes={bassMelody.notes}
            onChange={handleBassNotes}
            activeStep={laneStep}
            totalSteps={laneSteps}
            bars={laneBars}
            color="bg-orange-400/80"
            activeColor="bg-orange-300"
            label="Bass"
          />
          <VelocityLane
            notes={bassMelody.notes}
            onChange={handleBassNotes}
            totalSteps={laneSteps}
            label="Bass"
            color="bg-orange-400/80"
          />
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gray-400">Density</span>
              <select
                value={melody.bassDensity}
                onChange={event => apply({ bassDensity: event.target.value as MelodyDensity, bassNotes: null })}
                aria-label="Bass density"
                className="h-9 rounded-md border border-gray-700 bg-gray-900 px-1.5 text-[11px] text-gray-200 sm:h-7"
              >
                {densityOptions}
              </select>
            </label>
            <div className="flex items-center gap-1" role="group" aria-label="Bass idea">
              <span className="text-[10px] uppercase tracking-wide text-gray-400">Idea</span>
              {[1, 2, 3].map(idea => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => apply({ bassIdea: idea, bassNotes: null })}
                  aria-pressed={melody.bassIdea === idea}
                  className={`h-9 w-7 rounded-md text-[11px] font-medium transition-colors sm:h-7 ${
                    melody.bassIdea === idea
                      ? 'bg-orange-500/20 text-orange-200 ring-1 ring-orange-500/60'
                      : 'border border-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {idea}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gray-400">Contour</span>
              <select
                value={melody.bassContour}
                onChange={event => apply({ bassContour: event.target.value as MelodyContour, bassNotes: null })}
                aria-label="Bass contour"
                className="h-9 rounded-md border border-gray-700 bg-gray-900 px-1.5 text-[11px] text-gray-200 sm:h-7"
              >
                {contourOptions}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gray-400">Variation</span>
              <select
                value={melody.bassVariation}
                onChange={event => apply({ bassVariation: event.target.value as MelodyVariation, bassNotes: null })}
                aria-label="Bass variation"
                className="h-9 rounded-md border border-gray-700 bg-gray-900 px-1.5 text-[11px] text-gray-200 sm:h-7"
              >
                {variationOptions}
              </select>
            </label>
            <button
              type="button"
              onClick={() => apply({ bassGlide: !melody.bassGlide })}
              aria-pressed={melody.bassGlide}
              title="Portamento bass / 808 glide"
              className={`h-9 rounded-md px-2 text-[11px] font-medium transition-colors sm:h-7 ${
                melody.bassGlide
                  ? 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/60'
                  : 'border border-gray-700 text-gray-300 hover:border-gray-500'
              }`}
            >
              Glide
            </button>
            <button
              type="button"
              onClick={() => apply({ bassNotes: quantizeNotes(bassMelody.notes) })}
              title="Quantize bass to 1/8"
              className="h-9 rounded-md border border-gray-700 px-2 text-[11px] text-gray-300 hover:border-gray-500 sm:h-7"
            >
              Q 1/8
            </button>
            <button
              type="button"
              onClick={() => apply({ bassNotes: repeatFirstBar(bassMelody.notes, bars) })}
              title="Repeat the first bar across the progression"
              className="h-9 rounded-md border border-gray-700 px-2 text-[11px] text-gray-300 hover:border-gray-500 sm:h-7"
            >
              Repeat bar
            </button>
          </div>
          <p className="mt-1 hidden text-[11px] text-gray-400 sm:block">
            Click a note to delete · drag to move · drag the right edge to resize
          </p>
        </div>
      </section>

      {/* Lead */}
      <section className="min-w-0 rounded-xl border border-gray-800 bg-gray-900/50 p-2 sm:p-3">
        <TrackHeader
          trackId="lead"
          label="Lead"
          mix={melody.mixer.lead}
          synthId={melody.synthIds.lead}
          onMixChange={patch => updateMix('lead', patch)}
          onSynthChange={id => apply({ synthIds: { ...melody.synthIds, lead: id } })}
          onPreview={() => handlePreview('lead')}
          previewing={previewingTrack === 'lead'}
          busy={busy}
          timeScale={melody.timeScales.lead}
          onTimeScaleChange={scale => apply({ timeScales: { ...melody.timeScales, lead: scale } })}
          extra={(
            <>
              <label className="flex items-center gap-1">
                <span className="sr-only">Lead range width</span>
                <select
                  value={melody.rangeSpans.lead}
                  onChange={event => handleSpanChange('lead', Number(event.target.value))}
                  aria-label="Lead range width"
                  title="How many octaves the generated lead may use"
                  className="h-11 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-200 sm:h-8"
                >
                  {spanOptions}
                </select>
              </label>
              <OctaveStepper
                label="Lead"
                value={melody.octaves.lead}
                onChange={value => apply({ octaves: { ...melody.octaves, lead: value } })}
              />
              {styleChips(leadStyles, leadStyleId, id => apply({ leadStyleId: id, leadNotes: null }), () => apply({ leadSeed: melody.leadSeed + 1, leadNotes: null }), 'lead')}
              {melody.leadNotes && (
                <button
                  type="button"
                  onClick={() => apply({ leadNotes: null })}
                  className="h-11 rounded-md border border-amber-500/50 px-2 text-[11px] text-amber-200 hover:border-amber-400 sm:h-8"
                >
                  Reset edits
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  exportMelodyToMidi(leadMelody, bpm, 'Lead', rootKey, scaleType);
                  toast.show('Lead MIDI exported', 'success');
                }}
                className="h-11 rounded-md border border-gray-700/70 px-2 text-[11px] text-gray-300 hover:border-gray-500 sm:h-8"
              >
                MIDI
              </button>
            </>
          )}
        />
        <div className="mt-2">
          <EditablePianoRoll
            notes={leadMelody.notes}
            onChange={handleLeadNotes}
            activeStep={laneStep}
            totalSteps={laneSteps}
            bars={laneBars}
            color="bg-cyan-400/80"
            activeColor="bg-cyan-300"
            label="Lead"
          />
          <VelocityLane
            notes={leadMelody.notes}
            onChange={handleLeadNotes}
            totalSteps={laneSteps}
            label="Lead"
            color="bg-cyan-400/80"
          />
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gray-400">Density</span>
              <select
                value={melody.leadDensity}
                onChange={event => apply({ leadDensity: event.target.value as MelodyDensity, leadNotes: null })}
                aria-label="Lead density"
                className="h-9 rounded-md border border-gray-700 bg-gray-900 px-1.5 text-[11px] text-gray-200 sm:h-7"
              >
                {densityOptions}
              </select>
            </label>
            <div className="flex items-center gap-1" role="group" aria-label="Lead idea">
              <span className="text-[10px] uppercase tracking-wide text-gray-400">Idea</span>
              {[1, 2, 3].map(idea => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => apply({ leadIdea: idea, leadNotes: null })}
                  aria-pressed={melody.leadIdea === idea}
                  className={`h-9 w-7 rounded-md text-[11px] font-medium transition-colors sm:h-7 ${
                    melody.leadIdea === idea
                      ? 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-500/60'
                      : 'border border-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {idea}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gray-400">Contour</span>
              <select
                value={melody.leadContour}
                onChange={event => apply({ leadContour: event.target.value as MelodyContour, leadNotes: null })}
                aria-label="Lead contour"
                className="h-9 rounded-md border border-gray-700 bg-gray-900 px-1.5 text-[11px] text-gray-200 sm:h-7"
              >
                {contourOptions}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gray-400">Variation</span>
              <select
                value={melody.leadVariation}
                onChange={event => apply({ leadVariation: event.target.value as MelodyVariation, leadNotes: null })}
                aria-label="Lead variation"
                className="h-9 rounded-md border border-gray-700 bg-gray-900 px-1.5 text-[11px] text-gray-200 sm:h-7"
              >
                {variationOptions}
              </select>
            </label>
            <button
              type="button"
              onClick={() => apply({ leadNotes: quantizeNotes(leadMelody.notes) })}
              title="Quantize lead to 1/8"
              className="h-9 rounded-md border border-gray-700 px-2 text-[11px] text-gray-300 hover:border-gray-500 sm:h-7"
            >
              Q 1/8
            </button>
            <button
              type="button"
              onClick={() => apply({ leadNotes: repeatFirstBar(leadMelody.notes, bars) })}
              title="Repeat the first bar across the progression"
              className="h-9 rounded-md border border-gray-700 px-2 text-[11px] text-gray-300 hover:border-gray-500 sm:h-7"
            >
              Repeat bar
            </button>
          </div>
          <p className="mt-1 hidden text-[11px] text-gray-400 sm:block">
            Click a note to delete · drag to move · drag the right edge to resize
          </p>
        </div>
      </section>

      {/* Drums */}
      <section className="min-w-0 rounded-xl border border-gray-800 bg-gray-900/50 p-2 sm:p-3">
        <TrackHeader
          trackId="drums"
          label="Drums"
          mix={melody.mixer.drums}
          onMixChange={patch => updateMix('drums', patch)}
          onPreview={() => handlePreview('drums')}
          previewing={previewingTrack === 'drums'}
          busy={busy}
          timeScale={melody.timeScales.drums}
          onTimeScaleChange={scale => apply({ timeScales: { ...melody.timeScales, drums: scale } })}
          extra={(
            <>
              <select
                value={melody.drumKitId}
                onChange={event => apply({ drumKitId: event.target.value as DrumKitId })}
                aria-label="Drum kit"
                className="h-11 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-200 sm:h-8"
              >
                {DRUM_KITS.map(kit => (
                  <option key={kit.id} value={kit.id}>{kit.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => apply({ customDrumPattern: null, drumSeed: melody.drumSeed + 1 })}
                className="h-11 rounded-md border border-gray-700/70 px-2 text-[11px] text-gray-300 hover:border-gray-500 sm:h-8"
              >
                Regenerate
              </button>
              {melody.customDrumPattern && (
                <button
                  type="button"
                  onClick={() => apply({ customDrumPattern: null })}
                  className="h-11 rounded-md border border-rose-700/60 px-2 text-[11px] text-rose-300 hover:border-rose-500 sm:h-8"
                >
                  Reset edits
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  exportDrumsToMidi(drumPattern, bpm, bars, rootKey, scaleType);
                  toast.show('Drums MIDI exported', 'success');
                }}
                className="h-11 rounded-md border border-gray-700/70 px-2 text-[11px] text-gray-300 hover:border-gray-500 sm:h-8"
              >
                Drums MIDI
              </button>
              <button
                type="button"
                onClick={handleExportWav}
                disabled={rendering || renderingStems}
                className="h-11 rounded-md border border-gray-700 px-2 text-xs font-medium text-gray-200 hover:border-gray-500 disabled:opacity-50 sm:h-8"
              >
                {rendering ? 'Rendering…' : 'WAV'}
              </button>
              <button
                type="button"
                onClick={handleExportStems}
                disabled={rendering || renderingStems}
                className="h-11 rounded-md border border-gray-700 px-2 text-xs font-medium text-gray-200 hover:border-gray-500 disabled:opacity-50 sm:h-8"
              >
                {renderingStems ? 'Stems…' : 'Stems'}
              </button>
            </>
          )}
        />
        <div className="mt-2">
          <DrumGrid pattern={drumPattern} activeStep={laneStep} onToggle={handleToggleDrumNote} />
        </div>
      </section>

      {saveDialog && (
        <Modal
          title="Save arrangement"
          onClose={() => setSaveDialog(false)}
          footer={(
            <>
              <button
                type="button"
                onClick={() => setSaveDialog(false)}
                className="h-11 rounded-md border border-gray-700 px-3 text-xs font-semibold text-gray-200 hover:border-gray-500 sm:h-9"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveArrangement}
                disabled={!saveName.trim()}
                className="h-11 rounded-md bg-purple-600 px-3 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-50 sm:h-9"
              >
                Save
              </button>
            </>
          )}
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Name</span>
            <input
              type="text"
              value={saveName}
              onChange={event => setSaveName(event.target.value)}
              onFocus={event => event.currentTarget.select()}
              placeholder="Arrangement name"
              className="h-10 rounded-md border border-gray-700 bg-gray-950 px-3 text-sm text-white focus:border-purple-500 focus:outline-none"
            />
          </label>
          <p className="mt-2 text-xs text-gray-400">
            Saves harmony, arranger settings, mixer and edits — loading it restores the whole project.
          </p>
        </Modal>
      )}

      {loadDialog && (
        <Modal
          title="Load arrangement"
          onClose={() => setLoadDialog(false)}
          footer={(
            <button
              type="button"
              onClick={() => setLoadDialog(false)}
              className="h-11 rounded-md border border-gray-700 px-3 text-xs font-semibold text-gray-200 hover:border-gray-500 sm:h-9"
            >
              Close
            </button>
          )}
        >
          {savedArrangements.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No saved arrangements yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {savedArrangements.map(arrangement => (
                <li key={arrangement.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-700 bg-gray-800/60 p-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{arrangement.name}</p>
                    <p className="text-xs text-gray-400">
                      {arrangement.data.project.key} {arrangement.data.project.scale} · {arrangement.data.project.bpm} BPM ·{' '}
                      {new Date(arrangement.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => handleLoadArrangement(arrangement)}
                      className="h-11 rounded-md bg-purple-600 px-2 text-xs font-semibold text-white hover:bg-purple-500 sm:h-9"
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const copy = duplicateArrangement(arrangement.id);
                        if (copy) {
                          setSavedArrangements(prev => [...prev, copy]);
                          toast.show('Arrangement duplicated', 'success');
                        }
                      }}
                      aria-label={`Duplicate ${arrangement.name}`}
                      className="h-11 rounded-md border border-gray-700 px-2 text-xs font-semibold text-gray-200 hover:border-gray-500 sm:h-9"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenameTarget(arrangement);
                        setRenameValue(arrangement.name);
                      }}
                      aria-label={`Rename ${arrangement.name}`}
                      className="h-11 rounded-md border border-gray-700 px-2 text-xs font-semibold text-gray-200 hover:border-gray-500 sm:h-9"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteArrangement(arrangement.id)}
                      className="h-11 rounded-md border border-rose-700/60 px-2 text-xs font-semibold text-rose-300 hover:border-rose-500 sm:h-9"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {renameTarget && (
        <Modal
          title="Rename arrangement"
          onClose={() => setRenameTarget(null)}
          footer={(
            <>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="h-11 rounded-md border border-gray-700 px-3 text-xs font-semibold text-gray-200 hover:border-gray-500 sm:h-9"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const updated = renameArrangement(renameTarget.id, renameValue);
                  if (!updated) {
                    toast.show('Enter a name first', 'error');
                    return;
                  }
                  setSavedArrangements(prev => prev.map(item => item.id === updated.id ? updated : item));
                  setRenameTarget(null);
                  toast.show('Arrangement renamed', 'success');
                }}
                className="h-11 rounded-md bg-purple-600 px-3 text-xs font-semibold text-white hover:bg-purple-500 sm:h-9"
              >
                Save name
              </button>
            </>
          )}
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Name</span>
            <input
              type="text"
              value={renameValue}
              onChange={event => setRenameValue(event.target.value)}
              onFocus={event => event.currentTarget.select()}
              className="h-10 rounded-md border border-gray-700 bg-gray-950 px-3 text-sm text-white focus:border-purple-500 focus:outline-none"
            />
          </label>
        </Modal>
      )}
    </div>
  );
});

function genresLabel(genreId: string): string {
  const labels: Record<string, string> = {
    house: 'House',
    techno: 'Techno',
    trance: 'Trance',
    dnb: 'Drum & Bass',
    dubstep: 'Dubstep',
    futureBass: 'Future Bass',
    progressiveHouse: 'Progressive House',
    hardstyle: 'Hardstyle',
  };
  return labels[genreId] ?? genreId;
}
