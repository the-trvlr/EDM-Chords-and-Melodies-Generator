# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [SemVer](https://semver.org/).

## [1.5.1] — 2026-11-11

### Loop region

- Transport now has **Region: off / 2 / 4 / 8 bars**. The selected region loops the first N bars regardless of whether the full-song Loop button is on.
- The playhead and bar counter wrap inside the region; the arrangement, metronome and count-in start at bar 1 as before.
- WAV/MIDI exports still render the full song; the region is a playback-only practice tool.
- The region choice persists in the session (localStorage).

### Verification

- 90 unit tests, lint/tsc/build clean.
- Muted browser: Region 2 → `2/2` after 2.5 s and wraps to `1/2` at 5.5 s; mobile 390 without overflow; no console errors.

## [1.5.0] — 2026-11-11

### Practice & MIDI

- **Tap tempo** in the transport: tap up to four times and the BPM follows the average interval (3 s reset window).
- **Computer keyboard as piano:** A W S E D F T G Y H U J K play semitones from C4; modifier shortcuts (save/undo) still work.
- **Web MIDI input:** the MIDI button requests MIDI access and plays incoming note-on messages with the lead instrument. Devices connected later are picked up via `statechange`; clicking again disconnects.
- Footer hint for the keyboard mapping; no new screens or tabs.

### Verification

- 90 unit tests, lint/tsc/build clean.
- Muted browser: Tap changed 124 → 96 BPM with 600 ms taps; A key triggered a note without errors; MIDI permission denial produced a clear toast; mobile 390 without overflow.

### Still open for 1.5.x

- Loop region (2/4/8 bars) and quantize/duplicate-bar tools; these remain on the practice backlog.

## [1.4.0] — 2026-11-11

### Drum sequencer 2.0

- **Seven drum lanes:** Kick, Snare, Clap, Hi-Hat, Low Hat, Crash, Ride (previously only four). Hi-hat is split into high and low; crash and ride have their own tracks, synths and MIDI channels.
- **Classic DnB and Dubstep patterns:**
  - DnB two-step kick on 1 and 3.5, snare on 2 and 4, 16th hats, ride and crash;
  - Neurofunk adds the extra kick and pickup;
  - Dubstep half-time snare on 3, kick 1/3.5, sparse 8th hats, crash/ride accents.
- **Meaningful Regenerate:** four variation profiles (ghost pocket, hat fill, open-hat/ride accents, busy hats) plus seed-driven ghost snares, low-hat accents, kick pickups, crash/ride hits and clap changes. Kick/backbeat backbone is preserved.
- **`2×` no longer machine-guns the kick.** For drums, `2×` doubles hats/ride only; kick, snare, clap and crash keep the genre backbone. `½` similarly leaves the core intact.
- MIDI exports separate GM tracks: Hi-Hat 42, Low Hat 44, Crash 49, Ride 51, in addition to kick/snare/clap.
- Old 4-lane saved patterns are migrated automatically; missing lanes start empty.

### Verification

- 90 unit tests, including new lanes, seed variation, drum `2×` backbone and MIDI fixtures.
- Muted browser: seven lanes render, Regenerate changes the pattern, `2×` arms correctly, Play/Stop clean, mobile 390 without overflow.

## [1.3.2] — 2026-11-10

### Sample-based offline rendering

- **WAV mix and stems now use the same sample instruments as live playback** (when the selected variant maps them to samples). `renderArrangementToWav` creates the samplers inside the offline Tone context and awaits their buffers before scheduling.
- Acoustic/EDM selection and per-track release times are respected in renders, so exported audio matches the preview.
- If a sample cannot be loaded, rendering gracefully falls back to the synth for that track.
- Sample files come from the local bundle and are served by the service-worker cache, so offline export works after the first load.

### Verification

- 87 unit tests, lint/tsc/build clean.
- Muted browser: “Export → WAV mix” produced `edm-mix-A-minor-124bpm.wav` with no console errors; sample-based render path executed.

## [1.3.1] — 2026-11-10

### Sound pack refinements

- **EDM piano is no longer clipped short.** Sample instruments now have per-instrument release times; piano gets a 2.2 s natural release, so off-beat chord patterns ring instead of stopping abruptly.
- **Six track-specific instrument slots** instead of one shared list:
  - Chords: Piano, Organ, Warm Pad, Strings, Nylon Pluck, Bells.
  - Bass: Sub, Reese, Acid, 808, Electric Bass, Upright Bass.
  - Lead: Supersaw, Dark Lead, Nylon Pluck, Violin, Flute, Bells.
- Added local samples for **violin, flute, contrabass and electric bass** (CC-BY, VSCO 2 / Karoryfer); sample pack is now ~9.5 MB.
- Release times are calibrated per sample set: piano 2.2 s, organ 0.6 s, guitar 1.0 s, harmonium/cello/violin 1.2 s, flute 0.7 s, bass 0.5–0.6 s.
- Track instrument selectors expose only the six sounds for that track.

### Verification

- 87 unit tests (catalog shape, sample mapping, local assets).
- Muted browser: six options per track, 9 samples loaded for defaults, EDM ↔ Acoustic, no console errors, mobile 390 without overflow.

## [1.3.0] — 2026-11-10

### Sound — hybrid sample pack + Acoustic/EDM

- **Local CC-BY sample pack** (6.2 MB) for piano, organ, nylon guitar/pluck, electric bass, harmonium pad, cello lead and xylophone bell. No CDN at runtime; works offline after first load via Workbox CacheFirst.
- **Sound selector: EDM / Acoustic** in the Project Bar.
  - EDM: piano, organ and pluck use samples; pad, supersaw, dark and bell keep their electronic synths.
  - Acoustic: every preset uses its sampled counterpart (harmonium pad, cello lead/dark, xylophone bell).
- **Startup preload** for the current chord/bass/lead instruments with a “Loading instruments…” state; changing an instrument loads its samples in the background.
- Synth remains the **fallback** if samples fail or are not cached yet.
- **808 Glide** always uses the mono synth, even in Acoustic mode, so portamento is preserved.
- Samples are preview/live playback only for now: offline WAV/stems still render with synths. Sample-based offline rendering is the next audio task.
- Attribution: `docs/SAMPLES.md` (CC-BY 3.0, VSCO 2, Karoryfer, Freesound via tonejs-instruments).

### Verification

- 86 unit tests (sample mapping, local asset presence, generator/harmony/glide/inversion).
- Muted browser: 12 sample files loaded for the default three tracks, no network failures; Sound switches EDM ↔ Acoustic; playback has no console errors; mobile remains within viewport.

## [1.2.0] — 2026-11-10

### Generator 2.0 (1.1) — motif, contour, call-response, glide

- **Motif variations** for bass and lead: `Off / Repeat / Transpose / Invert`. The first bar's rhythm becomes a motif; later bars keep that rhythm and re-pitch it to the current chord. Repeat reharmonises to chord tones, Transpose follows the root movement, Invert mirrors the motif around its first note.
- **Contour** `Low / Mid / High` biases the line inside the selected 1–3 octave range without touching the rhythm.
- **Call & response**: bass answers on even bars and lead on odd bars.
- **808 Glide** for bass: a monophonic portamento synth plus legato bass durations; the same legato durations go into WAV, stems and MIDI.
- All generator settings persist in the project and share links.

### Harmony 2.0 (1.2) — suggestions, borrowed chords, key detection

- **Suggest next** in the Progression Strip: three ranked candidates using root motion, voice-leading cost, common tones, scale fit and tonic/dominant pull. Each can be auditioned or added.
- The pool includes **borrowed chords** (bVI, bVII, iv in major) and **secondary dominants** (V/ii, V/iii, V/IV, V/V, V/vi), in addition to diatonic chords.
- **Detect** key and scale from the current progression; the result is applied to the project and shown with confidence.
- **Pin** a chord in the Inspector to keep its voicing when Voice lead is applied.
- Suggestion/detection logic lives in `src/utils/harmony.ts` (pure, deterministic, tested).

### Verification

- 83 unit tests (12 harmony + generator matrix + inversion/glide tests), lint/tsc/build clean.
- Muted browser: contour/variation/glide/call-response controls render; 3 suggestions; adding one grows the progression; Detect reports A minor at 79%; bass plays even bars and lead odd bars; Pin toggles; mobile page has no horizontal overflow.

## [1.0.2] — 2026-11-10

### Fixed

- **Chord inversion buttons now switch between the actual inversions instead of stacking them.** `invertChord` was applied to the current voicing, so pressing 1st and 2nd repeatedly kept raising the chord. It now rebuilds the root-position voicing from the chord root and intervals, then applies the requested inversion.
- **Root restores the original chord** (notes, MIDI, display), not just the `inversion` flag.
- Repeated clicks on the same inversion are idempotent; moving 2nd → 1st works without accumulating octaves.
- The fix applies to the Inspector, voice leading and share links.

### Tests

- 67 unit tests: root → 1st → 2nd → root, repeated clicks, switching between ready-made inversions, and seventh chords.
- Muted browser: Am → Am/C → Am/E → Am, with MIDI `[69,72,76]` restored after Root.

## [1.0.1] — 2026-11-10

### Fixed

- **Generated bass and lead now follow chord changes without changing their rhythm.** Rhythm and pitch used one RNG stream, so replacing chords — especially triad → 7th chords — could change note positions and durations. They now use independent `rhythm` and `pitch` streams.
- The lead arpeggio always fills the bar with eight eighth notes, independent of chord size; chord quality changes only the pitch cycle.
- Progression changes (key, complexity, template, reorder) now update MIDI pitches while keeping the exact `step`/`duration` grid for both bass and lead.

### Tests

- 63 unit tests, including a cross-genre/style/seed matrix: rhythm is identical for substitutions, 7th chords and transposition; strong beats are chord tones of the new progression; pitches change.
- Muted browser: A → C key, triads → 7ths and Classic → Deep House template all kept the rhythm and changed the pitches for both tracks.

## [1.0.0] — 2026-11-04

### Studio 1.0 — one workspace instead of tabs

- **Harmony and Arrangement tabs are gone.** One Studio screen now holds the progression, song sections and all four tracks. Playback can continue while you edit any of them.
- **Project Bar** above the progression: compact `Key`, `Scale`, `Genre` and `Chords` (complexity) dropdowns. BPM, loop, click and count-in stay in the transport.
- **Progression Strip** replaces the old Harmony panel: chord cards are always visible, `+ Add chord` opens the palette, `Template` picks the genre progression, `Preview` auditions the progression. Selected chord moves into the inspector.
- **Inspector panel** on the right (above the tracks on mobile, collapsible): chord detail, piano keyboard, inversions, reorder/remove, voice leading and an **optional staff notation toggle**. Notation is off by default; VexFlow loads only when you turn it on.
- **Rhythm is global** and lives on the Chords track; the duplicate global synth selector was removed (each track owns its instrument).
- **Per-track time feel**: `½ / 1× / 2×` buttons on Chords, Bass, Lead and Drums. Half time stretches the track, double time quantises it to the 8th grid and repeats it across the second half of the arrangement. The shared schedule applies it to playback, WAV, stems and MIDI.
- **Genre change is a full project reset**: progression, custom chords, rhythm, BPM, complexity, synth, sections, melody edits, drum kit and time feels return to genre defaults. The old project is kept for **Undo**; a toast with Undo appears, and the header Undo restores it.
- **Undo/Redo moved to the header** (also `Cmd/Ctrl+Z` / `Shift+Cmd/Ctrl+Z`). Chord edits and melody edits are tracked; a genre reset is undoable.
- Mobile: project bar wraps, progression scrolls horizontally, the inspector collapses to a one-line panel, tracks stay below. No horizontal page overflow.
- Removed the tab-dependent `activeTab` state and the old Harmony components from the bundle.

### Tests

- 60 unit tests: schedule now covers per-track half/double time, chord-tone snapping, density and range; persistence/share cover the new time feels.
- Muted browser checks: no tabs, project bar/progression/inspector render, add chord + Undo works, genre reset clears the project and Undo restores it, A-minor chord shows in the inspector, notation loads only when toggled, mobile has no overflow.

### Notes

- The app remains English-only by design; RU/EN was removed from the roadmap.
- The Safari-only playhead delay reported earlier is still deferred.
## [0.13.0] — 2026-11-04

### Added

- **Melody generator 2.0 controls** for bass and lead:
  - **Density**: Sparse / Medium / Busy filters the generated line to quarter, eighth or full sixteenth resolution while keeping at least one note per bar.
  - **Three ideas**: quick 1 / 2 / 3 alternatives for the same seed and style, without losing the current range/density.
  - **Chord-tone snapping**: every note on a strong beat is forced to a chord tone; leap limiting then picks the chord tone closest to the previous note, so the line stays smooth.
- Density and idea are stored in the project (`bd/ld/bi/li` in share links) and remembered across reloads.
- The generator still respects the 1–3 octave range width and the 7/9-semitone leap limits.

### Tests

- 59 unit tests: strong beats are chord tones across all genres/styles/seeds, density is monotonic and never empties a bar, ideas are deterministic and distinct.
- Muted browser: medium 20 notes → sparse 16 → busy 20; Idea 2 changes the line; mobile page has no horizontal overflow.
## [0.12.0] — 2026-11-04

### Added

- **Metronome (“Click”) in the transport.** A toggle schedules quarter-note clicks with an accent on the first beat of the bar. It works for both the Harmony and Arrangement engines, can be switched on or off during playback, and follows the tempo.
- **Count-in**: Off / 1 bar / 2 bars. The clicks are scheduled on the audio clock and the transport starts exactly when the count-in ends, so the first note lands on the “one”. The playhead stays at bar 1 during the count-in, then follows the transport.
- Both settings are remembered in the session (localStorage). They are transport preferences, so they are intentionally not part of project files or share links.
- No new UI translation: the app remains English-only, by design.

### Implementation

- `utils/metronome.ts`: accented membrane click, count-in scheduling, start/stop for the live transport.
- `playArrangement` and `playProgression` accept `metronome` and `countInBars`; stopping either engine stops the clicks.
- Transport bar shows the Click toggle and the count-in selector; both are 44 px on mobile.

### Tests

- 56 unit tests remain green; the count-in timing was verified in a muted browser: with a 1-bar count-in the playhead is still at 1/4 after 1 s and at 2/4 after 4 s (124 BPM), i.e. music starts after the count-in.
## [0.11.0] — 2026-11-04

### Changed

- **The project is now called ∞ Melodies** (previously “EDM Studio”). The header, landing screen, footer, page title and PWA manifest use the infinity symbol; the npm package is `infinite-melodies`.

### Fixed

- **Arpeggiator notes now fill the whole bar.** The generator used to place at most one pattern pass (3–5 notes) at the start of the bar and leave the rest empty. It now cycles the chord pattern: 1/8 rate = 8 notes (steps 0,2,…,14), 1/16 rate = 16 notes. Gate is applied as a fraction of the step, so there is a real gap before the next note instead of a legato overlap.
- **Playhead no longer lags behind the audio.** It was driven by `Tone.Draw` callbacks scheduled from the loop. A requestAnimationFrame loop now reads the audio transport clock (`getTransportStep`) and updates the position only when the 16th-step changes, wrapping at the song length. The playhead starts together with the first sound and does not drift at 130 BPM.

### Tests

- 56 unit tests, including arpeggiator coverage: both rates fill a bar, the pattern cycles, octaves are spread, random is deterministic.
- Browser checks stay muted (`--mute-audio`).
## [0.10.1] — 2026-11-04

### Added

- The current app version is shown as a small chip next to the “EDM Studio” title, filled from `package.json` at build time.

## [0.10.0] — 2026-11-04

### Added

- **Velocity editing in the piano roll.** Bass and lead lanes now have a compact velocity strip under the notes: drag a bar (or focus it and use ↑/↓) to set that note's velocity from 5% to 100%. Notes are drawn with an opacity that follows their velocity.
- Generated melodies get a musical accent pattern by default (0.9 on beats, 0.72 elsewhere).
- Velocity is part of the project, share links (`bn`/`ln` notes now carry a fourth value), MIDI export (scaled to 1–100) and offline WAV rendering.

### Tests

- 51 unit tests; velocity survives share/sanitise and reaches the shared schedule events.
- Verified in a muted browser: dragging the first bass note changed its velocity from 90% to 33% and persisted `0.33`.
## [0.9.0] — 2026-11-04

### Changed

- **The range selector now controls the width of the allowed range, not its base register.** It previously picked a one-octave window (C2–B2, C3–B3, …), which duplicated the ± octave stepper. It now offers **1 / 2 / 3 octaves**:
  - Bass base is C2: 1 octave = C2–B2, 2 = C2–B3, 3 = C2–B4.
  - Lead base is C5: 1 octave = C5–B5, 2 = C5–B6, 3 = C5–B7.
  - The octave stepper continues to transpose the finished track, independently of the width.
- Span changes re-fit manually edited notes into the new width; generated lines use the same seed and span.
- Spans are stored as `rangeSpans` in projects (share payload field `rs`). Old share links without it fall back to one octave.
- Leap limits stay: bass ≤7 semitones, lead ≤9, regardless of width.

### Tests

- 50 unit tests; all genres/styles/seeds are checked for 1, 2 and 3 octave spans, including a test that the wider span actually uses the extra octave.
- Verified in a muted browser: span 1 → bass 36–47 / lead 72–83; span 2 → bass 36–52 / lead 74–93.
## [0.8.1] — 2026-11-04

### Fixed

- **Piano-roll notes can be deleted with a single click again.** Clicking empty space still draws a note; clicking an existing note without moving now removes it, while dragging moves it and dragging the right edge resizes it. Double-click deletion was removed so a click can no longer delete and re-create a note.
- The note labels/tooltips explain the gesture (“Click a note to delete · drag to move · drag the right edge to resize”).

### Added

- **Rename saved arrangements** from the project library dialog (in addition to Copy/Delete).

### Tests

- 51 unit tests (arrangement rename included); the piano-roll gesture was verified in a muted headless browser: add 20→21, click note 21→20, drag keeps 20.
## [0.8.0] — 2026-11-04

### Fixed

- **Bass and lead melodies no longer jump across the keyboard.** The generators could produce a bass leap of 23 semitones and a lead spanning 33 semitones (C1–A3) because the full C0–B7 scale was used for random walks and `chordTonesAt()` derived its octave from the lowest note of inverted chords.
  - Generated lines are now folded into a **one-octave base range**.
  - Adjacent notes are limited to 7 semitones for bass and 9 for lead (scale-aware, includes the octave-folding step).
  - Chord tones are derived from the chord root and its intervals, so inversions no longer shift a whole phrase by an octave.

### Added

- **Melody range selector** for Bass and Lead in the arranger: `C1–B1 … C4–B4` for bass (default `C2–B2`) and `C3–B3 … C7–B7` for lead (default `C5–B5`). The range is part of the project and share links.
- Changing the range transposes manually edited notes by whole octaves; `Reset edits` returns to the generated line in the selected range.
- Regression tests over all genres, styles and seeds: bass stays in C2–B2 with ≤7-semitone steps, lead in C5–B5 with ≤9-semitone steps (50 unit tests).

### Known limitations

- Velocity editing, metronome/count-in and RU/EN localisation are still on the 0.7/0.8 backlog.
## [0.7.0] — 2026-11-04

### Fixed

- **Track Preview did not behave like an audition.** It rendered the whole song (up to 54 s with a 28-bar structure), could be silent when the track was muted or another track was soloed, and its end callback could be lost, leaving the button stuck on “Playing…”. Preview now plays one pass through the chord progression, ignores the song structure, temporarily solos the chosen track (restoring the mixer afterwards), stops deterministically, and you can switch between track previews without waiting.
- **Chord MIDI had an empty bar between chords.** `midi-writer-js` measures `wait` after the previous note-off, so a one-bar chord plus a one-bar wait produced a two-bar grid. All notes are now written on absolute ticks: whole-note chords land on ticks 0, 512, 1024… with no gap, and the exported sequence is the same tempo as the rest of the project.
- **Drums exported outside the DAW drum zone.** GM notes used C1/D1/E1/G#5 (MIDI 24/26/28/92) instead of kick 36, snare 38, clap 39 and hat 42. Drum MIDI now uses C2/D2/D#2/F#2 on channel 10.
- **Arrangement MIDI now writes one track per drum instrument** (Kick, Snare, Clap, Hat) instead of one merged track, so each part can be routed to its own sampler or replaced with samples.

### Added

- **Section markers in arrangement MIDI**: a dedicated Sections track with `INTRO 1 (4 bars)`-style markers.
- **Duplicate saved arrangement** (“Copy”) in the project library dialog.
- Tests for chord tick spacing, drum track separation/channel 10 and arrangement duplication (44 unit tests).

### Known limitations

- Velocity editing, metronome/count-in and RU/EN localisation are the remaining 0.7 items.
## [0.6.1] — 2026-11-03

### Fixed

- **Live octave transposition did not reach the engine.** The arranger's `startEngine` never forwarded `octaves` (and, for the same reason, `sections`, `swing` and `humanize`), so the steppers changed the UI and the rendered WAV but not the live playback. All four options are now passed, and a test asserts that live note names move by an octave.
- **Dense patterns and supersaw.** The chord envelope is now shaped to the shortest hit gap at the current tempo: attack, decay and release shrink together for 16th-note patterns, so a Pulsing pattern no longer stacks overlapping supersaw voices. Polyphony budget for the supersaw is 16 (two chord generations of headroom) and its level is balanced against the other presets; the master limiter stays at −1 dBFS.
- Removed a development-only debug hook.

### Tests

- 41 unit tests, including the tempo/density envelope cap and the voice budget.

## [0.6.0] — 2026-11-03

Sprint 3 «Глубина» and Sprint 4 «Экспорт и библиотека», plus the audio and drum fixes requested after 0.4.

### Audio quality

- **Master limiter** (−1 dBFS) on the chord engine and on the arrangement bus (live and offline render), so dense supersaw chords and fast rhythm patterns no longer clip.
- **Supersaw rework:** 3 detuned voices instead of 5, lower level, shorter release, and a hard polyphony cap (8 voices). Every preset now has an explicit voice budget (`audioProfiles.ts`).
- **Per-rhythm ADSR:** stabs/syncopation get a 0.14 s release, pumping/rolling 0.26 s, gated 0.18 s, whole-note/sustained a 2.2 s tail. Tails no longer run into the next hit on fast patterns.
- Chord previews use the same envelope profile as the current rhythm pattern.
- Live tempo changes now also update note lengths (previously the step duration was captured once).

### Arrangement

- **Per-track octave transposition** for chords, bass and lead (−2 … +2) with dedicated steppers; applied to playback, WAV, stems, MIDI and share links. Drums are intentionally excluded (their octave is defined by the kit).
- **Song sections:** create Intro/Build/Drop/Break/Outro blocks with 2–16 bars each, choose which tracks play in each section, reorder, duplicate and delete. Sections gate tracks, define song length and loop as one song. Without sections the progression still loops as before.
- **Piano-roll editing** for bass and lead: click empty space to draw a note, drag to move, drag the right edge to resize, double-click/right-click to delete. "Reset edits" returns to the generated melody.
- **Swing** (0–60%) and **humanize** with a deterministic timing offset, reflected in playback, WAV, stems and MIDI.
- **Stems export:** chords, bass, lead and drums rendered separately and packed into a `.zip`.
- Arrangement MIDI export now uses the same event schedule as playback, so sections, octave shifts, swing and humanize are included; drums use GM channel 10.

### Drums

- Changing the genre now selects a fitting default drum kit (909 for house/techno/trance, 808 for dubstep/future bass, breakbeat for DnB).
- Every genre now has a genuinely different pattern: techno driving 16th hats, minimal off-beat kick, trance backbeat, DnB two-step kick, dubstep half-time snare on beat 3, future-bass syncopation, progressive house extra kick, hardstyle snare/clap backbeat.
- Tests assert that all eight genres have distinct full signatures and that the signature elements (four-on-the-floor, two-step, half-time) stay intact across seeds.

### Project & UX

- Manual chord edits are now part of the autosaved session and are restored on reload.
- Share links carry sections, octave shifts, edited notes and groove; oversized projects are rejected with a clear message instead of producing a broken URL.
- Project validation clamps octaves, section lengths, swing and note values instead of rejecting the whole file.
- Tests: 40 unit tests (schedule sections/gating/octaves/swing, drum signatures, audio profiles, share codec).

### Known limitations

- Section markers are not written into the MIDI file yet (the notes reflect the structure).
- The project library is still browser-stored arrangements; rename/duplicate of saved projects is planned for 0.7.
- Drum step cells and drag-to-reorder remain as documented in 0.4.
- Stems rendering is offline and can take a while for long songs; the button shows progress.

## [0.4.0] — 2026-11-03

Sprint 1 «Mobile-ready» and Sprint 2 «Консолидация» from [`docs/PLAN-UIUX-2026.md`](docs/PLAN-UIUX-2026.md).

### Fixed — P0

- **Staff notation and the piano keyboard stay inside their cards** on narrow screens (`min-w-0`, local horizontal scroll), so the page never grows after VexFlow mounts.
- **Mobile Arrangement works again.** Track headers wrap, lanes span the full width (`min-w-0`, no more `w-32` strips and `pl-[140px]`), toolbars wrap, and the page no longer scrolls horizontally on 320–414 px. A melody lane is now 340 px wide at a 390 px viewport instead of 2 px.
- **Export matches what you hear (WYSIWYG).** Live playback, WAV rendering and MIDI export now consume one shared event schedule (`src/utils/schedule.ts`). WAV includes the arpeggiator, the selected drum kit and the same reverb as playback; the master volume is applied.
- **Drums use a single 16-step bar model.** `generateDrums()` returns one bar that repeats every bar; playback, the editor and MIDI export all use the same grid. Previously patterns were generated for `bars × 16` steps but only the first 16 were ever played.
- **Drum kit selection affects previews** and WAV rendering, not only the live arrangement.
- **`Space` is handled by one global shortcut.** It now controls whichever engine is playing, keeps playing across tab switches, and ignores text fields. `Cmd/Ctrl+Z` also works while a button has focus.
- **Undo can revert the first edit.** The chord history is seeded with the current progression instead of starting empty.
- **Arrangement loading restores the whole project** — key, scale, genre, tempo, rhythm, custom chords and mixer — instead of only the melody seeds.
- **Share links keep everything**: custom chords, inversions, per-track mixer, drum edits, arp settings, styles and seeds. Links also decode the legacy format.

### Added

- **Unified transport bar** in the sticky header: play/stop, bar counter, BPM (slider + number), loop and master volume. Available on both screens; switching tabs no longer stops playback.
- **Compact Arrangement**: per-track synth `<select>` instead of 21 preset buttons, a single header row per track, bar ruler and bar grid lines on every lane, and piano-roll style notes. Four tracks fit a 1440×900 viewport.
- **Save / Export menus**: project `.json` (harmony + arranger), arrangement snapshots in browser storage, chord MIDI, arrangement MIDI, per-track MIDI (bass/lead/drums), WAV mix.
- **Toasts** with `role="status" aria-live="polite"` replace blocking `alert()` calls.
- **Accessible modals** (`role="dialog"`, `aria-modal`, Escape, focus trap, focus restore).
- **Validation for files and links** (`src/utils/sanitize.ts`): out-of-range BPM/volume, unknown genres/scales/synths, broken drum patterns and malformed JSON fall back to safe defaults instead of breaking the studio.
- **Error boundary** with a reload action, and a skeleton while VexFlow loads.
- **Tests:** Vitest unit suite (27 tests) for the schedule builder, drums, share codec, project files and music theory; `npm test` runs in CI before the build.
- **PWA polish:** app id/scope/orientation/categories/shortcuts, `apple-touch-icon`, `viewport-fit=cover`, `100dvh`, safe areas, `prefers-reduced-motion`, visible focus rings.
- **`LICENSE`** (MIT) — the README already claimed it.

### Changed

- **Initial JS is now ~168 KB gzip** (was ~843 KB) before the notation is needed. VexFlow is lazy-loaded only when the staff notation scrolls into view, and now uses the single-font `vexflow/bravura` build (**387 KB gzip**, down from 688 KB). The `melody-studio` chunk remains preloaded so playback survives tab switches.
- Renamed the UI: the app is now **EDM Studio**, the two sections are **Harmony** and **Arrangement**.
- Confusing labels fixed: “Half time” → the mode is now described by the actual behaviour, chord complexity uses plain names, “Preview” is announced as a solo preview.
- Changing key transposes custom progressions instead of silently discarding them; changing genre/complexity keeps chord edits.
- Chord removal has a dedicated, always-visible `✕` button; inversions are 44 px touch targets with `aria-pressed`.
- Touch targets are 44 px on mobile for all primary controls (transport, menus, track headers, style chips, export buttons). Dense 16-step drum cells are the documented exception.
- Per-track volume sliders and master volume have accessible names.

### Removed

- The old `TransportControls` component (replaced by `TransportBar`) and the unused project-library/persistence helpers.
- Duplicated share codec from `persistence.ts` (moved to `share.ts`).

### Known limitations

- VexFlow still loads on desktop as soon as the staff scrolls into view; it is only deferred on small screens.
- Drum step cells stay smaller than 44 px so that 16 steps fit a phone screen; the grid scrolls horizontally when needed.
- On narrow screens the staff notation scrolls inside its own card (the page itself never scrolls horizontally).
- Drag-to-reorder of chords uses the native HTML5 drag API, so it is desktop-only for now; touch users edit by adding/removing chords.
- No browser E2E suite yet (Playwright is planned in the next sprint); CI runs unit tests, lint, type-check and build.
- Sections timeline, piano-roll editing, stems export and i18n are the next milestones (v0.5 / v0.6).
