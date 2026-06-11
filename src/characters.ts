import { TIMBER, CRYSTAL, LANTERN, BLOSSOM, CARROT, PUMPKIN } from './blocks';

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
  /** pointy wizard hat color (traders wear them) */
  hat?: number;
  /** home spot in the castle realm: [x, z] */
  spot: [number, number];
  /** things they say, cycled each chat */
  lines: string[];
  /** a little fetch-wish: bring them blocks to become best friends */
  wish?: { block: number; count: number; ask: string; thanks: string };
  /** a repeatable shop trade: blocks in, a drink out */
  trade?: { takesBlock: number; takesCount: number; gives: 'juice' | 'brew'; givesName: string; thanks: string };
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

/** Greets you in the spawn village on the island (spot is set at runtime). */
export const WELCOMER: CharacterDef = {
  name: 'Wanda',
  robe: 0xb05a8a,
  hair: 0xd9d9d9,
  hat: 0xe0a85f,
  nameColor: '#a04a7a',
  spot: [0, 0],
  lines: [
    'Welcome home! This little village is all yours.',
    'See the treasure chests? Break them open — surprises inside! 🎁',
    'Mine Dream Crystals 💎 and Timber 🪵 to craft your wand!',
    'The stone ring east of here leads somewhere magical…',
    'Lucky explorers find wands and brooms sleeping inside chests!',
  ],
};

/** The spawn-village folk. Spots are relative to spawn, set at runtime. */
export const VILLAGERS: CharacterDef[] = [
  WELCOMER,
  {
    name: 'Sprout',
    robe: 0x6e8c3a,
    hair: 0x8a5a2a,
    hat: 0x4a6e2a,
    nameColor: '#5a7a2a',
    spot: [0, 0],
    lines: [
      'Fresh juice for hungry builders! 3 Carrots 🥕 for one juice!',
      'My carrots are the crunchiest on the island. Probably.',
      'The farm is right over there — pick all you like, it regrows… eventually.',
    ],
    trade: {
      takesBlock: CARROT,
      takesCount: 3,
      gives: 'juice',
      givesName: 'Pumpkin Juice',
      thanks: 'Three crunchy carrots! One juice for you! 🧃',
    },
  },
  {
    name: 'Bram',
    robe: 0x8c6e3a,
    hair: 0x2e2a33,
    hat: 0x6b4a2f,
    nameColor: '#7a5a2a',
    spot: [0, 0],
    lines: [
      'I built every roof in this village. Slate never leaks!',
      'Try the Cozy blocks for walls. Very snuggly.',
      'Night Stone sparkles like the night sky. Spooky-pretty.',
      'A village needs a builder like you. Add a house anywhere!',
    ],
  },
];

/** The village shopkeepers — wizards in pointy hats who trade food. */
export const TRADERS: CharacterDef[] = [
  {
    name: 'Granny Thistle',
    robe: 0x9e6a3a,
    hair: 0xd9d9d9,
    hat: 0x6e5aa8,
    nameColor: '#8a5a2a',
    spot: [24.5, 11.5],
    lines: [
      'Fresh Pumpkin Juice! Bring me 2 Pumpkins 🎃 and a cup is yours.',
      'My cottage roof is real slate, you know. Only the best in the village.',
      'Carrots grow on the island across the portal. Lovely fields out there.',
    ],
    trade: {
      takesBlock: PUMPKIN,
      takesCount: 2,
      gives: 'juice',
      givesName: 'Pumpkin Juice',
      thanks: 'Two plump pumpkins! Here — one Pumpkin Juice, fresh-squeezed! 🧃',
    },
  },
  {
    name: 'Mr. Fizzlepop',
    robe: 0x3a6e4e,
    hair: 0x6b4a2f,
    hat: 0x2f5e42,
    nameColor: '#2f6e4e',
    spot: [40.5, 11.5],
    lines: [
      'Butterbrew! Frothy, warm, and butterscotchy. 4 Carrots 🥕 a mug!',
      'Why carrots? My recipe, my secret. *winks*',
      'A mug of Butterbrew fixes every heart. Doctor Fizzlepop’s orders!',
    ],
    trade: {
      takesBlock: CARROT,
      takesCount: 4,
      gives: 'brew',
      givesName: 'Butterbrew',
      thanks: 'Four crunchy carrots! One frothy Butterbrew, coming up! 🥤',
    },
  },
];
