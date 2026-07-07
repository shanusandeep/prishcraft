import type { EnemyKind } from './enemies';

export interface LevelDef {
  id: number;
  name: string;
  emoji: string;
  /** where this level's enemies appear */
  realm: 'island' | 'castle' | 'shadow';
  enemy: EnemyKind | null;
  /** defeats needed to clear the level */
  goal: number;
  /** quest-banner hint */
  hint: string;
  /** toast when the level begins */
  intro: string;
}

export const LEVELS: Record<number, LevelDef> = {
  1: { id: 1, name: 'The Awakening', emoji: '✨', realm: 'island', enemy: null, goal: 0, hint: '', intro: '' },
  2: {
    id: 2, name: 'Gloom Slimes', emoji: '🟢', realm: 'island', enemy: 'slime', goal: 8,
    hint: 'Bouncy gloom is loose on the island — whack it!',
    intro: '🟢 Level 2! Gloom Slimes are bouncing around the island. Zap them with clicks!',
  },
  3: {
    id: 3, name: 'Werewolves', emoji: '🐺', realm: 'island', enemy: 'werewolf', goal: 6,
    hint: 'They prowl the wilds — especially at night.',
    intro: '🐺 Level 3! Werewolves prowl the island. Calm them — they make good dogs!',
  },
  4: {
    id: 4, name: 'Mischief Pixies', emoji: '🧚', realm: 'island', enemy: 'pixie', goal: 10,
    hint: 'They fly! The broom helps a LOT.',
    intro: '🧚 Level 4! Mischief Pixies swarm the skies. Hop on your broom!',
  },
  5: {
    id: 5, name: 'Giant Spiders', emoji: '🕷️', realm: 'island', enemy: 'spider', goal: 8,
    hint: 'Webs mean spiders. Watch the wild corners of the isles.',
    intro: '🕷️ Level 5! Giant Spiders crept in overnight. Clear them out!',
  },
  6: {
    id: 6, name: 'Cave Trolls', emoji: '🧌', realm: 'island', enemy: 'troll', goal: 4,
    hint: 'Slow, huge, and grumpy. Keep moving!',
    intro: '🧌 Level 6! Cave Trolls are stomping about. They hit HARD — stay quick!',
  },
  7: {
    id: 7, name: 'The Basilisk', emoji: '🐍', realm: 'island', enemy: 'basilisk', goal: 1,
    hint: 'A serpent slithers near the old ruin…',
    intro: '🐍 Level 7! Something enormous slithers near the ruin. Be brave!',
  },
  8: {
    id: 8, name: 'Dementors', emoji: '👻', realm: 'castle', enemy: 'dementor', goal: 6,
    hint: 'They drift around the CASTLE. Craft the Patronus Charm (🎒)!',
    intro: '👻 Level 8! Dementors surround the castle! Craft the Patronus Charm — press G to drive them off!',
  },
  9: {
    id: 9, name: 'Death Eaters', emoji: '🌑', realm: 'island', enemy: 'deatheater', goal: 7,
    hint: 'Dark wizards raid the island — and they have Pip!',
    intro: '🌑 Level 9! Death Eaters raid the island… and they have taken PIP! Save him!',
  },
  10: {
    id: 10, name: 'LORD VOLDEMORT', emoji: '🐍', realm: 'shadow', enemy: 'voldemort', goal: 1,
    hint: 'A dark portal opened in the castle courtyard…',
    intro: '⚡ LEVEL 10. A dark portal has opened in the castle courtyard. He is waiting.',
  },
  11: { id: 11, name: 'Peace', emoji: '🕊️', realm: 'island', enemy: null, goal: 0, hint: '', intro: '🕊️ PEACE RETURNS TO THE REALM! You did it, hero!' },
  // ---- Shadow-Touched: the world remixed, the fight renewed ----
  12: {
    id: 12, name: 'Shadow Slimes', emoji: '🟣', realm: 'island', enemy: 'slime', goal: 12,
    hint: 'Twice as tough, twice the bounce. Mine the new Void Crystal ore!',
    intro: '🟣 SHADOW-TOUCHED! Dark ores hide in old stone — and the slimes came back WRONG.',
  },
  13: {
    id: 13, name: 'Shadow Wolves', emoji: '🌘', realm: 'island', enemy: 'werewolf', goal: 8,
    hint: 'Shadow wolves hunt in the dark. Forge the Star Blade (🎒)!',
    intro: '🌘 Level 13! Shadow wolves prowl. The Star Blade recipe is in your bag…',
  },
  14: {
    id: 14, name: 'Shadow Trolls', emoji: '🌑', realm: 'island', enemy: 'troll', goal: 5,
    hint: 'Enormous. Furious. Very whackable with a Star Blade.',
    intro: '🌑 Level 14! Shadow Trolls shake the ground. Show them your new blade!',
  },
  15: {
    id: 15, name: "VOLDEMORT'S SHADOW", emoji: '⚡', realm: 'shadow', enemy: 'voldemort', goal: 1,
    hint: 'He left a shadow behind. End it — for good this time.',
    intro: '⚡ HE IS BACK. Or… his shadow is. The dark portal hums once more.',
  },
  16: { id: 16, name: 'Eternal Peace', emoji: '🌈', realm: 'island', enemy: null, goal: 0, hint: '', intro: '🌈 ETERNAL PEACE! Even the shadows bow to you now, hero of heroes!' },
};
