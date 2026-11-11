import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
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
import { initAudio, playChord, playMidiNote, playProgression, setPlaybackBpm, setVolume, stopPlayback } from './utils/audioEngine';
import { setMetronomeEnabled } from './utils/metronome';
import { setArrangementBpm, setArrangementLoop, stopArrangement } from './utils/mixer';
import { loadPersistedState, parseProjectFile, savePersistedState, serializeProject } from './utils/persistence';
import { chordTypeKey, decodeShare, encodeShare, expandChord } from './utils/share';
import { exportProgressionToMidi } from './utils/midiExport';
import { detectKey, suggestNextChords, type HarmonySuggestion } from './utils/harmony';
import { preloadTrackSamplers } from './utils/sampleLibrary';
import { songBars } from './utils/schedule';
import { defaultMelodyState, type MelodyState, type ProjectSnapshot } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Inspector } from './components/Inspector';
import { MelodyStudio, type MelodyStudioHandle } from './components/MelodyStudio';
import { Menu } from './components/Menu';
import { ProjectBar } from './components/ProjectBar';
import { ProgressionStrip } from './components/ProgressionStrip';
import { ToastProvider } from './components/Toast';
import { useToast } from './hooks/useToast';
import { TransportBar } from './components/TransportBar';

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

const KEYBOARD_NOTES: Record<string, number> = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5,
  KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12,
};

interface MidiInputLike {
  onmidimessage: ((event: { data: Uint8Array }) => void) | null;
}

interface MidiAccessLike {
  inputs: Map<string, MidiInputLike>;
  onstatechange: (() => void) | null;
}

function Studio() {
  const toast = useToast();
  const [audioReady, setAudioReady] = useState(false);
  const [loadingInstruments, setLoadingInstruments] = useState(false);
  const [midiEnabled, setMidiEnabled] = useState(false);
  const midiSupported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
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
  const [metronome, setMetronome] = useState(persisted.metronome ?? false);
  const [countIn, setCountIn] = useState(persisted.countInBars ?? 0);
  const [loopBars, setLoopBars] = useState(persisted.loopBars ?? 0);
  const [doubleTime, setDoubleTime] = useState(sharedProject?.doubleTime ?? persisted.doubleTime ?? false);
  const [chordComplexity, setChordComplexity] = useState<ChordComplexity>(sharedProject?.chordComplexity ?? persisted.chordComplexity ?? 'basic');
  const initialCustomProgression = sharedProject?.customProgression ?? persisted.customProgression ?? null;
  const [customProgression, setCustomProgression] = useState<ChordInfo[] | null>(initialCustomProgression);
  const [history, setHistory] = useState<{ list: ChordInfo[][]; index: number }>(initialCustomProgression ? { list: [initialCustomProgression], index: 0 } : { list: [], index: -1 });
  const [melody, setMelody] = useState<MelodyState>(initialMelodyState);
  const [lastEdit, setLastEdit] = useState<'chord' | 'melody' | 'reset' | null>(null);
  const [pinnedChords, setPinnedChords] = useState<Set<number>>(() => new Set());
  const [resetSnapshot, setResetSnapshot] = useState<ProjectSnapshot | null>(null);

  const studioRef = useRef<MelodyStudioHandle>(null);
  const midiAccessRef = useRef<MidiAccessLike | null>(null);
  const midiNoteRef = useRef<(event: { data: Uint8Array }) => void>(() => {});
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
  const harmonySuggestions = useMemo(
    () => suggestNextChords(progression, selectedKey, selectedScale, chordComplexity, 3),
    [progression, selectedKey, selectedScale, chordComplexity],
  );
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
    setLastEdit(null);
    setResetSnapshot(null);
    setPinnedChords(new Set());
  }, [stopAll]);

  const commitProgression = useCallback((next: ChordInfo[]) => {
    const base = customProgression ?? templateProgression;
    setHistory(prev => {
      const list = prev.list.length > 0 ? prev.list.slice(0, prev.index + 1) : [cloneChords(base)];
      const nextList = [...list, cloneChords(next)].slice(-50);
      return { list: nextList, index: nextList.length - 1 };
    });
    setCustomProgression(cloneChords(next));
    setLastEdit('chord');
    setResetSnapshot(null);
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
    setLastEdit('chord');
  }, [history]);

  const handleMelodyChange = useCallback((next: MelodyState) => {
    setMelody(next);
    setLastEdit('melody');
    setResetSnapshot(null);
  }, []);

  const handleUndo = useCallback(() => {
    if (lastEdit === 'reset' && resetSnapshot) {
      applyProject(resetSnapshot);
      return;
    }
    if (lastEdit === 'melody') {
      studioRef.current?.undo();
      return;
    }
    undoChords();
  }, [lastEdit, resetSnapshot, applyProject, undoChords]);

  const handleRedo = useCallback(() => {
    if (lastEdit === 'melody') studioRef.current?.redo();
    else redoChords();
  }, [lastEdit, redoChords]);

  const handlePlayChords = useCallback(() => {
    if (progression.length === 0) return;
    stopArrangement();
    setArrangementPlaying(false);
    setArrangementStep(null);
    setChordsPlaying(true);
    setActiveChordIndex(0);
    playProgression(
      progression,
      melody.synthIds.chord,
      bpm,
      selectedRhythm,
      index => setActiveChordIndex(index),
      () => setChordsPlaying(false),
      loop,
      doubleTime,
      metronome,
      countIn,
    );
  }, [progression, melody.synthIds.chord, bpm, selectedRhythm, loop, doubleTime, metronome, countIn]);

  const handleStopChords = useCallback(() => {
    stopPlayback();
    setChordsPlaying(false);
    setActiveChordIndex(0);
  }, []);

  const togglePlayback = useCallback(() => {
    if (chordsPlaying) {
      handleStopChords();
      return;
    }
    if (arrangementPlaying) {
      setArrangementPlaying(false);
      return;
    }
    setArrangementPlaying(true);
  }, [chordsPlaying, arrangementPlaying, handleStopChords]);

  const handleInitAudio = useCallback(async () => {
    setLoadingInstruments(true);
    try {
      await initAudio();
      await preloadTrackSamplers([
        ['chord', melody.synthIds.chord],
        ['bass', melody.synthIds.bass],
        ['lead', melody.synthIds.lead],
      ]);
      setAudioReady(true);
    } catch {
      toast.show('Audio could not start. Check your browser sound permissions.', 'error');
    } finally {
      setLoadingInstruments(false);
    }
  }, [toast, melody.synthIds]);

  const handleMidiNote = useCallback((event: { data: Uint8Array }) => {
    if (!audioReady) return;
    const [status, note, velocity] = event.data;
    if ((status & 0xf0) === 0x90 && velocity > 0) {
      playMidiNote(note, melody.synthIds.lead);
    }
  }, [audioReady, melody.synthIds.lead]);

  useEffect(() => {
    midiNoteRef.current = handleMidiNote;
  }, [handleMidiNote]);

  const detachMidi = useCallback(() => {
    const access = midiAccessRef.current;
    if (!access) return;
    access.inputs.forEach(input => { input.onmidimessage = null; });
    access.onstatechange = null;
    midiAccessRef.current = null;
    setMidiEnabled(false);
  }, []);

  const handleMidiToggle = useCallback(async () => {
    if (midiEnabled) {
      detachMidi();
      toast.show('MIDI input disconnected');
      return;
    }
    const request = (navigator as Navigator & { requestMIDIAccess?: () => Promise<MidiAccessLike> }).requestMIDIAccess;
    if (!request) {
      toast.show('Web MIDI is not available in this browser.', 'error');
      return;
    }
    try {
      const access = await request.call(navigator);
      const attach = () => {
        access.inputs.forEach(input => {
          input.onmidimessage = event => midiNoteRef.current(event);
        });
      };
      attach();
      access.onstatechange = attach;
      midiAccessRef.current = access;
      setMidiEnabled(true);
      toast.show('MIDI input connected', 'success');
    } catch {
      toast.show('MIDI access was blocked. Allow it in the browser settings.', 'error');
    }
  }, [midiEnabled, detachMidi, toast]);

  useEffect(() => () => detachMidi(), [detachMidi]);

  useEffect(() => {
    if (!audioReady) return;
    void preloadTrackSamplers([
      ['chord', melody.synthIds.chord],
      ['bass', melody.synthIds.bass],
      ['lead', melody.synthIds.lead],
    ]);
  }, [audioReady, melody.synthIds, melody.soundVariant]);

  useEffect(() => { setVolume(volume); }, [volume]);
  useEffect(() => { setPlaybackBpm(bpm); setArrangementBpm(bpm); }, [bpm]);
  useEffect(() => { setArrangementLoop(loop); }, [loop]);
  useEffect(() => {
    if (chordsPlaying || arrangementPlaying) setMetronomeEnabled(metronome, bpm);
  }, [metronome, chordsPlaying, arrangementPlaying, bpm]);

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
      melody,
      customProgression,
      metronome,
      countInBars: countIn,
      loopBars,
    });
  }, [
    selectedKey, selectedScale, selectedGenre.id, selectedProgressionIdx, selectedSynth,
    bpm, volume, loop, doubleTime, chordComplexity, melody, customProgression, metronome, countIn, loopBars,
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
      melody.synthIds.chord,
      bpm,
      selectedRhythm,
      index => setActiveChordIndex(index),
      () => setChordsPlaying(false),
      loop,
      doubleTime,
    );
    // The transport is restarted only when the sound of the chord track changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop, doubleTime, melody.synthIds.chord, selectedRhythm, progression]);

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
    const before = snapshot;
    stopAll();
    setResetSnapshot(before);
    setLastEdit('reset');
    setSelectedGenre(genre);
    setSelectedProgressionIdx(0);
    setSelectedRhythm(genre.rhythmPatterns[0]);
    setBpm(genre.defaultBpm);
    setSelectedScale(genre.preferredScale);
    setPinnedChords(new Set());
    setSelectedKey(current => getPreferredKeyName(noteNameToPc(current), genre.preferredScale));
    setSelectedSynth(genre.synthPreset as typeof selectedSynth);
    setChordComplexity('basic');
    setCustomProgression(null);
    setHistory({ list: [], index: -1 });
    const fresh = defaultMelodyState();
    setMelody({ ...fresh, drumKitId: DEFAULT_DRUM_KIT_BY_GENRE[genre.id] ?? fresh.drumKitId });
    setSelectedChordForView(null);
    toast.show(`${genre.name} selected — the project was reset.`, 'info', {
      label: 'Undo',
      onClick: () => applyProject(before),
    });
  }, [snapshot, stopAll, toast, applyProject]);

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
      if (!mod && !event.repeat && KEYBOARD_NOTES[event.code] !== undefined) {
        event.preventDefault();
        if (audioReady) playMidiNote(60 + KEYBOARD_NOTES[event.code], melody.synthIds.lead);
        return;
      }
      if (mod && event.code === 'KeyZ' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }
      if (mod && ((event.code === 'KeyZ' && event.shiftKey) || event.code === 'KeyY')) {
        event.preventDefault();
        handleRedo();
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
  }, [togglePlayback, handleUndo, handleRedo, handleSaveProjectFile, audioReady, melody.synthIds.lead]);

  const handleSelectTemplate = useCallback((index: number) => {
    if (chordsPlaying) handleStopChords();
    setSelectedProgressionIdx(index);
    setPinnedChords(new Set());
    setCustomProgression(null);
    setHistory({ list: [], index: -1 });
    setSelectedChordForView(null);
    setLastEdit(null);
    setPinnedChords(new Set());
  }, [chordsPlaying, handleStopChords]);

  const handleAddChord = useCallback((chord: ChordInfo) => {
    setPinnedChords(new Set());
    const next = [...progression, chord];
    commitProgression(next);
    setSelectedChordForView(next.length - 1);
  }, [progression, commitProgression]);

  const handleAddSuggestion = useCallback((suggestion: HarmonySuggestion) => {
    handleAddChord(suggestion.chord);
    toast.show(`Added ${suggestion.chord.display} · ${suggestion.kind}`, 'success');
  }, [handleAddChord, toast]);

  const handleDetectKey = useCallback(() => {
    const detected = detectKey(progression);
    if (!detected) {
      toast.show('Add a few chords first — nothing to detect yet.', 'error');
      return;
    }
    setSelectedKey(getPreferredKeyName(noteNameToPc(detected.key), detected.scale));
    setSelectedScale(detected.scale);
    toast.show(`Detected ${detected.key} ${detected.scale} · ${Math.round(detected.confidence * 100)}%`, 'success');
  }, [progression, toast]);

  const handleRemoveChord = useCallback((index: number) => {
    setPinnedChords(new Set());
    const next = progression.filter((_, i) => i !== index);
    commitProgression(next);
    setSelectedChordForView(next.length === 0 ? null : Math.min(index, next.length - 1));
  }, [progression, commitProgression]);

  const handleMoveChord = useCallback((index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= progression.length) return;
    setPinnedChords(new Set());
    const next = [...progression];
    [next[index], next[target]] = [next[target], next[index]];
    commitProgression(next);
    setSelectedChordForView(target);
  }, [progression, commitProgression]);

  const handleInversion = useCallback((index: number, inversion: number) => {
    commitProgression(progression.map((chord, i) => i === index ? invertChord(chord, inversion) : chord));
  }, [progression, commitProgression]);

  const handleVoiceLead = useCallback(() => {
    const voiced = voiceLeading(progression);
    commitProgression(voiced.map((chord, index) => pinnedChords.has(index) ? progression[index] : chord));
  }, [progression, pinnedChords, commitProgression]);

  const handleResetToTemplate = useCallback(() => {
    setPinnedChords(new Set());
    setCustomProgression(null);
    setHistory({ list: [], index: -1 });
    setSelectedChordForView(null);
    toast.show('Progression reset to the genre template');
  }, [toast]);

  const previewChord = useCallback((chord: ChordInfo) => {
    if (!audioReady) return;
    playChord(chord, melody.synthIds.chord, '4n', selectedRhythm.name, bpm, selectedRhythm.pattern);
  }, [audioReady, melody.synthIds.chord, selectedRhythm.name, selectedRhythm.pattern, bpm]);

  if (!audioReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">∞ Melodies</h1>
          <p className="mt-2 text-sm text-gray-300">
            Chord progressions, bass, lead and drums — generated, arranged and exported to your DAW.
          </p>
          <button
            type="button"
            onClick={handleInitAudio}
            disabled={loadingInstruments}
            className="mt-8 min-h-12 rounded-xl bg-purple-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-purple-500/30 transition-colors hover:bg-purple-500 disabled:cursor-wait disabled:opacity-60"
          >
            {loadingInstruments ? 'Loading instruments…' : 'Start making music'}
          </button>
          <p className="mt-4 text-xs text-gray-400">Click once to enable the audio engine · works offline</p>
        </div>
      </div>
    );
  }

  const playing = chordsPlaying || arrangementPlaying;
  const totalBars = Math.max(1, songBars({ chords: progression, sections: melody.sections }));
  const visibleTotalBars = loopBars > 0 ? Math.min(loopBars, totalBars) : totalBars;
  const position = chordsPlaying
    ? { bar: Math.min(activeChordIndex + 1, totalBars), totalBars }
    : arrangementPlaying
      ? { bar: Math.floor((arrangementStep ?? 0) / 16) + 1, totalBars: visibleTotalBars }
      : { bar: 1, totalBars: visibleTotalBars };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-2 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-bold text-white sm:text-lg">∞ Melodies</h1>
                <span
                  className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-gray-300"
                  title="App version"
                >
                  v{__APP_VERSION__}
                </span>
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleUndo}
                aria-label="Undo"
                className="h-11 rounded-lg border border-gray-700 px-2 text-xs font-medium text-gray-200 transition-colors hover:border-gray-500 sm:h-9"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={handleRedo}
                aria-label="Redo"
                className="h-11 rounded-lg border border-gray-700 px-2 text-xs font-medium text-gray-200 transition-colors hover:border-gray-500 sm:h-9"
              >
                Redo
              </button>

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
                  { label: 'DAW pack (.zip)', hint: 'MIDI + stems + project.json + README', onSelect: () => studioRef.current?.exportDawPack() },
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
            metronome={metronome}
            onMetronomeChange={setMetronome}
            countIn={countIn}
            onCountInChange={setCountIn}
            loopBars={loopBars}
            onLoopBarsChange={setLoopBars}
            position={position}
            midiEnabled={midiEnabled}
            onMidiToggle={handleMidiToggle}
            midiSupported={midiSupported}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-6">
        <ProjectBar
          selectedKey={selectedKey}
          selectedScale={selectedScale}
          selectedGenre={selectedGenre}
          chordComplexity={chordComplexity}
          soundVariant={melody.soundVariant}
          onSoundVariantChange={variant => setMelody(previous => ({ ...previous, soundVariant: variant }))}
          onKeyChange={handleKeyChange}
          onScaleChange={handleScaleChange}
          onGenreChange={handleGenreChange}
          onComplexityChange={handleComplexityChange}
        />

        <div className="mt-2">
          <ProgressionStrip
            progression={progression}
            activeIndex={activeChordIndex}
            selectedIndex={selectedChordForView}
            scaleName={selectedScale}
            scaleChords={availableChords}
            availableChords={availableChords}
            templates={selectedGenre.progressions.map(template => ({
              label: template.name,
              hint: template.description,
            }))}
            selectedTemplate={selectedProgressionIdx}
            isPlaying={chordsPlaying}
            isPreviewing={chordsPlaying}
            custom={customProgression !== null}
            onSelect={setSelectedChordForView}
            onPreviewChord={previewChord}
            onAddChord={handleAddChord}
            onTemplateSelect={handleSelectTemplate}
            onTogglePreview={() => {
              if (chordsPlaying) handleStopChords();
              else handlePlayChords();
            }}
            onResetToTemplate={handleResetToTemplate}
            suggestions={harmonySuggestions}
            onAddSuggestion={handleAddSuggestion}
            onDetectKey={handleDetectKey}
          />
        </div>

        <div className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="order-2 min-w-0 xl:order-1">
            <MelodyStudio
              ref={studioRef}
              progression={progression}
              rhythm={selectedRhythm}
              rhythms={selectedGenre.rhythmPatterns}
              onRhythmChange={rhythm => {
                if (chordsPlaying) handleStopChords();
                setSelectedRhythm(rhythm);
              }}
              rootKey={selectedKey}
              scaleType={selectedScale}
              bpm={bpm}
              genreId={selectedGenre.id}
              loop={loop}
              doubleTime={doubleTime}
              masterVolume={volume}
              metronome={metronome}
              countInBars={countIn}
              loopBars={loopBars}
              isPlaying={arrangementPlaying}
              onPlayingChange={handleArrangementPlayingChange}
              onStepChange={setArrangementStep}
              melody={melody}
              onMelodyChange={handleMelodyChange}
              project={snapshot}
              onApplyProject={applyProject}
              onStopOtherPlayback={handleStopChords}
            />
          </div>

          <Inspector
            className="order-1 xl:order-2"
            chord={viewedChord}
            chordIndex={selectedChordForView}
            progression={progression}
            activeIndex={activeChordIndex}
            scaleName={selectedScale}
            isPlaying={chordsPlaying}
            onInversion={handleInversion}
            onMove={handleMoveChord}
            onRemove={handleRemoveChord}
            onVoiceLead={handleVoiceLead}
            onPreview={previewChord}
            pinned={selectedChordForView !== null && pinnedChords.has(selectedChordForView)}
            onTogglePin={() => {
              if (selectedChordForView === null) return;
              setPinnedChords(prev => {
                const next = new Set(prev);
                if (next.has(selectedChordForView)) next.delete(selectedChordForView);
                else next.add(selectedChordForView);
                return next;
              });
            }}
          />
        </div>
      </main>

      <footer className="mt-8 border-t border-gray-800 py-4 text-center text-xs text-gray-400">
        ∞ Melodies · works fully offline · PWA · A–K plays notes
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
