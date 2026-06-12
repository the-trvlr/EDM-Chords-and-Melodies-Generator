// @ts-expect-error midi-writer-js has types but exports resolution fails
import MidiWriter from 'midi-writer-js';
import type { ChordInfo } from './musicTheory';
import type { RhythmPattern } from '../data/genres';
import type { GeneratedMelody } from './melodyGenerator';

export function exportProgressionToMidi(
  chords: ChordInfo[],
  bpm: number,
  rhythm: RhythmPattern,
  keyName: string,
  scaleName: string,
  doubleTime = false,
): void {
  const track = new MidiWriter.Track();
  track.setTempo(bpm);
  track.addTrackName(`EDM Chord Progression - ${keyName} ${scaleName}`);
  track.setTimeSignature(4, 4);

  const ticksPer16th = 32;
  const barSteps = rhythm.pattern.length;

  const repetitions = doubleTime ? 2 : 1;

  for (const chord of chords) {
    const pitches = chord.midiNotes.map(
      m => `${getNoteLetter(m % 12)}${Math.floor(m / 12) - 1}`,
    );

    const hits: number[] = [];
    for (let i = 0; i < barSteps; i++) {
      if (rhythm.pattern[i]) hits.push(i);
    }

    for (let rep = 0; rep < repetitions; rep++) {
      if (hits.length === 0) {
        track.addEvent(new MidiWriter.NoteEvent({
          pitch: pitches as MidiWriter.Pitch[],
          duration: `T${barSteps * ticksPer16th}` as MidiWriter.Duration,
          velocity: 0,
        }));
        continue;
      }

      let cursor = 0;
      for (let h = 0; h < hits.length; h++) {
        const hitPos = hits[h];
        const nextPos = h + 1 < hits.length ? hits[h + 1] : barSteps;

        const waitSteps = hitPos - cursor;
        const durationSteps = nextPos - hitPos;

        const opts: Record<string, unknown> = {
          pitch: pitches,
          duration: `T${durationSteps * ticksPer16th}`,
          velocity: 80,
        };
        if (waitSteps > 0) {
          opts.wait = `T${waitSteps * ticksPer16th}`;
        }

        track.addEvent(new MidiWriter.NoteEvent(opts));
        cursor = nextPos;
      }
    }
  }

  const write = new MidiWriter.Writer([track]);
  const dataUri = write.dataUri();

  const link = document.createElement('a');
  link.href = dataUri;
  link.download = `chord-progression-${keyName}-${scaleName}-${bpm}bpm.mid`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getNoteLetter(noteIndex: number): string {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return notes[noteIndex] || 'C';
}

function buildChordTrack(
  chords: ChordInfo[],
  bpm: number,
  rhythm: RhythmPattern,
  doubleTime = false,
): MidiWriter.Track {
  const track = new MidiWriter.Track();
  track.setTempo(bpm);
  track.addTrackName('Chords');
  track.setTimeSignature(4, 4);

  const ticksPer16th = 32;
  const barSteps = rhythm.pattern.length;
  const repetitions = doubleTime ? 2 : 1;

  for (const chord of chords) {
    const pitches = chord.midiNotes.map(
      m => `${getNoteLetter(m % 12)}${Math.floor(m / 12) - 1}`,
    );

    const hits: number[] = [];
    for (let i = 0; i < barSteps; i++) {
      if (rhythm.pattern[i]) hits.push(i);
    }

    for (let rep = 0; rep < repetitions; rep++) {
      if (hits.length === 0) {
        track.addEvent(new MidiWriter.NoteEvent({
          pitch: pitches as MidiWriter.Pitch[],
          duration: `T${barSteps * ticksPer16th}` as MidiWriter.Duration,
          velocity: 0,
        }));
        continue;
      }

      let cursor = 0;
      for (let h = 0; h < hits.length; h++) {
        const hitPos = hits[h];
        const nextPos = h + 1 < hits.length ? hits[h + 1] : barSteps;

        const waitSteps = hitPos - cursor;
        const durationSteps = nextPos - hitPos;

        const opts: Record<string, unknown> = {
          pitch: pitches,
          duration: `T${durationSteps * ticksPer16th}`,
          velocity: 80,
        };
        if (waitSteps > 0) {
          opts.wait = `T${waitSteps * ticksPer16th}`;
        }

        track.addEvent(new MidiWriter.NoteEvent(opts));
        cursor = nextPos;
      }
    }
  }

  return track;
}

function buildMelodyTrack(melody: GeneratedMelody, bpm: number, label: string): MidiWriter.Track {
  const track = new MidiWriter.Track();
  track.setTempo(bpm);
  track.addTrackName(`EDM ${label} Melody`);
  track.setTimeSignature(4, 4);

  const ticksPer16th = 32;
  let cursor = 0;

  for (const note of melody.notes) {
    const waitSteps = note.step - cursor;
    const opts: Record<string, unknown> = {
      pitch: [getNoteLetter(note.midi % 12) + Math.floor(note.midi / 12 - 1)],
      duration: `T${note.duration * ticksPer16th}`,
      velocity: 80,
    };
    if (waitSteps > 0) {
      opts.wait = `T${waitSteps * ticksPer16th}`;
    }
    track.addEvent(new MidiWriter.NoteEvent(opts));
    cursor = note.step + note.duration;
  }

  return track;
}

export function exportArrangementToMidi(
  chords: ChordInfo[],
  rhythm: RhythmPattern,
  bass: GeneratedMelody,
  lead: GeneratedMelody,
  bpm: number,
  keyName: string,
  scaleName: string,
  doubleTime = false,
): void {
  const chordTrack = buildChordTrack(chords, bpm, rhythm, doubleTime);
  const bassTrack = buildMelodyTrack(bass, bpm, 'Bass');
  const leadTrack = buildMelodyTrack(lead, bpm, 'Lead');

  const write = new MidiWriter.Writer([chordTrack, bassTrack, leadTrack]);
  const dataUri = write.dataUri();

  const link = document.createElement('a');
  link.href = dataUri;
  link.download = `edm-arrangement-${keyName}-${scaleName}-${bpm}bpm.mid`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
