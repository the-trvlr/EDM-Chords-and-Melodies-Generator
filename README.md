# EDM Chord Progression Generator

A fully offline Progressive Web App (PWA) for generating, previewing, and exporting chord progressions tailored to different EDM genres.

**Live App:** [https://the-trvlr.github.io/EDM-Chords-and-Melodies-Generator/](https://the-trvlr.github.io/EDM-Chords-and-Melodies-Generator/)

---

## Features

### Genre-Specific Progressions
- **8 EDM genres:** House, Techno, Trance, Drum & Bass, Dubstep, Future Bass, Progressive House, Hardstyle
- 5 curated chord progression templates per genre with music-theory-accurate chord relationships
- Genre-appropriate default BPM, scale, synth preset, and rhythm patterns

### Key & Scale Selection
- All 12 keys, spelled conventionally per key (flats for flat keys, e.g. Eb/Ab/Bb)
- 4 scale types: Major, Minor, Harmonic Minor, Melodic Minor
- Chords transpose automatically when changing key or scale
- Your selections (key, scale, genre, BPM, etc.) are remembered across reloads

### Rhythm Patterns
- **Whole Note** — one chord sustained per full bar (available in every genre)
- Genre-specific patterns: Straight, Off-beat, Pumping, Gated, Syncopated, Rolling, Wobble, and more
- Visual 16-step sequencer display showing the active rhythm pattern

### Synth Presets
- **7 presets:** Piano, Warm Pad, Organ, Supersaw, Pluck, Dark Lead, Bell
- Powered by Tone.js (Web Audio API) — no audio files needed

### Playback Controls
- **Play/Stop** with real-time chord highlighting across all visualizations
- **Loop** toggle (enabled by default) — progression repeats continuously
- **Double Time** toggle — each chord occupies 2 bars instead of 1, rhythm pattern repeats per chord
- Adjustable **BPM** (slider + number input) and **Volume** controls

### Visualization
- **Piano keyboard** — click any chord to see its notes highlighted on a visual keyboard
- **Staff notation** — real-time rendering via VexFlow with proper accidentals and active chord highlighting

### Chord Editing
- Add/remove chords from the key's available chord palette
- Reset to the original genre template at any time
- Preview individual chords by clicking them

### MIDI Export
- Download progressions as standard `.mid` files for use in any DAW
- Exports respect the selected rhythm pattern, BPM, and Double Time setting
- Filename includes key, scale, and BPM for easy organization

### Melody Studio (Arranger)
- **Multi-track arranger** with Chords, Bass, and Lead tracks
- **Per-track instrument selection** — each track can use a different synth preset
- **Per-track mixer controls** — volume, mute, and solo for each track
- **Seeded melody generation** — bass and lead melodies synced to your chord progression
- **Genre-specific melody styles** — different patterns for bass (Rolling, Driving, Gated) and lead (Arpeggio, Euphoric, Pluck)
- **Synced playback** — "Play All Together" plays all tracks with a unified transport
- **Multitrack MIDI export** — download all three tracks as a single MIDI file with separate tracks
- **WAV export** — render the full arrangement to audio for quick demos

### Offline PWA
- Installable on desktop and mobile (Chrome, Edge, Safari, Firefox)
- Works fully offline after first load — no server required
- Service worker caches all assets for instant subsequent loads

---

## Using the App Offline

### Option 1: Visit the Hosted Version (Recommended)
1. Open [https://the-trvlr.github.io/EDM-Chords-and-Melodies-Generator/](https://the-trvlr.github.io/EDM-Chords-and-Melodies-Generator/) in Chrome, Edge, or Safari
2. The app loads and caches itself automatically via the service worker
3. **Install as PWA** (optional but recommended for offline use):
   - **Chrome/Edge (Desktop):** Click the install icon in the address bar, or go to Menu (⋮) → "Install EDM Chord Generator"
   - **Chrome (Android):** Tap Menu (⋮) → "Add to Home screen" or "Install app"
   - **Safari (iOS):** Tap the Share button → "Add to Home Screen"
4. Once installed, the app works completely offline — open it anytime without an internet connection

### Option 2: Self-Host from Source
1. Clone the repository:
   ```bash
   git clone https://github.com/the-trvlr/EDM-Chords-and-Melodies-Generator.git
   cd EDM-Chords-and-Melodies-Generator
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. **Development mode** (with hot reload):
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

4. **Production build** (optimized, with PWA service worker):
   ```bash
   npm run build
   ```
5. **Preview the production build locally:**
   ```bash
   npm run preview
   ```
   Open [http://localhost:4173](http://localhost:4173) in your browser. The PWA service worker is active in this mode, so the app will work offline after the first load.

6. **Deploy anywhere:** The `dist/` folder contains a fully static site. Upload it to any static hosting service (GitHub Pages, Netlify, Vercel, S3, Nginx, Apache, etc.) — no server-side runtime needed.

### Option 3: Run Locally Without a Server
After building (`npm run build`), you can serve the `dist/` folder with any static file server:
```bash
# Using Python
python3 -m http.server 8000 -d dist

# Using npx serve
npx serve dist

# Using Node's http-server
npx http-server dist
```
Note: The PWA service worker requires HTTPS or `localhost` to register. For fully offline PWA functionality, use `npm run preview` or deploy to an HTTPS-enabled host.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 19 + TypeScript |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS 4 |
| Audio Engine | Tone.js 15 (Web Audio API) |
| Staff Notation | VexFlow 5 |
| MIDI Export | midi-writer-js 3 |
| PWA | vite-plugin-pwa + Workbox |

---

## Project Structure

```
src/
├── App.tsx                          # Main app component & state management
├── main.tsx                         # Entry point
├── index.css                        # Global styles (Tailwind)
├── types.ts                         # Shared TypeScript types
├── data/
│   └── genres.ts                    # Genre definitions, progressions, rhythm patterns
├── components/
│   ├── KeySelector.tsx              # Key & scale selection
│   ├── GenreSelector.tsx            # Genre picker
│   ├── ProgressionSelector.tsx      # Progression template picker
│   ├── RhythmSelector.tsx           # Rhythm pattern selector with step display
│   ├── SynthSelector.tsx            # Synth preset picker
│   ├── TransportControls.tsx        # Play/Stop, Loop, Double Time, BPM, Volume, MIDI export
│   ├── ChordDisplay.tsx             # Chord cards with active highlighting
│   ├── ChordPalette.tsx             # Add/remove chords from progression
│   ├── PianoKeyboard.tsx            # SVG piano keyboard visualization
│   ├── StaffNotation.tsx            # VexFlow staff notation rendering
│   └── MelodyStudio.tsx             # Multi-track arranger with chords, bass, lead
└── utils/
    ├── audioEngine.ts               # Tone.js synth creation, playback, looping
    ├── musicTheory.ts               # Scales, chords, intervals, transposition
    ├── midiExport.ts                # MIDI file generation & download (chord + multitrack)
    ├── melodyGenerator.ts           # Seeded bass/lead melody generation
    ├── mixer.ts                     # Unified audio engine for multi-track playback
    └── persistence.ts               # State persistence across reloads
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

---

## Browser Compatibility

The app uses the Web Audio API and modern JavaScript features. Supported browsers:
- Chrome / Edge 80+
- Firefox 76+
- Safari 14.1+
- Chrome for Android
- Safari on iOS 14.5+

---

## License

MIT
