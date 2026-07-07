import { GameState } from './state';
import { PLACEABLE } from './blocks';

// The trophy shelf. Checks run against lifetime stats + game state;
// earning one fires fireworks and lives forever in the save.

export interface AchievementDef {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  check: (state: GameState, stats: Record<string, number>) => boolean;
}

const s = (stats: Record<string, number>, key: string) => stats[key] ?? 0;

export const ACHIEVEMENTS: AchievementDef[] = [
  // building & mining
  { id: 'first-break', emoji: '⛏️', name: 'First Crack', desc: 'Break your first block', check: (_st, stats) => s(stats, 'blocksBroken') >= 1 },
  { id: 'miner-100', emoji: '⛏️', name: 'Digger', desc: 'Break 100 blocks', check: (_st, stats) => s(stats, 'blocksBroken') >= 100 },
  { id: 'miner-1000', emoji: '💎', name: 'Master Miner', desc: 'Break 1,000 blocks', check: (_st, stats) => s(stats, 'blocksBroken') >= 1000 },
  { id: 'builder-10', emoji: '🧱', name: 'First Bricks', desc: 'Place 10 blocks', check: (_st, stats) => s(stats, 'blocksPlaced') >= 10 },
  { id: 'builder-250', emoji: '🏠', name: 'Home Maker', desc: 'Place 250 blocks', check: (_st, stats) => s(stats, 'blocksPlaced') >= 250 },
  { id: 'builder-1000', emoji: '🏰', name: 'Castle Dreamer', desc: 'Place 1,000 blocks', check: (_st, stats) => s(stats, 'blocksPlaced') >= 1000 },
  { id: 'collector-half', emoji: '📦', name: 'Collector', desc: 'Collect half of all block types', check: (st) => (st.collected?.length ?? 0) >= Math.ceil(PLACEABLE.length / 2) },
  { id: 'collector-all', emoji: '🌟', name: 'One of Everything', desc: 'Collect every block type', check: (st) => (st.collected?.length ?? 0) >= PLACEABLE.length },
  { id: 'rich', emoji: '💰', name: 'Block Baron', desc: 'Hold 99 of one block', check: (st) => Object.values(st.resources).some((n) => (n ?? 0) >= 99) },

  // gear
  { id: 'wand', emoji: '🪄', name: 'Wandmaker', desc: 'Craft the Wizard Wand', check: (st) => st.items.wand },
  { id: 'broom', emoji: '🧹', name: 'Cleared for Takeoff', desc: 'Craft the Flying Broom', check: (st) => st.items.broom },
  { id: 'key', emoji: '🗝️', name: 'Keeper of the Gate', desc: 'Craft the Portal Key', check: (st) => st.items.key },
  { id: 'patronus', emoji: '🦌', name: 'Light-Bringer', desc: 'Craft the Patronus Charm', check: (st) => st.items.patronus },
  { id: 'starblade', emoji: '⭐', name: 'Star Smith', desc: 'Forge the Star Blade', check: (st) => st.items.starblade },

  // friends
  { id: 'first-friend', emoji: '💛', name: 'First Friend', desc: 'Reach 3 hearts with someone', check: (st) => Object.values(st.friendship).some((h) => h >= 3) },
  { id: 'social-10', emoji: '💖', name: 'Loved by the Village', desc: '3+ hearts with 10 friends', check: (st) => Object.values(st.friendship).filter((h) => h >= 3).length >= 10 },
  { id: 'family-gift', emoji: '💝', name: 'Family Favorite', desc: 'Befriend one whole family', check: (st) => (st.familyGifts?.length ?? 0) >= 1 },
  { id: 'all-families', emoji: '👑', name: 'Everyone’s Hero', desc: 'Befriend five whole families', check: (st) => (st.familyGifts?.length ?? 0) >= 5 },
  { id: 'interviewer', emoji: '❓', name: 'Curious Mind', desc: 'Ask friends 25 questions', check: (_st, stats) => s(stats, 'questionsAsked') >= 25 },
  { id: 'trader', emoji: '🧃', name: 'Regular Customer', desc: 'Trade 5 times', check: (_st, stats) => s(stats, 'trades') >= 5 },
  { id: 'duel-win', emoji: '⚡', name: 'Duelist', desc: 'Win a friendly duel', check: (_st, stats) => s(stats, 'duelsWon') >= 1 },
  { id: 'duel-5', emoji: '🏆', name: 'Champion of the Green', desc: 'Win 5 duels', check: (_st, stats) => s(stats, 'duelsWon') >= 5 },

  // adventure
  { id: 'chest-1', emoji: '🎁', name: 'Treasure!', desc: 'Open a treasure chest', check: (_st, stats) => s(stats, 'chestsOpened') >= 1 },
  { id: 'chest-20', emoji: '🗺️', name: 'Treasure Hunter', desc: 'Open 20 chests', check: (_st, stats) => s(stats, 'chestsOpened') >= 20 },
  { id: 'sleep-1', emoji: '😴', name: 'Sweet Dreams', desc: 'Sleep in a bed', check: (_st, stats) => s(stats, 'sleeps') >= 1 },
  { id: 'sleep-7', emoji: '🛏️', name: 'Well Rested', desc: 'Sleep 7 nights', check: (_st, stats) => s(stats, 'sleeps') >= 7 },
  { id: 'castle', emoji: '🏰', name: 'Through the Ring', desc: 'Visit the castle realm', check: (st) => !!st.castleVisited },
  { id: 'slayer-25', emoji: '⚔️', name: 'Monster Whacker', desc: 'Defeat 25 enemies', check: (_st, stats) => s(stats, 'kills') >= 25 },
  { id: 'slayer-100', emoji: '🗡️', name: 'Realm Protector', desc: 'Defeat 100 enemies', check: (_st, stats) => s(stats, 'kills') >= 100 },
  { id: 'campaign', emoji: '🕊️', name: 'Savior of the Realm', desc: 'Defeat Lord Voldemort', check: (st) => (st.level ?? 1) >= 11 },
  { id: 'shadow-mode', emoji: '🟣', name: 'Into the Shadow', desc: 'Begin Shadow-Touched mode', check: (st) => !!st.shadowTouched },
  { id: 'eternal', emoji: '🌈', name: 'Hero of Heroes', desc: 'Defeat Voldemort’s Shadow', check: (st) => (st.level ?? 1) >= 16 },

  // dedication
  { id: 'streak-3', emoji: '🦉', name: 'Owl Friend', desc: '3-day Daily Owl streak', check: (st) => (st.giftStreak ?? 0) >= 3 },
  { id: 'streak-7', emoji: '🌟', name: 'Faithful Friend', desc: '7-day Daily Owl streak', check: (st) => (st.giftStreak ?? 0) >= 7 },

  // together
  { id: 'together', emoji: '👫', name: 'Better Together', desc: 'Share an island with a friend', check: (_st, stats) => s(stats, 'coopPlays') >= 1 },
];
