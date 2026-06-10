import { TIMBER, CRYSTAL, LANTERN, BLOSSOM } from './blocks';

// The castle friends.
//
// NOTE on names: these are fine for your family's own private build, but
// they belong to someone else's books. If you ever share or publish the
// game, rename them here — this file is the only place they exist.

export interface CharacterDef {
  name: string;
  /** robe color (legs are auto-darkened) */
  robe: number;
  hair: number;
  nameColor: string;
  /** home spot in the castle realm: [x, z] */
  spot: [number, number];
  /** things they say, cycled each chat */
  lines: string[];
  /** a little fetch-wish: bring them blocks to become best friends */
  wish: { block: number; count: number; ask: string; thanks: string };
}

export const CHARACTERS: CharacterDef[] = [
  {
    name: 'Harry',
    robe: 0x8c3a3a,
    hair: 0x2e2a33,
    nameColor: '#a33c3c',
    spot: [29.5, 21.5],
    lines: [
      "Welcome to the castle! We've been waiting for a builder like you.",
      'I once flew my broom around all four towers without stopping!',
      'The view from the tower tops is brilliant — take the spiral stairs!',
    ],
    wish: {
      block: LANTERN,
      count: 3,
      ask: 'Could you bring me 3 Star Lanterns ⭐? The corridors get so dark at night.',
      thanks: 'Brilliant! The halls will glow all night now. Thank you!',
    },
  },
  {
    name: 'Hermione',
    robe: 0x7a5cc4,
    hair: 0x6b4a2f,
    nameColor: '#6f54b8',
    spot: [24.5, 40.5],
    lines: [
      'Have you seen the library? I arranged every single book myself.',
      'Castle bricks are far too hard for bare hands. Wands only!',
      'If you read one story every night, you can read them all in a year.',
    ],
    wish: {
      block: BLOSSOM,
      count: 4,
      ask: 'Would you bring 4 Blossom blocks 🌸 to decorate the library?',
      thanks: "They're perfect! The library smells like spring now.",
    },
  },
  {
    name: 'Ron',
    robe: 0x3a6e8c,
    hair: 0xd96f32,
    nameColor: '#c4642a',
    spot: [34.5, 21.5],
    lines: [
      'I am STARVING. Do castles always make you this hungry?',
      'Watch out on the tower stairs — I trip on them every single time.',
      "Nice cape… er, you don't have a cape. You still look great!",
    ],
    wish: {
      block: TIMBER,
      count: 5,
      ask: "Could you grab 5 Timber 🪵? I'm building a snack table.",
      thanks: "Excellent! Snack table time. You're the best!",
    },
  },
  {
    name: 'Luna',
    robe: 0x4a9e8f,
    hair: 0xf0e0a8,
    nameColor: '#3d8a7c',
    spot: [36.5, 35.5],
    lines: [
      'The clouds here drift backwards sometimes. Nobody believes me.',
      'Dream Crystals hum if you listen very, very closely. Mmm-hmm.',
      "I like your face. It's a friendly sort of face.",
    ],
    wish: {
      block: CRYSTAL,
      count: 2,
      ask: 'May I have 2 Dream Crystals 💎? They whisper the loveliest things.',
      thanks: "Oh, lovely whispers! We're proper friends now.",
    },
  },
];
