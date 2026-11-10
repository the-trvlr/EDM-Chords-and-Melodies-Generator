# ∞ Melodies — chord, bass, lead & drum generator

A fully offline Progressive Web App (PWA) for turning an EDM idea into a playable sketch: pick a genre and a key, audition genre-specific progressions, arrange bass/lead/drums, then export MIDI or WAV to your DAW.

**Live app:** <https://the-trvlr.github.io/EDM-Chords-and-Melodies-Generator/>
**Roadmap:** [`docs/PLAN-1.0.md`](docs/PLAN-1.0.md) · **Plans:** [`docs/PLAN-UIUX-2026.md`](docs/PLAN-UIUX-2026.md) · **Changelog:** [`CHANGELOG.md`](CHANGELOG.md)

![∞ Melodies 1.0 Studio](docs/release-1.0/desktop.png)

---

## What's new in 1.3

- **Hybrid instrument samples:** local CC-BY piano, organ, nylon guitar, electric bass, upright bass, harmonium, cello, violin, flute and xylophone; lazy-loaded, cached offline and used in WAV/stems renders.
- **Six track-specific instruments** for Chords, Bass and Lead; piano has a natural 2.2 s release so EDM chords ring instead of clipping.
- **Acoustic / EDM sound selector** in the Project Bar.
- **Generator 2.0:** motif variations, contour, call & response, 808 glide.
- **Harmony 2.0:** suggest next, key detection, pin a chord.
- **One Studio, no tabs**: progression, sections and tracks share a single screen. Project Bar, Progression Strip and an Inspector panel replace the old Harmony/Arrangement split.
- **Optional staff notation**: off by default in the inspector; VexFlow loads only when you enable it.
- **Per-track time feel**: `½ / 1× / 2×` on every track, applied to playback, WAV, stems and MIDI.
- **Full genre reset with Undo**; Undo/Redo moved to the header.
- **Metronome and count-in**, **velocity editing**, **generator density/ideas**, **range width selector**, song sections, arpeggiator, stems, WAV/MIDI export.
- **60 unit tests** wired into CI.

See [`CHANGELOG.md`](CHANGELOG.md) for the complete list.

## Features

### Harmony

- **8 genres:** House, Techno, Trance, Drum & Bass, Dubstep, Future Bass, Progressive House, Hardstyle.
- 5 curated progression templates per genre, with genre defaults for BPM, scale, rhythm and synth.
- **All 12 keys and 9 scales/modes** (major, minor, Dorian, Phrygian, Lydian, Mixolydian, Locrian, harmonic/melodic minor), spelled conventionally (flats for flat keys).
- **4 chord complexity levels:** simple triads, 7ths, 9ths, jazzy voicings.
- **Harmony 2.0:** next-chord suggestions (diatonic, borrowed, secondary dominants), key detection and pinned voicings.
- **Chord editing:** add via the progression strip, reorder/remove in the inspector, inversions and auto voice-leading, undo/redo in the header.
- **Visual feedback:** active chord highlighting, piano keyboard, optional VexFlow staff notation in the inspector.
- Chord edits **transpose with the key**. Changing genre performs a full project reset, undoable from the toast or the header.

### Arrangement

- **Four tracks:** Chords (block or arpeggiated), Bass, Lead, Drums.
- **Song sections** with per-section track gating and song-length playback; saved arrangements can be renamed, duplicated and deleted.
- **Piano-roll editing** for bass/lead (draw, move, resize, delete) and per-track octave shift.
- **Swing and humanize** applied consistently to playback and all exports.
- Per-track instrument, volume, mute, solo and time feel (`½ / 1× / 2×`); solo preview per track.
- **Arpeggiator:** up/down/up-down/random, 1/8 or 1/16, 1–3 octaves, gate.
- **Bass and lead generators** with genre-specific styles, seeded and regenerable; density, three ideas, contour, motif variations, call & response, 808 glide, chord-tone snapping and a selectable 1/2/3-octave range.
- **Drum machine:** genre-accurate one-bar patterns (two-step DnB, half-time dubstep, trap hats, four-on-the-floor house), 5 kits, click-to-edit steps.
- Piano-roll lanes with bar ruler, grid and synced playhead.

### Sound & samples

- **Acoustic / EDM** character; acoustic instruments are sampled and cached offline, electronic presets stay synthesised in EDM mode.
- **Sample-based WAV/stems** match the preview; synth fallback if a sample is unavailable.
- Sample pack attribution: [`docs/SAMPLES.md`](docs/SAMPLES.md).

### Transport & export

- Sticky transport: play/stop, bar counter, BPM (slider + input), loop, master volume, metronome and count-in.
- `Cmd/Ctrl+Space`/`Space` play-stop, `Cmd/Ctrl+Z`/`Shift+Z` undo-redo, `Cmd/Ctrl+S` save, `Cmd/Ctrl+O` open.
- **MIDI:** chord progression, full arrangement, per-track files, and separate drum tracks (Kick/Snare/Clap/Hat) on GM notes; section markers included.
- **WAV mix** and **stems** (4-track zip) rendered offline with the same instruments, kit and effects as playback.
- **Project files** (`.json`) with harmony + arrangement; browser-stored arrangement snapshots.
- **Share links** that restore the whole project, including custom chords and mixer.

### Offline PWA

- Installable on desktop, Android and iOS.
- Works fully offline after the first load; service worker precaches the app.
- No accounts, no network calls, no audio files.

## Screenshots

| Desktop | Mobile |
|---|---|
| ![Desktop Studio](docs/release-1.0/desktop.png) | ![Mobile Studio](docs/release-1.0/mobile.png) |

## Using the app offline

### Option 1 — hosted version (recommended)

1. Open <https://the-trvlr.github.io/EDM-Chords-and-Melodies-Generator/>.
2. Install it as a PWA: Chrome/Edge — install icon in the address bar; Android — “Add to Home screen”; iOS Safari — Share → “Add to Home Screen”.
3. The app then opens offline at any time.

### Option 2 — run from source

```bash
git clone https://github.com/the-trvlr/EDM-Chords-and-Melodies-Generator.git
cd EDM-Chords-and-Melodies-Generator
npm install
npm run dev        # http://localhost:5173
npm run build      # production build with service worker
npm run preview    # http://localhost:4173
```

The `dist/` folder is a fully static site and can be hosted anywhere.

## Tech stack

| Layer | Technology |
|---|---|
| UI | React 19 + TypeScript |
| Build | Vite 8 |
| Styling | Tailwind CSS 4 |
| Audio | Tone.js 15 (Web Audio API) |
| Notation | VexFlow 5 (lazy-loaded) |
| MIDI | midi-writer-js 3 |
| PWA | vite-plugin-pwa + Workbox |
| Tests | Vitest |

## Project structure

```
src/
├── App.tsx                    # studio shell: state, transport, project/share, shortcuts
├── types.ts                   # project, melody and mixer types
├── hooks/
│   └── useToast.ts            # toast context + hook
├── components/
│   ├── TransportBar.tsx       # unified transport
│   ├── MelodyStudio.tsx       # arranger (sections, tracks, mixer, export, dialogs)
│   ├── SectionsTimeline.tsx   # song structure editor
│   ├── lanes.tsx              # chord lane, editable piano roll, drum grid
│   ├── Menu.tsx, Modal.tsx, Toast.tsx, Skeleton.tsx, ErrorBoundary.tsx
│   ├── ChordDisplay.tsx, ChordPalette.tsx, PianoKeyboard.tsx, StaffNotation.tsx
│   ├── KeySelector.tsx, GenreSelector.tsx, ProgressionSelector.tsx,
│   │   RhythmSelector.tsx, SynthSelector.tsx
├── data/
│   ├── genres.ts              # genres, progressions, rhythms
│   └── drumKits.ts
└── utils/
    ├── schedule.ts            # single event schedule for live/WAV/MIDI (sections, octaves, swing)
    ├── audioProfiles.ts       # envelopes, voice budgets, per-rhythm ADSR
    ├── audioEngine.ts         # chord playback
    ├── mixer.ts               # multi-track playback + offline WAV render
    ├── musicTheory.ts         # scales, chords, inversions, voice leading
    ├── melodyGenerator.ts     # seeded bass/lead generation
    ├── arpeggiator.ts         # deterministic arpeggios
    ├── drumGenerator.ts       # genre drum patterns
    ├── midiExport.ts          # MIDI writers
    ├── share.ts               # share-link codec + validation
    ├── sanitize.ts            # validation for files, links and storage
    ├── persistence.ts         # localStorage, project files, arrangements
    └── __tests__/             # Vitest unit tests
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest, 87) |
| `npm run test:watch` | Unit tests in watch mode |

## Testing

- Unit tests cover the event schedule (chord holds, arp replacement, drum repetition), drum generation, the share codec (including legacy links), project files and music-theory helpers.
- CI runs lint → type-check → tests → build → deploy to GitHub Pages.

## Browser support

Chrome/Edge 80+, Firefox 76+, Safari 14.1+, Chrome for Android, Safari iOS 14.5+. Web Audio requires one user gesture, hence the “Start making music” screen.

## Roadmap

The next milestones are described in [`docs/PLAN-UIUX-2026.md`](docs/PLAN-UIUX-2026.md): section timeline (intro/build/drop), piano-roll editing with swing/humanize, stems export, project library + share 2.0, i18n.

## License

MIT — see [`LICENSE`](LICENSE).
