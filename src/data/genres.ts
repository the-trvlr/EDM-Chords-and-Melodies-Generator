export interface GenreProgression {
  name: string;
  degrees: number[];
  chordTypes?: string[];
  description: string;
}

export interface RhythmPattern {
  name: string;
  pattern: number[];
  subdivisions: number;
  description: string;
}

export interface Genre {
  id: string;
  name: string;
  description: string;
  bpmRange: [number, number];
  defaultBpm: number;
  preferredScale: string;
  color: string;
  progressions: GenreProgression[];
  rhythmPatterns: RhythmPattern[];
  synthPreset: string;
}

export const GENRES: Genre[] = [
  {
    id: 'house',
    name: 'House',
    description: 'Four-on-the-floor groove with soulful chords',
    bpmRange: [120, 130],
    defaultBpm: 124,
    preferredScale: 'minor',
    color: '#e74c3c',
    progressions: [
      { name: 'Classic House', degrees: [0, 5, 3, 4], description: 'i - VI - IV - V (soulful classic)' },
      { name: 'Deep House', degrees: [0, 3, 5, 4], description: 'i - iv - VI - V (deep & moody)' },
      { name: 'Jazzy House', degrees: [0, 4, 5, 3], chordTypes: ['min7', 'major', 'major', 'major'], description: 'im7 - V - VI - IV (jazz-influenced)' },
      { name: 'Funky House', degrees: [0, 6, 5, 4], description: 'i - VII - VI - V (descending energy)' },
      { name: 'Vocal House', degrees: [5, 3, 0, 4], description: 'VI - IV - i - V (pop-influenced)' },
    ],
    rhythmPatterns: [
      { name: 'Straight', pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], subdivisions: 16, description: 'Quarter notes' },
      { name: 'Off-beat', pattern: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], subdivisions: 16, description: 'Classic house off-beat chords' },
      { name: 'Pumping', pattern: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], subdivisions: 16, description: 'Eighth note pump' },
      { name: 'Stab', pattern: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0], subdivisions: 16, description: 'Syncopated stabs' },
    ],
    synthPreset: 'pad',
  },
  {
    id: 'techno',
    name: 'Techno',
    description: 'Driving, hypnotic, and minimal',
    bpmRange: [125, 140],
    defaultBpm: 130,
    preferredScale: 'minor',
    color: '#2c3e50',
    progressions: [
      { name: 'Hypnotic', degrees: [0, 0, 0, 0], description: 'i - i - i - i (single chord drone)' },
      { name: 'Dark Minimal', degrees: [0, 4, 0, 3], description: 'i - v - i - iv (minimal movement)' },
      { name: 'Industrial', degrees: [0, 1, 0, 6], description: 'i - ii° - i - VII (dark & tense)' },
      { name: 'Melodic Techno', degrees: [0, 5, 3, 4], description: 'i - VI - IV - V (melodic tension)' },
      { name: 'Acid', degrees: [0, 2, 0, 6], description: 'i - III - i - VII (acid movement)' },
    ],
    rhythmPatterns: [
      { name: 'Driving', pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], subdivisions: 16, description: 'Steady quarter notes' },
      { name: 'Minimal', pattern: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], subdivisions: 16, description: 'Half notes' },
      { name: 'Syncopated', pattern: [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0], subdivisions: 16, description: 'Off-grid hits' },
      { name: 'Pulsing', pattern: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], subdivisions: 16, description: '16th note pulse' },
    ],
    synthPreset: 'dark',
  },
  {
    id: 'trance',
    name: 'Trance',
    description: 'Euphoric, uplifting melodies and supersaws',
    bpmRange: [128, 142],
    defaultBpm: 138,
    preferredScale: 'minor',
    color: '#3498db',
    progressions: [
      { name: 'Uplifting', degrees: [0, 5, 6, 4], description: 'i - VI - VII - V (classic uplifting)' },
      { name: 'Emotional', degrees: [0, 2, 5, 6], description: 'i - III - VI - VII (emotional build)' },
      { name: 'Epic', degrees: [5, 6, 0, 4], description: 'VI - VII - i - V (epic anthem)' },
      { name: 'Dark Psy', degrees: [0, 1, 5, 4], description: 'i - ii° - VI - V (dark psychedelic)' },
      { name: 'Progressive Trance', degrees: [0, 3, 5, 2], description: 'i - iv - VI - III (progressive build)' },
    ],
    rhythmPatterns: [
      { name: 'Gated', pattern: [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0], subdivisions: 16, description: 'Gated pad' },
      { name: 'Arpeggio', pattern: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], subdivisions: 16, description: 'Rolling arpeggio feel' },
      { name: 'Sustained', pattern: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], subdivisions: 16, description: 'Long sustained chords' },
      { name: 'Pluck', pattern: [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0], subdivisions: 16, description: 'Plucky rhythm' },
    ],
    synthPreset: 'supersaw',
  },
  {
    id: 'dnb',
    name: 'Drum & Bass',
    description: 'Fast breakbeats with deep bass and atmospheric pads',
    bpmRange: [165, 180],
    defaultBpm: 174,
    preferredScale: 'minor',
    color: '#e67e22',
    progressions: [
      { name: 'Liquid', degrees: [0, 5, 3, 6], description: 'i - VI - IV - VII (smooth liquid)' },
      { name: 'Dark DnB', degrees: [0, 1, 4, 0], description: 'i - ii° - v - i (dark & menacing)' },
      { name: 'Neurofunk', degrees: [0, 6, 5, 4], description: 'i - VII - VI - V (descending)' },
      { name: 'Atmospheric', degrees: [0, 2, 5, 0], description: 'i - III - VI - i (spacious)' },
      { name: 'Jump Up', degrees: [0, 5, 0, 6], description: 'i - VI - i - VII (bouncy energy)' },
    ],
    rhythmPatterns: [
      { name: 'Half-time', pattern: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], subdivisions: 16, description: 'Half-time feel' },
      { name: 'Chopped', pattern: [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0], subdivisions: 16, description: 'Chopped pads' },
      { name: 'Rolling', pattern: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], subdivisions: 16, description: 'Triplet-ish rolling' },
      { name: 'Sustained', pattern: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], subdivisions: 16, description: 'Long sustained pads' },
    ],
    synthPreset: 'pad',
  },
  {
    id: 'dubstep',
    name: 'Dubstep',
    description: 'Heavy bass drops with half-time grooves',
    bpmRange: [138, 152],
    defaultBpm: 140,
    preferredScale: 'minor',
    color: '#8e44ad',
    progressions: [
      { name: 'Heavy Drop', degrees: [0, 5, 3, 6], description: 'i - VI - IV - VII (drop progression)' },
      { name: 'Melodic Dub', degrees: [0, 2, 5, 6], description: 'i - III - VI - VII (melodic)' },
      { name: 'Dark Dub', degrees: [0, 4, 3, 0], description: 'i - v - iv - i (dark half-time)' },
      { name: 'Riddim', degrees: [0, 0, 5, 6], description: 'i - i - VI - VII (minimal riddim)' },
      { name: 'Tearout', degrees: [0, 1, 0, 6], description: 'i - ii° - i - VII (aggressive)' },
    ],
    rhythmPatterns: [
      { name: 'Half-time', pattern: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], subdivisions: 16, description: 'Half-time sustained' },
      { name: 'Wobble', pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], subdivisions: 16, description: 'Quarter note wobble' },
      { name: 'Choppy', pattern: [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0], subdivisions: 16, description: 'Choppy stabs' },
      { name: 'Triplet', pattern: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0], subdivisions: 16, description: 'Triplet feel' },
    ],
    synthPreset: 'dark',
  },
  {
    id: 'futureBass',
    name: 'Future Bass',
    description: 'Lush supersaws with emotional chord progressions',
    bpmRange: [130, 160],
    defaultBpm: 150,
    preferredScale: 'major',
    color: '#1abc9c',
    progressions: [
      { name: 'Kawaii', degrees: [0, 4, 5, 3], description: 'I - V - vi - IV (pop-influenced)' },
      { name: 'Emotional', degrees: [5, 3, 0, 4], description: 'vi - IV - I - V (emotional)' },
      { name: 'Dreamy', degrees: [0, 2, 5, 4], chordTypes: ['maj7', 'minor', 'minor', 'major'], description: 'Imaj7 - iii - vi - V (dreamy)' },
      { name: 'Anthem', degrees: [0, 5, 3, 4], description: 'I - vi - IV - V (anthem build)' },
      { name: 'Chill', degrees: [0, 3, 4, 5], chordTypes: ['maj9', 'major', 'major', 'minor'], description: 'Imaj9 - IV - V - vi (chill vibes)' },
    ],
    rhythmPatterns: [
      { name: 'Sidechain', pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], subdivisions: 16, description: 'Sidechained chords' },
      { name: 'Staccato', pattern: [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1], subdivisions: 16, description: 'Short staccato hits' },
      { name: 'Swung', pattern: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], subdivisions: 16, description: 'Swung rhythm' },
      { name: 'Sustained', pattern: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], subdivisions: 16, description: 'Full sustained chords' },
    ],
    synthPreset: 'supersaw',
  },
  {
    id: 'progressiveHouse',
    name: 'Progressive House',
    description: 'Building energy with layered melodic elements',
    bpmRange: [122, 132],
    defaultBpm: 128,
    preferredScale: 'minor',
    color: '#27ae60',
    progressions: [
      { name: 'Classic Prog', degrees: [0, 5, 3, 4], description: 'i - VI - IV - V (classic progressive)' },
      { name: 'Anjuna Style', degrees: [0, 2, 5, 6], description: 'i - III - VI - VII (Anjunabeats feel)' },
      { name: 'Driving', degrees: [0, 3, 5, 0], description: 'i - iv - VI - i (driving energy)' },
      { name: 'Ethereal', degrees: [0, 6, 5, 3], description: 'i - VII - VI - IV (descending ethereal)' },
      { name: 'Peak Time', degrees: [5, 6, 0, 0], description: 'VI - VII - i - i (peak-time energy)' },
    ],
    rhythmPatterns: [
      { name: 'Building', pattern: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], subdivisions: 16, description: 'Building half notes' },
      { name: 'Pluck', pattern: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0], subdivisions: 16, description: 'Plucky pattern' },
      { name: 'Off-beat', pattern: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], subdivisions: 16, description: 'Off-beat stabs' },
      { name: 'Arp', pattern: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], subdivisions: 16, description: 'Arpeggio 8th notes' },
    ],
    synthPreset: 'pluck',
  },
  {
    id: 'hardstyle',
    name: 'Hardstyle',
    description: 'Hard-hitting kicks with euphoric melodies',
    bpmRange: [150, 160],
    defaultBpm: 150,
    preferredScale: 'minor',
    color: '#c0392b',
    progressions: [
      { name: 'Euphoric', degrees: [0, 5, 6, 4], description: 'i - VI - VII - V (euphoric lead)' },
      { name: 'Raw', degrees: [0, 0, 5, 6], description: 'i - i - VI - VII (raw energy)' },
      { name: 'Anthem', degrees: [5, 6, 0, 2], description: 'VI - VII - i - III (anthem)' },
      { name: 'Classic', degrees: [0, 3, 5, 6], description: 'i - iv - VI - VII (classic hardstyle)' },
      { name: 'Reverse Bass', degrees: [0, 4, 5, 0], description: 'i - v - VI - i (reverse bass feel)' },
    ],
    rhythmPatterns: [
      { name: 'Kick Pattern', pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], subdivisions: 16, description: 'Quarter note kicks' },
      { name: 'Lead Melody', pattern: [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0], subdivisions: 16, description: 'Melodic lead rhythm' },
      { name: 'Sustained', pattern: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], subdivisions: 16, description: 'Sustained for buildups' },
      { name: 'Screechy', pattern: [1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0], subdivisions: 16, description: 'Screech rhythm' },
    ],
    synthPreset: 'supersaw',
  },
];
