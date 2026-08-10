/* eslint-disable react-hooks/preserve-manual-memoization */
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useCallback, useEffect, useMemo } from 'react';
import type { ChordInfo } from '../utils/musicTheory';
import { generateMelody, getGenreMelodyStyles, type MelodyStyle, type GeneratedMelody } from '../utils/melodyGenerator';
import type { RhythmPattern } from '../data/genres';
import type { SynthPresetId } from '../utils/audioEngine';
import { playArrangement, stopArrangement, setTrackVolume, setTrackMute, setTrackSolo, renderArrangementToWav, playTrackPreview, stopTrackPreview, updateDrumKit, type TrackId } from '../utils/mixer';
import { exportArrangementToMidi } from '../utils/midiExport';
import { stopPlayback } from '../utils/audioEngine';
import { SynthSelector } from './SynthSelector';
import { getSavedArrangements, saveArrangement, deleteArrangement, type SavedArrangement } from '../utils/persistence';
import { arpeggiate, type ArpSettings, type ArpPattern, type ArpRate } from '../utils/arpeggiator';
import { generateDrums, type DrumPattern } from '../utils/drumGenerator';
import { DRUM_KITS, type DrumKitId } from '../data/drumKits';

interface MelodyStudioProps {
  progression: ChordInfo[];
  rhythm: RhythmPattern;
  rootKey: string;
  scaleType: string;
  bpm: number;
  genreId: string;
  chordSynthId: SynthPresetId;
  loop: boolean;
  doubleTime: boolean;
}

const STEPS_PER_CHORD = 16;

type TrackState = { volume: number; mute: boolean; solo: boolean };
const initTrack = (): TrackState => ({ volume: 0, mute: false, solo: false });

function MelodyLane({
  melody, totalSteps, activeStep, color, activeColor,
}: {
  melody: GeneratedMelody;
  totalSteps: number;
  activeStep: number | null;
  color: string;
  activeColor: string;
}) {
  if (melody.notes.length === 0) {
    return <div className="flex-1 text-[10px] text-gray-600 flex items-center pl-2">No notes</div>;
  }
  const midis = melody.notes.map(n => n.midi);
  const minMidi = Math.min(...midis);
  const maxMidi = Math.max(...midis);
  const range = Math.max(maxMidi - minMidi, 12);
  return (
    <div className="relative flex-1 bg-gray-900 rounded border border-gray-700/50 overflow-hidden" style={{ height: 120 }}>
      {activeStep !== null && (
        <div className="absolute top-0 bottom-0 w-px bg-white/50 z-10" style={{ left: `${(activeStep / totalSteps) * 100}%` }} />
      )}
      {melody.notes.map((note, i) => {
        const x = (note.step / totalSteps) * 100;
        const w = (note.duration / totalSteps) * 100;
        const y = ((maxMidi - note.midi) / range) * 80 + 10;
        const isActive = activeStep !== null && activeStep >= note.step && activeStep < note.step + note.duration;
        return (
          <div
            key={i}
            className={`absolute rounded-sm transition-all ${isActive ? activeColor : color}`}
            style={{ left: `${x}%`, width: `${Math.max(w, 0.5)}%`, top: `${y}%`, height: isActive ? 8 : 6 }}
          />
        );
      })}
    </div>
  );
}

export function MelodyStudio({ progression, rhythm, rootKey, scaleType, bpm, genreId, chordSynthId, loop, doubleTime }: MelodyStudioProps) {
  const bassStyles = getGenreMelodyStyles(genreId, 'bass');
  const leadStyles = getGenreMelodyStyles(genreId, 'lead');

  const [bassStyleId, setBassStyleId] = useState(bassStyles[0]?.id || '');
  const [leadStyleId, setLeadStyleId] = useState(leadStyles[0]?.id || '');
  const [bassSeed, setBassSeed] = useState(1);
  const [leadSeed, setLeadSeed] = useState(1);

  // Arpeggiator state
  const [arpEnabled, setArpEnabled] = useState(false);
  const [arpSettings, setArpSettings] = useState<ArpSettings>({
    pattern: 'up',
    rate: 'eighth',
    octaveRange: 1,
    gate: 0.8,
  });
  const [arpSeed, setArpSeed] = useState(1);

  // Drum state
  const [drumKitId, setDrumKitId] = useState<DrumKitId>('acoustic');
  const [drumSeed, setDrumSeed] = useState(1);
  const [customDrumPattern, setCustomDrumPattern] = useState<DrumPattern | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [rendering, setRendering] = useState(false);
  const [previewingTrack, setPreviewingTrack] = useState<TrackId | null>(null);
  const [savedArrangements, setSavedArrangements] = useState<SavedArrangement[]>(getSavedArrangements());
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [history, setHistory] = useState<Array<{ bassSeed: number; leadSeed: number; arpSeed: number; drumSeed: number }>>([{ bassSeed: 1, leadSeed: 1, arpSeed: 1, drumSeed: 1 }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [tracks, setTracks] = useState<Record<TrackId, TrackState>>({
    chord: initTrack(), bass: initTrack(), lead: initTrack(), drums: initTrack(),
  });

  const [synthIds, setSynthIds] = useState<{ chord: SynthPresetId; bass: SynthPresetId; lead: SynthPresetId; drums: SynthPresetId }>({
    chord: chordSynthId,
    bass: 'pluck',
    lead: 'supersaw',
    drums: 'piano',
  });

  // Reset melody styles when genre changes (render-time state adjustment).
  const [prevGenreId, setPrevGenreId] = useState(genreId);
  if (genreId !== prevGenreId) {
    setPrevGenreId(genreId);
    setBassStyleId(bassStyles[0]?.id || '');
    setLeadStyleId(leadStyles[0]?.id || '');
    setBassSeed(s => s + 1);
    setLeadSeed(s => s + 1);
  }

  const bassMelody = useMemo(
    () => generateMelody(progression, 'bass', bassStyleId, rootKey, scaleType, bassSeed),
    [progression, bassStyleId, rootKey, scaleType, bassSeed],
  );
  const leadMelody = useMemo(
    () => generateMelody(progression, 'lead', leadStyleId, rootKey, scaleType, leadSeed),
    [progression, leadStyleId, rootKey, scaleType, leadSeed],
  );

  // Arpeggiated chord melody
  const arpMelody = useMemo(
    () => arpEnabled ? arpeggiate(progression, arpSettings, arpSeed, STEPS_PER_CHORD) : null,
    [progression, arpEnabled, arpSettings, arpSeed],
  );

  // Drum pattern
  const drumPattern = useMemo(
    () => customDrumPattern || generateDrums(genreId, progression.length, drumSeed),
    [customDrumPattern, genreId, progression.length, drumSeed],
  );

  const handleToggleDrumNote = useCallback((instrument: keyof DrumPattern, step: number) => {
    setCustomDrumPattern(prev => {
      if (!prev) {
        const generated = generateDrums(genreId, progression.length, drumSeed);
        const newPattern = { ...generated };
        newPattern[instrument][step] = newPattern[instrument][step] ? 0 : 1;
        return newPattern;
      }
      const newPattern = { ...prev };
      newPattern[instrument][step] = newPattern[instrument][step] ? 0 : 1;
      return newPattern;
    });
  }, [genreId, progression.length, drumSeed]);

  const handleResetDrumPattern = useCallback(() => {
    setCustomDrumPattern(null);
  }, []);

  // Engine start carries no direct setState — playback state is owned by isPlaying
  // and driven via the effect below, so changing inputs mid-play re-syncs the mix.
  const startEngine = useCallback(() => {
    stopPlayback(); // stop the chord-only engine if it was running
    playArrangement({
      chords: progression,
      rhythm,
      bass: bassMelody,
      lead: leadMelody,
      arpMelody,
      drums: drumPattern,
      synthIds,
      bpm,
      loop,
      onStep: setActiveStep,
      onStop: () => { setIsPlaying(false); setActiveStep(null); },
    });
  }, [progression, rhythm, bassMelody, leadMelody, arpMelody, drumPattern, synthIds, bpm, loop]);

  const stop = useCallback(() => {
    stopArrangement();
    stopTrackPreview();
    setIsPlaying(false);
    setPreviewingTrack(null);
    setActiveStep(null);
  }, []);

  const handlePreviewTrack = useCallback((trackId: TrackId) => {
    stopPlayback();
    stopArrangement();
    setPreviewingTrack(trackId);
    playTrackPreview({
      chords: progression,
      rhythm,
      bass: bassMelody,
      lead: leadMelody,
      arpMelody,
      drums: drumPattern,
      synthIds,
      bpm,
      trackId,
      onStep: setActiveStep,
      onStop: () => { setPreviewingTrack(null); setActiveStep(null); },
    });
  }, [progression, rhythm, bassMelody, leadMelody, arpMelody, drumPattern, synthIds, bpm]);

  // (Re)start whenever playing or when the musical content changes mid-playback.
  useEffect(() => {
    if (isPlaying) startEngine();
  }, [isPlaying, startEngine]);

  // Restart arrangement when synthIds change during playback
  useEffect(() => {
    if (isPlaying) {
      stopArrangement();
      startEngine();
    }
  }, [synthIds, isPlaying, startEngine]);

  useEffect(() => () => { stopArrangement(); }, []);

  const handleSaveArrangement = useCallback(() => {
    if (!saveName.trim()) return;
    const saved = saveArrangement({
      name: saveName.trim(),
      data: {
        rootKey,
        scaleType,
        genreId,
        bpm,
        progressionIndex: 0,
        bassStyleId,
        leadStyleId,
        bassSeed,
        leadSeed,
        arpEnabled,
        arpSettings,
        arpSeed,
        drumKitId,
        drumSeed,
        synthIds,
      },
    });
    setSavedArrangements(prev => [...prev, saved]);
    setShowSaveDialog(false);
    setSaveName('');
  }, [saveName, rootKey, scaleType, genreId, bpm, bassStyleId, leadStyleId, bassSeed, leadSeed, arpEnabled, arpSettings, arpSeed, drumKitId, drumSeed, synthIds]);

  const handleLoadArrangement = useCallback((arrangement: SavedArrangement) => {
    // Restore all state from the saved arrangement
    const { data } = arrangement;
    setBassStyleId(data.bassStyleId);
    setLeadStyleId(data.leadStyleId);
    setBassSeed(data.bassSeed);
    setLeadSeed(data.leadSeed);
    setArpEnabled(data.arpEnabled);
    setArpSettings(data.arpSettings);
    setArpSeed(data.arpSeed);
    setDrumKitId(data.drumKitId);
    setDrumSeed(data.drumSeed);
    setSynthIds(data.synthIds);
    
    // Reset history with loaded state
    setHistory([{ 
      bassSeed: data.bassSeed, 
      leadSeed: data.leadSeed, 
      arpSeed: data.arpSeed, 
      drumSeed: data.drumSeed 
    }]);
    setHistoryIndex(0);
    
    setShowLoadDialog(false);
  }, [setBassStyleId, setLeadStyleId, setBassSeed, setLeadSeed, setArpEnabled, setArpSettings, setArpSeed, setDrumKitId, setDrumSeed, setSynthIds, setShowLoadDialog]);

  const handleDeleteArrangement = useCallback((id: string) => {
    if (deleteArrangement(id)) {
      setSavedArrangements(prev => prev.filter(a => a.id !== id));
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setBassSeed(prevState.bassSeed);
      setLeadSeed(prevState.leadSeed);
      setArpSeed(prevState.arpSeed);
      setDrumSeed(prevState.drumSeed);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex, setBassSeed, setLeadSeed, setArpSeed, setDrumSeed, setHistoryIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setBassSeed(nextState.bassSeed);
      setLeadSeed(nextState.leadSeed);
      setArpSeed(nextState.arpSeed);
      setDrumSeed(nextState.drumSeed);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex, setBassSeed, setLeadSeed, setArpSeed, setDrumSeed, setHistoryIndex]);

  // Save snapshot when seeds change (for undo/redo)
  useEffect(() => {
    if (history.length > 0) {
      const currentState = history[historyIndex];
      if (currentState.bassSeed !== bassSeed || currentState.leadSeed !== leadSeed || 
          currentState.arpSeed !== arpSeed || currentState.drumSeed !== drumSeed) {
        setHistory(prev => {
          const newHistory = prev.slice(0, historyIndex + 1);
          newHistory.push({ bassSeed, leadSeed, arpSeed, drumSeed });
          return newHistory.slice(-50);
        });
        setHistoryIndex(prev => prev + 1);
      }
    }
  }, [bassSeed, leadSeed, arpSeed, drumSeed, history, historyIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Space: Play/Stop
      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) {
          stop();
        } else {
          setIsPlaying(true);
        }
      }
      // Cmd/Ctrl+Z: Undo
      else if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y: Redo
      else if ((e.metaKey || e.ctrlKey) && (e.shiftKey && e.code === 'KeyZ' || e.code === 'KeyY')) {
        e.preventDefault();
        handleRedo();
      }
      // Cmd/Ctrl+S: Save
      else if ((e.metaKey || e.ctrlKey) && e.code === 'KeyS') {
        e.preventDefault();
        setShowSaveDialog(true);
      }
      // Cmd/Ctrl+O: Load
      else if ((e.metaKey || e.ctrlKey) && e.code === 'KeyO') {
        e.preventDefault();
        setShowLoadDialog(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, stop, handleUndo, handleRedo]);

  // Push per-track mixer settings to the engine whenever they change.
  useEffect(() => {
    (Object.keys(tracks) as TrackId[]).forEach(id => {
      setTrackVolume(id, tracks[id].volume);
      setTrackMute(id, tracks[id].mute);
      setTrackSolo(id, tracks[id].solo);
    });
  }, [tracks]);

  // Update drum kit when drumKitId changes
  useEffect(() => {
    updateDrumKit(drumKitId);
  }, [drumKitId]);

  const updateTrack = useCallback((id: TrackId, patch: Partial<TrackState>) => {
    setTracks(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const handleExportWav = useCallback(async () => {
    setRendering(true);
    try {
      const blob = await renderArrangementToWav({
        chords: progression, rhythm, bass: bassMelody, lead: leadMelody,
        drums: drumPattern,
        synthIds, bpm, tracks,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edm-mix-${rootKey}-${scaleType}-${bpm}bpm.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setRendering(false);
    }
  }, [progression, rhythm, bassMelody, leadMelody, drumPattern, synthIds, bpm, tracks, rootKey, scaleType]);

  const handleExportMultitrackMidi = useCallback(() => {
    exportArrangementToMidi(progression, rhythm, bassMelody, leadMelody, bpm, rootKey, scaleType, doubleTime, arpMelody, drumPattern);
  }, [progression, rhythm, bassMelody, leadMelody, bpm, rootKey, scaleType, doubleTime, arpMelody, drumPattern]);

  if (progression.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12">
        Select a chord progression in the Chord Progression tab first.
      </div>
    );
  }

  const totalSteps = progression.length * STEPS_PER_CHORD;
  const activeChordIdx = activeStep !== null ? Math.floor(activeStep / STEPS_PER_CHORD) : -1;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={isPlaying ? stop : () => setIsPlaying(true)}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${isPlaying ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
          >
            {isPlaying ? 'Stop' : 'Play'}
          </button>
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="px-3 py-1.5 rounded text-xs font-semibold border border-gray-700 text-gray-200 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="px-3 py-1.5 rounded text-xs font-semibold border border-gray-700 text-gray-200 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Redo
          </button>
          <button
            onClick={() => setShowSaveDialog(true)}
            className="px-3 py-1.5 rounded text-xs font-semibold border border-gray-700 text-gray-200 hover:border-gray-500 transition-all"
          >
            Save
          </button>
          <button
            onClick={() => setShowLoadDialog(true)}
            className="px-3 py-1.5 rounded text-xs font-semibold border border-gray-700 text-gray-200 hover:border-gray-500 transition-all"
          >
            Load
          </button>
          <button
            onClick={handleExportMultitrackMidi}
            className="px-3 py-1.5 rounded text-xs font-semibold border border-gray-700 text-gray-200 hover:border-gray-500 transition-all"
          >
            Export MIDI
          </button>
          <button
            onClick={handleExportWav}
            disabled={rendering}
            className="px-3 py-1.5 rounded text-xs font-semibold border border-gray-700 text-gray-200 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {rendering ? 'Rendering...' : 'Export WAV'}
          </button>
        </div>
        <div className="text-xs text-gray-500">
          {savedArrangements.length} saved arrangement{savedArrangements.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-96 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Save Arrangement</h3>
            <input
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Arrangement name..."
              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white text-sm mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-3 py-1.5 rounded text-xs font-semibold border border-gray-700 text-gray-200 hover:border-gray-500 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveArrangement}
                disabled={!saveName.trim()}
                className="px-3 py-1.5 rounded text-xs font-semibold bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Dialog */}
      {showLoadDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-96 border border-gray-700 max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-4">Load Arrangement</h3>
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {savedArrangements.length === 0 ? (
                <div className="text-gray-500 text-sm text-center py-4">No saved arrangements</div>
              ) : (
                savedArrangements.map(arr => (
                  <div
                    key={arr.id}
                    className="flex items-center justify-between p-3 rounded bg-gray-800 border border-gray-700 hover:border-gray-600 transition-all"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{arr.name}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(arr.updatedAt).toLocaleDateString()} {new Date(arr.updatedAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleLoadArrangement(arr)}
                        className="px-2 py-1 rounded text-xs font-semibold bg-purple-600 text-white hover:bg-purple-500 transition-all"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDeleteArrangement(arr.id)}
                        className="px-2 py-1 rounded text-xs font-semibold bg-red-600 text-white hover:bg-red-500 transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => setShowLoadDialog(false)}
              className="px-3 py-1.5 rounded text-xs font-semibold border border-gray-700 text-gray-200 hover:border-gray-500 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Tracks */}
      <div className="flex flex-col gap-3">
        {(() => {
          const renderStrip = (id: TrackId, label: string, accent: string) => {
            const t = tracks[id];
            return (
              <div className="flex flex-col gap-1.5 w-32 shrink-0">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${accent}`}>{label}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => updateTrack(id, { mute: !t.mute })}
                      className={`w-5 h-5 rounded text-[10px] font-bold transition-all ${t.mute ? 'bg-red-500 text-white' : 'bg-gray-700/60 text-gray-300 hover:bg-gray-600'}`}
                      title="Mute"
                    >M</button>
                    <button
                      onClick={() => updateTrack(id, { solo: !t.solo })}
                      className={`w-5 h-5 rounded text-[10px] font-bold transition-all ${t.solo ? 'bg-yellow-400 text-black' : 'bg-gray-700/60 text-gray-300 hover:bg-gray-600'}`}
                      title="Solo"
                    >S</button>
                  </div>
                </div>
                <input
                  type="range" min={-30} max={6} step={1} value={t.volume}
                  onChange={e => updateTrack(id, { volume: Number(e.target.value) })}
                  className="w-full accent-purple-500"
                />
                <span className="text-[10px] text-gray-500">{t.volume > 0 ? '+' : ''}{t.volume} dB</span>
              </div>
            );
          };

          const styleButtons = (styles: MelodyStyle[], selected: string, onPick: (id: string) => void, onRegen: () => void) => (
            <div className="flex items-center gap-1.5 flex-wrap">
              {styles.map(s => (
                <button
                  key={s.id}
                  onClick={() => onPick(s.id)}
                  title={s.description}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${selected === s.id ? 'bg-purple-500/20 border border-purple-500 text-purple-300' : 'border border-gray-700/50 text-gray-400 hover:border-gray-600 hover:text-gray-200'}`}
                >{s.name}</button>
              ))}
              <button
                onClick={onRegen}
                className="px-2 py-0.5 rounded text-[11px] text-gray-400 hover:text-gray-200 border border-gray-700/50 hover:border-gray-600 transition-all"
              >Regenerate</button>
            </div>
          );

          return (
            <>
              {/* Chord track */}
              <div className="flex flex-col gap-2 p-3 rounded-xl bg-gray-900/50 border border-gray-800">
                <div className="flex items-center gap-3">
                  {renderStrip('chord', 'Chords', 'text-purple-300')}
                  <div className="flex-1 flex items-center gap-2">
                    <SynthSelector selectedSynth={synthIds.chord} onSynthChange={(id) => setSynthIds(prev => ({ ...prev, chord: id }))} />
                    {arpEnabled && arpMelody ? (
                      <MelodyLane melody={arpMelody} totalSteps={totalSteps} activeStep={activeStep} color="bg-purple-400/80" activeColor="bg-purple-300 ring-1 ring-white shadow-lg shadow-purple-500/50" />
                    ) : (
                      <div className="relative flex-1 bg-gray-900 rounded border border-gray-700/50 overflow-hidden flex" style={{ height: 120 }}>
                        {activeStep !== null && (
                          <div className="absolute top-0 bottom-0 w-px bg-white/50 z-10 shadow-lg shadow-white/30" style={{ left: `${(activeStep / totalSteps) * 100}%` }} />
                        )}
                        {progression.map((chord, i) => (
                          <div
                            key={i}
                            className={`h-full flex items-center justify-center text-xs font-medium border-r border-gray-800 transition-all ${i === activeChordIdx ? 'bg-purple-500/40 text-white shadow-lg shadow-purple-500/30 scale-105' : 'text-gray-400'}`}
                            style={{ width: `${100 / progression.length}%` }}
                          >
                            {chord.display}
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => handlePreviewTrack('chord')}
                      disabled={previewingTrack === 'chord' || isPlaying}
                      className="px-3 py-1.5 rounded text-xs font-semibold border border-gray-700 text-gray-200 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                    >
                      {previewingTrack === 'chord' ? 'Playing...' : 'Preview'}
                    </button>
                  </div>
                </div>
                {/* Arpeggiator controls */}
                <div className="flex items-center gap-2 pl-[140px]">
                  <button
                    onClick={() => setArpEnabled(!arpEnabled)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${arpEnabled ? 'bg-purple-500/20 border border-purple-500 text-purple-300' : 'border border-gray-700/50 text-gray-400 hover:border-gray-600'}`}
                  >
                    {arpEnabled ? 'Arp: ON' : 'Arp: OFF'}
                  </button>
                  {arpEnabled && (
                    <>
                      <select
                        value={arpSettings.pattern}
                        onChange={e => setArpSettings(prev => ({ ...prev, pattern: e.target.value as ArpPattern }))}
                        className="px-2 py-0.5 rounded text-[11px] bg-gray-800 border border-gray-700 text-gray-300"
                      >
                        <option value="up">Up</option>
                        <option value="down">Down</option>
                        <option value="up-down">Up-Down</option>
                        <option value="random">Random</option>
                      </select>
                      <select
                        value={arpSettings.rate}
                        onChange={e => setArpSettings(prev => ({ ...prev, rate: e.target.value as ArpRate }))}
                        className="px-2 py-0.5 rounded text-[11px] bg-gray-800 border border-gray-700 text-gray-300"
                      >
                        <option value="eighth">1/8</option>
                        <option value="sixteenth">1/16</option>
                      </select>
                      <select
                        value={arpSettings.octaveRange}
                        onChange={e => setArpSettings(prev => ({ ...prev, octaveRange: Number(e.target.value) }))}
                        className="px-2 py-0.5 rounded text-[11px] bg-gray-800 border border-gray-700 text-gray-300"
                      >
                        <option value={1}>1 Oct</option>
                        <option value={2}>2 Oct</option>
                        <option value={3}>3 Oct</option>
                      </select>
                      <input
                        type="range"
                        min="0.5"
                        max="1"
                        step="0.1"
                        value={arpSettings.gate}
                        onChange={e => setArpSettings(prev => ({ ...prev, gate: Number(e.target.value) }))}
                        className="w-16 accent-purple-500"
                      />
                      <span className="text-[10px] text-gray-500">Gate: {arpSettings.gate}</span>
                      <button
                        onClick={() => setArpSeed(s => s + 1)}
                        className="px-2 py-0.5 rounded text-[11px] text-gray-400 hover:text-gray-200 border border-gray-700/50 hover:border-gray-600 transition-all"
                      >
                        Regenerate
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Bass track */}
              <div className="flex flex-col gap-2 p-3 rounded-xl bg-gray-900/50 border border-gray-800">
                <div className="flex items-center gap-3">
                  {renderStrip('bass', 'Bass', 'text-orange-300')}
                  <div className="flex-1 flex items-center gap-2">
                    <SynthSelector selectedSynth={synthIds.bass} onSynthChange={(id) => setSynthIds(prev => ({ ...prev, bass: id }))} />
                    <MelodyLane melody={bassMelody} totalSteps={totalSteps} activeStep={activeStep} color="bg-orange-400/80" activeColor="bg-orange-300 ring-1 ring-white shadow-lg shadow-orange-500/50" />
                    <button
                      onClick={() => handlePreviewTrack('bass')}
                      disabled={previewingTrack === 'bass' || isPlaying}
                      className="px-3 py-1.5 rounded text-xs font-semibold border border-gray-700 text-gray-200 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                    >
                      {previewingTrack === 'bass' ? 'Playing...' : 'Preview'}
                    </button>
                  </div>
                </div>
                {styleButtons(bassStyles, bassStyleId, setBassStyleId, () => setBassSeed(s => s + 1))}
              </div>

              {/* Lead track */}
              <div className="flex flex-col gap-2 p-3 rounded-xl bg-gray-900/50 border border-gray-800">
                <div className="flex items-center gap-3">
                  {renderStrip('lead', 'Lead', 'text-cyan-300')}
                  <div className="flex-1 flex items-center gap-2">
                    <SynthSelector selectedSynth={synthIds.lead} onSynthChange={(id) => setSynthIds(prev => ({ ...prev, lead: id }))} />
                    <MelodyLane melody={leadMelody} totalSteps={totalSteps} activeStep={activeStep} color="bg-cyan-400/80" activeColor="bg-cyan-300 ring-1 ring-white shadow-lg shadow-cyan-500/50" />
                    <button
                      onClick={() => handlePreviewTrack('lead')}
                      disabled={previewingTrack === 'lead' || isPlaying}
                      className="px-3 py-1.5 rounded text-xs font-semibold border border-gray-700 text-gray-200 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                    >
                      {previewingTrack === 'lead' ? 'Playing...' : 'Preview'}
                    </button>
                  </div>
                </div>
                {styleButtons(leadStyles, leadStyleId, setLeadStyleId, () => setLeadSeed(s => s + 1))}
              </div>

              {/* Drums track */}
              <div className="flex flex-col gap-2 p-3 rounded-xl bg-gray-900/50 border border-gray-800">
                <div className="flex items-center gap-3">
                  {renderStrip('drums', 'Drums', 'text-red-300')}
                  <div className="flex-1 flex items-center gap-2">
                    <div className="relative flex-1 bg-gray-900 rounded border border-gray-700/50 overflow-hidden flex" style={{ height: 120 }}>
                      {activeStep !== null && (
                        <div className="absolute top-0 bottom-0 w-px bg-white/50 z-10" style={{ left: `${(activeStep / totalSteps) * 100}%` }} />
                      )}
                      <div className="flex-1 flex flex-col gap-0.5 p-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 w-8">Kick</span>
                          <div className="flex-1 flex gap-0.5">
                            {drumPattern.kick.slice(0, 16).map((v, i) => (
                              <div
                                key={i}
                                onClick={() => handleToggleDrumNote('kick', i)}
                                className={`flex-1 h-3 rounded-sm transition-all cursor-pointer hover:opacity-80 ${v ? 'bg-red-400' : 'bg-gray-800'} ${activeStep !== null && activeStep % 16 === i ? 'ring-1 ring-white shadow-lg shadow-red-500/50 scale-110' : ''}`}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 w-8">Snare</span>
                          <div className="flex-1 flex gap-0.5">
                            {drumPattern.snare.slice(0, 16).map((v, i) => (
                              <div
                                key={i}
                                onClick={() => handleToggleDrumNote('snare', i)}
                                className={`flex-1 h-3 rounded-sm transition-all cursor-pointer hover:opacity-80 ${v ? 'bg-orange-400' : 'bg-gray-800'} ${activeStep !== null && activeStep % 16 === i ? 'ring-1 ring-white shadow-lg shadow-orange-500/50 scale-110' : ''}`}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 w-8">Clap</span>
                          <div className="flex-1 flex gap-0.5">
                            {drumPattern.clap.slice(0, 16).map((v, i) => (
                              <div
                                key={i}
                                onClick={() => handleToggleDrumNote('clap', i)}
                                className={`flex-1 h-3 rounded-sm transition-all cursor-pointer hover:opacity-80 ${v ? 'bg-yellow-400' : 'bg-gray-800'} ${activeStep !== null && activeStep % 16 === i ? 'ring-1 ring-white shadow-lg shadow-yellow-500/50 scale-110' : ''}`}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 w-8">Hat</span>
                          <div className="flex-1 flex gap-0.5">
                            {drumPattern.hat.slice(0, 16).map((v, i) => (
                              <div
                                key={i}
                                onClick={() => handleToggleDrumNote('hat', i)}
                                className={`flex-1 h-3 rounded-sm transition-all cursor-pointer hover:opacity-80 ${v ? 'bg-green-400' : 'bg-gray-800'} ${activeStep !== null && activeStep % 16 === i ? 'ring-1 ring-white shadow-lg shadow-green-500/50 scale-110' : ''}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handlePreviewTrack('drums')}
                      disabled={previewingTrack === 'drums' || isPlaying}
                      className="px-3 py-1.5 rounded text-xs font-semibold border border-gray-700 text-gray-200 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                    >
                      {previewingTrack === 'drums' ? 'Playing...' : 'Preview'}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-[140px]">
                  <select
                    value={drumKitId}
                    onChange={e => setDrumKitId(e.target.value as DrumKitId)}
                    className="px-2 py-0.5 rounded text-[11px] bg-gray-800 border border-gray-700 text-gray-300"
                  >
                    {DRUM_KITS.map(kit => (
                      <option key={kit.id} value={kit.id}>{kit.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setDrumSeed(s => s + 1)}
                    className="px-2 py-0.5 rounded text-[11px] text-gray-400 hover:text-gray-200 border border-gray-700/50 hover:border-gray-600 transition-all"
                  >
                    Regenerate
                  </button>
                  {customDrumPattern && (
                    <button
                      onClick={handleResetDrumPattern}
                      className="px-2 py-0.5 rounded text-[11px] text-red-400 hover:text-red-200 border border-red-700/50 hover:border-red-600 transition-all"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
