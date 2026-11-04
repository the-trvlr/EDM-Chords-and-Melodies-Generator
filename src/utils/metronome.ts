import * as Tone from 'tone';

let click: Tone.MembraneSynth | null = null;
let loop: Tone.Loop | null = null;
let beat = 0;

function ensureClick(): Tone.MembraneSynth {
  if (!click) {
    click = new Tone.MembraneSynth({
      pitchDecay: 0.002,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
    }).toDestination();
    click.volume.value = -12;
  }
  return click;
}

function triggerClick(time: number, accent: boolean): void {
  ensureClick().triggerAttackRelease(accent ? 'C6' : 'C5', 0.03, time, accent ? 0.9 : 0.55);
}

export function countInSeconds(bars: number, bpm: number): number {
  return Math.max(0, bars) * 4 * (60 / Math.max(1, bpm));
}

/**
 * Schedules the count-in clicks and returns the exact audio time at which the
 * transport (and therefore the first note) must start.
 */
export function prepareCountIn(bpm: number, bars: number): number {
  if (bars <= 0) return Tone.now();
  const start = Tone.now() + 0.08;
  const beatSeconds = 60 / Math.max(1, bpm);
  const beats = bars * 4;
  for (let i = 0; i < beats; i++) {
    triggerClick(start + i * beatSeconds, i % 4 === 0);
  }
  return start + beats * beatSeconds;
}

/** Starts the metronome loop at transport position 0 (before transport.start). */
export function startMetronome(bpm: number): void {
  void bpm;
  stopMetronome();
  beat = 0;
  loop = new Tone.Loop((time) => {
    triggerClick(time, beat % 4 === 0);
    beat++;
  }, '4n');
  loop.start(0);
}

/** Live toggle while the transport is already running. */
export function setMetronomeEnabled(enabled: boolean, bpm: number): void {
  if (!enabled) {
    stopMetronome();
    return;
  }
  if (loop) return;
  beat = 0;
  loop = new Tone.Loop((time) => {
    triggerClick(time, beat % 4 === 0);
    beat++;
  }, '4n');
  loop.start();
  void bpm;
}

export function stopMetronome(): void {
  if (loop) {
    loop.stop();
    loop.dispose();
    loop = null;
  }
  beat = 0;
}

export function isMetronomeRunning(): boolean {
  return loop !== null;
}
