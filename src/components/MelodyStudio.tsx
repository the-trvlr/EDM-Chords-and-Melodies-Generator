import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ChordInfo } from '../utils/musicTheory';
import { SYNTH_PRESETS, type SynthPresetId } from '../utils/audioEngine';
import { generateMelody, getGenreMelodyStyles, type MelodyStyle } from '../utils/melodyGenerator';
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
  updateDrumKit,
  type TrackId,
} from '../utils/mixer';
import { exportArrangementToMidi, exportDrumsToMidi, exportMelodyToMidi } from '../utils/midiExport';
import { stopPlayback } from '../utils/audioEngine';
import { arpeggiate, type ArpPattern, type ArpRate } from '../utils/arpeggiator';
import { generateDrums, type DrumPattern } from '../utils/drumGenerator';
import { deleteArrangement, getSavedArrangements, saveArrangement, type SavedArrangement } from '../utils/persistence';
import type { MelodyState, MixerState, ProjectSnapshot, TrackMix } from '../types';
import { Modal } from './Modal';
import { ChordLane, DrumGrid, PianoRollLane } from './lanes';
import { useToast } from '../hooks/useToast';

export interface MelodyStudioHandle {
  undo: () => void;
  redo: () => void;
  openSaveDialog: () => void;
  openLoadDialog: () => void;
  exportMidi: () => void;
  exportWav: () => void;
}

interface MelodyStudioProps {
  progression: ChordInfo[];
  rhythm: RhythmPattern;
  rootKey: string;
  scaleType: string;
  bpm: number;
  genreId: string;
  loop: boolean;
  doubleTime: boolean;
  masterVolume: number;
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

      {synthId && onSynthChange && (
        <label className="flex min-w-0 items-center gap-1">
          <span className="sr-only">{label} instrument</span>
          <select
            value={synthId}
            onChange={event => onSynthChange(event.target.value as SynthPresetId)}
            className="h-11 max-w-[9rem] rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-200 focus:border-purple-500 focus:outline-none sm:h-8"
          >
            {SYNTH_PRESETS.map(preset => (
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

export const MelodyStudio = forwardRef<MelodyStudioHandle, MelodyStudioProps>(function MelodyStudio({
  progression,
  rhythm,
  rootKey,
  scaleType,
  bpm,
  genreId,
  loop,
  doubleTime,
  masterVolume,
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
  const [history, setHistory] = useState<MelodyHistory>({ list: [melody], index: 0 });
  const [saveDialog, setSaveDialog] = useState(false);
  const [loadDialog, setLoadDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedArrangements, setSavedArrangements] = useState<SavedArrangement[]>([]);
  const liveRef = useRef({ bpm, loop, drumKitId: melody.drumKitId });
  useEffect(() => {
    liveRef.current = { bpm, loop, drumKitId: melody.drumKitId };
  }, [bpm, loop, melody.drumKitId]);

  const bassStyles = getGenreMelodyStyles(genreId, 'bass');
  const leadStyles = getGenreMelodyStyles(genreId, 'lead');
  const bassStyleId = bassStyles.some(style => style.id === melody.bassStyleId)
    ? melody.bassStyleId
    : bassStyles[0]?.id ?? '';
  const leadStyleId = leadStyles.some(style => style.id === melody.leadStyleId)
    ? melody.leadStyleId
    : leadStyles[0]?.id ?? '';

  const bassMelody = useMemo(
    () => generateMelody(progression, 'bass', bassStyleId, rootKey, scaleType, melody.bassSeed),
    // Melodies are pure functions of these values; memoisation keeps the
    // playhead (16 updates per bar) from regenerating them on every tick.
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    [progression, bassStyleId, rootKey, scaleType, melody.bassSeed],
  );
  const leadMelody = useMemo(
    () => generateMelody(progression, 'lead', leadStyleId, rootKey, scaleType, melody.leadSeed),
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    [progression, leadStyleId, rootKey, scaleType, melody.leadSeed],
  );
  const arpMelody = useMemo(
    () => melody.arpEnabled ? arpeggiate(progression, melody.arpSettings, melody.arpSeed) : null,
    [progression, melody.arpEnabled, melody.arpSettings, melody.arpSeed],
  );
  const drumPattern = useMemo(
    () => melody.customDrumPattern ?? generateDrums(genreId, melody.drumSeed),
    [melody.customDrumPattern, genreId, melody.drumSeed],
  );

  const bars = Math.max(1, progression.length);
  const totalSteps = bars * 16;

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
      onStep: (step) => {
        setActiveStep(step);
        onStepChange?.(step);
      },
      onStop: () => {
        setActiveStep(null);
        onStepChange?.(null);
        onPlayingChange(false);
      },
    });
  }, [progression, rhythm, bassMelody, leadMelody, arpMelody, drumPattern, melody.synthIds, onPlayingChange, onStepChange, onStopOtherPlayback]);

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
      trackId,
      onStep: (step) => {
        setActiveStep(step);
        onStepChange?.(step);
      },
      onStop: () => {
        setPreviewingTrack(null);
        setActiveStep(null);
        onStepChange?.(null);
      },
    });
  }, [progression, rhythm, bassMelody, leadMelody, arpMelody, drumPattern, melody.synthIds, melody.drumKitId, bpm, onStepChange, onStopOtherPlayback]);

  const handleToggleDrumNote = useCallback((instrument: keyof DrumPattern, step: number) => {
    const base = melody.customDrumPattern ?? generateDrums(genreId, melody.drumSeed);
    const nextPattern: DrumPattern = {
      ...base,
      [instrument]: base[instrument].map((value, index) => index === step ? (value ? 0 : 1) : value),
    };
    apply({ customDrumPattern: nextPattern });
  }, [apply, genreId, melody.customDrumPattern, melody.drumSeed]);

  const handleExportMidi = useCallback(() => {
    exportArrangementToMidi(
      progression, rhythm, bassMelody, leadMelody, bpm, rootKey, scaleType, doubleTime, arpMelody, drumPattern,
    );
    toast.show('Arrangement MIDI exported', 'success');
  }, [progression, rhythm, bassMelody, leadMelody, bpm, rootKey, scaleType, doubleTime, arpMelody, drumPattern, toast]);

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
  }, [progression, rhythm, bassMelody, leadMelody, arpMelody, drumPattern, melody.synthIds, melody.mixer, melody.drumKitId, bpm, rootKey, scaleType, masterVolume, toast]);

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
    setSaveName(`${rootKey} ${scaleType} · ${bpm} BPM`);
    setSaveDialog(true);
  }, [rootKey, scaleType, bpm]);

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
  }), [undo, redo, openSaveDialog, openLoadDialog, handleExportMidi, handleExportWav]);

  if (progression.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-8 text-center">
        <h2 className="text-lg font-semibold text-white">Nothing to arrange yet</h2>
        <p className="mt-1 text-sm text-gray-400">Add at least one chord on the Harmony tab to generate bass, lead and drums.</p>
      </div>
    );
  }

  const busy = isPlaying || previewingTrack !== null;
  const displayStep = isPlaying || previewingTrack !== null ? activeStep : null;

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
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">Arrangement</h2>
          <p className="text-xs text-gray-400">
            {bars} {bars === 1 ? 'bar' : 'bars'} · {bpm} BPM · {genresLabel(genreId)} · edits are saved in the project
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={undo}
            disabled={history.index <= 0}
            className="h-11 rounded-md border border-gray-700 px-2 text-xs font-medium text-gray-200 transition-colors hover:border-gray-500 disabled:opacity-40 sm:h-8"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={history.index >= history.list.length - 1}
            className="h-11 rounded-md border border-gray-700 px-2 text-xs font-medium text-gray-200 transition-colors hover:border-gray-500 disabled:opacity-40 sm:h-8"
          >
            Redo
          </button>
          <button
            type="button"
            onClick={openSaveDialog}
            className="h-11 rounded-md border border-gray-700 px-2 text-xs font-medium text-gray-200 transition-colors hover:border-gray-500 sm:h-8"
          >
            Save
          </button>
          <button
            type="button"
            onClick={openLoadDialog}
            className="h-11 rounded-md border border-gray-700 px-2 text-xs font-medium text-gray-200 transition-colors hover:border-gray-500 sm:h-8"
          >
            Load
          </button>
        </div>
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
          extra={
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
          }
        />
        <div className="mt-2">
          {arpMelody ? (
            <PianoRollLane
              notes={arpMelody.notes}
              activeStep={displayStep}
              totalSteps={totalSteps}
              bars={bars}
              color="bg-purple-400/80"
              activeColor="bg-purple-300"
              label="Arpeggiated chords"
            />
          ) : (
            <ChordLane chords={progression} activeStep={displayStep} totalSteps={totalSteps} bars={bars} />
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
          extra={(
            <>
              {styleChips(bassStyles, bassStyleId, id => apply({ bassStyleId: id }), () => apply({ bassSeed: melody.bassSeed + 1 }), 'bass')}
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
          <PianoRollLane
            notes={bassMelody.notes}
            activeStep={displayStep}
            totalSteps={totalSteps}
            bars={bars}
            color="bg-orange-400/80"
            activeColor="bg-orange-300"
            label="Bass"
          />
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
          extra={(
            <>
              {styleChips(leadStyles, leadStyleId, id => apply({ leadStyleId: id }), () => apply({ leadSeed: melody.leadSeed + 1 }), 'lead')}
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
          <PianoRollLane
            notes={leadMelody.notes}
            activeStep={displayStep}
            totalSteps={totalSteps}
            bars={bars}
            color="bg-cyan-400/80"
            activeColor="bg-cyan-300"
            label="Lead"
          />
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
                disabled={rendering}
                className="h-11 rounded-md border border-gray-700 px-2 text-xs font-medium text-gray-200 hover:border-gray-500 disabled:opacity-50 sm:h-8"
              >
                {rendering ? 'Rendering…' : 'WAV'}
              </button>
            </>
          )}
        />
        <div className="mt-2">
          <DrumGrid pattern={drumPattern} activeStep={displayStep} onToggle={handleToggleDrumNote} />
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
