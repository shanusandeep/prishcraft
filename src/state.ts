import { TIMBER, LEAF, CRYSTAL, LANTERN, BLOSSOM } from './blocks';

export interface Items {
  wand: boolean;
  broom: boolean;
  key: boolean;
  patronus: boolean;
}

export interface GameState {
  /** blocks collected by breaking them, spent on crafting */
  resources: Record<number, number>;
  items: Items;
  /** friendship hearts per character name */
  friendship: Record<string, number>;
  /** character wishes already granted */
  wishesDone: string[];
  /** which realm the player is in */
  where: 'island' | 'castle' | 'shadow';
  /** Pip's current command */
  elfMode?: 'follow' | 'stay';
  /** hearts, 0..10 */
  health?: number;
  /** drinks from trading: pumpkin juice and butterbrew */
  foods?: { juice: number; brew: number };
  /** 0..1 around the clock; ~0.1 is morning, ~0.6 is deep night */
  timeOfDay?: number;
  /** families whose gift chest has already appeared */
  familyGifts?: string[];
  /** campaign level 1..10, 11 = peace */
  level?: number;
  /** enemies defeated within the current level */
  levelKills?: number;
  /** enemies nap; level goals pause */
  peaceful?: boolean;
  /** the player has reached the castle at least once */
  castleVisited?: boolean;
  /** Pip is held by the Death Eaters (level 9) */
  pipKidnapped?: boolean;
  /** village architecture version (bumps trigger a renovation on old saves) */
  villageV?: number;
}

export const MAX_HEALTH = 10;

/** hearts restored per food */
export const FOOD_VALUE = { carrot: 2, juice: 5, brew: 10 } as const;

export interface Recipe {
  id: keyof Items;
  name: string;
  emoji: string;
  blurb: string;
  needs: Array<{ block: number; count: number }>;
}

export const RECIPES: Recipe[] = [
  {
    id: 'wand',
    name: 'Wizard Wand',
    emoji: '🪄',
    blurb: 'Breaks any block — even stone! — and reaches twice as far.',
    needs: [
      { block: CRYSTAL, count: 3 },
      { block: TIMBER, count: 2 },
    ],
  },
  {
    id: 'broom',
    name: 'Flying Broom',
    emoji: '🧹',
    blurb: 'Fly! Press F to hop on, Space to rise, Shift to sink.',
    needs: [
      { block: TIMBER, count: 3 },
      { block: LEAF, count: 2 },
      { block: LANTERN, count: 1 },
    ],
  },
  {
    id: 'key',
    name: 'Portal Key',
    emoji: '🗝️',
    blurb: 'Wakes the sleeping stone ring… where does it lead?',
    needs: [
      { block: CRYSTAL, count: 5 },
      { block: LANTERN, count: 2 },
      { block: BLOSSOM, count: 3 },
    ],
  },
  {
    id: 'patronus',
    name: 'Patronus Charm',
    emoji: '🦌',
    blurb: 'Press G — a burst of light that scares dementors away!',
    needs: [
      { block: LANTERN, count: 4 },
      { block: CRYSTAL, count: 4 },
      { block: BLOSSOM, count: 2 },
    ],
  },
];

export function defaultState(): GameState {
  return {
    resources: {},
    items: { wand: false, broom: false, key: false, patronus: false },
    friendship: {},
    wishesDone: [],
    where: 'island',
    elfMode: 'follow',
    health: MAX_HEALTH,
    foods: { juice: 0, brew: 0 },
    timeOfDay: 0.1,
    familyGifts: [],
    level: 1,
    levelKills: 0,
    peaceful: false,
    castleVisited: false,
    pipKidnapped: false,
    villageV: 1,
  };
}

export function canCraft(state: GameState, recipe: Recipe): boolean {
  if (state.items[recipe.id]) return false;
  return recipe.needs.every((n) => (state.resources[n.block] ?? 0) >= n.count);
}

export function craft(state: GameState, recipe: Recipe): boolean {
  if (!canCraft(state, recipe)) return false;
  for (const n of recipe.needs) state.resources[n.block] = (state.resources[n.block] ?? 0) - n.count;
  state.items[recipe.id] = true;
  return true;
}
