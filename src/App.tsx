import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { GENRES } from './data/genres';
import { DEFAULT_DRUM_KIT_BY_GENRE } from './data/drumKits';
import type { Genre, RhythmPattern } from './data/genres';
import {
  FLAT_NAMES,
  NOTE_NAMES,
  getChordNotes,
  getChordsInKey,
  getPreferredKeyName,
  invertChord,
  keyPrefersFlats,
  noteNameToPc,
  voiceLeading,
  type ChordComplexity,
  type ChordInfo,
} from './utils/musicTheory';
import { initAudio, playChord, playProgression, setPlaybackBpm, setVolume, stopPlayback } from './utils/audioEngine';
import { setArrangementBpm, setArrangementLoop, stopArrangement } from './utils/mixer';
import { loadPersistedState, parseProjectFile, savePersistedState, serializeProject } from './utils/persistence';
import { chordTypeKey, decodeShare, encodeShare, expandChord } from './utils/share';
import { exportProgressionToMidi } from './utils/midiExport';
import { songBars } from './utils/schedule';
import { defaultMelodyState, type MelodyState, type ProjectSnapshot } from './types';
import { ChordDisplay } from './components/ChordDisplay';
import { ChordPalette } from './components/ChordPalette';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GenreSelector } from './components/GenreSelector';
import { KeySelector } from './components/KeySelector';
import { MelodyStudio, type MelodyStudioHandle } from './components/MelodyStudio';
import { Menu } from './components/Menu';
import { PianoKeyboard } from './components/PianoKeyboard';
import { ProgressionSelector } from './components/ProgressionSelector';
import { RhythmSelector } from './components/RhythmSelector';
import { StaffSkeleton } from './components/Skeleton';
import { SynthSelector } from './components/SynthSelector';
import { ToastProvider } from './components/Toast';
import { useToast } from './hooks/useToast';
import { TransportBar } from './components/TransportBar';

const StaffNotation = lazy(() => import('./components/StaffNotation'));

const persisted = loadPersistedState();

function readSharedProject(): ProjectSnapshot | null {
  try {
    const preset = new URLSearchParams(window.location.search).get('preset');
    return preset ? decodeShare(preset) : null;
  } catch {
    return null;
  }
}

const sharedProject = readSharedProject();
const initialGenre = sharedProject
  ? GENRES.find(genre => genre.id === sharedProject.genreId) ?? GENRES[0]
  : GENRES.find(genre => genre.id === persisted.genreId) ?? GENRES[0];
const initialScale = sharedProject?.scale ?? persisted.selectedScale ?? 'minor';
const initialKey = sharedProject?.key ?? getPreferredKeyName(noteNameToPc(persisted.selectedKey ?? 'A'), initialScale);
const initialRhythm = sharedProject
  ? initialGenre.rhythmPatterns.find(rhythm => rhythm.name === sharedProject.rhythmName) ?? initialGenre.rhythmPatterns[0]
  : initialGenre.rhythmPatterns[0];
const initialMelodyState = sharedProject?.melody ?? persisted.melody ?? defaultMelodyState();

function buildProgression(
  genre: Genre,
  progressionIdx: number,
  key: string,
  scale: string,
  complexity: ChordComplexity = 'basic',
): ChordInfo[] {
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

const cloneChords = (chords: ChordInfo[]): ChordInfo[] =>
  chords.map(chord => ({ ...chord, notes: [...chord.notes], midiNotes: [...chord.midiNotes] }));

function transposeChord(chord: ChordInfo, delta: number, useFlats: boolean): ChordInfo {
  const names = useFlats ? FLAT_NAMES : NOTE_NAMES;
  const root = names[((noteNameToPc(chord.root) + delta) % 12 + 12) % 12];
  return expandChord([root, chordTypeKey(chord), chord.inversion ?? 0], useFlats) ?? chord;
}

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function StaffSection({
  progression,
  activeIndex,
  isPlaying,
}: {
  progression: ChordInfo[];
  activeIndex: number;
  isPlaying: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (visible) return;
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '300px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={containerRef} className="min-w-0">
      {visible ? (
        <Suspense fallback={<StaffSkeleton />}>
          <StaffNotation progression={progression} activeIndex={activeIndex} isPlaying={isPlaying} />
        </Suspense>
      ) : (
        <StaffSkeleton />
      )}
    </div>
  );
}

const COMPLEXITY_OPTIONS: { id: ChordComplexity; label: string; hint: string }[] = [
  { id: 'basic', label: 'Simple', hint: 'Triads only' },
  { id: '7ths', label: '7ths', hint: 'Seventh chords' },
  { id: '9ths', label: '9ths', hint: 'Ninth chords' },
  { id: 'jazzy', label: 'Jazzy', hint: 'Sus and extended voicings' },
];

function Studio() {
  const toast = useToast();
  const [audioReady, setAudioReady] = useState(false);
  const [selectedKey, setSelectedKey] = useState(initialKey);
  const [selectedScale, setSelectedScale] = useState(initialScale);
  const [selectedGenre, setSelectedGenre] = useState<Genre>(initialGenre);
  const [selectedProgressionIdx, setSelectedProgressionIdx] = useState(sharedProject?.progressionIdx ?? persisted.selectedProgressionIdx ?? 0);
  const [selectedRhythm, setSelectedRhythm] = useState<RhythmPattern>(initialRhythm);
  const [selectedSynth, setSelectedSynth] = useState(sharedProject?.synth ?? persisted.selectedSynth ?? 'pad');
  const [bpm, setBpm] = useState(sharedProject?.bpm ?? persisted.bpm ?? initialGenre.defaultBpm);
  const [volume, setVolumeState] = useState(sharedProject?.volume ?? persisted.volume ?? -6);
  const [activeChordIndex, setActiveChordIndex] = useState(0);
  const [selectedChordForView, setSelectedChordForView] = useState<number | null>(null);
  const [chordsPlaying, setChordsPlaying] = useState(false);
  const [arrangementPlaying, setArrangementPlaying] = useState(false);
  const [arrangementStep, setArrangementStep] = useState<number | null>(null);
  const [loop, setLoop] = useState(sharedProject?.loop ?? persisted.loop ?? true);
  const [doubleTime, setDoubleTime] = useState(sharedProject?.doubleTime ?? persisted.doubleTime ?? false);
  const [chordComplexity, setChordComplexity] = useState<ChordComplexity>(sharedProject?.chordComplexity ?? persisted.chordComplexity ?? 'basic');
  const [activeTab, setActiveTab] = useState<'chords' | 'melodies'>(() => {
    const param = new URLSearchParams(window.location.search).get('tab');
    if (param === 'arrangement' || param === 'melody') return 'melodies';
    if (param === 'harmony') return 'chords';
    return persisted.activeTab ?? 'chords';
  });
  const initialCustomProgression = sharedProject?.customProgression ?? persisted.customProgression ?? null;
  const [customProgression, setCustomProgression] = useState<ChordInfo[] | null>(initialCustomProgression);
  const [history, setHistory] = useState<{ list: ChordInfo[][]; index: number }>(initialCustomProgression ? { list: [initialCustomProgression], index: 0 } : { list: [], index: -1 });
  const [melody, setMelody] = useState<MelodyState>(initialMelodyState);

  const studioRef = useRef<MelodyStudioHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableChords = useMemo(
    () => getChordsInKey(selectedKey, selectedScale, chordComplexity),
    [selectedKey, selectedScale, chordComplexity],
  );
  const templateProgression = useMemo(
    () => buildProgression(selectedGenre, selectedProgressionIdx, selectedKey, selectedScale, chordComplexity),
    [selectedGenre, selectedProgressionIdx, selectedKey, selectedScale, chordComplexity],
  );
  const progression = customProgression ?? templateProgression;
  const viewedChord = selectedChordForView !== null ? progression[selectedChordForView] ?? null : null;

  const snapshot = useMemo<ProjectSnapshot>(() => ({
    key: selectedKey,
    scale: selectedScale,
    genreId: selectedGenre.id,
    progressionIdx: selectedProgressionIdx,
    rhythmName: selectedRhythm.name,
    synth: selectedSynth,
    bpm,
    volume,
    loop,
    doubleTime,
    chordComplexity,
    customProgression,
    melody,
  }), [
    selectedKey, selectedScale, selectedGenre.id, selectedProgressionIdx, selectedRhythm.name,
    selectedSynth, bpm, volume, loop, doubleTime, chordComplexity, customProgression, melody,
  ]);

  const stopAll = useCallback(() => {
    stopPlayback();
    stopArrangement();
    setChordsPlaying(false);
    setArrangementPlaying(false);
    setActiveChordIndex(0);
    setArrangementStep(null);
  }, []);

  const applyProject = useCallback((project: ProjectSnapshot) => {
    stopAll();
    const genre = GENRES.find(item => item.id === project.genreId) ?? GENRES[0];
    setSelectedKey(project.key);
    setSelectedScale(project.scale);
    setSelectedGenre(genre);
    setSelectedProgressionIdx(project.progressionIdx);
    setSelectedSynth(project.synth);
    setBpm(project.bpm);
    setVolumeState(project.volume);
    setVolume(project.volume);
    setLoop(project.loop);
    setDoubleTime(project.doubleTime);
    setChordComplexity(project.chordComplexity);
    setSelectedRhythm(genre.rhythmPatterns.find(rhythm => rhythm.name === project.rhythmName) ?? genre.rhythmPatterns[0]);
    setCustomProgression(project.customProgression ?? null);
    setHistory(project.customProgression ? { list: [project.customProgression], index: 0 } : { list: [], index: -1 });
    setMelody(project.melody);
    setSelectedChordForView(null);
    setActiveChordIndex(0);
  }, [stopAll]);

  const commitProgression = useCallback((next: ChordInfo[]) => {
    const base = customProgression ?? templateProgression;
    setHistory(prev => {
      const list = prev.list.length > 0 ? prev.list.slice(0, prev.index + 1) : [cloneChords(base)];
      const nextList = [...list, cloneChords(next)].slice(-50);
      return { list: nextList, index: nextList.length - 1 };
    });
    setCustomProgression(cloneChords(next));
  }, [customProgression, templateProgression]);

  const undoChords = useCallback(() => {
    if (history.index <= 0) return;
    const index = history.index - 1;
    setCustomProgression(cloneChords(history.list[index]));
    setHistory({ list: history.list, index });
  }, [history]);

  const redoChords = useCallback(() => {
    if (history.index >= history.list.length - 1) return;
    const index = history.index + 1;
    setCustomProgression(cloneChords(history.list[index]));
    setHistory({ list: history.list, index });
  }, [history]);

  const handlePlayChords = useCallback(() => {
    if (progression.length === 0) return;
    stopArrangement();
    setArrangementPlaying(false);
    setArrangementStep(null);
    setChordsPlaying(true);
    setActiveChordIndex(0);
    playProgression(
      progression,
      selectedSynth,
      bpm,
      selectedRhythm,
      index => setActiveChordIndex(index),
      () => setChordsPlaying(false),
      loop,
      doubleTime,
    );
  }, [progression, selectedSynth, bpm, selectedRhythm, loop, doubleTime]);

  const handleStopChords = useCallback(() => {
    stopPlayback();
    setChordsPlaying(false);
    setActiveChordIndex(0);
  }, []);

  const togglePlayback = useCallback(() => {
    // One transport for both screens: it always controls whatever is sounding,
    // so switching tabs never leaves an invisible engine running.
    if (chordsPlaying) {
      handleStopChords();
      return;
    }
    if (arrangementPlaying) {
      setArrangementPlaying(false);
      return;
    }
    if (activeTab === 'chords') {
      handlePlayChords();
    } else {
      setArrangementPlaying(true);
    }
  }, [activeTab, chordsPlaying, arrangementPlaying, handlePlayChords, handleStopChords]);

  const handleInitAudio = useCallback(async () => {
    try {
      await initAudio();
      setAudioReady(true);
    } catch {
      toast.show('Audio could not start. Check your browser sound permissions.', 'error');
    }
  }, [toast]);

  useEffect(() => { setVolume(volume); }, [volume]);
  useEffect(() => { setPlaybackBpm(bpm); setArrangementBpm(bpm); }, [bpm]);
  useEffect(() => { setArrangementLoop(loop); }, [loop]);

  useEffect(() => {
    savePersistedState({
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
      melody,
      customProgression,
    });
  }, [
    selectedKey, selectedScale, selectedGenre.id, selectedProgressionIdx, selectedSynth,
    bpm, volume, loop, doubleTime, chordComplexity, activeTab, melody, customProgression,
  ]);

  const chordsPlayingRef = useRef(chordsPlaying);
  useEffect(() => {
    chordsPlayingRef.current = chordsPlaying;
  }, [chordsPlaying]);

  const handleArrangementPlayingChange = useCallback((playing: boolean) => {
    setArrangementPlaying(playing);
    if (playing) setChordsPlaying(false);
  }, []);

  useEffect(() => {
    if (!chordsPlayingRef.current) return;
    stopPlayback();
    playProgression(
      progression,
      selectedSynth,
      bpm,
      selectedRhythm,
      index => setActiveChordIndex(index),
      () => setChordsPlaying(false),
      loop,
      doubleTime,
    );
    // The transport is restarted only when the sound of the chord track changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop, doubleTime, selectedSynth, selectedRhythm, progression]);

  useEffect(() => {
    if (!sharedProject) return;
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const handleKeyChange = useCallback((nextKey: string) => {
    if (nextKey === selectedKey) return;
    if (chordsPlaying) handleStopChords();
    const delta = ((noteNameToPc(nextKey) - noteNameToPc(selectedKey)) % 12 + 12) % 12;
    setSelectedKey(nextKey);
    if (customProgression) {
      const useFlats = keyPrefersFlats(noteNameToPc(nextKey), selectedScale);
      commitProgression(customProgression.map(chord => transposeChord(chord, delta, useFlats)));
    }
  }, [selectedKey, selectedScale, customProgression, chordsPlaying, handleStopChords, commitProgression]);

  const handleScaleChange = useCallback((scale: string) => {
    if (chordsPlaying) handleStopChords();
    setSelectedScale(scale);
    setSelectedKey(current => getPreferredKeyName(noteNameToPc(current), scale));
  }, [chordsPlaying, handleStopChords]);

  const handleGenreChange = useCallback((genre: Genre) => {
    if (chordsPlaying) handleStopChords();
    if (arrangementPlaying) setArrangementPlaying(false);
    setSelectedGenre(genre);
    setSelectedProgressionIdx(0);
    setSelectedRhythm(genre.rhythmPatterns[0]);
    setBpm(genre.defaultBpm);
    setSelectedScale(genre.preferredScale);
    setSelectedKey(current => getPreferredKeyName(noteNameToPc(current), genre.preferredScale));
    setSelectedSynth(genre.synthPreset as typeof selectedSynth);
    setMelody(prev => ({
      ...prev,
      drumKitId: DEFAULT_DRUM_KIT_BY_GENRE[genre.id] ?? prev.drumKitId,
    }));
    setSelectedChordForView(null);
  }, [chordsPlaying, arrangementPlaying, handleStopChords]);

  const handleComplexityChange = useCallback((level: ChordComplexity) => {
    if (chordsPlaying) handleStopChords();
    setChordComplexity(level);
  }, [chordsPlaying, handleStopChords]);

  const handleLoopChange = useCallback((next: boolean) => {
    setLoop(next);
    setArrangementLoop(next);
  }, []);

  const handleShare = useCallback(async () => {
    const encoded = encodeShare(snapshot);
    if (encoded.length > 7000) {
      toast.show('This project is too large for a link — use Save → Save project instead.', 'error');
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}?preset=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.show('Link copied — chords, mixer and drum edits included', 'success');
    } catch {
      toast.show('Could not copy the link. Your browser blocked clipboard access.', 'error');
    }
  }, [snapshot, toast]);

  const handleSaveProjectFile = useCallback(() => {
    const name = `${selectedKey}-${selectedGenre.name}-${bpm}bpm`.replace(/\s+/g, '-').toLowerCase();
    downloadText(`${name}.json`, serializeProject(name, snapshot));
    toast.show('Project file saved', 'success');
  }, [selectedKey, selectedGenre.name, bpm, snapshot, toast]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = parseProjectFile(String(reader.result ?? ''));
      if (!result) {
        toast.show('Could not read this project file', 'error');
        return;
      }
      applyProject(result.project);
      toast.show(`Loaded “${result.name}”`, 'success');
    };
    reader.onerror = () => toast.show('Could not read this file', 'error');
    reader.readAsText(file);
  }, [applyProject, toast]);

  const handleExportChordMidi = useCallback(() => {
    exportProgressionToMidi(progression, bpm, selectedRhythm, selectedKey, selectedScale, doubleTime);
    toast.show('Chord MIDI exported', 'success');
  }, [progression, bpm, selectedRhythm, selectedKey, selectedScale, doubleTime, toast]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

      const mod = event.metaKey || event.ctrlKey;
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlayback();
        return;
      }
      if (mod && event.code === 'KeyZ' && !event.shiftKey) {
        event.preventDefault();
        if (activeTab === 'chords') undoChords();
        else studioRef.current?.undo();
        return;
      }
      if (mod && ((event.code === 'KeyZ' && event.shiftKey) || event.code === 'KeyY')) {
        event.preventDefault();
        if (activeTab === 'chords') redoChords();
        else studioRef.current?.redo();
        return;
      }
      if (mod && event.code === 'KeyS') {
        event.preventDefault();
        handleSaveProjectFile();
        return;
      }
      if (mod && event.code === 'KeyO') {
        event.preventDefault();
        fileInputRef.current?.click();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, togglePlayback, undoChords, redoChords, handleSaveProjectFile]);

  const handleTabChange = useCallback((tab: 'chords' | 'melodies') => {
    setActiveTab(tab);
  }, []);

  const previewChord = useCallback((chord: ChordInfo) => {
    if (!audioReady) return;
    playChord(chord, selectedSynth, '4n', selectedRhythm.name, bpm, selectedRhythm.pattern);
  }, [audioReady, selectedSynth, selectedRhythm.name, selectedRhythm.pattern, bpm]);

  if (!audioReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">EDM Studio</h1>
          <p className="mt-2 text-sm text-gray-300">
            Chord progressions, bass, lead and drums — generated, arranged and exported to your DAW.
          </p>
          <button
            type="button"
            onClick={handleInitAudio}
            className="mt-8 min-h-12 rounded-xl bg-purple-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-purple-500/30 transition-colors hover:bg-purple-500"
          >
            Start making music
          </button>
          <p className="mt-4 text-xs text-gray-400">Click once to enable the audio engine · works offline</p>
        </div>
      </div>
    );
  }

  const playing = chordsPlaying || arrangementPlaying;
  const totalBars = Math.max(1, songBars({ chords: progression, sections: melody.sections }));
  const position = chordsPlaying
    ? { bar: Math.min(activeChordIndex + 1, totalBars), totalBars }
    : { bar: Math.floor((arrangementStep ?? 0) / 16) + 1, totalBars };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-2 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-white sm:text-lg">EDM Studio</h1>
              <p className="truncate text-[11px] text-gray-400">
                {selectedKey} {selectedScale} · {selectedGenre.name} · {bpm} BPM
              </p>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <Menu
                label="Save"
                tone="primary"
                items={[
                  { label: 'Save project…', hint: 'Download a .json file', onSelect: handleSaveProjectFile },
                  { label: 'Open project…', hint: 'Ctrl/Cmd+O', onSelect: () => fileInputRef.current?.click() },
                  { label: 'Save arrangement…', hint: 'Stored in this browser', onSelect: () => studioRef.current?.openSaveDialog() },
                  { label: 'Open arrangement…', onSelect: () => studioRef.current?.openLoadDialog() },
                ]}
              />
              <Menu
                label="Export"
                items={[
                  { label: 'Chord progression MIDI', onSelect: handleExportChordMidi },
                  { label: 'Arrangement MIDI', hint: 'Chords, bass, lead, drums', onSelect: () => studioRef.current?.exportMidi() },
                  { label: 'WAV mix', onSelect: () => studioRef.current?.exportWav() },
                  { label: 'Stems (.zip)', hint: 'Chords, bass, lead and drums as separate WAVs', onSelect: () => studioRef.current?.exportStems() },
                  { label: 'Project JSON', onSelect: handleSaveProjectFile },
                ]}
              />
              <button
                type="button"
                onClick={handleShare}
                className="h-11 rounded-lg border border-cyan-600/40 bg-cyan-600/15 px-3 text-xs font-medium text-cyan-200 transition-colors hover:bg-cyan-600/25 sm:h-9"
              >
                Share
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>
          </div>

          <TransportBar
            isPlaying={playing}
            onToggle={togglePlayback}
            bpm={bpm}
            bpmRange={selectedGenre.bpmRange}
            onBpmChange={setBpm}
            loop={loop}
            onLoopChange={handleLoopChange}
            volume={volume}
            onVolumeChange={setVolumeState}
            position={position}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-6">
        <div
          role="tablist"
          aria-label="Studio sections"
          className="mb-3 flex w-fit gap-1 rounded-lg border border-gray-800 bg-gray-900/60 p-1"
        >
          {([
            { id: 'chords', label: 'Harmony' },
            { id: 'melodies', label: 'Arrangement' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`min-h-11 rounded-md px-4 text-sm font-medium transition-colors sm:min-h-9 ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={activeTab === 'chords' ? 'block' : 'hidden'} role="tabpanel" aria-label="Harmony">
          <div className="grid min-w-0 gap-4 lg:grid-cols-3">
            <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
              <div className="flex flex-col gap-5 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <KeySelector
                  selectedKey={selectedKey}
                  selectedScale={selectedScale}
                  onKeyChange={handleKeyChange}
                  onScaleChange={handleScaleChange}
                />
                <GenreSelector selectedGenre={selectedGenre} onGenreChange={handleGenreChange} />

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Chord complexity</span>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chord complexity">
                    {COMPLEXITY_OPTIONS.map(option => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleComplexityChange(option.id)}
                        aria-pressed={chordComplexity === option.id}
                        title={option.hint}
                        className={`min-h-11 rounded-md px-2.5 text-xs font-medium transition-colors sm:min-h-9 ${
                          chordComplexity === option.id
                            ? 'bg-purple-500/20 text-purple-200 ring-1 ring-purple-500'
                            : 'border border-gray-700/60 text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <ProgressionSelector
                  genre={selectedGenre}
                  selectedIndex={selectedProgressionIdx}
                  onSelect={index => {
                    if (chordsPlaying) handleStopChords();
                    setSelectedProgressionIdx(index);
                  }}
                />
              </div>

              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <RhythmSelector
                  genre={selectedGenre}
                  selectedRhythm={selectedRhythm}
                  onRhythmChange={setSelectedRhythm}
                />
              </div>

              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <SynthSelector selectedSynth={selectedSynth} onSynthChange={setSelectedSynth} />
              </div>
            </div>

            <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-2 lg:col-span-2">
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <ChordDisplay
                  progression={progression}
                  activeIndex={activeChordIndex}
                  selectedIndex={selectedChordForView}
                  scaleName={selectedScale}
                  scaleChords={availableChords}
                  onChordClick={setSelectedChordForView}
                  onPreviewChord={previewChord}
                  isPlaying={chordsPlaying}
                />
              </div>

              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <PianoKeyboard chord={viewedChord} />
              </div>

              <div className="min-w-0 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <StaffSection
                  progression={progression}
                  activeIndex={activeChordIndex}
                  isPlaying={chordsPlaying}
                />
              </div>

              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span />
                  {customProgression && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomProgression(null);
                        setHistory({ list: [], index: -1 });
                        setSelectedChordForView(null);
                        toast.show('Progression reset to template');
                      }}
                      className="min-h-8 text-xs text-gray-300 underline-offset-2 hover:text-white hover:underline"
                    >
                      Reset to template
                    </button>
                  )}
                </div>
                <ChordPalette
                  availableChords={availableChords}
                  progression={progression}
                  scaleName={selectedScale}
                  onAddChord={chord => commitProgression([...(customProgression ?? templateProgression), chord])}
                  onRemoveChord={index => commitProgression((customProgression ?? templateProgression).filter((_, i) => i !== index))}
                  onPreviewChord={previewChord}
                  onInversionChange={(index, inversion) => {
                    const current = customProgression ?? templateProgression;
                    commitProgression(current.map((chord, i) => i === index ? invertChord(chord, inversion) : chord));
                  }}
                  onAutoVoiceLead={() => commitProgression(voiceLeading(customProgression ?? templateProgression))}
                  onUndo={undoChords}
                  onRedo={redoChords}
                  canUndo={history.index > 0}
                  canRedo={history.index < history.list.length - 1}
                  onReorderChord={(from, to) => {
                    const current = [...(customProgression ?? templateProgression)];
                    const [moved] = current.splice(from, 1);
                    current.splice(to, 0, moved);
                    commitProgression(current);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={activeTab === 'melodies' ? 'block' : 'hidden'} role="tabpanel" aria-label="Arrangement">
          <MelodyStudio
            ref={studioRef}
            progression={progression}
            rhythm={selectedRhythm}
            rootKey={selectedKey}
            scaleType={selectedScale}
            bpm={bpm}
            genreId={selectedGenre.id}
            loop={loop}
            doubleTime={doubleTime}
            masterVolume={volume}
            isPlaying={arrangementPlaying}
            onPlayingChange={handleArrangementPlayingChange}
            onStepChange={setArrangementStep}
            melody={melody}
            onMelodyChange={setMelody}
            project={snapshot}
            onApplyProject={applyProject}
            onStopOtherPlayback={handleStopChords}
          />
        </div>
      </main>

      <footer className="mt-8 border-t border-gray-800 py-4 text-center text-xs text-gray-400">
        EDM Studio · works fully offline · PWA
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Studio />
      </ToastProvider>
    </ErrorBoundary>
  );
}
