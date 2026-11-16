import { CHORD_TYPES, getChordNotes, NOTE_NAMES, type ChordInfo } from './musicTheory';

export interface ReferenceResult {
  source: 'midi' | 'audio';
  fileName: string;
  bpm: number;
  key: string;
  scale: 'major' | 'minor';
  durationSec: number;
  energy: number;
  confidence: number;
  chords: ChordInfo[];
  note: string;
}

interface ParsedNote {
  midi: number;
  startTick: number;
  endTick: number;
  velocity: number;
}

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function correlation(hist: number[], profile: number[], rotation: number): number {
  const n = 12;
  const meanHist = hist.reduce((a, b) => a + b, 0) / n;
  const meanProfile = profile.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dh = 0;
  let dp = 0;
  for (let i = 0; i < n; i++) {
    const h = hist[(i + rotation) % n] - meanHist;
    const p = profile[i] - meanProfile;
    num += h * p;
    dh += h * h;
    dp += p * p;
  }
  return num / Math.sqrt(Math.max(1e-9, dh * dp));
}

function detectKey(hist: number[]): { key: string; scale: 'major' | 'minor'; confidence: number } {
  let best: { key: string; scale: 'major' | 'minor'; confidence: number } = { key: 'C', scale: 'major', confidence: 0 };
  for (let root = 0; root < 12; root++) {
    for (const [scale, profile] of [['major', MAJOR_PROFILE], ['minor', MINOR_PROFILE]] as const) {
      const score = correlation(hist, profile, root);
      if (score > best.confidence) {
        best = { key: NOTE_NAMES[root], scale, confidence: Math.max(0, Math.min(1, score)) };
      }
    }
  }
  return best;
}

function readVar(data: Uint8Array, pos: number): [number, number] {
  let value = 0;
  let cursor = pos;
  while (cursor < data.length) {
    const byte = data[cursor++];
    value = (value << 7) | (byte & 0x7f);
    if (!(byte & 0x80)) break;
  }
  return [value, cursor];
}

function parseMidi(data: Uint8Array): { bpm: number; notes: ParsedNote[]; durationSec: number } {
  if (String.fromCharCode(...data.slice(0, 4)) !== 'MThd') throw new Error('Not a MIDI file');
  const headerLength = (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7];
  const division = (data[12] << 8) | data[13];
  const ticksPerQuarter = division & 0x8000 ? 480 : division || 480;
  let pos = 8 + headerLength;
  let bpm = 120;
  const notes: ParsedNote[] = [];
  const maxTick = { value: 0 };

  while (pos + 8 <= data.length) {
    const type = String.fromCharCode(...data.slice(pos, pos + 4));
    const length = (data[pos + 4] << 24) | (data[pos + 5] << 16) | (data[pos + 6] << 8) | data[pos + 7];
    if (type !== 'MTrk') {
      pos += 8 + length;
      continue;
    }
    let cursor = pos + 8;
    const end = Math.min(data.length, cursor + length);
    let tick = 0;
    let running = 0;
    const active = new Map<string, { start: number; velocity: number }>();

    while (cursor < end) {
      const [delta, next] = readVar(data, cursor);
      cursor = next;
      tick += delta;
      maxTick.value = Math.max(maxTick.value, tick);
      let status = data[cursor];
      if (status < 0x80) {
        status = running;
      } else {
        cursor++;
        running = status;
      }
      if (status === 0xff) {
        const meta = data[cursor++];
        const [len, afterLen] = readVar(data, cursor);
        cursor = afterLen;
        if (meta === 0x51 && len >= 3) {
          const micros = (data[cursor] << 16) | (data[cursor + 1] << 8) | data[cursor + 2];
          if (micros > 0 && micros < 60000000) bpm = 60000000 / micros;
        }
        cursor += len;
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        const [len, afterLen] = readVar(data, cursor);
        cursor = afterLen + len;
        continue;
      }
      const hi = status & 0xf0;
      const channel = status & 0x0f;
      if (hi === 0x90 || hi === 0x80) {
        const midi = data[cursor++];
        const velocity = data[cursor++];
        const key = `${channel}:${midi}`;
        if (hi === 0x90 && velocity > 0) {
          active.set(key, { start: tick, velocity });
        } else {
          const note = active.get(key);
          if (note) {
            notes.push({ midi, startTick: note.start, endTick: tick, velocity: note.velocity });
            active.delete(key);
          }
        }
      } else if (hi === 0xc0 || hi === 0xd0) {
        cursor += 1;
      } else {
        cursor += 2;
      }
    }
    for (const [key, note] of active) {
      notes.push({ midi: Number(key.split(':')[1]), startTick: note.start, endTick: Math.max(note.start + 1, maxTick.value), velocity: note.velocity });
    }
    pos += 8 + length;
  }

  if (notes.length === 0) throw new Error('No notes found in MIDI');
  const secPerTick = 60 / bpm / ticksPerQuarter;
  const lastTick = Math.max(...notes.map(note => note.endTick));
  return { bpm, notes, durationSec: lastTick * secPerTick };
}

function toChord(noteSet: Set<number>, preferredRoot: number): ChordInfo | null {
  const order = [12, 4, 3, 7, 5, 2, 11, 10, 9, 8, 6];
  for (const root of [preferredRoot, ...Array.from({ length: 12 }, (_, i) => i)]) {
    for (const typeId of ['major', 'minor', 'dom7', 'min7', 'maj7', 'dim', 'aug', 'sus2', 'sus4']) {
      const type = CHORD_TYPES[typeId];
      if (!type) continue;
      const intervals = type.intervals.map(interval => (root + interval) % 12);
      if (intervals.every(pc => noteSet.has(pc))) {
        return getChordNotes(NOTE_NAMES[root], typeId, 4, false);
      }
    }
  }
  void order;
  return null;
}

function chordsFromNotes(notes: ParsedNote[]): ChordInfo[] {
  const groups = new Map<number, ParsedNote[]>();
  for (const note of notes) {
    const key = note.startTick;
    const list = groups.get(key) ?? [];
    list.push(note);
    groups.set(key, list);
  }
  const chords: ChordInfo[] = [];
  const seen = new Set<string>();
  for (const [tick, group] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    void tick;
    const lowest = group.reduce((min, note) => Math.min(min, note.midi), 127);
    const noteSet = new Set(group.map(note => note.midi % 12));
    if (noteSet.size < 3) continue;
    const chord = toChord(noteSet, lowest % 12);
    if (!chord) continue;
    const signature = `${chord.root}-${chord.type.name}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    chords.push(chord);
    if (chords.length >= 12) break;
  }
  return chords;
}

export function analyzeMidiBuffer(buffer: ArrayBuffer, fileName: string): ReferenceResult {
  const data = new Uint8Array(buffer);
  const parsed = parseMidi(data);
  const hist = new Array(12).fill(0);
  for (const note of parsed.notes) {
    hist[note.midi % 12] += Math.max(1, note.endTick - note.startTick) * (note.velocity / 127);
  }
  const key = detectKey(hist);
  const notesPerSecond = parsed.notes.length / Math.max(0.5, parsed.durationSec);
  return {
    source: 'midi',
    fileName,
    bpm: Math.round(parsed.bpm),
    key: key.key,
    scale: key.scale,
    durationSec: parsed.durationSec,
    energy: Math.min(1, notesPerSecond / 12),
    confidence: key.confidence,
    chords: chordsFromNotes(parsed.notes),
    note: 'Tempo and notes read from the MIDI file; chords are inferred from simultaneous notes.',
  };
}

function fftMagnitudes(input: Float32Array): Float32Array {
  const n = input.length;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  re.set(input);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) {
      for (let j = 0; j < len / 2; j++) {
        const wr = Math.cos(angle * j);
        const wi = Math.sin(angle * j);
        const ur = re[i + j];
        const ui = im[i + j];
        const vr = re[i + j + len / 2] * wr - im[i + j + len / 2] * wi;
        const vi = re[i + j + len / 2] * wi + im[i + j + len / 2] * wr;
        re[i + j] = ur + vr;
        im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr;
        im[i + j + len / 2] = ui - vi;
      }
    }
  }
  const out = new Float32Array(n / 2);
  for (let i = 0; i < out.length; i++) out[i] = Math.hypot(re[i], im[i]);
  return out;
}

function audioKey(samples: Float32Array, sampleRate: number): { key: string; scale: 'major' | 'minor'; confidence: number } {
  const hist = new Array(12).fill(0);
  const size = 2048;
  const step = Math.max(size, Math.floor(sampleRate * 0.25));
  for (let offset = 0; offset + size < samples.length; offset += step) {
    const frame = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      frame[i] = samples[offset + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)));
    }
    const mags = fftMagnitudes(frame);
    for (let bin = 2; bin < mags.length; bin++) {
      const freq = bin * sampleRate / size;
      if (freq < 55 || freq > 1760) continue;
      const midi = Math.round(69 + 12 * Math.log2(freq / 440));
      if (midi < 24 || midi > 96) continue;
      hist[midi % 12] += mags[bin];
    }
  }
  return detectKey(hist);
}

function audioBpm(samples: Float32Array, sampleRate: number): number {
  const win = Math.floor(sampleRate * 0.02);
  const envelope: number[] = [];
  for (let i = 0; i + win < samples.length; i += win) {
    let sum = 0;
    for (let j = 0; j < win; j++) sum += samples[i + j] * samples[i + j];
    envelope.push(Math.sqrt(sum / win));
  }
  const onset = envelope.map((value, index) => Math.max(0, value - (envelope[index - 1] ?? 0)));
  let bestLag = 0;
  let best = -Infinity;
  const minLag = Math.max(1, Math.floor(60 / 180 / 0.02));
  const maxLag = Math.floor(60 / 70 / 0.02);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = lag; i < onset.length; i++) sum += onset[i] * onset[i - lag];
    const score = sum / (onset.length - lag);
    if (score > best) {
      best = score;
      bestLag = lag;
    }
  }
  const bpm = bestLag > 0 ? 60 / (bestLag * 0.02) : 120;
  return Math.round(Math.max(70, Math.min(180, bpm)));
}

export async function analyzeAudioFile(buffer: ArrayBuffer, fileName: string): Promise<ReferenceResult> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(buffer.slice(0));
    const samples = decoded.getChannelData(0);
    const histSamples = samples.length > decoded.sampleRate * 90
      ? samples.subarray(0, decoded.sampleRate * 90)
      : samples;
    const key = audioKey(histSamples, decoded.sampleRate);
    const bpm = audioBpm(histSamples, decoded.sampleRate);
    let sum = 0;
    for (let i = 0; i < histSamples.length; i += 4) sum += histSamples[i] * histSamples[i];
    const energy = Math.min(1, Math.sqrt(sum / Math.max(1, histSamples.length / 4)) * 4);
    return {
      source: 'audio',
      fileName,
      bpm,
      key: key.key,
      scale: key.scale,
      durationSec: decoded.duration,
      energy,
      confidence: key.confidence * 0.7,
      chords: [],
      note: 'BPM/key are estimated from the audio preview; chords are available from MIDI references.',
    };
  } finally {
    await context.close();
  }
}

export async function analyzeReference(file: File): Promise<ReferenceResult> {
  if (file.size > 40 * 1024 * 1024) throw new Error('Reference is larger than 40 MB');
  const buffer = await file.arrayBuffer();
  if (/\.(mid|midi)$/i.test(file.name)) return analyzeMidiBuffer(buffer, file.name);
  if (/\.(wav|mp3|m4a|ogg|aac|flac)$/i.test(file.name)) return analyzeAudioFile(buffer, file.name);
  throw new Error('Use a .mid, .wav, .mp3, .m4a, .ogg or .aac file');
}
