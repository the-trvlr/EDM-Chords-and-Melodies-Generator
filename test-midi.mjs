import MidiWriter from 'midi-writer-js';
import fs from 'fs';

const ticksPer16th = 32;
const barSteps = 16;

// Simulate Techno - Melodic Techno - Driving pattern
const pattern = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
const chords = [
  { name: 'Am', pitches: ['A4', 'C5', 'E5'] },
  { name: 'F',  pitches: ['F4', 'A4', 'C5'] },
  { name: 'Dm', pitches: ['D4', 'F4', 'A4'] },
  { name: 'Em', pitches: ['E4', 'G4', 'B4'] },
];

const track = new MidiWriter.Track();
track.setTempo(130);
track.setTimeSignature(4, 4);

console.log(`Pattern: [${pattern.join(', ')}]`);
console.log(`ticksPer16th: ${ticksPer16th}`);
console.log(`Expected ticks per bar: ${barSteps * ticksPer16th} (${barSteps} steps * ${ticksPer16th} ticks)`);
console.log(`Expected total ticks for 4 chords: ${4 * barSteps * ticksPer16th}`);
console.log('');

for (const chord of chords) {
  const hits = [];
  for (let i = 0; i < barSteps; i++) {
    if (pattern[i]) hits.push(i);
  }

  console.log(`Chord: ${chord.name}, hits at steps: [${hits.join(', ')}]`);

  let cursor = 0;
  let totalTicksThisChord = 0;

  for (let h = 0; h < hits.length; h++) {
    const hitPos = hits[h];
    const nextPos = h + 1 < hits.length ? hits[h + 1] : barSteps;

    const waitSteps = hitPos - cursor;
    const durationSteps = nextPos - hitPos;
    const waitTicks = waitSteps * ticksPer16th;
    const durationTicks = durationSteps * ticksPer16th;

    console.log(`  Event ${h}: wait=${waitSteps} steps (${waitTicks}t), dur=${durationSteps} steps (${durationTicks}t)`);
    totalTicksThisChord += waitTicks + durationTicks;

    const opts = {
      pitch: chord.pitches,
      duration: `T${durationTicks}`,
      velocity: 80,
    };
    if (waitSteps > 0) {
      opts.wait = `T${waitTicks}`;
    }

    track.addEvent(new MidiWriter.NoteEvent(opts));
    cursor = nextPos;
  }

  console.log(`  Total ticks for ${chord.name}: ${totalTicksThisChord}`);
  console.log('');
}

// Write to file for inspection
const write = new MidiWriter.Writer([track]);
const buffer = write.buildFile();
fs.writeFileSync('/home/ubuntu/edm-chord-generator/test-output.mid', Buffer.from(buffer));
console.log('Written test-output.mid');

// Also dump raw bytes to check
const bytes = Array.from(new Uint8Array(buffer));
console.log(`\nTotal MIDI file size: ${bytes.length} bytes`);

// Parse the MIDI to check actual tick positions
// Look for note-on events (0x9n) and their delta times
console.log('\nRaw MIDI hex (first 200 bytes):');
const hex = bytes.slice(0, 200).map(b => b.toString(16).padStart(2, '0')).join(' ');
console.log(hex);
