import './style.css';
import * as THREE from 'three';
import { AIR, BLOCKS, WATER, VINE, CARROT, isSolid } from './blocks';
import { World } from './world';
import { generateIsland, findSpawn, buildIslandPortal, floraPass, cropsPass, Gate } from './terrain';
import { Elf, Mermaid, findMermaidSpot } from './creatures';
import { generateCastleRealm, CASTLE_GATE, CASTLE_SPAWN } from './castle';
import { VoxelRenderer } from './mesher';
import { createAtlas } from './textures';
import { raycastVoxels } from './raycast';
import { Player } from './player';
import { Controls } from './controls';
import { TouchControls, isTouchDevice } from './touch';
import { Particles } from './effects';
import { UI } from './ui';
import { NPC } from './npc';
import { CHARACTERS, TRADERS } from './characters';
import { RECIPES, Recipe, canCraft, craft, defaultState, MAX_HEALTH, FOOD_VALUE } from './state';
import { writeSave, readSave, decodeWorldInto, encodeWorld, clearSave } from './save';

// ---------- renderer / scene ----------

/** Footprint of newly-grown islands. Old saves keep their size until reset. */
const ISLAND_SIZE = 192;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('app')!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffe9f3, 60, 170);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 400);

// soft gradient sky dome
{
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#8ed0ff');
  grad.addColorStop(0.55, '#cde9ff');
  grad.addColorStop(1, '#ffe9f3');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(260, ISLAND_SIZE * 1.7), 16, 12),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }),
  );
  dome.position.set(ISLAND_SIZE / 2, 0, ISLAND_SIZE / 2);
  scene.add(dome);
}

scene.add(new THREE.HemisphereLight(0xcfe8ff, 0xffe2c9, 0.95));
const sun = new THREE.DirectionalLight(0xfff2dd, 0.9);
sun.position.set(40, 70, 25);
scene.add(sun);

// drifting marshmallow clouds
const clouds: Array<{ group: THREE.Group; speed: number }> = [];
{
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 10; i++) {
    const group = new THREE.Group();
    const puffs = 2 + Math.floor(Math.random() * 2);
    for (let p = 0; p < puffs; p++) {
      const w = 4 + Math.random() * 5;
      const puff = new THREE.Mesh(new THREE.BoxGeometry(w, 1.4, 3 + Math.random() * 3), mat);
      puff.position.set(p * 2.5 - puffs, Math.random() * 0.6, (Math.random() - 0.5) * 2);
      group.add(puff);
    }
    group.position.set(
      Math.random() * (ISLAND_SIZE + 120) - 60,
      40 + Math.random() * 10,
      Math.random() * (ISLAND_SIZE + 120) - 60,
    );
    scene.add(group);
    clouds.push({ group, speed: 0.4 + Math.random() * 0.5 });
  }
}

// ---------- worlds & game state ----------

const atlas = createAtlas();
const saved = readSave();
const state = saved?.state ?? defaultState();
// fields added after the first release — fill them in for old saves
state.health = state.health ?? MAX_HEALTH;
state.foods = state.foods ?? { juice: 0, brew: 0 };
let seed = saved?.seed ?? ((Math.random() * 2 ** 31) | 0);

const avoidCastleFootprint = (x: number, z: number) => x >= 12 && x <= 52 && z >= 12 && z <= 52;

let island = new World(saved?.islandSize ?? (saved?.islandWorld ? 64 : ISLAND_SIZE), saved?.islandSize ?? (saved?.islandWorld ? 64 : ISLAND_SIZE));
if (!saved?.islandWorld || !decodeWorldInto(island, saved.islandWorld)) {
  generateIsland(island, seed);
}
let islandGate: Gate = saved?.islandGate ?? buildIslandPortal(island);
// keep flora/fields away from the portal clearing
const nearGate = (x: number, z: number) =>
  Math.abs(x - islandGate.x) < 9 && Math.abs(z - islandGate.z) < 7;
floraPass(island, Math.round(3 * island.sizeX / 64), nearGate); // tufts + willows (old saves too)
cropsPass(island, nearGate); // carrot & pumpkin fields

let castle: World | null = null;
if (saved?.castleWorld) {
  castle = new World();
  if (!decodeWorldInto(castle, saved.castleWorld)) castle = null;
  if (castle) floraPass(castle, 2, avoidCastleFootprint);
}

function getCastle(): World {
  if (!castle) {
    castle = new World();
    generateCastleRealm(castle, seed + 1);
    floraPass(castle, 2, avoidCastleFootprint);
  }
  return castle;
}

let world = state.where === 'castle' ? getCastle() : island;

const voxels = new VoxelRenderer(world, scene, atlas);
voxels.rebuildAll();

// ---------- player / npcs / controls / ui ----------

const player = new Player();
scene.add(player.group);

let spawn = findSpawn(island);
if (saved?.player) {
  player.pos.set(saved.player.x, saved.player.y, saved.player.z);
} else {
  player.pos.set(spawn.x, spawn.y, spawn.z);
}
player.setWandVisible(state.items.wand);

const npcRoot = new THREE.Group();
scene.add(npcRoot);
const npcs: NPC[] = [...CHARACTERS, ...TRADERS].map((def) => {
  const npc = new NPC(def);
  npcRoot.add(npc.group);
  return npc;
});
npcRoot.visible = state.where === 'castle';

// Pip the house elf — follows you everywhere
const elf = new Elf();
elf.teleportTo(player.pos);
scene.add(elf.group);

// Marina the mermaid — lives in the island's sea
const mermaid = new Mermaid();
{
  const spot = findMermaidSpot(island);
  mermaid.setHome(spot.x, spot.z);
}
scene.add(mermaid.group);
mermaid.group.visible = state.where === 'island';

const controls = new Controls(renderer.domElement);
const touch = isTouchDevice();
const ui = new UI(atlas, touch);
if (saved?.slot !== undefined) ui.select(saved.slot);
ui.setItems(state);
ui.renderCraft(state);
ui.setFlyButtonVisible(touch && state.items.broom);

const particles = new Particles(scene);

// highlight box around the targeted block
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }),
);
highlight.visible = false;
scene.add(highlight);

// ---------- saving ----------

let saveTimer: number | undefined;
function markDirty(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, 1200);
}
function saveNow(): void {
  writeSave({
    v: 2,
    seed,
    islandSize: island.sizeX,
    islandWorld: encodeWorld(island),
    castleWorld: castle ? encodeWorld(castle) : undefined,
    islandGate,
    player: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
    slot: ui.selected,
    state,
  });
}
window.addEventListener('beforeunload', saveNow);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveNow();
});

// ---------- quest banner ----------

function recipeGoal(recipe: Recipe): string {
  if (canCraft(state, recipe)) {
    return `✨ You can craft the ${recipe.name}! ${touch ? 'Tap 🎒' : 'Press C'}`;
  }
  const parts = recipe.needs.map((n) => {
    const have = Math.min(state.resources[n.block] ?? 0, n.count);
    return `${ui.blockIcon(n.block)} ${have}/${n.count}`;
  });
  return `${recipe.emoji} Make a ${recipe.name} — mine these blocks: ${parts.join(' · ')}`;
}

function updateGoal(): void {
  if (!state.items.wand) ui.setGoal(recipeGoal(RECIPES[0]));
  else if (!state.items.broom) ui.setGoal(recipeGoal(RECIPES[1]));
  else if (!state.items.key) ui.setGoal(recipeGoal(RECIPES[2]));
  else if (state.where === 'island') ui.setGoal('🗝️ The stone ring on the east side is awake. Step through it!');
  else if (state.wishesDone.length < CHARACTERS.length) {
    ui.setGoal(`💬 Make friends in the castle! ${touch ? 'Walk close and tap 💬' : 'Walk close and press E'} (wishes granted: ${state.wishesDone.length}/${CHARACTERS.length})`);
  } else {
    ui.setGoal('🏰 Everyone is your friend! Explore the towers, fly, and build ✨');
  }
}
updateGoal();

// ---------- block targeting and actions ----------

function reach(): number {
  return state.items.wand ? 12 : 7;
}

function targetBlock() {
  const dir = camera.getWorldDirection(new THREE.Vector3());
  const camDist = camera.position.distanceTo(player.pos);
  const hit = raycastVoxels(
    world,
    camera.position.x, camera.position.y, camera.position.z,
    dir.x, dir.y, dir.z,
    camDist + reach(),
  );
  if (!hit) return null;
  const center = new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  if (center.distanceTo(player.pos) > reach() + 1) return null;
  return hit;
}

function doBreak(): void {
  if (ui.isCraftOpen()) return;
  const hit = targetBlock();
  if (!hit) return;
  if (hit.y === 0) {
    ui.toast('The world base is magic-proof ✨');
    return;
  }
  const def = BLOCKS[hit.id];
  if (def.hard && !state.items.wand) {
    ui.toast('Too strong for bare hands… craft a Wand 🪄');
    return;
  }
  world.set(hit.x, hit.y, hit.z, AIR);
  voxels.blockChanged(hit.x, hit.z);
  particles.burst(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, def.color, state.items.wand ? 14 : 10);
  if (state.items.wand) particles.burst(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, 0xf0a6e8, 5);
  state.resources[hit.id] = (state.resources[hit.id] ?? 0) + 1;
  ui.renderCraft(state);
  updateGoal();
  markDirty();
}

function doPlace(): void {
  if (ui.isCraftOpen()) return;
  const hit = targetBlock();
  if (!hit) return;
  const x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
  if (!world.inBounds(x, y, z) || y === 0) return;
  const existing = world.get(x, y, z);
  if (existing !== AIR && existing !== WATER) return;
  const id = ui.selectedBlockId();
  if (isSolid(id) && player.intersectsBlock(x, y, z)) return; // not inside yourself!
  world.set(x, y, z, id);
  voxels.blockChanged(x, z);
  markDirty();
}

// ---------- crafting ----------

function craftRecipe(recipe: Recipe): void {
  if (!craft(state, recipe)) return;
  ui.renderCraft(state);
  ui.setItems(state);
  updateGoal();
  saveNow();
  if (recipe.id === 'wand') {
    player.setWandVisible(true);
    ui.toast('🪄 Your wand hums with magic! Long reach, breaks anything.');
  } else if (recipe.id === 'broom') {
    ui.setFlyButtonVisible(touch);
    ui.toast(touch ? '🧹 A flying broom! Tap 🧹 to fly!' : '🧹 A flying broom! Press F to fly!');
  } else {
    ui.toast('🗝️ Somewhere on the island, old stones begin to glow…');
  }
  particles.burst(player.pos.x, player.pos.y + 1.2, player.pos.z, 0xf0a6e8, 16);
}

// ---------- flying ----------

function toggleFly(): void {
  if (!state.items.broom) {
    ui.toast('You need a Flying Broom 🧹 — check the crafting bag!');
    return;
  }
  player.setFlying(!player.flying);
  ui.setDownVisible(touch && player.flying);
  if (player.flying) ui.toast('🧹 Whoosh! Space to rise' + (touch ? ', ⬇️ to sink' : ', Shift to sink'));
}

// ---------- talking ----------

type Talkable = { kind: 'npc'; npc: NPC } | { kind: 'elf' } | { kind: 'mermaid' };

function nearestTalkable(): Talkable | null {
  let best: Talkable | null = null;
  let bestDist = 3.6;
  if (state.where === 'castle') {
    for (const npc of npcs) {
      const d = npc.pos.distanceTo(player.pos);
      if (d < bestDist) {
        best = { kind: 'npc', npc };
        bestDist = d;
      }
    }
  } else {
    const d = mermaid.pos.distanceTo(player.pos);
    if (d < Math.max(bestDist, 4.5)) {
      best = { kind: 'mermaid' };
      bestDist = d;
    }
  }
  const elfD = elf.pos.distanceTo(player.pos);
  if (elfD < bestDist) best = { kind: 'elf' };
  return best;
}

function talk(): void {
  const who = nearestTalkable();
  if (!who) return;

  if (who.kind === 'elf') {
    state.elfMode = (state.elfMode ?? 'follow') === 'follow' ? 'stay' : 'follow';
    state.friendship['Pip'] = (state.friendship['Pip'] ?? 0) + 1;
    const line = state.elfMode === 'follow' ? elf.def.followLine : elf.def.stayLine;
    ui.showDialogue('Pip', elf.def.nameColor, line, state.friendship['Pip']);
    particles.burst(elf.pos.x, elf.pos.y + 1.2, elf.pos.z, 0xff6b9d, 4);
    markDirty();
    return;
  }

  if (who.kind === 'mermaid') {
    state.friendship['Marina'] = (state.friendship['Marina'] ?? 0) + 1;
    const line = mermaid.def.lines[mermaid.lineIndex % mermaid.def.lines.length];
    mermaid.lineIndex++;
    ui.showDialogue('Marina', mermaid.def.nameColor, line, state.friendship['Marina']);
    particles.burst(mermaid.pos.x, mermaid.pos.y + 1.6, mermaid.pos.z, 0x7fd4f0, 6);
    markDirty();
    return;
  }

  const npc = who.npc;
  const def = npc.def;
  const hearts = (state.friendship[def.name] ?? 0);

  // shopkeepers: a repeatable trade instead of a wish
  if (def.trade) {
    const t = def.trade;
    state.friendship[def.name] = hearts + 1;
    const have = state.resources[t.takesBlock] ?? 0;
    if (have >= t.takesCount) {
      state.resources[t.takesBlock] = have - t.takesCount;
      state.foods![t.gives]++;
      ui.showDialogue(def.name, def.nameColor, t.thanks, state.friendship[def.name]);
      particles.burst(npc.pos.x, npc.pos.y + 1.6, npc.pos.z, 0xffe27a, 10);
      ui.setItems(state);
      ui.renderCraft(state);
    } else {
      ui.showDialogue(def.name, def.nameColor, def.lines[npc.lineIndex % def.lines.length], state.friendship[def.name]);
      npc.lineIndex++;
    }
    markDirty();
    return;
  }

  const wish = def.wish!;
  const wishDone = state.wishesDone.includes(def.name);

  if (!wishDone && (state.resources[wish.block] ?? 0) >= wish.count) {
    // grant the wish
    state.resources[wish.block] -= wish.count;
    state.wishesDone.push(def.name);
    state.friendship[def.name] = hearts + 5;
    ui.showDialogue(def.name, def.nameColor, wish.thanks, state.friendship[def.name]);
    particles.burst(npc.pos.x, npc.pos.y + 1.6, npc.pos.z, 0xff6b9d, 18);
    ui.renderCraft(state);
  } else if (!wishDone && npc.lineIndex >= 1) {
    // after a couple of chats, they share their wish
    state.friendship[def.name] = hearts + 1;
    ui.showDialogue(def.name, def.nameColor, wish.ask, state.friendship[def.name]);
    particles.burst(npc.pos.x, npc.pos.y + 1.6, npc.pos.z, 0xff6b9d, 4);
  } else {
    state.friendship[def.name] = hearts + 1;
    ui.showDialogue(def.name, def.nameColor, def.lines[npc.lineIndex % def.lines.length], state.friendship[def.name]);
    npc.lineIndex++;
    particles.burst(npc.pos.x, npc.pos.y + 1.6, npc.pos.z, 0xff6b9d, 4);
  }
  updateGoal();
  markDirty();
}

// ---------- health, hurting, and snacks ----------

ui.setHearts(state.health!);

function eat(kind: 'carrot' | 'juice' | 'brew'): void {
  if (state.health! >= MAX_HEALTH) {
    ui.toast('All hearts are full! Save it for later 😋');
    return;
  }
  if (kind === 'carrot') {
    if ((state.resources[CARROT] ?? 0) < 1) return;
    state.resources[CARROT]!--;
  } else {
    if ((state.foods![kind] ?? 0) < 1) return;
    state.foods![kind]--;
  }
  state.health = Math.min(MAX_HEALTH, state.health! + FOOD_VALUE[kind]);
  ui.setHearts(state.health);
  ui.setItems(state);
  ui.renderCraft(state);
  ui.toast(kind === 'carrot' ? '🥕 Crunch! +❤️❤️' : kind === 'juice' ? '🧃 Glug glug! +❤️×5' : '🥤 Butterbrew! All hearts back!');
  particles.burst(player.pos.x, player.pos.y + 1.4, player.pos.z, 0xffa64a, 8);
  markDirty();
}

/** Eat the best snack we have (Q key). */
function eatBest(): void {
  if ((state.foods!.brew ?? 0) > 0) eat('brew');
  else if ((state.foods!.juice ?? 0) > 0) eat('juice');
  else if ((state.resources[CARROT] ?? 0) > 0) eat('carrot');
  else ui.toast('No snacks! Pick carrots 🥕 in the fields.');
}

let hurtCooldown = 0;
let warnedAboutWillow = false;

function takeDamage(amount: number, why: string): void {
  state.health = Math.max(0, state.health! - amount);
  ui.setHearts(state.health);
  ui.hurtFlash();
  if (state.health <= 0) {
    // gentle "defeat": Pip drags you home for a rest, hearts refill
    state.health = MAX_HEALTH;
    ui.setHearts(state.health);
    const home = state.where === 'island' ? spawn : CASTLE_SPAWN;
    player.pos.set(home.x, home.y + 1, home.z);
    player.vel.set(0, 0, 0);
    player.setFlying(false);
    elf.teleportTo(player.pos);
    ui.toast(`💫 ${why} Pip dragged you home for a rest!`);
  }
  markDirty();
}

/** Standing under a willow's hanging vines hurts — the willow whomps! */
function checkWillowWhomp(dt: number): void {
  hurtCooldown -= dt;
  if (hurtCooldown > 0) return;
  const px = Math.floor(player.pos.x), py = Math.floor(player.pos.y + 1), pz = Math.floor(player.pos.z);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = 0; dy <= 2; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (world.get(px + dx, py + dy, pz + dz) === VINE) {
          hurtCooldown = 1.0;
          takeDamage(1, 'The willow whomped you!');
          if (!warnedAboutWillow) {
            warnedAboutWillow = true;
            ui.toast('🌳 The Whomping Willow! Run out from under it!');
          }
          return;
        }
      }
    }
  }
}

// ---------- portals ----------

const fadeEl = document.getElementById('fade')!;
let traveling = false;
let wasInGate = false;

function inGate(gate: Gate, pos: THREE.Vector3): boolean {
  return (
    pos.x > gate.x - 0.4 && pos.x < gate.x + 3.4 &&
    pos.y > gate.y - 1.2 && pos.y < gate.y + 3 &&
    Math.abs(pos.z - (gate.z + 0.5)) < 0.95
  );
}

function travel(to: 'island' | 'castle'): void {
  traveling = true;
  fadeEl.classList.add('show');
  window.setTimeout(() => {
    state.where = to;
    world = to === 'castle' ? getCastle() : island;
    voxels.setWorld(world);
    npcRoot.visible = to === 'castle';
    mermaid.group.visible = to === 'island';
    player.setFlying(false);
    ui.setDownVisible(false);
    player.vel.set(0, 0, 0);
    if (to === 'castle') {
      player.pos.set(CASTLE_SPAWN.x, CASTLE_SPAWN.y, CASTLE_SPAWN.z);
      ui.toast('🏰 Welcome to the castle!');
    } else {
      player.pos.set(islandGate.x + 1.5, islandGate.y, islandGate.z + 2.5);
      ui.toast('🏝️ Home again!');
    }
    wasInGate = true; // don't bounce straight back
    elf.teleportTo(player.pos); // Pip comes along through the portal
    updateGoal();
    saveNow();
    window.setTimeout(() => fadeEl.classList.remove('show'), 150);
    traveling = false;
  }, 420);
}

function checkPortals(): void {
  if (traveling) return;
  const gate = state.where === 'island' ? islandGate : CASTLE_GATE;
  const inside = inGate(gate, player.pos);
  if (inside && !wasInGate) {
    wasInGate = true;
    if (state.where === 'island') {
      if (state.items.key) travel('castle');
      else ui.toast('The stone ring sleeps… it wants a Portal Key 🗝️');
    } else {
      travel('island');
    }
  } else if (!inside) {
    wasInGate = false;
  }
}

// portal sparkle so it reads as magical from far away
let sparkleTimer = 0;
function portalSparkle(dt: number): void {
  sparkleTimer -= dt;
  if (sparkleTimer > 0) return;
  sparkleTimer = 0.4;
  const gate = state.where === 'island' ? islandGate : CASTLE_GATE;
  const active = state.where === 'castle' || state.items.key;
  if (!active) return;
  particles.burst(
    gate.x + 0.5 + Math.random() * 2,
    gate.y + 0.4 + Math.random() * 2.2,
    gate.z + 0.5,
    Math.random() < 0.5 ? 0xf0a6e8 : 0xb9a8ee,
    2,
  );
}

// ---------- wiring ----------

controls.onBreak = doBreak;
controls.onPlace = doPlace;
controls.onSelect = (i) => { ui.select(i); markDirty(); };
controls.onCycle = (dir) => { ui.select(ui.selected + dir); markDirty(); };
controls.onTalk = talk;
controls.onFly = toggleFly;
controls.onCraft = () => ui.toggleCraft();
controls.onEat = eatBest;
ui.onEat = eat;

ui.onSelect = (i) => ui.select(i);
ui.onStart = () => { if (!touch) controls.lock(); };
ui.onCraft = craftRecipe;
ui.onFlyChip = toggleFly;
ui.onCraftToggle = (open) => {
  if (open) {
    controls.unlock();
    ui.renderCraft(state);
  }
};
ui.onReset = () => {
  clearSave();
  seed = (Math.random() * 2 ** 31) | 0;
  Object.assign(state, defaultState());
  island = new World(ISLAND_SIZE, ISLAND_SIZE); // new islands grow BIG
  generateIsland(island, seed);
  islandGate = buildIslandPortal(island);
  floraPass(island, Math.round(3 * island.sizeX / 64), nearGate);
  cropsPass(island, nearGate);
  const mspot = findMermaidSpot(island);
  mermaid.setHome(mspot.x, mspot.z);
  mermaid.group.visible = true;
  castle = null;
  world = island;
  voxels.setWorld(island);
  npcRoot.visible = false;
  spawn = findSpawn(island);
  const s = spawn;
  player.pos.set(s.x, s.y, s.z);
  elf.teleportTo(player.pos);
  player.vel.set(0, 0, 0);
  player.setFlying(false);
  player.setWandVisible(false);
  ui.setItems(state);
  ui.renderCraft(state);
  ui.setFlyButtonVisible(false);
  ui.setDownVisible(false);
  updateGoal();
  saveNow();
  ui.toast('🌱 A brand new island grew!');
};

let touchControls: TouchControls | null = null;
if (touch) {
  touchControls = new TouchControls(controls, {
    break: doBreak,
    place: doPlace,
    talk,
    fly: toggleFly,
  });
}

// ---------- camera follow with terrain occlusion ----------

const camTarget = new THREE.Vector3();
function updateCamera(dt: number): void {
  camTarget.set(player.pos.x, player.pos.y + 1.5, player.pos.z);
  const { yaw, pitch } = controls;
  const dir = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  );

  // pull the camera in if a hill or wall is in the way
  let dist = 5.5;
  for (let t = 0.4; t < dist; t += 0.2) {
    const px = camTarget.x + dir.x * t;
    const py = camTarget.y + dir.y * t;
    const pz = camTarget.z + dir.z * t;
    if (isSolid(world.get(Math.floor(px), Math.floor(py), Math.floor(pz)))) {
      dist = Math.max(1.2, t - 0.4);
      break;
    }
  }

  const desired = camTarget.clone().addScaledVector(dir, dist);
  const k = 1 - Math.exp(-14 * dt);
  camera.position.lerp(desired, k);
  camera.lookAt(camTarget);
}
// start the camera in a sensible spot immediately
camera.position.set(player.pos.x, player.pos.y + 4, player.pos.z + 6);

// ---------- main loop ----------

const clock = new THREE.Clock();

function frame(): void {
  const dt = Math.min(clock.getDelta(), 0.05);

  controls.updateCamera(dt);

  const input = controls.input();
  if (touchControls) {
    input.x += touchControls.move.x;
    input.z += touchControls.move.z;
    input.jump = input.jump || touchControls.jump;
    input.down = input.down || touchControls.down;
  }

  player.update(dt, input, controls.yaw, world);

  // safety net: never fall forever
  if (player.pos.y < -5) {
    if (state.where === 'island') player.pos.set(spawn.x, spawn.y + 2, spawn.z);
    else player.pos.set(CASTLE_SPAWN.x, CASTLE_SPAWN.y + 2, CASTLE_SPAWN.z);
    player.vel.set(0, 0, 0);
  }

  if (state.where === 'castle') {
    for (const npc of npcs) npc.update(dt, world, player.pos);
  } else {
    mermaid.update(dt, world, player.pos);
  }
  elf.update(dt, world, player.pos, state.elfMode ?? 'follow');
  if (touch) ui.setTalkVisible(!!nearestTalkable());

  checkWillowWhomp(dt);
  checkPortals();
  portalSparkle(dt);
  updateCamera(dt);

  const hit = targetBlock();
  highlight.visible = !!hit;
  if (hit) highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);

  particles.update(dt);

  for (const cloud of clouds) {
    cloud.group.position.x += cloud.speed * dt;
    if (cloud.group.position.x > ISLAND_SIZE + 70) cloud.group.position.x = -70;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// small debug handle for poking at the game from the console
(window as unknown as Record<string, unknown>).__spellcraft = {
  world: () => world, player, controls, camera, ui, state, npcs,
  doBreak, doPlace, talk, toggleFly, travel, craftRecipe,
  get islandGate() { return islandGate; },
  get seed() { return seed; },
};

export {};
