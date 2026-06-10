import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import * as Tone from 'tone';
import type { ChordInfo } from '../utils/musicTheory';
import { midiNoteToToneName } from '../utils/musicTheory';
import { generateMelody, getGenreMelodyStyles, type MelodyType, type MelodyStyle, type GeneratedMelody } from '../utils/melodyGenerator';
// @ts-expect-error midi-writer-js has types but exports resolution fails
import MidiWriter from 'midi-writer-js';

interface MelodyStudioProps {
  progression: ChordInfo[];
  rootKey: string;
  scaleType: string;
  bpm: number;
  genreId: string;
}

function exportMelodyToMidi(melody: GeneratedMelody, bpm: number, label: string) {
  const track = new MidiWriter.Track();
  track.setTempo(bpm);
  track.addTrackName(`EDM ${label} Melody`);
  track.setTimeSignature(4, 4);

  const ticksPer16th = 32;
  let cursor = 0;

  for (const note of melody.notes) {
    const waitSteps = note.step - cursor;
    const opts: Record<string, unknown> = {
      pitch: [midiNoteToToneName(note.midi)],
      duration: `T${note.duration * ticksPer16th}`,
      velocity: 80,
    };
    if (waitSteps > 0) {
      opts.wait = `T${waitSteps * ticksPer16th}`;
    }
    track.addEvent(new MidiWriter.NoteEvent(opts));
    cursor = note.step + note.duration;
  }

  const write = new MidiWriter.Writer([track]);
  const dataUri = write.dataUri();
  const link = document.createElement('a');
  link.href = dataUri;
  link.download = `${label.toLowerCase().replace(/\s+/g, '-')}-melody-${bpm}bpm.mid`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function MelodyPanel({
  type,
  melody,
  styles,
  selectedStyleId,
  progression,
  bpm,
  onStyleChange,
  onRegenerate,
}: {
  type: MelodyType;
  melody: GeneratedMelody;
  styles: MelodyStyle[];
  selectedStyleId: string;
  progression: ChordInfo[];
  bpm: number;
  onStyleChange: (styleId: string) => void;
  onRegenerate: () => void;
}) {
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const loopRef = useRef<Tone.Loop | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const stopMelody = useCallback(() => {
    if (loopRef.current) {
      loopRef.current.stop();
      loopRef.current.dispose();
      loopRef.current = null;
    }
    Tone.getTransport().stop();
    Tone.getTransport().position = 0;
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    return () => { stopMelody(); };
  }, [stopMelody]);

  const playMelody = useCallback(() => {
    stopMelody();

    if (synthRef.current) {
      synthRef.current.disconnect();
      synthRef.current.dispose();
    }

    const preset = type === 'bass'
      ? { oscillator: { type: 'sawtooth4' as const }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.5 }, volume: -8 }
      : { oscillator: { type: 'triangle8' as const }, envelope: { attack: 0.01, decay: 0.15, sustain: 0.3, release: 0.8 }, volume: -10 };

    synthRef.current = new Tone.PolySynth(Tone.Synth, preset).toDestination();
    Tone.getTransport().bpm.value = bpm;

    const totalSteps = progression.length * 16;
    let step = 0;
    const sixteenthDur = Tone.Time('16n').toSeconds();

    const noteMap = new Map<number, { midi: number; duration: number }>();
    for (const n of melody.notes) noteMap.set(n.step, n);

    loopRef.current = new Tone.Loop((time) => {
      const note = noteMap.get(step);
      if (note && synthRef.current) {
        const name = midiNoteToToneName(note.midi);
        synthRef.current.triggerAttackRelease(name, sixteenthDur * note.duration * 0.9, time);
      }
      step++;
      if (step >= totalSteps) {
        Tone.getDraw().schedule(() => setIsPlaying(false), time);
        stopMelody();
      }
    }, '16n');

    loopRef.current.start(0);
    Tone.getTransport().start();
    setIsPlaying(true);
  }, [melody, bpm, progression, type, stopMelody]);

  const label = type === 'bass' ? 'Bass' : 'Lead';

  // Compute note range for visualization
  if (melody.notes.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-white">{label} Melody</h3>
        <div className="text-xs text-gray-500">No notes generated. Try a different style or regenerate.</div>
      </div>
    );
  }

  const midiValues = melody.notes.map(n => n.midi);
  const minMidi = Math.min(...midiValues);
  const maxMidi = Math.max(...midiValues);
  const range = Math.max(maxMidi - minMidi, 12);
  const totalSteps = progression.length * 16;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{label} Melody</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={isPlaying ? stopMelody : playMelody}
            className={`px-3 py-1 rounded text-xs font-medium transition-all ${
              isPlaying
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isPlaying ? 'Stop' : 'Preview'}
          </button>
          <button
            onClick={() => exportMelodyToMidi(melody, bpm, label)}
            className="px-3 py-1 rounded text-xs font-medium border border-gray-600 text-gray-300 hover:border-purple-500 hover:text-purple-300 transition-all"
          >
            Download MIDI
          </button>
        </div>
      </div>

      {/* Style selector */}
      <div className="flex gap-1.5 flex-wrap">
        {styles.map((style) => (
          <button
            key={style.id}
            onClick={() => onStyleChange(style.id)}
            title={style.description}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
              selectedStyleId === style.id
                ? 'bg-purple-500/20 border border-purple-500 text-purple-300'
                : 'border border-gray-700/50 text-gray-400 hover:border-gray-600 hover:text-gray-200'
            }`}
          >
            {style.name}
          </button>
        ))}
      </div>

      {/* Piano roll visualization */}
      <div className="relative bg-gray-900 rounded-lg border border-gray-700/50 overflow-hidden" style={{ height: 120 }}>
        {/* Grid lines for each chord */}
        {progression.map((_, i) => (
          <div
            key={`grid-${i}`}
            className="absolute top-0 bottom-0 border-l border-gray-700/30"
            style={{ left: `${(i / progression.length) * 100}%` }}
          />
        ))}
        {/* Chord labels */}
        {progression.map((chord, i) => (
          <div
            key={`label-${i}`}
            className="absolute top-1 text-[9px] text-gray-500"
            style={{ left: `${((i + 0.05) / progression.length) * 100}%` }}
          >
            {chord.display}
          </div>
        ))}
        {/* Notes */}
        {melody.notes.map((note, i) => {
          const x = (note.step / totalSteps) * 100;
          const w = (note.duration / totalSteps) * 100;
          const y = ((maxMidi - note.midi) / range) * 80 + 10;
          return (
            <div
              key={i}
              className={`absolute rounded-sm ${type === 'bass' ? 'bg-orange-400/80' : 'bg-cyan-400/80'}`}
              style={{
                left: `${x}%`,
                width: `${Math.max(w, 0.5)}%`,
                top: `${y}%`,
                height: 6,
              }}
            />
          );
        })}
      </div>

      <button
        onClick={onRegenerate}
        className="self-start px-3 py-1 rounded text-xs text-gray-400 hover:text-gray-200 border border-gray-700/50 hover:border-gray-600 transition-all"
      >
        Regenerate
      </button>
    </div>
  );
}

export function MelodyStudio({ progression, rootKey, scaleType, bpm, genreId }: MelodyStudioProps) {
  const bassStyles = getGenreMelodyStyles(genreId, 'bass');
  const leadStyles = getGenreMelodyStyles(genreId, 'lead');

  const [bassStyleId, setBassStyleId] = useState(bassStyles[0]?.id || '');
  const [leadStyleId, setLeadStyleId] = useState(leadStyles[0]?.id || '');
  const [bassSeed, setBassSeed] = useState(1);
  const [leadSeed, setLeadSeed] = useState(1);

  // Reset styles when genre changes (render-time state adjustment instead of an
  // effect — see https://react.dev/learn/you-might-not-need-an-effect).
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

  if (progression.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12">
        Select a chord progression in the Chord Progression tab first.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-1">Melody Studio</h2>
        <p className="text-xs text-gray-500">
          Generate bass and lead melodies synced to your chord progression ({rootKey} {scaleType} · {bpm} BPM)
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800">
          <MelodyPanel
            type="bass"
            melody={bassMelody}
            styles={bassStyles}
            selectedStyleId={bassStyleId}
            progression={progression}
            bpm={bpm}
            onStyleChange={setBassStyleId}
            onRegenerate={() => setBassSeed(s => s + 1)}
          />
        </div>

        <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800">
          <MelodyPanel
            type="lead"
            melody={leadMelody}
            styles={leadStyles}
            selectedStyleId={leadStyleId}
            progression={progression}
            bpm={bpm}
            onStyleChange={setLeadStyleId}
            onRegenerate={() => setLeadSeed(s => s + 1)}
          />
        </div>
      </div>
    </div>
  );
}
