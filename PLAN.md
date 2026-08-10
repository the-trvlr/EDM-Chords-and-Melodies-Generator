# EDM Chord & Melody Generator — Review, Problems & Roadmap

_Originally reviewed @ `main` (60dbe7d). Updated after Phase 1 (PR #7) and Phase 2 (PR #8)._

## What the app is today
A fully-offline PWA (React 19 + TS + Vite 8 + Tailwind 4 + Tone.js + VexFlow + midi-writer-js).

- **Chord Progression** — pick key/scale/genre/progression/complexity/rhythm/synth, play with loop + double-time, see piano + staff notation, edit chords, export chord MIDI.
- **Melody Studio** — generate seeded bass + lead melodies per genre style, piano-roll preview + per-track MIDI export.
- **Full Mix** _(Phase 2, PR #8)_ — unified engine: chords + bass + lead play together on one transport with per-track mute/solo/volume, synced playhead, and WAV export.

Status: Phase 1 (lint/CI, enharmonic spelling, PWA icons, persistence) ✅ · Phase 2 (unified audio engine) ✅ · Phase 3 (Arpeggiator, Drums, Harmony, Workflow & UX) ✅.

---

## Product model — iterative producer workflow

The app should mirror how a producer actually builds a track, as a **funnel from harmony → arrangement → DAW**:

1. **Set up the project** — choose genre, key/scale, BPM. Genre seeds sensible defaults (progressions, sounds, tempo range).
2. **Find the progression** — audition templates / edit chords until happy. This is the creative anchor.
3. **Decision point** — either:
   - **Export chord MIDI** and continue in a DAW, **or**
   - **Move to the arranger** to layer bass + lead (later: arp + drums).
4. **Arrange** — per track: pick an instrument, set volume, mute/solo, preview alone or **Play All Together**.
5. **Export** — per-track MIDI (drop individual parts into a DAW) **or** one **multitrack MIDI** (whole arrangement, separate tracks) — or WAV for a quick demo.

Key principle: **Chord Progression = harmony lab; Melody Studio = the arranger.** "Full Mix" stops being its own tab — its functionality lives _inside_ the arranger so users never juggle two places for the same arrangement.

---

## Next: Phase 2.5 — Hybrid Melody Studio (the arranger)

Merge **Full Mix → Melody Studio** so the studio becomes a multi-track arranger. The standalone Full Mix tab is removed.

### Layout (per the workflow above)
```
Melody Studio (arranger)
├── Header: project context (key · genre · BPM) + master transport
│     [ Play All Together ] [ Stop ] [ Download Multitrack MIDI ] [ Download WAV ]
├── Track: CHORDS
│     instrument ▾ | vol ──── | M S | (read-only: comes from Chord Progression tab)
│     large lane: chord blocks (kept full size) + synced playhead
│     [ Preview ] [ Download MIDI ]
├── Track: BASS
│     instrument ▾ | vol ──── | M S | style: Rolling/Driving/Gated | [Regenerate]
│     large piano-roll lane (kept full size) + synced playhead
│     [ Preview ] [ Download MIDI ]
└── Track: LEAD
      instrument ▾ | vol ──── | M S | style: Arpeggio/Euphoric/Pluck | [Regenerate]
      large piano-roll lane (kept full size) + synced playhead
      [ Preview ] [ Download MIDI ]
```

### Functions & where they live
| Function | Location | Notes |
|---|---|---|
| Per-track **instrument selector** | each track row | reuse `SynthSelector` presets; chords/bass/lead each get their own `SynthPresetId` |
| Per-track **volume + mute/solo** | each track row | already in mixer (`setTrackVolume/Mute/Solo`) |
| **Preview** (track alone) | each track row | plays just that track through the unified engine |
| **Play All Together / Stop** | header | the Phase 2 `playArrangement` engine, now instrument-aware per track |
| Per-track **Download MIDI** | each track row | chords reuse `exportProgressionToMidi`; bass/lead reuse `exportMelodyToMidi` |
| **Download Multitrack MIDI** | header | new `exportArrangementToMidi` → one `.mid`, 3 named tracks (Chords/Bass/Lead), shared tempo |
| **Download WAV** | header | Phase 2 offline render, now instrument-aware |
| **Large previews** | track lanes | keep current Melody Studio lane sizes (not the compact Full-Mix strips) |

### Engine changes
- `playArrangement` / `renderArrangementToWav` already take `chordSynthId`; extend to **per-track synth ids** (`{ chord, bass, lead }`).
- `createTrackSynth(id, synthId)` already exists — wire each track's selected instrument through it.
- New `exportArrangementToMidi({ chords, rhythm, bass, lead, bpm, key, scale })` in `midiExport.ts` using `new MidiWriter.Writer([chordTrack, bassTrack, leadTrack])` (factor out the existing chord/melody track builders so all three paths share them).

---

## Phase 3 — New features (built on the arranger)

The arranger is the home for everything that plays in time. Each new musical element becomes **a new track row** that automatically inherits volume/mute/solo, Preview, Play-All, per-track MIDI, and multitrack MIDI.

### 3a — Arpeggiator
- A **mode on the Chords track** (toggle: `Block chords ⇄ Arpeggiated`) plus a small control set: pattern (up/down/up-down/random), rate (1/8, 1/16), octave range, gate.
- Implemented as a deterministic transform `arpeggiate(progression, settings, seed)` → a `GeneratedMelody`-shaped note list, so it reuses the existing lane renderer, synth, MIDI export and Play-All path.
- Lives in `utils/arpeggiator.ts`; UI is a collapsible section under the Chords track. When arp is on, the chords track exports the arpeggiated notes.

### 3b — Drum / beat generator
- A new **DRUMS track** in the arranger: genre-based patterns (kick/clap/snare/hat) on the same 16-step grid.
- `utils/drumGenerator.ts`: per-genre pattern presets + a `generateDrums(genreId, bars, seed)` → per-instrument step arrays. Drum **kit selector** (acoustic/909/808) instead of a synth preset.
- Audio: a `Tone.Players`/sampler (or synthesized membrane/noise) routed as a 4th mixer channel; MIDI export maps to GM drum notes on channel 10; included in multitrack MIDI + Play-All + WAV.
- Lane: a compact step-grid (rows = kick/clap/hat) rather than a piano-roll.

### 3c — Harmony & musicianship
- **More scales/modes** (Dorian, Phrygian, Mixolydian, etc.) — high EDM value, unblocked by the Phase 1 flat-root fix.
- **Chord inversions / voice-leading** controls on the Chords track for smoother movement.

### 3d — Project & UX
- **Save / load / shareable preset links** (serialize the whole project: genre, key, progression, per-track styles/instruments/volumes, arp + drum settings).
- **Undo/redo + drag-to-reorder** chords.
- **Keyboard shortcuts** (space = play), **tap tempo**, **swing/groove**.
- **Mobile/responsive polish**, tooltips/onboarding for the funnel.
- **Performance:** code-split Tone.js + VexFlow (current bundle ≈1.6 MB / ≈828 KB gzip).

### Suggested Phase 3 order
1. **3a Arpeggiator** (small, self-contained, immediately useful; proves the "new element = new behavior on a track" pattern).
2. **3b Drum generator** (biggest "real EDM tool" win; establishes the "new element = new track" pattern + drum MIDI).
3. **3c scales/modes + inversions**, then **3d** project/share + UX polish.

---

## Phase 3 Implementation (Completed)

### 3a — Arpeggiator ✅
- Implemented deterministic arpeggiator with patterns (up, down, up-down, random)
- Rate controls (eighth, sixteenth, quarter)
- Octave range (1-3 octaves)
- Gate control (0.5-1.0)
- Toggles between block chords and arpeggiated output
- Integrated into unified audio engine and MIDI export
- UI: collapsible section under Chords track with seed-based regeneration

### 3b — Drum/Beat Generator ✅
- Genre-specific drum pattern presets (House, Techno, Trance, DnB, Dubstep, Future Bass, Progressive House, Hardstyle)
- 4-instrument grid: kick, snare, clap, hat (16-step)
- Drum kit selector (acoustic, 909, 808)
- Seed-based pattern generation with variation
- Click-to-toggle individual drum notes for custom patterns
- Reset button to return to generated pattern
- Integrated into unified audio engine and multitrack MIDI export
- MIDI export maps to GM drum notes on channel 10

### 3c — Harmony & Musicianship ✅
- Added chord inversion controls (0, 1, 2 inversions per chord)
- Auto voice-leading function for smooth chord movement
- Inversion state persisted in saved arrangements

### 3d — Workflow & UX ✅
- **Undo/Redo system** for chord progression editing with 50-step history
- **Keyboard shortcuts**: Cmd/Ctrl+Z (undo), Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y (redo), Space (play/stop)
- **Project save/load**: Changed from localStorage to JSON file download/upload for better portability
- **Shareable preset links**: URL-encoded state parameters for sharing presets via clipboard
- **Drag-to-reorder chords**: Native drag-and-drop in progression editor with visual feedback
- **Arrangement save/load**: Local file persistence for full arrangements including all track settings

### Recent Bug Fixes
- Fixed drum pattern regeneration stuck on default sequence by adding seed-based variation to fallback patterns
- Fixed share button not providing user feedback - added alert notification with error handling
- Fixed bass and lead synth selection not affecting playback - added useEffect to restart arrangement when synthIds change during playback
- Added genre-specific drum presets for all genres (previously only had House, Techno, Trance)

---

## Resolved (historical) problems
Phase 1 fixed: broken lint (now in CI), missing PWA icons, sharp-only enharmonic spelling + no key signature, latent flat-root bug, unmemoized melodies, no state persistence, README drift.
Phase 2 fixed: Melody Studio couldn't layer/sync with chords — now a unified transport with master volume + reverb and Play-All.
Phase 3 fixed: All Phase 3 features implemented plus drum pattern regeneration, share button feedback, synth selection during playback, and genre-specific drum patterns.

Still open: bundle size / no code-splitting (≈1.6 MB / ≈828 KB gzip).
