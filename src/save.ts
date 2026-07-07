import { World } from './world';
import { GameState, defaultState } from './state';
import { Gate } from './terrain';

const KEY = 'spellcraft.v1'; // kept stable; the payload carries its own version

export interface SaveData {
  v: 2;
  seed: number;
  /** island footprint (older saves are 64) */
  islandSize?: number;
  islandWorld?: string; // base64 of run-length-encoded block data
  castleWorld?: string;
  shadowWorld?: string;
  islandGate?: Gate;
  player?: { x: number; y: number; z: number };
  slot?: number;
  state: GameState;
}

/** Run-length encode as (count, value) byte pairs — the world is mostly air. */
function rleEncode(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < data.length) {
    const value = data[i];
    let count = 1;
    while (count < 255 && i + count < data.length && data[i + count] === value) count++;
    out.push(count, value);
    i += count;
  }
  return new Uint8Array(out);
}

function rleDecode(src: Uint8Array, outLength: number): Uint8Array {
  const out = new Uint8Array(outLength);
  let o = 0;
  for (let i = 0; i + 1 < src.length && o < outLength; i += 2) {
    out.fill(src[i + 1], o, Math.min(outLength, o + src[i]));
    o += src[i];
  }
  return out;
}

function toBase64(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i += 8192) {
    binary += String.fromCharCode(...data.subarray(i, i + 8192));
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function encodeWorld(world: World): string {
  return toBase64(rleEncode(world.data));
}

/**
 * Decodes saved blocks into the world. Worlds saved before the height was
 * raised simply fill the lower layers — the layout is layer-by-layer, so
 * old islands come back intact with extra sky above them.
 */
export function decodeWorldInto(world: World, b64: string): boolean {
  try {
    world.data.set(rleDecode(fromBase64(b64), world.data.length));
    return true;
  } catch {
    return false;
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable — the game keeps running, it just won't persist
  }
}

export function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.v === 2) return parsed as SaveData;
    // migrate a Phase 0 save: { seed, world, player, slot }
    return {
      v: 2,
      seed: parsed.seed,
      islandWorld: parsed.world,
      player: parsed.player,
      slot: parsed.slot,
      state: defaultState(),
    };
  } catch {
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(KEY);
}

/** The raw save as text — for saving the whole world to a file. */
export function exportSaveText(): string | null {
  return localStorage.getItem(KEY);
}

/** Load a world file's text into the save slot (validated first). */
export function importSaveText(text: string): boolean {
  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed.v === 2 && typeof parsed.seed === 'number' && parsed.state) {
      localStorage.setItem(KEY, text);
      return true;
    }
  } catch {
    // fall through — not a world file
  }
  return false;
}
