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
  /** home spot: [x, z] (runtime-set for island folk) */
  spot: [number, number];
  /** where they sleep at night: [x, z] (runtime-set) */
  indoor?: [number, number];
  /** things they say, cycled each chat */
  lines: string[];
  /** a little fetch-wish: bring them blocks to become best friends */
  wish?: { block: number; count: number; ask: string; thanks: string };
  /** a repeatable shop trade: blocks in, a drink out */
  trade?: { takesBlock: number; takesCount: number; gives: 'juice' | 'brew'; givesName: string; thanks: string };
}

export interface FamilyDef {
  surname: string;
  members: CharacterDef[];
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

const c = (
  name: string, robe: number, hair: number, nameColor: string, lines: string[],
  extra: Partial<CharacterDef> = {},
): CharacterDef => ({ name, robe, hair, nameColor, spot: [0, 0], lines, hat: extra.hat, wish: extra.wish, trade: extra.trade });

/**
 * The eight wizarding families of the spawn village — one per cottage,
 * in the same order as terrain's villagePlots(). Spots set at runtime.
 */
export const FAMILIES: FamilyDef[] = [
  {
    surname: 'Willowbrook',
    members: [
      c('Wanda Willowbrook', 0xb05a8a, 0xd9d9d9, '#a04a7a', [
        'Welcome home! This little village is all yours.',
        'See the treasure chests? Break them open — surprises inside! 🎁',
        'Mine Dream Crystals 💎 and Timber 🪵 to craft your wand!',
        'Follow the beam of golden light east — the old ruin still works…',
      ], { hat: 0xe0a85f }),
      c('Wilbur Willowbrook', 0x8a5a9e, 0x9e9e9e, '#7a4a8e', [
        'Wanda does the welcoming. I do the napping.',
        'Our house has TWO floors now. Fancy!',
      ]),
      c('Wren Willowbrook', 0xd98ab0, 0x6b4a2f, '#b06a90', [
        'I can see the whole village from my bedroom window!',
        'The well at the plaza grants wishes. Small ones.',
      ]),
    ],
  },
  {
    surname: 'Greenpatch',
    members: [
      c('Sprout Greenpatch', 0x6e8c3a, 0x8a5a2a, '#5a7a2a', [
        'Fresh juice for hungry builders! 3 Carrots 🥕 for one juice!',
        'My carrots are the crunchiest on the island. Probably.',
        'The farm is right over there — pick all you like!',
      ], { hat: 0x4a6e2a, trade: { takesBlock: CARROT, takesCount: 3, gives: 'juice', givesName: 'Pumpkin Juice', thanks: 'Three crunchy carrots! One juice for you! 🧃' } }),
      c('Fern Greenpatch', 0x8fbf5a, 0xd96f32, '#6e9e3a', [
        'I water the carrots. Sprout takes the credit.',
        'Pumpkins get BIGGER if you sing to them. True fact.',
      ]),
    ],
  },
  {
    surname: 'Bramble',
    members: [
      c('Bram Bramble', 0x8c6e3a, 0x2e2a33, '#7a5a2a', [
        'I built every roof in this village. Slate never leaks!',
        'Try the Cozy blocks for walls. Very snuggly.',
        'A village needs a builder like you. Add a house anywhere!',
      ], { hat: 0x6b4a2f }),
      c('Bessie Bramble', 0xb08c5a, 0xf0e0a8, '#9e7a4a', [
        'Bram built our bathroom himself. The shower ACTUALLY showers.',
        'Paintings make a house a home, dear.',
      ]),
    ],
  },
  {
    surname: 'Moonwhistle',
    members: [
      c('Milo Moonwhistle', 0x4a6e9e, 0x3a3a4e, '#3a5e8e', [
        'I study the stars. The night sky here is SPECTACULAR.',
        'Sleep when the stars come out — you wake up brand new.',
      ], { hat: 0x2e4a6e }),
      c('Mira Moonwhistle', 0x7a9ec4, 0xd9d9d9, '#5a7eb4', [
        'The Moon Wolves will come back someday. I heard one once.',
        'Star Lanterns are just bottled moonlight, you know.',
      ]),
    ],
  },
  {
    surname: 'Thistledown',
    members: [
      c('Tilly Thistledown', 0xc46a5a, 0x6b4a2f, '#a45a4a', [
        'Blossom blocks smell like spring. I keep one on my pillow.',
        'Have you met EVERYONE in the village yet? We are a lot.',
      ]),
      c('Tom Thistledown', 0x9e6a3a, 0x8a5a2a, '#8a5a2a', [
        'I dug our basement myself. Found three worms and a pebble.',
        'Treasure chests never appear twice in the same spot. Spooky.',
      ]),
    ],
  },
  {
    surname: 'Starfield',
    members: [
      c('Stella Starfield', 0x8a5ac4, 0xf0e0a8, '#7a4ab4', [
        'Sun Stone glows even at midnight. I lined my windows with it.',
        'The ruin to the east? Older than the island, they say.',
      ], { hat: 0x6a3aa4 }),
      c('Sam Starfield', 0xa47ad9, 0x2e2a33, '#8a5ec9', [
        'One day I will fly a broom around all the little islands.',
        'Mum says the castle has a LIBRARY. With a thousand books!',
      ]),
    ],
  },
  {
    surname: 'Puddifoot',
    members: [
      c('Poppy Puddifoot', 0xd9889e, 0xd96f32, '#b9687e', [
        'Tea? Cake? Sit down, sit down! The chairs are new.',
        'A Feast Table always has room for one more plate.',
      ]),
      c('Pim Puddifoot', 0xc4a45a, 0x6b4a2f, '#a4843a', [
        'I once ate eleven pumpkin pies. I regret only the last one.',
        'Butterbrew from Mr. Fizzlepop fixes EVERYTHING.',
      ]),
    ],
  },
  {
    surname: 'Quillfeather',
    members: [
      c('Quinn Quillfeather', 0x5a9e8c, 0x9e9e9e, '#4a8e7c', [
        'I write down everything that happens in the village. Everything.',
        'Today\'s entry: a hero walked by. Looked very capable.',
      ], { hat: 0x3a7e6c }),
      c('Quilla Quillfeather', 0x7ab4a4, 0xf0e0a8, '#5aa494', [
        'My quill is a real Glow Owl feather. It writes in the dark!',
        'Marina the mermaid knows the best stories. Ask her!',
      ]),
    ],
  },
];

/**
 * The Weasley family, of the Burrow. (Private family build — rename
 * before any public release, same as the castle friends above.)
 */
export const WEASLEYS: FamilyDef = {
  surname: 'Weasley',
  members: [
    c('Mr. Weasley', 0x6e8c5a, 0xd96f32, '#c4642a', [
      'Welcome to the Burrow! Mind the stairs — they wobble on purpose.',
      'Fascinating, these block contraptions of yours. Simply fascinating!',
    ]),
    c('Mrs. Weasley', 0x9e5a4a, 0xd96f32, '#c4642a', [
      'You look HUNGRY, dear. The feast table is always full.',
      'Fred! George! Whatever it is — put it DOWN.',
    ]),
    c('Bill Weasley', 0x4a5a8c, 0xd96f32, '#c4642a', [
      'I hunt treasure for a living. The chests on this island? Quality.',
      'The ruin east of here is curse-free. I checked. Twice.',
    ]),
    c('Percy Weasley', 0x3a3a4e, 0xd96f32, '#c4642a', [
      'I have organized the basement. ALPHABETICALLY.',
      'Rules keep a village running, you know.',
    ]),
    c('Fred Weasley', 0xc47a2a, 0xd96f32, '#c4642a', [
      'I\'m George. He\'s Fred. Or wait—',
      'We hid something in one of the village chests. Good luck!',
    ]),
    c('George Weasley', 0xc47a2a, 0xd96f32, '#c4642a', [
      '—I\'m Fred. He\'s George. Honestly, keep up.',
      'The shower upstairs? We enchanted it to sing. You\'re welcome.',
    ]),
    c('Ginny Weasley', 0xb04a5a, 0xd96f32, '#c4642a', [
      'Race you around the duel ring! Loser feeds the pumpkins.',
      'One day I\'ll be the best duellist in the whole village.',
      'Ron lives at the castle now. Visiting friends, he says.',
    ]),
  ],
};

/** Folk of the far-island hamlets — two move into each hamlet. */
export const HAMLET_FOLK: CharacterDef[] = [
  c('Skye Saltbeard', 0x4a6e8c, 0xd9d9d9, '#3a5e7c', [
    'A visitor! We hardly ever get visitors out here.',
    'I sailed every inch of this sea. Well. Floated, mostly.',
  ], { hat: 0x2e4a6e }),
  c('Coral', 0xe08a9e, 0x6b4a2f, '#c06a80', [
    'Our little island is the prettiest one. Everyone says so. (I say so.)',
    'Pumpkins for juice, dear? 2 plump ones and the cup is yours.',
  ], { trade: { takesBlock: PUMPKIN, takesCount: 2, gives: 'juice', givesName: 'Pumpkin Juice', thanks: 'Lovely pumpkins! Fresh juice for the traveler! 🧃' } }),
  c('Finn Driftwood', 0x6e8c5a, 0xf0e0a8, '#5a7a4a', [
    'I once saw the mermaid wave at me. Best day of my life.',
    'Treasure washes up on far islands like this one. Look around!',
  ]),
  c('Pebble', 0x8a8a9e, 0x3a3a4e, '#6e6e8a', [
    'I collect rocks. This island is my favorite rock.',
    'The light beam on the big island? I can see it from my window!',
  ], { hat: 0x5a5a72 }),
  c('Juniper', 0x7a5cc4, 0xd96f32, '#6a4cb4', [
    'I moved out here for the quiet. Then the slimes came. Less quiet.',
    'A hero like you should visit ALL the islands. We get lonely!',
  ]),
  c('Moss', 0x5a8c6e, 0x8a5a2a, '#4a7a5e', [
    'Shhh. The wild grass whispers if you stand very still.',
    'My cottage bathroom has a SHOWER. Island life is luxury.',
  ]),
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
