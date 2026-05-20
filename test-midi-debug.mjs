import MidiWriter from 'midi-writer-js';
import fs from 'fs';

// Parse MIDI file to extract absolute tick positions of note-on events
function parseMidiNoteOns(buffer) {
  const bytes = new Uint8Array(buffer);
  // Skip MThd header (14 bytes)
  let pos = 14;
  // Skip MTrk header (4 bytes) + length (4 bytes)
  pos += 8;
  
  let absTick = 0;
  const noteOns = [];
  let runningStatus = 0;
  
  while (pos < bytes.length) {
    // Read variable-length delta time
    let delta = 0;
    let b;
    do {
      b = bytes[pos++];
      delta = (delta << 7) | (b & 0x7F);
    } while (b & 0x80);
    
    absTick += delta;
    
    // Read event
    let status = bytes[pos];
    if (status & 0x80) {
      runningStatus = status;
      pos++;
    } else {
      status = runningStatus;
    }
    
    if (status === 0xFF) {
      // Meta event
      const metaType = bytes[pos++];
      let len = 0;
      do {
        b = bytes[pos++];
        len = (len << 7) | (b & 0x7F);
      } while (b & 0x80);
      pos += len;
    } else if ((status & 0xF0) === 0x90) {
      // Note on
      const note = bytes[pos++];
      const vel = bytes[pos++];
      if (vel > 0) {
        noteOns.push({ tick: absTick, note, vel });
      }
    } else if ((status & 0xF0) === 0x80) {
      // Note off
      pos += 2;
    } else if ((status & 0xF0) === 0xC0 || (status & 0xF0) === 0xD0) {
      pos += 1;
    } else {
      pos += 2;
    }
  }
  return noteOns;
}

// Test 1: Single note per event
console.log('=== TEST 1: Single note per chord ===');
{
  const track = new MidiWriter.Track();
  track.setTempo(130);
  track.setTimeSignature(4, 4);
  
  // 4 "chords" of 1 note each, quarter notes (T128)
  for (let i = 0; i < 4; i++) {
    for (let q = 0; q < 4; q++) {
      track.addEvent(new MidiWriter.NoteEvent({
        pitch: ['C4'],
        duration: 'T128',
        velocity: 80,
      }));
    }
  }
  
  const write = new MidiWriter.Writer([track]);
  const buf = write.buildFile();
  const noteOns = parseMidiNoteOns(buf);
  console.log('Note-on positions:', noteOns.map(n => n.tick));
  console.log('Expected bar starts at ticks: 0, 512, 1024, 1536');
  console.log('');
}

// Test 2: 3-note chords (like our app)
console.log('=== TEST 2: 3-note chords ===');
{
  const track = new MidiWriter.Track();
  track.setTempo(130);
  track.setTimeSignature(4, 4);
  
  for (let i = 0; i < 4; i++) {
    for (let q = 0; q < 4; q++) {
      track.addEvent(new MidiWriter.NoteEvent({
        pitch: ['A4', 'C5', 'E5'],
        duration: 'T128',
        velocity: 80,
      }));
    }
  }
  
  const write = new MidiWriter.Writer([track]);
  const buf = write.buildFile();
  fs.writeFileSync('/home/ubuntu/edm-chord-generator/test2.mid', Buffer.from(buf));
  const noteOns = parseMidiNoteOns(buf);
  
  // Group by unique tick positions
  const uniqueTicks = [...new Set(noteOns.map(n => n.tick))];
  console.log('Unique note-on tick positions:', uniqueTicks);
  console.log(`Total unique positions: ${uniqueTicks.length} (expected: 16 = 4 chords * 4 quarter notes)`);
  
  // Check bar alignment
  for (let bar = 0; bar < 4; bar++) {
    const barStart = bar * 512;
    const barEnd = (bar + 1) * 512;
    const notesInBar = uniqueTicks.filter(t => t >= barStart && t < barEnd);
    console.log(`Bar ${bar + 1}: ticks ${barStart}-${barEnd}, notes at: ${notesInBar}`);
  }
  const overflow = uniqueTicks.filter(t => t >= 2048);
  if (overflow.length > 0) {
    console.log(`OVERFLOW beyond bar 4: ${overflow}`);
  }
  console.log('');
}

// Test 3: Exact reproduction of the app's export logic
console.log('=== TEST 3: Exact app logic reproduction ===');
{
  const ticksPer16th = 32;
  const barSteps = 16;
  const pattern = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
  const chordPitches = [
    ['A4', 'C5', 'E5'],   // Am
    ['F4', 'A4', 'C5'],   // F
    ['D4', 'F4', 'A4'],   // Dm
    ['E4', 'G4', 'B4'],   // Em
  ];

  const track = new MidiWriter.Track();
  track.setTempo(130);
  track.setTimeSignature(4, 4);

  for (const pitches of chordPitches) {
    const hits = [];
    for (let i = 0; i < barSteps; i++) {
      if (pattern[i]) hits.push(i);
    }

    let cursor = 0;
    for (let h = 0; h < hits.length; h++) {
      const hitPos = hits[h];
      const nextPos = h + 1 < hits.length ? hits[h + 1] : barSteps;
      const waitSteps = hitPos - cursor;
      const durationSteps = nextPos - hitPos;

      const opts = {
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

  const write = new MidiWriter.Writer([track]);
  const buf = write.buildFile();
  fs.writeFileSync('/home/ubuntu/edm-chord-generator/test3.mid', Buffer.from(buf));
  const noteOns = parseMidiNoteOns(buf);
  
  const uniqueTicks = [...new Set(noteOns.map(n => n.tick))];
  console.log('Unique note-on tick positions:', uniqueTicks);
  
  for (let bar = 0; bar < 5; bar++) {
    const barStart = bar * 512;
    const barEnd = (bar + 1) * 512;
    const notesInBar = uniqueTicks.filter(t => t >= barStart && t < barEnd);
    if (notesInBar.length > 0) {
      console.log(`Bar ${bar + 1}: ticks ${barStart}-${barEnd}, notes at: ${notesInBar}`);
    }
  }
  
  const lastTick = Math.max(...uniqueTicks);
  console.log(`Last note-on at tick: ${lastTick}, expected last: ${3*512 + 3*128} = ${3*512 + 384}`);
  console.log(`Total musical time: ${lastTick + 128} ticks (with last note duration)`);
  console.log(`Expected: 2048 ticks = 4 bars`);
  console.log('');
}

// Test 4: Use standard durations instead of T format
console.log('=== TEST 4: Standard duration strings ===');
{
  const track = new MidiWriter.Track();
  track.setTempo(130);
  track.setTimeSignature(4, 4);
  
  const chordPitches = [
    ['A4', 'C5', 'E5'],
    ['F4', 'A4', 'C5'],
    ['D4', 'F4', 'A4'],
    ['E4', 'G4', 'B4'],
  ];
  
  for (const pitches of chordPitches) {
    for (let q = 0; q < 4; q++) {
      track.addEvent(new MidiWriter.NoteEvent({
        pitch: pitches,
        duration: '4',  // quarter note
        velocity: 80,
      }));
    }
  }

  const write = new MidiWriter.Writer([track]);
  const buf = write.buildFile();
  fs.writeFileSync('/home/ubuntu/edm-chord-generator/test4.mid', Buffer.from(buf));
  const noteOns = parseMidiNoteOns(buf);
  
  const uniqueTicks = [...new Set(noteOns.map(n => n.tick))];
  console.log('Unique note-on tick positions:', uniqueTicks);
  
  for (let bar = 0; bar < 5; bar++) {
    const barStart = bar * 512;
    const barEnd = (bar + 1) * 512;
    const notesInBar = uniqueTicks.filter(t => t >= barStart && t < barEnd);
    if (notesInBar.length > 0) {
      console.log(`Bar ${bar + 1}: ticks ${barStart}-${barEnd}, notes at: ${notesInBar}`);
    }
  }
  console.log('');
}
