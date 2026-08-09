import { useState, useCallback, useEffect, useMemo } from 'react';
import type { ChordInfo } from '../utils/musicTheory';
import { generateMelody, getGenreMelodyStyles, type MelodyStyle, type GeneratedMelody } from '../utils/melodyGenerator';
import type { RhythmPattern } from '../data/genres';
import type { SynthPresetId } from '../utils/audioEngine';
import { playArrangement, stopArrangement, setTrackVolume, setTrackMute, setTrackSolo, renderArrangementToWav, playTrackPreview, stopTrackPreview, type TrackId } from '../utils/mixer';
import { exportArrangementToMidi } from '../utils/midiExport';
import { stopPlayback } from '../utils/audioEngine';
import { SynthSelector } from './SynthSelector';
import { arpeggiate, type ArpSettings, type ArpPattern, type ArpRate } from '../utils/arpeggiator';
import { generateDrums } from '../utils/drumGenerator';
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

  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [rendering, setRendering] = useState(false);
  const [previewingTrack, setPreviewingTrack] = useState<TrackId | null>(null);

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
    () => generateDrums(genreId, progression.length, drumSeed),
    [genreId, progression.length, drumSeed],
  );

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

  useEffect(() => () => { stopArrangement(); }, []);

  // Push per-track mixer settings to the engine whenever they change.
  useEffect(() => {
    (Object.keys(tracks) as TrackId[]).forEach(id => {
      setTrackVolume(id, tracks[id].volume);
      setTrackMute(id, tracks[id].mute);
      setTrackSolo(id, tracks[id].solo);
    });
  }, [tracks]);

  const updateTrack = useCallback((id: TrackId, patch: Partial<TrackState>) => {
    setTracks(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const handleExportWav = useCallback(async () => {
    setRendering(true);
    try {
      const blob = await renderArrangementToWav({
        chords: progression, rhythm, bass: bassMelody, lead: leadMelody,
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
  }, [progression, rhythm, bassMelody, leadMelody, synthIds, bpm, tracks, rootKey, scaleType]);

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Melody Studio</h2>
          <p className="text-xs text-gray-500">Multi-track arranger ({rootKey} {scaleType} · {bpm} BPM)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportMultitrackMidi}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-700 text-gray-200 hover:border-gray-500 transition-all"
          >
            Download Multitrack MIDI
          </button>
          <button
            onClick={handleExportWav}
            disabled={rendering}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-700 text-gray-200 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {rendering ? 'Rendering…' : 'Download WAV'}
          </button>
          <button
            onClick={isPlaying ? stop : () => setIsPlaying(true)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${isPlaying ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
          >
            {isPlaying ? 'Stop' : 'Play All Together'}
          </button>
        </div>
      </div>

      {/* Chord track */}
      <div className="flex flex-col gap-2 p-3 rounded-xl bg-gray-900/50 border border-gray-800">
        <div className="flex items-center gap-3">
          {renderStrip('chord', 'Chords', 'text-purple-300')}
          <div className="flex-1 flex items-center gap-2">
            <SynthSelector selectedSynth={synthIds.chord} onSynthChange={(id) => setSynthIds(prev => ({ ...prev, chord: id }))} />
            {arpEnabled && arpMelody ? (
              <MelodyLane melody={arpMelody} totalSteps={totalSteps} activeStep={activeStep} color="bg-purple-400/80" activeColor="bg-purple-300 ring-1 ring-white" />
            ) : (
              <div className="relative flex-1 bg-gray-900 rounded border border-gray-700/50 overflow-hidden flex" style={{ height: 120 }}>
                {activeStep !== null && (
                  <div className="absolute top-0 bottom-0 w-px bg-white/50 z-10" style={{ left: `${(activeStep / totalSteps) * 100}%` }} />
                )}
                {progression.map((chord, i) => (
                  <div
                    key={i}
                    className={`h-full flex items-center justify-center text-xs font-medium border-r border-gray-800 transition-colors ${i === activeChordIdx ? 'bg-purple-500/30 text-white' : 'text-gray-400'}`}
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
            <MelodyLane melody={bassMelody} totalSteps={totalSteps} activeStep={activeStep} color="bg-orange-400/80" activeColor="bg-orange-300 ring-1 ring-white" />
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
            <MelodyLane melody={leadMelody} totalSteps={totalSteps} activeStep={activeStep} color="bg-cyan-400/80" activeColor="bg-cyan-300 ring-1 ring-white" />
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
                        className={`flex-1 h-3 rounded-sm transition-all ${v ? 'bg-red-400' : 'bg-gray-800'} ${activeStep === i ? 'ring-1 ring-white' : ''}`}
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
                        className={`flex-1 h-3 rounded-sm transition-all ${v ? 'bg-orange-400' : 'bg-gray-800'} ${activeStep === i ? 'ring-1 ring-white' : ''}`}
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
                        className={`flex-1 h-3 rounded-sm transition-all ${v ? 'bg-yellow-400' : 'bg-gray-800'} ${activeStep === i ? 'ring-1 ring-white' : ''}`}
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
                        className={`flex-1 h-3 rounded-sm transition-all ${v ? 'bg-green-400' : 'bg-gray-800'} ${activeStep === i ? 'ring-1 ring-white' : ''}`}
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
        </div>
      </div>
    </div>
  );
}
