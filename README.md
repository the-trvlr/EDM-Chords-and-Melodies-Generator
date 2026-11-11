# ∞ Melodies

**Chords, bass, lead and drums for EDM sketches — in one Studio, offline, in your browser.**

∞ Melodies turns a genre, a key and a chord progression into a playable arrangement. Generate genre-specific parts, edit them on a piano roll, practise with tap tempo and MIDI, then export MIDI, WAV, stems or a ready-to-import DAW pack.

- **Live app:** <https://the-trvlr.github.io/EDM-Chords-and-Melodies-Generator/>
- **Version:** 1.8.1
- **Changelog:** [`CHANGELOG.md`](CHANGELOG.md)
- **Design notes:** [`docs/PLAN-1.0.md`](docs/PLAN-1.0.md)
- **Sample credits:** [`docs/SAMPLES.md`](docs/SAMPLES.md)

![∞ Melodies Studio](docs/release-1.0/desktop.png)

---

## Quick start

1. **Open the app** and press **Start making music**. The first start loads the current instrument samples; after that the app works offline.
2. In the **Project Bar** choose **Key**, **Scale**, **Genre**, **Chords** (complexity) and **Sound** (EDM or Acoustic).
3. Use **Progression → Template** for a genre progression, click **+ Add chord** to extend it, or open **Suggest** for three ranked next-chord ideas.
4. Press **Play**. The arrangement loops the song (or the selected **Region**: 2/4/8 bars).
5. Shape the tracks: pick instruments, edit the piano roll, generate variations, adjust the drums.
6. Export with **Export → DAW pack**, **WAV mix**, **Stems**, **MIDI**, or save a project file.

No account, no cloud, no upload. Everything is computed and stored locally.

---

## The Studio

The app has one workspace — no Harmony/Arrangement tabs.

```
┌─ Header ───────────────────────────────────────────────────────────────┐
│ ∞ Melodies  v1.6        Undo  Redo  Save ▾  Export ▾  Share           │
│ Play  bar  BPM  Tap  MIDI  Loop  Region  Click  Count-in  Vol         │
├─ Project Bar ──────────────────────────────────────────────────────────┤
│ Key  Scale  Genre  Chords  Sound                                      │
├─ Progression Strip ────────────────────────────────────────────────────┤
│ [Am] [F] [Dm] [Em]   Preview  Suggest  Detect  Template  + Add chord  │
├─ Main ────────────────────────────────────────┬─ Inspector ────────────┤
│ Song sections                                  │ Chord, notes, piano    │
│ Groove                                         │ Inversions / Pin       │
│ Chords / Bass / Lead / Drums                   │ Notation (optional)    │
└────────────────────────────────────────────────┴────────────────────────┘
```

### Project Bar

| Control | What it does |
|---|---|
| **Name** | Project name; used for saved JSON and the DAW pack. |
| **Key** | The tonic of the project. Changing it transposes a custom progression. |
| **Scale** | Major, minor and the modes; conventional flat/sharp spelling. |
| **Genre** | Loads genre defaults and templates, and changes the BPM suggestion. Changing genre performs a **full project reset with Undo**. |
| **Chords** | Complexity: triads, 7ths, 9ths or jazzy voicings. |
| **Sound** | `EDM` or `Acoustic` sample/synth character. |

### Progression Strip

- Chord cards are always visible; click one to select it and open the Inspector.
- **+ Add chord** opens the chord palette for the current key and complexity.
- **Template** switches between the genre's five curated progressions.
- **Suggest** proposes three next chords (diatonic, borrowed or secondary dominant) with a reason; each can be auditioned or added.
- **Detect** analyses the current progression and applies the most likely key/scale.
- **Preview** auditions the progression through the chord track.
- A custom progression can be reset to the genre template.

### Inspector

Select a chord card to see:

- chord name, type, notes and intervals;
- an interactive piano keyboard;
- **inversions** — Root / 1st / 2nd, always rebuilt from the root position;
- move left/right, remove, auto **Voice lead**;
- **Pin** — keeps this chord's voicing when Voice lead is applied;
- **Notation** — optional staff notation. VexFlow is lazy-loaded only when you enable it and is off by default.

---

## Harmony

- **8 genres:** House, Techno, Trance, Drum & Bass, Dubstep, Future Bass, Progressive House, Hardstyle.
- **5 progression templates per genre**, with genre defaults for BPM, scale, rhythm and synth.
- **12 keys, 9 scales/modes**, flat/sharp spelling.
- **4 complexity levels.**
- **Suggest next:** ranked by root motion, voice-leading cost, common tones, scale fit and tonic/dominant pull.
- **Borrowed chords:** bVI, bVII and minor iv.
- **Secondary dominants:** V/ii, V/iii, V/IV, V/V, V/vi.
- **Key detection** from the progression.
- **Pin** a chord to protect its voicing.

Chord edits transpose with the key. Changing genre resets the musical project (progression, melody, drums, sections, time feels) and leaves an Undo in the toast and header.

---

## Tracks

### Instruments

Each track has **six logical instruments**, not one shared list.

| Track | Instruments |
|---|---|
| **Chords** | Piano, Organ, Warm Pad, Strings, Nylon Pluck, Bells |
| **Bass** | Sub, Reese, Acid, 808, Electric Bass, Upright Bass |
| **Lead** | Supersaw, Dark Lead, Nylon Pluck, Violin, Flute, Bells |
| **Drums** | 5 kits: Acoustic, TR-909, TR-808, Trap, Breakbeat |

### Sound character

| Mode | Behaviour |
|---|---|
| **EDM** | Piano, organ, pluck, strings, violin, flute and electric bass use samples; pad, supersaw, dark, bells, sub, reese, acid and 808 stay synthesised. |
| **Acoustic** | Acoustic presets use their sampled counterparts (harmonium pad, cello lead/dark, xylophone bell). Pure electronic basses remain synths. |

Samples are bundled locally (about 9.5 MB) and cached by the service worker after the first load. WAV mixes and stems use the same sample instruments as the preview; if a sample cannot load, that track falls back to its synth.

### Chords track

- **Arp ON/OFF** with up/down/up-down/random, 1/8 or 1/16, 1–3 octaves and gate.
- Global **Rhythm** pattern for the chord engine.
- Chord octave shift.
- Instrument, volume, mute, solo, preview.

### Bass and lead generators

- Genre-specific styles (3 per track per genre).
- **Density:** sparse / medium / busy.
- **Three ideas** for the same seed and style; select one and press Preview.
- **Contour:** low / mid / high.
- **Variation:** off / repeat / transpose / invert — a first-bar motif is re-pitched to each chord while its rhythm stays.
- Chord-tone snapping on strong beats, with leap limits (bass ≤7, lead ≤9 semitones).
- Range width: 1, 2 or 3 octaves (bass from C2, lead from C5); octave stepper shifts the finished line.
- **Call & response:** bass on even bars, lead on odd bars.
- **808 Glide** for bass: monophonic portamento with legato note lengths.
- **Regenerate** creates a new idea; **Reset edits** restores the generated line.

### Piano roll

| Gesture | Result |
|---|---|
| Click empty space | Add a note |
| Click a note | Delete it |
| Drag a note | Move pitch/time |
| Drag right edge | Change duration |
| Right-click | Delete |
| Velocity lane | Drag a bar, or focus and use ↑/↓, to set 5–100 % |
| **Q 1/8** | Quantize the line to the eighth grid |
| **Repeat bar** | Repeat the first bar across the progression |

The velocity strip is under each bass/lead lane. Velocity flows into playback, WAV, stems, MIDI and share links.

### Drums

Seven editable lanes: **Kick, Snare, Clap, Hi-Hat, Low Hat, Crash, Ride**.

- 5 kits.
- Genre-accurate patterns, including DnB two-step and Dubstep half-time.
- **Regenerate** uses four variation profiles plus seed accents (ghost snares, hat fills, low-hat, kick pickups, crash/ride, clap) while keeping the kick/backbeat backbone.
- Click steps to edit; **Reset edits** restores the generated pattern.
- Drums MIDI exports separate GM tracks: kick 36, snare 38, clap 39, hi-hat 42, low hat 44, crash 49, ride 51.

### Song sections

Build Intro / Build / Drop / Break / Outro blocks with bar lengths and per-section track gating. Sections drive arrangement playback, MIDI markers and song length.

### Groove and time feel

- **Swing** 0–60 % and **Humanize**.
- Per-track **½ / 1× / 2×**:
  - chords/bass/lead double or halve their pattern;
  - drums double hats/ride only — kick, snare, clap and crash keep the genre backbone.

---

## Practice

- **Tap tempo:** press Tap up to four times; the BPM follows the average interval.
- **Computer keyboard:** `A W S E D F T G Y H U J K` play semitones from C4.
- **Web MIDI:** press **MIDI**, allow access, and play the lead instrument from a controller. Devices connected later are picked up automatically; press again to disconnect.
- **Loop region:** `Region: off / 2 / 4 / 8 bars` loops the first N bars. The playhead and bar counter wrap inside the region; exports remain full-song.

---

## Transport and shortcuts

| Control / key | Action |
|---|---|
| **Play / Stop** or **Space** | Start/stop the arrangement |
| **BPM** | Slider, number input, Tap |
| **Loop** | Loop the whole song |
| **Region** | Loop first 2/4/8 bars |
| **Click** | Metronome with bar accents |
| **Count-in** | Off / 1 bar / 2 bars |
| **Vol** | Master volume |
| **Cmd/Ctrl+Z** | Undo (chords, melodies, genre reset) |
| **Shift+Cmd/Ctrl+Z** or **Ctrl+Y** | Redo |
| **Cmd/Ctrl+S** | Save project JSON |
| **Cmd/Ctrl+O** | Open project JSON |

A metronome click is accented on the first beat of each bar. Count-in clicks are scheduled on the audio clock, so the first note lands exactly on “one”.

---

## Export

| Export | Contents |
|---|---|
| **Chord progression MIDI** | Chords only, absolute ticks, no empty bar between chords |
| **Arrangement MIDI** | Chords, bass, lead, separate drum tracks, section markers |
| **WAV mix** | Offline render of the full song, sample instruments included |
| **Stems (.zip)** | Chords, bass, lead and drums as separate WAVs |
| **DAW pack (.zip)** | `midi/arrangement.mid`, `stems/*.wav`, `project.json`, `README.txt` |
| **Project JSON** | Full project, reopen with Save → Open project |

The DAW pack is the recommended hand-off: import the MIDI at bar 1, 4/4, route drums to a GM kit, and use the stems as a reference or for further processing.

**Share** copies a link that restores the project, including custom chords, mixer, melody edits, time feels, sound character and drum pattern. Very large projects may exceed the link limit; use project JSON instead.

---

## Library and persistence

- The current session autosaves to `localStorage`.
- **Save → Save arrangement** stores a named snapshot in the browser; **Open arrangement** restores it.
- Saved arrangements can be renamed, duplicated and deleted.
- **Save project…** downloads a `.json` named after the project; **Open project…** restores it and its name on any device.
- Share links are stateless and do not create an account.

---

## Offline PWA

- Installable on desktop, Android and iOS.
- Core app and notation are precached; instrument samples are cached on first use.
- No network calls for generation, playback or export.
- If you are offline before a particular sample was cached, that track uses its synth fallback.

### Install

- **Chrome/Edge:** install icon in the address bar, or browser menu → Install.
- **iOS Safari:** Share → Add to Home Screen.
- **Android Chrome:** menu → Add to Home screen.

---

## Sound engine

- **Samples:** piano, organ, nylon guitar, electric bass, upright bass, harmonium, cello, violin, flute and xylophone. CC-BY 3.0; see [`docs/SAMPLES.md`](docs/SAMPLES.md).
- **Synths:** pad, supersaw, dark, bells, sub, reese, acid, 808 and synth fallbacks.
- **Effects:** master limiter, shared reverb, per-track level/mute/solo; acoustic mode uses a slightly longer reverb.
- **Velocity layers:** each sample instrument has soft and hard samplers; quiet notes use a low-passed soft layer, so velocity changes timbre, not just level.
- **WAV/stems** use the same sample/synth selection as live playback.
- **808 Glide** uses a monophonic portamento synth and legato bass durations.

Attribution is required if you redistribute the sample files; the code and app are separate from the CC-BY sample license.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| No sound | Press **Start making music** (browsers require a gesture); check master volume and mute/solo. |
| Samples not used | Wait for “Loading instruments…” on first run, or reload once; then they are cached. |
| MIDI button disabled | Web MIDI is not available in this browser (Safari support is limited). |
| MIDI access blocked | Allow MIDI in site settings and press MIDI again. |
| Exported WAV sounds different | Confirm the same Sound character and instrument; if a sample failed to load, the synth fallback is used. |
| Safari playhead lag | Known Safari-only issue, deferred; Chrome/Edge are the reference browsers. |
| Share link too long | Use **Save → Save project…** and open the JSON. |
| Old project missing drum lanes | Old 4-lane drum patterns are migrated automatically with empty hi-hat/low-hat/crash/ride lanes. |

---

## Browser support

- **Chrome / Edge:** full support, including Web MIDI.
- **Safari:** playback and export work; Web MIDI is limited/absent and a playhead timing issue is known.
- **Firefox:** core app works; Web MIDI support varies.

---

## Development

```bash
npm install
npm run dev       # local dev server
npm test          # Vitest unit tests
npm run test:e2e  # Playwright smoke + axe (system Chrome)
npm run lint      # ESLint
npx tsc -b        # typecheck
npm run build     # production build
```

Stack: React 19, TypeScript, Vite 8, Tone.js 15, VexFlow 5 (lazy), midi-writer-js, fflate, Tailwind 4, vite-plugin-pwa.

The shared scheduler (`src/utils/schedule.ts`) drives live playback, offline WAV, stems and MIDI, so edits, swing, sections, time feels and octave shifts stay consistent everywhere.

---

## Privacy

All generation, editing and export happen locally. The app has no accounts, analytics or server-side processing. The only network requests are for the app assets and instrument samples.

---

## Credits

- Instrument samples: [nbrosowsky/tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments), CC-BY 3.0; sources include VSCO 2 Community Edition, Karoryfer and Freesound. Full attribution: [`docs/SAMPLES.md`](docs/SAMPLES.md).
- Built with React, Tone.js, VexFlow, midi-writer-js, fflate and Tailwind CSS.

---

## Roadmap

- **1.8.x:** Safari timing, colour-contrast token pass, round-robin samples.
- **2.0:** song-level arrangement automation, fills/transitions and section-level generator settings.

See [`docs/PLAN-1.0.md`](docs/PLAN-1.0.md) for the full backlog.
