import { useState, useCallback, useEffect } from 'react';
import { GENRES } from './data/genres';
import type { Genre, RhythmPattern } from './data/genres';
import { getChordsInKey, getChordNotes } from './utils/musicTheory';
import type { ChordInfo, ChordComplexity } from './utils/musicTheory';
import { initAudio, playChord, playProgression, stopPlayback, setVolume } from './utils/audioEngine';
import type { SynthPresetId } from './utils/audioEngine';
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
  const prog = genre.progressions[progressionIdx];
  if (!prog) return [];

  return prog.degrees.map((degree, i) => {
    const baseChord = scaleChords[degree];
    if (!baseChord) return getChordNotes(key, 'minor');
    if (prog.chordTypes && prog.chordTypes[i]) {
      return getChordNotes(baseChord.root, prog.chordTypes[i]);
    }
    return baseChord;
  });
}

export default function App() {
  const [audioReady, setAudioReady] = useState(false);
  const [selectedKey, setSelectedKey] = useState('A');
  const [selectedScale, setSelectedScale] = useState('minor');
  const [selectedGenre, setSelectedGenre] = useState<Genre>(GENRES[0]);
  const [selectedProgressionIdx, setSelectedProgressionIdx] = useState(0);
  const [selectedRhythm, setSelectedRhythm] = useState<RhythmPattern>(GENRES[0].rhythmPatterns[0]);
  const [selectedSynth, setSelectedSynth] = useState<SynthPresetId>('pad');
  const [bpm, setBpm] = useState(GENRES[0].defaultBpm);
  const [volume, setVolumeState] = useState(-6);
  const [activeChordIndex, setActiveChordIndex] = useState(0);
  const [selectedChordForView, setSelectedChordForView] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [doubleTime, setDoubleTime] = useState(false);
  const [chordComplexity, setChordComplexity] = useState<ChordComplexity>('basic');
  const [activeTab, setActiveTab] = useState<'chords' | 'melodies'>('chords');
  const [customProgression, setCustomProgression] = useState<ChordInfo[] | null>(null);

  const availableChords = getChordsInKey(selectedKey, selectedScale, chordComplexity);
  const templateProgression = buildProgression(selectedGenre, selectedProgressionIdx, selectedKey, selectedScale, chordComplexity);
  const progression = customProgression || templateProgression;

  useEffect(() => {
    setCustomProgression(null);
    setSelectedChordForView(null);
  }, [selectedKey, selectedScale, selectedGenre, selectedProgressionIdx, chordComplexity]);

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
    setSelectedSynth(genre.synthPreset as SynthPresetId);
  }, [isPlaying]);

  const handlePlay = useCallback(() => {
    if (progression.length === 0) return;
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
    setCustomProgression([...current, chord]);
  }, [customProgression, templateProgression]);

  const handleRemoveChord = useCallback((index: number) => {
    const current = customProgression || [...templateProgression];
    setCustomProgression(current.filter((_, i) => i !== index));
  }, [customProgression, templateProgression]);

  const handleResetProgression = useCallback(() => {
    setCustomProgression(null);
    setSelectedChordForView(null);
  }, []);

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
      <header className="border-b border-gray-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center font-bold text-sm">E</div>
            <div>
              <h1 className="text-lg font-bold leading-tight">EDM Chord Generator</h1>
              <p className="text-xs text-gray-500">Offline Chord Progression Tool</p>
            </div>
          </div>
          <div className="text-xs text-gray-600">
            {selectedKey} {selectedScale} · {selectedGenre.name} · {bpm} BPM
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 bg-gray-900/50 rounded-lg p-1 border border-gray-800 w-fit">
          <button
            onClick={() => setActiveTab('chords')}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'chords'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Chord Progression
          </button>
          <button
            onClick={() => setActiveTab('melodies')}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800 flex flex-col gap-5">
              <KeySelector
                selectedKey={selectedKey}
                selectedScale={selectedScale}
                onKeyChange={(k) => { if (isPlaying) handleStop(); setSelectedKey(k); }}
                onScaleChange={(s) => { if (isPlaying) handleStop(); setSelectedScale(s); }}
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
              />
            </div>
          </div>
        </div>
        ) : (
          <MelodyStudio
            progression={progression}
            rootKey={selectedKey}
            scaleType={selectedScale}
            bpm={bpm}
            rhythm={selectedRhythm}
            doubleTime={doubleTime}
          />
        )}
      </main>

      <footer className="border-t border-gray-800 mt-8 py-4 text-center text-xs text-gray-600">
        EDM Chord Generator · Works fully offline · PWA
      </footer>
    </div>
  );
}
