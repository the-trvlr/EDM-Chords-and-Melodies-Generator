/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useCallback, useEffect } from 'react';
import { GENRES } from './data/genres';
import type { Genre, RhythmPattern } from './data/genres';
import { getChordsInKey, getChordNotes, keyPrefersFlats, noteNameToPc, getPreferredKeyName, invertChord, voiceLeading } from './utils/musicTheory';
import type { ChordInfo, ChordComplexity } from './utils/musicTheory';
import { initAudio, playChord, playProgression, stopPlayback, setVolume } from './utils/audioEngine';
import type { SynthPresetId } from './utils/audioEngine';
import { stopArrangement } from './utils/mixer';
import { loadPersistedState, savePersistedState, loadProject, encodeShareablePreset, decodeShareablePreset, type ShareablePreset } from './utils/persistence';
import type { ArpPattern, ArpRate } from './utils/arpeggiator';
import type { DrumKitId } from './data/drumKits';
import { exportProgressionToMidi } from './utils/midiExport';
import { KeySelector } from './components/KeySelector';
import { GenreSelector } from './components/GenreSelector';
import { ProgressionSelector } from './components/ProgressionSelector';
import { ChordDisplay } from './components/ChordDisplay';
import { RhythmSelector } from './components/RhythmSelector';
import { SynthSelector } from './components/SynthSelector';
import { TransportControls } from './components/TransportControls';
import { PianoKeyboard } from './components/PianoKeyboard';
import { StaffNotation } from './components/StaffNotation';
import { ChordPalette } from './components/ChordPalette';
import { MelodyStudio } from './components/MelodyStudio';

function buildProgression(genre: Genre, progressionIdx: number, key: string, scale: string, complexity: ChordComplexity = 'basic'): ChordInfo[] {
  const scaleChords = getChordsInKey(key, scale, complexity);
  const useFlats = keyPrefersFlats(noteNameToPc(key), scale);
  const prog = genre.progressions[progressionIdx];
  if (!prog) return [];

  return prog.degrees.map((degree, i) => {
    const baseChord = scaleChords[degree];
    if (!baseChord) return getChordNotes(key, 'minor', 4, useFlats);
    if (prog.chordTypes && prog.chordTypes[i]) {
      return getChordNotes(baseChord.root, prog.chordTypes[i], 4, useFlats);
    }
    return baseChord;
  });
}

const persisted = loadPersistedState();
const initialGenre = GENRES.find(g => g.id === persisted.genreId) ?? GENRES[0];
const initialScale = persisted.selectedScale ?? 'minor';
const initialKey = getPreferredKeyName(noteNameToPc(persisted.selectedKey ?? 'A'), initialScale);

export default function App() {
  const [audioReady, setAudioReady] = useState(false);
  const [selectedKey, setSelectedKey] = useState(initialKey);
  const [selectedScale, setSelectedScale] = useState(initialScale);
  const [selectedGenre, setSelectedGenre] = useState<Genre>(initialGenre);
  const [selectedProgressionIdx, setSelectedProgressionIdx] = useState(persisted.selectedProgressionIdx ?? 0);
  const [selectedRhythm, setSelectedRhythm] = useState<RhythmPattern>(initialGenre.rhythmPatterns[0]);
  const [selectedSynth, setSelectedSynth] = useState<SynthPresetId>(persisted.selectedSynth ?? 'pad');
  const [bpm, setBpm] = useState(persisted.bpm ?? initialGenre.defaultBpm);
  const [volume, setVolumeState] = useState(persisted.volume ?? -6);
  const [activeChordIndex, setActiveChordIndex] = useState(0);
  const [selectedChordForView, setSelectedChordForView] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoop] = useState(persisted.loop ?? true);
  const [doubleTime, setDoubleTime] = useState(persisted.doubleTime ?? false);
  const [chordComplexity, setChordComplexity] = useState<ChordComplexity>(persisted.chordComplexity ?? 'basic');
  const [activeTab, setActiveTab] = useState<'chords' | 'melodies'>(persisted.activeTab ?? 'chords');
  const [customProgression, setCustomProgression] = useState<ChordInfo[] | null>(null);
  const [progressionHistory, setProgressionHistory] = useState<ChordInfo[][]>([]);
  const [progressionHistoryIndex, setProgressionHistoryIndex] = useState(-1);

  // Melody Studio persisted state
  const [melodyStudioState, setMelodyStudioState] = useState({
    bassStyleId: persisted.bassStyleId || '',
    leadStyleId: persisted.leadStyleId || '',
    bassSeed: persisted.bassSeed || 1,
    leadSeed: persisted.leadSeed || 1,
    arpEnabled: persisted.arpEnabled || false,
    arpSettings: persisted.arpSettings || { pattern: 'up' as const, rate: 'eighth' as const, octaveRange: 1, gate: 0.8 },
    arpSeed: persisted.arpSeed || 1,
    drumKitId: persisted.drumKitId || 'acoustic',
    drumSeed: persisted.drumSeed || 1,
    synthIds: persisted.synthIds || { chord: 'pad' as const, bass: 'pluck' as const, lead: 'supersaw' as const, drums: 'piano' as const },
  });

  // Check for shared preset in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preset = params.get('preset');
    if (preset) {
      const decoded = decodeShareablePreset(preset);
      if (decoded) {
        const genre = GENRES.find(g => g.id === decoded.g) ?? GENRES[0];
        setSelectedKey(decoded.k);
        setSelectedScale(decoded.s);
        setSelectedGenre(genre);
        setSelectedProgressionIdx(decoded.p);
        setSelectedSynth(decoded.y as SynthPresetId);
        setBpm(decoded.b);
        setChordComplexity(decoded.c as ChordComplexity);
        setSelectedRhythm(genre.rhythmPatterns.find(r => r.name === decoded.r) ?? genre.rhythmPatterns[0]);
        // Restore Melody Studio state if present
        if (decoded.bs || decoded.ls || decoded.si) {
          setMelodyStudioState({
            bassStyleId: decoded.bs || '',
            leadStyleId: decoded.ls || '',
            bassSeed: decoded.bsd || 1,
            leadSeed: decoded.lsd || 1,
            arpEnabled: decoded.ae || false,
            arpSettings: decoded.as ? {
              pattern: decoded.as.pattern as ArpPattern,
              rate: decoded.as.rate as ArpRate,
              octaveRange: decoded.as.octaveRange,
              gate: decoded.as.gate,
            } : { pattern: 'up' as const, rate: 'eighth' as const, octaveRange: 1, gate: 0.8 },
            arpSeed: decoded.asd || 1,
            drumKitId: (decoded.dk || 'acoustic') as DrumKitId,
            drumSeed: decoded.dsd || 1,
            synthIds: decoded.si ? {
              chord: decoded.si.chord as SynthPresetId,
              bass: decoded.si.bass as SynthPresetId,
              lead: decoded.si.lead as SynthPresetId,
              drums: decoded.si.drums as SynthPresetId,
            } : { chord: 'pad' as const, bass: 'pluck' as const, lead: 'supersaw' as const, drums: 'piano' as const },
          });
        }
        // Clear URL params
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const handleSaveProject = useCallback(() => {
    const projectData = {
      name: `Project_${new Date().toISOString().slice(0, 10)}`,
      data: {
        selectedKey,
        selectedScale,
        genreId: selectedGenre.id,
        selectedProgressionIdx,
        selectedSynth,
        bpm,
        volume,
        loop,
        doubleTime,
        chordComplexity,
        activeTab,
        customProgression,
        selectedRhythmName: selectedRhythm.name,
      },
    };
    const json = JSON.stringify(projectData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectData.name}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selectedKey, selectedScale, selectedGenre.id, selectedProgressionIdx, selectedSynth, bpm, volume, loop, doubleTime, chordComplexity, activeTab, customProgression, selectedRhythm.name]);

  const handleLoadProject = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const project = JSON.parse(json);
        const loaded = loadProject(project);
        const genre = GENRES.find(g => g.id === loaded.genreId) ?? GENRES[0];
        setSelectedKey(loaded.selectedKey ?? 'C');
        setSelectedScale(loaded.selectedScale ?? 'minor');
        setSelectedGenre(genre);
        setSelectedProgressionIdx(loaded.selectedProgressionIdx ?? 0);
        setSelectedSynth(loaded.selectedSynth ?? 'pad');
        setBpm(loaded.bpm ?? genre.defaultBpm);
        setVolumeState(loaded.volume ?? -6);
        setLoop(loaded.loop ?? true);
        setDoubleTime(loaded.doubleTime ?? false);
        setChordComplexity(loaded.chordComplexity ?? 'basic');
        setActiveTab(loaded.activeTab ?? 'chords');
        setCustomProgression(loaded.customProgression);
        setSelectedRhythm(genre.rhythmPatterns.find(r => r.name === loaded.selectedRhythmName) ?? genre.rhythmPatterns[0]);
      } catch (err) {
        console.error('Failed to load project:', err);
        alert('Failed to load project file. Please check the file format.');
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  }, []);

  const handleSharePreset = useCallback(() => {
    const preset: ShareablePreset = {
      k: selectedKey,
      s: selectedScale,
      g: selectedGenre.id,
      p: selectedProgressionIdx,
      y: selectedSynth,
      b: bpm,
      c: chordComplexity,
      r: selectedRhythm.name,
      // Melody Studio state
      bs: melodyStudioState.bassStyleId,
      ls: melodyStudioState.leadStyleId,
      bsd: melodyStudioState.bassSeed,
      lsd: melodyStudioState.leadSeed,
      ae: melodyStudioState.arpEnabled,
      as: melodyStudioState.arpSettings,
      asd: melodyStudioState.arpSeed,
      dk: melodyStudioState.drumKitId,
      dsd: melodyStudioState.drumSeed,
      si: melodyStudioState.synthIds,
    };
    const encoded = encodeShareablePreset(preset);
    const url = `${window.location.origin}${window.location.pathname}?preset=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Preset link copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy link. Please try again.');
    });
  }, [selectedKey, selectedScale, selectedGenre.id, selectedProgressionIdx, selectedSynth, bpm, chordComplexity, selectedRhythm.name, melodyStudioState]);

  const availableChords = getChordsInKey(selectedKey, selectedScale, chordComplexity);
  const templateProgression = buildProgression(selectedGenre, selectedProgressionIdx, selectedKey, selectedScale, chordComplexity);

  // Reset custom edits when the underlying configuration changes (render-time
  // state adjustment — see https://react.dev/learn/you-might-not-need-an-effect).
  const configKey = `${selectedKey}|${selectedScale}|${selectedGenre.id}|${selectedProgressionIdx}|${chordComplexity}`;
  const [prevConfigKey, setPrevConfigKey] = useState(configKey);
  if (configKey !== prevConfigKey) {
    setPrevConfigKey(configKey);
    setCustomProgression(null);
    setSelectedChordForView(null);
  }

  const progression = customProgression || templateProgression;

  const handleReorderChord = useCallback((fromIndex: number, toIndex: number) => {
    const current = customProgression || [...templateProgression];
    const newProgression = [...current];
    const [movedChord] = newProgression.splice(fromIndex, 1);
    newProgression.splice(toIndex, 0, movedChord);
    setCustomProgression(newProgression);
    // Save to history
    setProgressionHistory(prev => {
      const newHistory = prev.slice(0, progressionHistoryIndex + 1);
      newHistory.push(newProgression);
      return newHistory.slice(-50);
    });
    setProgressionHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [customProgression, templateProgression, progressionHistoryIndex]);

  useEffect(() => {
    savePersistedState({
      selectedKey, selectedScale, genreId: selectedGenre.id, selectedProgressionIdx,
      selectedSynth, bpm, volume, loop, doubleTime, chordComplexity, activeTab,
      ...melodyStudioState,
    });
  }, [selectedKey, selectedScale, selectedGenre, selectedProgressionIdx, selectedSynth, bpm, volume, loop, doubleTime, chordComplexity, activeTab, melodyStudioState]);

  const handleInitAudio = useCallback(async () => {
    await initAudio();
    setAudioReady(true);
  }, []);

  const handleGenreChange = useCallback((genre: Genre) => {
    if (isPlaying) { stopPlayback(); setIsPlaying(false); }
    setSelectedGenre(genre);
    setSelectedProgressionIdx(0);
    setSelectedRhythm(genre.rhythmPatterns[0]);
    setBpm(genre.defaultBpm);
    setSelectedScale(genre.preferredScale);
    setSelectedKey(k => getPreferredKeyName(noteNameToPc(k), genre.preferredScale));
    setSelectedSynth(genre.synthPreset as SynthPresetId);
  }, [isPlaying]);

  const handlePlay = useCallback(() => {
    if (progression.length === 0) return;
    stopArrangement(); // ensure the full-mix engine isn't also driving the transport
    setIsPlaying(true);
    setActiveChordIndex(0);
    playProgression(
      progression,
      selectedSynth,
      bpm,
      selectedRhythm,
      (idx) => setActiveChordIndex(idx),
      () => setIsPlaying(false),
      loop,
      doubleTime,
    );
  }, [progression, selectedSynth, bpm, selectedRhythm, loop, doubleTime]);

  const handleStop = useCallback(() => {
    stopPlayback();
    setIsPlaying(false);
    setActiveChordIndex(0);
  }, []);

  const handleTabChange = useCallback((tab: 'chords' | 'melodies') => {
    stopPlayback();
    stopArrangement();
    setIsPlaying(false);
    setActiveChordIndex(0);
    setActiveTab(tab);
  }, []);

  const handleScaleChange = useCallback((scale: string) => {
    if (isPlaying) handleStop();
    setSelectedScale(scale);
    setSelectedKey(k => getPreferredKeyName(noteNameToPc(k), scale));
  }, [isPlaying, handleStop]);

  const handleVolumeChange = useCallback((vol: number) => {
    setVolumeState(vol);
    setVolume(vol);
  }, []);

  const handlePreviewChord = useCallback((chord: ChordInfo) => {
    if (!audioReady) return;
    playChord(chord, selectedSynth, '4n');
  }, [audioReady, selectedSynth]);

  const handleExportMidi = useCallback(() => {
    exportProgressionToMidi(progression, bpm, selectedRhythm, selectedKey, selectedScale, doubleTime);
  }, [progression, bpm, selectedRhythm, selectedKey, selectedScale, doubleTime]);

  const handleAddChord = useCallback((chord: ChordInfo) => {
    const current = customProgression || [...templateProgression];
    const newProgression = [...current, chord];
    setCustomProgression(newProgression);
    // Save to history
    setProgressionHistory(prev => {
      const newHistory = prev.slice(0, progressionHistoryIndex + 1);
      newHistory.push(newProgression);
      return newHistory.slice(-50);
    });
    setProgressionHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [customProgression, templateProgression, progressionHistoryIndex]);

  const handleRemoveChord = useCallback((index: number) => {
    const current = customProgression || [...templateProgression];
    const newProgression = current.filter((_, i) => i !== index);
    setCustomProgression(newProgression);
    // Save to history
    setProgressionHistory(prev => {
      const newHistory = prev.slice(0, progressionHistoryIndex + 1);
      newHistory.push(newProgression);
      return newHistory.slice(-50);
    });
    setProgressionHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [customProgression, templateProgression, progressionHistoryIndex]);

  const handleResetProgression = useCallback(() => {
    setCustomProgression(null);
    setSelectedChordForView(null);
  }, []);

  const handleInversionChange = useCallback((index: number, inversion: number) => {
    const current = customProgression || [...templateProgression];
    const updated = [...current];
    updated[index] = invertChord(updated[index], inversion);
    setCustomProgression(updated);
  }, [customProgression, templateProgression]);

  const handleAutoVoiceLead = useCallback(() => {
    const current = customProgression || [...templateProgression];
    const voiced = voiceLeading(current);
    setCustomProgression(voiced);
    // Save to history
    setProgressionHistory(prev => {
      const newHistory = prev.slice(0, progressionHistoryIndex + 1);
      newHistory.push(voiced);
      return newHistory.slice(-50);
    });
    setProgressionHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [customProgression, templateProgression, progressionHistoryIndex]);

  const handleUndo = useCallback(() => {
    if (progressionHistoryIndex > 0) {
      setProgressionHistoryIndex(prev => prev - 1);
      setCustomProgression([...progressionHistory[progressionHistoryIndex - 1]]);
    }
  }, [progressionHistoryIndex, progressionHistory]);

  const handleRedo = useCallback(() => {
    if (progressionHistoryIndex < progressionHistory.length - 1) {
      setProgressionHistoryIndex(prev => prev + 1);
      setCustomProgression([...progressionHistory[progressionHistoryIndex + 1]]);
    }
  }, [progressionHistoryIndex, progressionHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Undo: Cmd/Ctrl + Z
      if (cmdOrCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Redo: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
      else if ((cmdOrCtrl && e.key === 'z' && e.shiftKey) || (cmdOrCtrl && e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
      // Play/Stop: Space
      else if (e.key === ' ') {
        e.preventDefault();
        if (isPlaying) {
          handleStop();
        } else {
          handlePlay();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, handleUndo, handleRedo, handlePlay, handleStop]);

  const viewedChord = selectedChordForView !== null ? progression[selectedChordForView] : null;

  if (!audioReady) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">EDM Chord Generator</h1>
          <p className="text-gray-400 mb-8 text-sm">Generate chord progressions for electronic dance music</p>
          <button
            onClick={handleInitAudio}
            className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 text-lg"
          >
            Start Making Music
          </button>
          <p className="text-gray-600 text-xs mt-4">Click to enable audio engine</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/50 backdrop-blur">
        <div>
          <h1 className="text-xl font-bold text-white">EDM Chord Generator</h1>
          <div className="text-xs text-gray-600">
            {selectedKey} {selectedScale} · {selectedGenre.name} · {bpm} BPM
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSharePreset}
            className="px-3 py-1.5 rounded text-xs font-medium bg-cyan-600/20 border border-cyan-600/30 text-cyan-300 hover:bg-cyan-600/30 transition-all"
            title="Copy shareable link"
          >
            Share
          </button>
          <button
            onClick={handleSaveProject}
            className="px-3 py-1.5 rounded text-xs font-medium bg-purple-600/20 border border-purple-600/30 text-purple-300 hover:bg-purple-600/30 transition-all"
            title="Save current project as JSON file"
          >
            Save Project
          </button>
          <label className="px-3 py-1.5 rounded text-xs font-medium bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 transition-all cursor-pointer">
            Load Project
            <input
              type="file"
              accept=".json"
              onChange={handleLoadProject}
              className="hidden"
            />
          </label>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 bg-gray-900/50 rounded-lg p-1 border border-gray-800 w-fit">
          <button
            onClick={() => handleTabChange('chords')}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'chords'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Chord Progression
          </button>
          <button
            onClick={() => handleTabChange('melodies')}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'melodies'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Melody Studio
          </button>
        </div>

        {activeTab === 'chords' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-tab="chords">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800 flex flex-col gap-5">
              <KeySelector
                selectedKey={selectedKey}
                selectedScale={selectedScale}
                onKeyChange={(k) => { if (isPlaying) handleStop(); setSelectedKey(k); }}
                onScaleChange={handleScaleChange}
              />
              <GenreSelector selectedGenre={selectedGenre} onGenreChange={handleGenreChange} />

              {/* Chord Complexity */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Chord Complexity</label>
                <div className="flex gap-1.5 flex-wrap">
                  {(['basic', '7ths', '9ths', 'jazzy'] as ChordComplexity[]).map((level) => (
                    <button
                      key={level}
                      onClick={() => { if (isPlaying) handleStop(); setChordComplexity(level); }}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-all capitalize ${
                        chordComplexity === level
                          ? 'bg-purple-500/20 border border-purple-500 text-purple-300'
                          : 'border border-gray-700/50 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800 flex flex-col gap-5">
              <ProgressionSelector
                genre={selectedGenre}
                selectedIndex={selectedProgressionIdx}
                onSelect={(i) => { if (isPlaying) handleStop(); setSelectedProgressionIdx(i); }}
              />
            </div>

            <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800 flex flex-col gap-5">
              <RhythmSelector
                genre={selectedGenre}
                selectedRhythm={selectedRhythm}
                onRhythmChange={setSelectedRhythm}
              />
            </div>

            <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800">
              <SynthSelector selectedSynth={selectedSynth} onSynthChange={setSelectedSynth} />
            </div>
          </div>

          {/* Right Panel - Display */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <TransportControls
              isPlaying={isPlaying}
              bpm={bpm}
              bpmRange={selectedGenre.bpmRange}
              volume={volume}
              loop={loop}
              doubleTime={doubleTime}
              onPlay={handlePlay}
              onStop={handleStop}
              onBpmChange={setBpm}
              onVolumeChange={handleVolumeChange}
              onLoopChange={setLoop}
              onDoubleTimeChange={setDoubleTime}
              onExportMidi={handleExportMidi}
            />

            <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800">
              <ChordDisplay
                progression={progression}
                activeIndex={activeChordIndex}
                selectedIndex={selectedChordForView}
                scaleName={selectedScale}
                scaleChords={availableChords}
                onChordClick={setSelectedChordForView}
                onPreviewChord={handlePreviewChord}
                isPlaying={isPlaying}
              />
            </div>

            <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800">
              <PianoKeyboard chord={viewedChord} />
            </div>

            <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800">
              <StaffNotation
                progression={progression}
                activeIndex={activeChordIndex}
                isPlaying={isPlaying}
              />
            </div>

            <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span />
                {customProgression && (
                  <button
                    onClick={handleResetProgression}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Reset to template
                  </button>
                )}
              </div>
              <ChordPalette
                availableChords={availableChords}
                progression={progression}
                scaleName={selectedScale}
                onAddChord={handleAddChord}
                onRemoveChord={handleRemoveChord}
                onPreviewChord={handlePreviewChord}
                onInversionChange={handleInversionChange}
                onAutoVoiceLead={handleAutoVoiceLead}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={progressionHistoryIndex > 0}
                canRedo={progressionHistoryIndex < progressionHistory.length - 1}
                onReorderChord={handleReorderChord}
              />
            </div>
          </div>
        </div>
        ) : (
          <MelodyStudio
            progression={progression}
            rhythm={selectedRhythm}
            rootKey={selectedKey}
            scaleType={selectedScale}
            bpm={bpm}
            genreId={selectedGenre.id}
            chordSynthId={selectedSynth}
            loop={loop}
            doubleTime={doubleTime}
            persistedBassStyleId={melodyStudioState.bassStyleId}
            persistedLeadStyleId={melodyStudioState.leadStyleId}
            persistedBassSeed={melodyStudioState.bassSeed}
            persistedLeadSeed={melodyStudioState.leadSeed}
            persistedArpEnabled={melodyStudioState.arpEnabled}
            persistedArpSettings={melodyStudioState.arpSettings}
            persistedArpSeed={melodyStudioState.arpSeed}
            persistedDrumKitId={melodyStudioState.drumKitId}
            persistedDrumSeed={melodyStudioState.drumSeed}
            persistedSynthIds={melodyStudioState.synthIds}
            onSaveState={setMelodyStudioState}
          />
        )}
      </main>

      <footer className="border-t border-gray-800 mt-8 py-4 text-center text-xs text-gray-600">
        EDM Chord Generator · Works fully offline · PWA
      </footer>
    </div>
  );
}
