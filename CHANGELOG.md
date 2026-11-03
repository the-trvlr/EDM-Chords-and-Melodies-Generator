# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [SemVer](https://semver.org/).

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
