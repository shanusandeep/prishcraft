import './style.css';
import * as THREE from 'three';
import { AIR, BLOCKS, WATER, VINE, CARROT, PUMPKIN, CHEST, CRYSTAL, TIMBER, LANTERN, BLOSSOM, BED, DOOR, DOOR_OPEN, isSolid } from './blocks';
import { World } from './world';
import { generateIsland, findSpawn, buildIslandPortal, floraPass, cropsPass, treasurePass, renovateVillage, findHamletSites, buildHamlet, villagePlots, burrowSpot, Gate } from './terrain';
import { Elf, Mermaid, findMermaidSpot } from './creatures';
import {
  generateCastleRealm, CASTLE_GATE, CASTLE_SPAWN,
  generateShadowRealm, ensureShadowGate, CASTLE_SHADOW_GATE, SHADOW_RETURN_GATE, SHADOW_SPAWN,
} from './castle';
import { EnemyManager, EnemyKind, KINDS } from './enemies';
import { LEVELS } from './levels';
import { VoxelRenderer } from './mesher';
import { createAtlas } from './textures';
import { raycastVoxels } from './raycast';
import { Player } from './player';
import { Controls } from './controls';
import { TouchControls, isTouchDevice } from './touch';
import { Particles } from './effects';
import { UI } from './ui';
import { NPC } from './npc';
import { makeTextSprite } from './avatar';
import { QUESTIONS, Speaker } from './questions';
import { ACHIEVEMENTS } from './achievements';
import { VOIDCRYSTAL, MOONSILVER } from './blocks';
import { CHARACTERS, TRADERS, FAMILIES, WEASLEYS, HAMLET_FOLK, CharacterDef } from './characters';
import { RECIPES, Recipe, canCraft, craft, defaultState, MAX_HEALTH, FOOD_VALUE } from './state';
import { writeSave, readSave, decodeWorldInto, encodeWorld, clearSave } from './save';

// ---------- renderer / scene ----------

/** Footprint of newly-grown islands. Old saves keep their size until reset. */
const ISLAND_SIZE = 500;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('app')!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// fog hides the edge of the streamed-in world (8 chunks = 128 blocks)
scene.fog = new THREE.Fog(0xffe9f3, 55, 115);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 400);

// soft gradient sky dome (follows the camera, like a real sky)
let dome: THREE.Mesh;
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
  dome = new THREE.Mesh(
    new THREE.SphereGeometry(300, 16, 12),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }),
  );
  scene.add(dome);
}

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0xffe2c9, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dd, 0.9);
sun.position.set(40, 70, 25);
scene.add(sun);

// drifting marshmallow clouds
const clouds: Array<{ group: THREE.Group; speed: number }> = [];
const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
{
  const mat = cloudMat;
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
state.familyGifts = state.familyGifts ?? [];
state.items.patronus = state.items.patronus ?? false;
state.items.starblade = state.items.starblade ?? false;
state.stats = state.stats ?? {};
state.achievements = state.achievements ?? [];
state.collected = state.collected ?? Object.keys(state.resources).map(Number).filter((id) => (state.resources[id] ?? 0) > 0);
state.shadowTouched = state.shadowTouched ?? false;
state.giftStreak = state.giftStreak ?? 0;
state.levelKills = state.levelKills ?? 0;
state.peaceful = state.peaceful ?? false;
state.castleVisited = state.castleVisited ?? !!saved?.castleWorld;
let levelToastPending: string | null = null;
if (state.level == null) {
  // veterans who already finished the old quest line jump straight to the campaign
  if (state.items.wand && state.items.broom && state.items.key && state.castleVisited) {
    state.level = 2;
    levelToastPending = '⚔️ NEW: the 10-level campaign begins! ' + LEVELS[2].intro;
  } else {
    state.level = 1;
  }
}
let seed = saved?.seed ?? ((Math.random() * 2 ** 31) | 0);

const avoidCastleFootprint = (x: number, z: number) => x >= 12 && x <= 52 && z >= 12 && z <= 52;

let island = new World(saved?.islandSize ?? (saved?.islandWorld ? 64 : ISLAND_SIZE), saved?.islandSize ?? (saved?.islandWorld ? 64 : ISLAND_SIZE));
if (!saved?.islandWorld || !decodeWorldInto(island, saved.islandWorld)) {
  generateIsland(island, seed);
}
let islandGate: Gate = saved?.islandGate ?? buildIslandPortal(island);
// keep generated extras away from the portal clearing
const nearGate = (x: number, z: number) =>
  Math.abs(x - islandGate.x) < 9 && Math.abs(z - islandGate.z) < 7;
let spawn = findSpawn(island);
floraPass(island, Math.round(3 * island.sizeX / 64), nearGate); // tufts + willows (old saves too)
cropsPass(island, nearGate); // carrot & pumpkin fields
treasurePass(island, spawn, nearGate); // spawn village + hidden chests
if ((state.villageV ?? 0) < 3) {
  // old saves get the renovation crew: realistic interiors with doors,
  // desks, carpets, ceiling fans, cozier ceilings — and hamlets stay
  renovateVillage(island, spawn, nearGate);
  for (const site of findHamletSites(island, spawn)) buildHamlet(island, site.x, site.z);
  state.villageV = 3; // islandEncDirty starts true, so the next save picks this up
  window.setTimeout(() => ui.toast('🏗️ Home makeover! Real doors, desks, carpets, fans — and room labels!'), 2500);
}
let hamletSites = findHamletSites(island, spawn);

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
  if ((state.level ?? 1) >= 10) ensureShadowGate(castle);
  return castle;
}

let shadow: World | null = null;
if (saved?.shadowWorld) {
  shadow = new World();
  if (!decodeWorldInto(shadow, saved.shadowWorld)) shadow = null;
}
function getShadow(): World {
  if (!shadow) {
    shadow = new World();
    generateShadowRealm(shadow, seed + 2);
  }
  return shadow;
}

type Realm = 'island' | 'castle' | 'shadow';
function realmWorld(realm: Realm): World {
  return realm === 'island' ? island : realm === 'castle' ? getCastle() : getShadow();
}
function realmHome(realm: Realm): { x: number; y: number; z: number } {
  return realm === 'island' ? spawn : realm === 'castle' ? CASTLE_SPAWN : SHADOW_SPAWN;
}

let world = realmWorld(state.where as Realm);

// ---------- player / npcs / controls / ui ----------

const player = new Player();
scene.add(player.group);

if (saved?.player) {
  player.pos.set(saved.player.x, saved.player.y, saved.player.z);
} else {
  player.pos.set(spawn.x, spawn.y, spawn.z);
}
player.setWandVisible(state.items.wand);

const voxels = new VoxelRenderer(world, scene, atlas);
voxels.setWorld(world, player.pos.x, player.pos.z);

const npcRoot = new THREE.Group();
scene.add(npcRoot);
const npcs: NPC[] = [...CHARACTERS, ...TRADERS].map((def) => {
  const npc = new NPC(def);
  npcRoot.add(npc.group);
  return npc;
});
npcRoot.visible = state.where === 'castle';

// the spawn-village folk: eight wizarding families plus the Weasleys at the Burrow
let islandNpcs: NPC[] = [];
const npcFamily = new Map<string, string>(); // member name -> surname
function placeIslandVillagers(): void {
  for (const npc of islandNpcs) scene.remove(npc.group);
  islandNpcs = [];
  npcFamily.clear();
  const sx = Math.floor(spawn.x), sz = Math.floor(spawn.z);
  const plots = villagePlots(sx, sz);
  const addMember = (def: CharacterDef, home: { x: number; z: number }, jitter: number) => {
    const npc = new NPC({
      ...def,
      spot: [home.x + 3.5 + (Math.random() - 0.5) * jitter, home.z + 8 + (Math.random() - 0.5) * jitter],
      indoor: [home.x + 3.5, home.z + 3.5],
    });
    npc.pos.y = spawn.y;
    scene.add(npc.group);
    npc.group.visible = state.where === 'island';
    islandNpcs.push(npc);
  };
  FAMILIES.forEach((family, i) => {
    const plot = plots[i % plots.length];
    for (const member of family.members) {
      npcFamily.set(member.name, family.surname);
      addMember(member, plot, 8);
    }
  });
  const burrow = burrowSpot(sx, sz);
  for (const weasley of WEASLEYS.members) {
    npcFamily.set(weasley.name, WEASLEYS.surname);
    addMember(weasley, burrow, 10);
  }
  // far-island hamlet folk, two per hamlet
  hamletSites.forEach((site, i) => {
    for (let k = 0; k < 2; k++) {
      const def = HAMLET_FOLK[(i * 2 + k) % HAMLET_FOLK.length];
      const npc = new NPC({
        ...def,
        spot: [site.x + (k ? 3.5 : -3.5), site.z + 1.5],
        indoor: [site.x + (k ? 7.5 : -6.5), site.z - 0.5],
      });
      npc.pos.y = 15;
      scene.add(npc.group);
      npc.group.visible = state.where === 'island';
      islandNpcs.push(npc);
    }
  });
}
placeIslandVillagers();

// floating room labels inside the village manors ("super realistic")
const labelsRoot = new THREE.Group();
scene.add(labelsRoot);
function buildRoomLabels(): void {
  while (labelsRoot.children.length) labelsRoot.remove(labelsRoot.children[0]);
  const sx = Math.floor(spawn.x), sz = Math.floor(spawn.z);
  const vh = island.surfaceY(sx, sz);
  for (const plot of villagePlots(sx, sz)) {
    const x0 = plot.x, x1 = plot.x + 12, z0 = plot.z, z1 = plot.z + 12;
    const zz = (d: number) => (plot.door === 'N' ? z0 + d : z1 - d) + 0.5;
    const rooms: Array<[string, number, number, number]> = [
      ['🛋 Living Room', x0 + 2.5, vh + 3.2, zz(5)],
      ['🍽 Dining Room', x1 - 1.5, vh + 3.2, zz(5)],
      ['🍳 Kitchen', x0 + 6.5, vh + 3.2, zz(10)],
      ['🛏 Bedroom', x0 + 2.5, vh + 8.2, zz(4)],
      ['🛏 Bedroom', x1 - 1.5, vh + 8.2, zz(4)],
      ['🛁 Bathroom', x0 + 6.5, vh + 8.2, zz(11)],
    ];
    for (const [text, lx, ly, lz] of rooms) {
      const sprite = makeTextSprite(text, '#7a5cc4', 1.9);
      sprite.position.set(lx, ly, lz);
      labelsRoot.add(sprite);
    }
  }
  labelsRoot.visible = state.where === 'island';
}
buildRoomLabels();

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
ui.refreshCounts(state);
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
let islandEncoded = '';
let islandEncDirty = true; // re-encode the big island only when its blocks changed
function markDirty(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, 2500); // big worlds take a moment to encode
}
function saveNow(): void {
  state.timeOfDay = timeOfDay;
  if (islandEncDirty || !islandEncoded) {
    islandEncoded = encodeWorld(island);
    islandEncDirty = false;
  }
  writeSave({
    v: 2,
    seed,
    islandSize: island.sizeX,
    islandWorld: islandEncoded,
    castleWorld: castle ? encodeWorld(castle) : undefined,
    shadowWorld: shadow ? encodeWorld(shadow) : undefined,
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
  const lvl = state.level ?? 1;
  if (state.peaceful && lvl >= 2 && lvl <= 10) {
    ui.setGoal('😴 Peaceful mode — enemies are napping. (Wake them in the 🎒 bag.)');
    return;
  }
  if (lvl === 1) {
    if (!state.items.wand) ui.setGoal('⚔️ Level 1: ' + recipeGoal(RECIPES[0]));
    else if (!state.items.broom) ui.setGoal('⚔️ Level 1: ' + recipeGoal(RECIPES[1]));
    else if (!state.items.key) ui.setGoal('⚔️ Level 1: ' + recipeGoal(RECIPES[2]));
    else ui.setGoal('⚔️ Level 1: follow the beam of light east — step through the ruin!');
    return;
  }
  if (lvl === 11) {
    ui.setGoal(state.shadowTouched
      ? '🕊️ Peace… for now.'
      : '🕊️ Peace reigns! Build and celebrate — or dare the 🟣 dark option in your 🎒 bag…');
    return;
  }
  if (lvl >= 16) {
    ui.setGoal('🌈 ETERNAL PEACE. The realm is yours, hero of heroes ✨');
    return;
  }
  const def = LEVELS[lvl];
  const here = state.where === def.realm;
  const whereHint = here ? def.hint : def.realm === 'castle' ? 'They are at the CASTLE — take the portal!' : def.realm === 'shadow' ? 'Enter the dark portal in the castle courtyard!' : 'They roam the ISLAND — head home!';
  ui.setGoal(`${def.emoji} Level ${lvl}: ${def.name} — ${state.levelKills ?? 0}/${def.goal} · ${whereHint}`);
}
updateGoal();

// ---------- block targeting and actions ----------

function reach(): number {
  return state.items.starblade ? 14 : state.items.wand ? 12 : 7;
}

function whackDamage(): number {
  return state.items.starblade ? 4 : state.items.wand ? 2 : 1;
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

/** Treasure chests pop open into random loot — sometimes a whole magic item. */
function openChest(): void {
  const roll = Math.random();
  let msg: string;
  if (roll < 0.06) {
    if (!state.items.wand) {
      state.items.wand = true;
      player.setWandVisible(true);
      msg = '🪄 A WIZARD WAND was sleeping inside!! So lucky!';
    } else if (!state.items.broom) {
      state.items.broom = true;
      ui.setFlyButtonVisible(touch);
      msg = '🧹 A FLYING BROOM was inside!! Press F to fly!';
    } else if (!state.items.key) {
      state.items.key = true;
      msg = '🗝️ The PORTAL KEY was inside!! The stone ring wakes…';
    } else {
      state.foods!.brew += 3;
      msg = '🥤 THREE Butterbrews! Jackpot!';
    }
  } else if (roll < 0.16) {
    state.foods!.brew++;
    msg = '🥤 A Butterbrew!';
  } else if (roll < 0.32) {
    state.foods!.juice++;
    msg = '🧃 A Pumpkin Juice!';
  } else if (roll < 0.55) {
    // rare decorative blocks you can't mine anywhere else
    const decor = [21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35, 36, 37];
    const block = decor[Math.floor(Math.random() * decor.length)];
    const count = 4 + Math.floor(Math.random() * 4);
    state.resources[block] = (state.resources[block] ?? 0) + count;
    msg = `${count}× ${BLOCKS[block].name}!`;
  } else {
    const bundles: Array<[number, number]> = [[CRYSTAL, 3], [TIMBER, 3], [LANTERN, 2], [BLOSSOM, 3], [CARROT, 3], [PUMPKIN, 2]];
    const [block, count] = bundles[Math.floor(Math.random() * bundles.length)];
    state.resources[block] = (state.resources[block] ?? 0) + count;
    msg = `${count}× ${BLOCKS[block].name}!`;
  }
  ui.toast('🎁 ' + msg);
  bumpStat('chestsOpened');
  checkAchievements();
  ui.setItems(state);
  ui.renderCraft(state);
  ui.refreshCounts(state);
  updateGoal();
}

function doBreak(): void {
  if (ui.isCraftOpen()) return;
  if (duelRayTag()) return; // friendly duel tags come first
  // the wand is also a sword: enemies in the crosshair get whacked
  const hit = targetBlock();
  {
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const camDist = camera.position.distanceTo(player.pos);
    const eh = enemies.rayHit(camera.position.x, camera.position.y, camera.position.z, dir.x, dir.y, dir.z, camDist - 0.6);
    if (eh && eh.enemy.pos.distanceTo(player.pos) < reach() + 2 && (!hit || eh.t < hit.t)) {
      const dmg = whackDamage();
      eh.enemy.hit(dmg, player.pos);
      particles.burst(eh.enemy.pos.x, eh.enemy.pos.y + 1, eh.enemy.pos.z, 0xffffff, 6);
      return;
    }
  }
  if (!hit) return;
  if (hit.y === 0) {
    ui.toast('The world base is magic-proof ✨');
    return;
  }
  if (hit.id === CHEST) {
    world.set(hit.x, hit.y, hit.z, AIR);
    voxels.blockChanged(hit.x, hit.z);
    particles.burst(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, 0xffd24a, 16);
    openChest();
    markDirty();
    return;
  }
  const def = BLOCKS[hit.id];
  if (def.hard && !state.items.wand) {
    ui.toast('Too strong for bare hands… craft a Wand 🪄');
    return;
  }
  world.set(hit.x, hit.y, hit.z, AIR);
  voxels.blockChanged(hit.x, hit.z);
  if (state.where === 'island') islandEncDirty = true;
  particles.burst(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, def.color, state.items.wand ? 14 : 10);
  if (state.items.wand) particles.burst(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, 0xf0a6e8, 5);
  // open doors break back into door blocks
  const creditId = hit.id === DOOR_OPEN ? DOOR : hit.id;
  state.resources[creditId] = (state.resources[creditId] ?? 0) + 1;
  bumpStat('blocksBroken');
  collectBlock(creditId);
  checkAchievements();
  ui.renderCraft(state);
  ui.refreshCounts(state);
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
  // survival rules: you place what you've gathered (water is magic, always free)
  if (id !== WATER) {
    if ((state.resources[id] ?? 0) <= 0) {
      ui.toast(`No ${BLOCKS[id].name} in your pouch — mine some first! ⛏️`);
      return;
    }
    state.resources[id]!--;
  }
  world.set(x, y, z, id);
  voxels.blockChanged(x, z);
  if (state.where === 'island') islandEncDirty = true;
  bumpStat('blocksPlaced');
  checkAchievements();
  ui.refreshCounts(state);
  markDirty();
}

// ---------- crafting ----------

function craftRecipe(recipe: Recipe): void {
  if (!craft(state, recipe)) return;
  ui.renderCraft(state);
  ui.setItems(state);
  ui.refreshCounts(state);
  updateGoal();
  saveNow();
  if (recipe.id === 'wand') {
    player.setWandVisible(true);
    ui.toast('🪄 Your wand hums with magic! Long reach, breaks anything.');
  } else if (recipe.id === 'broom') {
    ui.setFlyButtonVisible(touch);
    ui.toast(touch ? '🧹 A flying broom! Tap 🧹 to fly!' : '🧹 A flying broom! Press F to fly!');
  } else if (recipe.id === 'patronus') {
    ui.toast(touch ? '🦌 The Patronus Charm! Tap 🦌 when dementors close in!' : '🦌 The Patronus Charm! Press G when dementors close in!');
  } else if (recipe.id === 'starblade') {
    player.setStarblade(true);
    ui.toast('⭐ The STAR BLADE! Your wand blazes silver — harder hits, longer reach!');
  } else {
    ui.toast('🗝️ Somewhere on the island, old stones begin to glow…');
  }
  particles.burst(player.pos.x, player.pos.y + 1.2, player.pos.z, 0xf0a6e8, 16);
  checkLevelOne();
  checkAchievements();
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
  const nearby = state.where === 'castle' ? npcs : islandNpcs;
  for (const npc of nearby) {
    const d = npc.pos.distanceTo(player.pos);
    if (d < bestDist) {
      best = { kind: 'npc', npc };
      bestDist = d;
    }
  }
  if (state.where === 'island') {
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

/** +1 heart and a sparkle for whoever we're chatting with. */
function bondWith(name: string, x: number, y: number, z: number, color = 0xff6b9d, amount = 1): number {
  state.friendship[name] = (state.friendship[name] ?? 0) + amount;
  particles.burst(x, y, z, color, 4 + amount * 2);
  markDirty();
  return state.friendship[name];
}

const bye = { label: 'Bye! 👋', quiet: true, onPick: () => ui.hideDialogue() };

/** "Would you like to ask them something?" — the big question list. */
function askReply(speaker: Speaker, color: string, x: number, y: number, z: number) {
  return {
    label: '❓ Ask a question',
    onPick: () => {
      ui.hideDialogue();
      ui.showQuestions(QUESTIONS.map((qq) => qq.q), (i) => {
        const ctx = {
          isNight: isNight(),
          level: state.level ?? 1,
          hearts: state.friendship[speaker.name] ?? 0,
          where: state.where as 'island' | 'castle' | 'shadow',
          levelName: LEVELS[state.level ?? 1]?.name ?? 'the adventure',
        };
        const answer = QUESTIONS[i].answer(speaker, ctx);
        bumpStat('questionsAsked');
        checkAchievements();
        const hearts = bondWith(speaker.name, x, y, z);
        ui.showDialogue(speaker.name, color, answer, hearts, [
          askReply(speaker, color, x, y, z),
          bye,
        ]);
      });
    },
  };
}

function speakerForNpc(def: { name: string; trade?: unknown }): Speaker {
  const surname = npcFamily.get(def.name);
  let role: Speaker['role'] = 'villager';
  if (surname === 'Weasley') role = 'weasley';
  else if (def.trade) role = 'trader';
  else if (CHARACTERS.some((c) => c.name === def.name)) role = 'castle-friend';
  else if (HAMLET_FOLK.some((c) => c.name === def.name)) role = 'hamlet';
  else if (def.name === 'Biscuit' || def.name === 'Waffles') role = 'dog';
  return { name: def.name, surname, role };
}

/** Open or close a door (and its partner blocks above/beside it). */
function toggleDoor(x: number, y: number, z: number): void {
  const from = world.get(x, y, z);
  const to = from === DOOR ? DOOR_OPEN : DOOR;
  const queue: Array<[number, number, number]> = [[x, y, z]];
  let flipped = 0;
  while (queue.length && flipped < 8) {
    const [cx, cy, cz] = queue.pop()!;
    if (world.get(cx, cy, cz) !== from) continue;
    world.set(cx, cy, cz, to);
    voxels.blockChanged(cx, cz);
    flipped++;
    queue.push([cx, cy + 1, cz], [cx, cy - 1, cz], [cx + 1, cy, cz], [cx - 1, cy, cz], [cx, cy, cz + 1], [cx, cy, cz - 1]);
  }
  if (state.where === 'island') islandEncDirty = true;
  particles.burst(x + 0.5, y + 0.5, z + 0.5, 0xc89c70, 3);
  markDirty();
}

function talk(): void {
  // a bed at night means sleep; a door means open/close — not chat
  const aimed = targetBlock();
  if (aimed) {
    const aimedId = world.get(aimed.x, aimed.y, aimed.z);
    if (aimedId === BED) {
      trySleep();
      return;
    }
    if (aimedId === DOOR || aimedId === DOOR_OPEN) {
      toggleDoor(aimed.x, aimed.y, aimed.z);
      return;
    }
  }

  const who = nearestTalkable();
  if (!who) return;

  if (who.kind === 'elf') {
    const hearts = state.friendship['Pip'] ?? 0;
    const mode = state.elfMode ?? 'follow';
    ui.showDialogue('Pip', elf.def.nameColor,
      mode === 'follow' ? 'Pip is following! Where to, friend?' : 'Pip is waiting right here, like Pip promised!',
      hearts, [
        {
          label: mode === 'follow' ? 'Stay here, Pip' : 'Follow me, Pip!',
          onPick: () => {
            state.elfMode = mode === 'follow' ? 'stay' : 'follow';
            const h = bondWith('Pip', elf.pos.x, elf.pos.y + 1.2, elf.pos.z);
            ui.showDialogue('Pip', elf.def.nameColor,
              state.elfMode === 'follow' ? elf.def.followLine : elf.def.stayLine, h, [bye]);
          },
        },
        {
          label: "Who's a good elf?",
          onPick: () => {
            const h = bondWith('Pip', elf.pos.x, elf.pos.y + 1.2, elf.pos.z, 0xff6b9d, 2);
            ui.showDialogue('Pip', elf.def.nameColor, 'Pip is!! Pip is a good elf!! Oh, happy day!', h, [bye]);
          },
        },
        askReply({ name: 'Pip', role: 'elf' }, elf.def.nameColor, elf.pos.x, elf.pos.y + 1.2, elf.pos.z),
        bye,
      ]);
    return;
  }

  if (who.kind === 'mermaid') {
    const line = mermaid.def.lines[mermaid.lineIndex % mermaid.def.lines.length];
    mermaid.lineIndex++;
    const hearts = bondWith('Marina', mermaid.pos.x, mermaid.pos.y + 1.6, mermaid.pos.z, 0x7fd4f0);
    ui.showDialogue('Marina', mermaid.def.nameColor, line, hearts, [
      { label: 'Tell me more! 🌊', onPick: () => talk() },
      askReply({ name: 'Marina', role: 'mermaid' }, mermaid.def.nameColor, mermaid.pos.x, mermaid.pos.y + 1.6, mermaid.pos.z),
      bye,
    ]);
    return;
  }

  const npc = who.npc;
  const def = npc.def;
  const sparkle = () => bondWith(def.name, npc.pos.x, npc.pos.y + 1.6, npc.pos.z);
  const moreReply = { label: 'Tell me more!', onPick: () => talk() };
  const npcAsk = askReply(speakerForNpc(def), def.nameColor, npc.pos.x, npc.pos.y + 1.6, npc.pos.z);

  // family bonus: befriend everyone in a household → a gift chest appears
  const checkFamilyGift = () => {
    const surname = npcFamily.get(def.name);
    if (!surname || state.familyGifts!.includes(surname)) return;
    const family = surname === WEASLEYS.surname ? WEASLEYS : FAMILIES.find((f) => f.surname === surname);
    if (!family) return;
    if (family.members.every((m) => (state.friendship[m.name] ?? 0) >= 3)) {
      state.familyGifts!.push(surname);
      const gx = Math.floor(npc.pos.x) + 1, gz = Math.floor(npc.pos.z) + 1;
      const gy = world.surfaceY(gx, gz);
      world.set(gx, gy + 1, gz, CHEST);
      voxels.blockChanged(gx, gz);
      ui.toast(`💝 The ${surname} family adores you! They left you a gift chest!`);
      particles.burst(npc.pos.x, npc.pos.y + 1.8, npc.pos.z, 0xffd24a, 20);
    }
  };

  // shopkeepers: the trade is now a question, not automatic
  if (def.trade) {
    const t = def.trade;
    const have = state.resources[t.takesBlock] ?? 0;
    const hearts = sparkle();
    checkFamilyGift();
    if (have >= t.takesCount) {
      ui.showDialogue(def.name, def.nameColor,
        `Trade ${t.takesCount}× ${BLOCKS[t.takesBlock].name} for one ${t.givesName}?`, hearts, [
          {
            label: 'Yes please! ✨',
            onPick: () => {
              state.resources[t.takesBlock] = (state.resources[t.takesBlock] ?? 0) - t.takesCount;
              state.foods![t.gives]++;
              bumpStat('trades');
              checkAchievements();
              ui.showDialogue(def.name, def.nameColor, t.thanks, state.friendship[def.name] ?? 0, [bye]);
              particles.burst(npc.pos.x, npc.pos.y + 1.6, npc.pos.z, 0xffe27a, 10);
              ui.setItems(state);
              ui.renderCraft(state);
              ui.refreshCounts(state);
              markDirty();
            },
          },
          { label: 'Not now', quiet: true, onPick: () => ui.hideDialogue() },
        ]);
    } else {
      ui.showDialogue(def.name, def.nameColor, def.lines[npc.lineIndex % def.lines.length], hearts, [moreReply, npcAsk, bye]);
      npc.lineIndex++;
    }
    return;
  }

  if (def.wish) {
    const wish = def.wish;
    const wishDone = state.wishesDone.includes(def.name);
    if (!wishDone && (state.resources[wish.block] ?? 0) >= wish.count) {
      const hearts = state.friendship[def.name] ?? 0;
      ui.showDialogue(def.name, def.nameColor, wish.ask, hearts, [
        {
          label: `Give ${wish.count}× ${BLOCKS[wish.block].name} 💝`,
          onPick: () => {
            state.resources[wish.block] -= wish.count;
            state.wishesDone.push(def.name);
            const h = bondWith(def.name, npc.pos.x, npc.pos.y + 1.6, npc.pos.z, 0xff6b9d, 5);
            ui.showDialogue(def.name, def.nameColor, wish.thanks, h, [bye]);
            ui.renderCraft(state);
            ui.refreshCounts(state);
            checkFamilyGift();
            updateGoal();
          },
        },
        { label: 'Maybe later', quiet: true, onPick: () => ui.hideDialogue() },
      ]);
      return;
    }
    if (!wishDone && npc.lineIndex >= 1) {
      const hearts = sparkle();
      ui.showDialogue(def.name, def.nameColor, wish.ask, hearts, [
        { label: "I'll find them! 🔍", onPick: () => { ui.hideDialogue(); ui.toast(`🔍 ${def.name} needs ${wish.count}× ${BLOCKS[wish.block].name}!`); } },
        { label: 'Maybe later', quiet: true, onPick: () => ui.hideDialogue() },
      ]);
      updateGoal();
      return;
    }
  }

  // everyone else: friendly chatter with replies (and duels, for good friends)
  const hearts = sparkle();
  checkFamilyGift();
  const replies = [moreReply, npcAsk, bye];
  if (hearts >= 3 && !duel && !state.peaceful) {
    replies.splice(1, 0, { label: 'Duel me! ⚡', onPick: () => startDuel(npc) });
  }
  ui.showDialogue(def.name, def.nameColor, def.lines[npc.lineIndex % def.lines.length], hearts, replies);
  npc.lineIndex++;
  updateGoal();
}

// ---------- day & night ----------

let timeOfDay = state.timeOfDay ?? 0.1; // 0..1; ~0.1 morning, ~0.6 deep night
const DAY_CYCLE = 480; // seconds for a full day
let daylight = 1;
let nudgedTonight = false;

const fogDay = new THREE.Color(0xffe9f3);
const fogNight = new THREE.Color(0x141733);
const skyNightTint = new THREE.Color(0x2a2d5e);
const skyDayTint = new THREE.Color(0xffffff);

function applyDayNight(dt: number): void {
  timeOfDay = (timeOfDay + dt / DAY_CYCLE) % 1;
  daylight = Math.max(0, Math.min(1, Math.sin(timeOfDay * Math.PI * 2) * 1.6 + 0.45));
  if (state.where === 'shadow') daylight = Math.min(daylight, 0.12); // eternal dusk
  sun.intensity = 0.12 + 0.78 * daylight;
  hemi.intensity = 0.3 + 0.65 * daylight;
  (scene.fog as THREE.Fog).color.lerpColors(fogNight, fogDay, daylight);
  (dome.material as THREE.MeshBasicMaterial).color.lerpColors(skyNightTint, skyDayTint, daylight);
  cloudMat.opacity = 0.92 * Math.max(0.12, daylight);

  if (isNight() && !nudgedTonight) {
    nudgedTonight = true;
    ui.toast('🌙 The stars are out — find a bed! 🛏');
  }
  if (!isNight() && daylight > 0.6) nudgedTonight = false;
}

function isNight(): boolean {
  return daylight < 0.25;
}

// a real night's sleep: lie down, the sleep screen appears, a timer runs,
// and when it ends you may wake to a fresh morning
const SLEEP_SECONDS = 60;
let sleeping = false;
let sleepTimer: number | undefined;

function trySleep(): void {
  if (sleeping) return;
  if (!isNight()) {
    ui.toast('Not sleepy yet — come back after dark 🌙');
    return;
  }
  sleeping = true;
  controls.unlock();
  const overlay = document.getElementById('sleep')!;
  const count = document.getElementById('sleep-count')!;
  const wake = document.getElementById('wake-btn') as HTMLButtonElement;
  overlay.hidden = false;
  wake.disabled = true;
  let remaining = SLEEP_SECONDS;
  count.textContent = `Wake up in ${remaining}s`;
  window.clearInterval(sleepTimer);
  sleepTimer = window.setInterval(() => {
    remaining--;
    if (remaining > 0) {
      count.textContent = `Wake up in ${remaining}s`;
    } else {
      window.clearInterval(sleepTimer);
      count.textContent = 'The sun is rising… ☀️';
      wake.disabled = false;
    }
  }, 1000);
}

function wakeUp(): void {
  if (!sleeping) return;
  sleeping = false;
  window.clearInterval(sleepTimer);
  document.getElementById('sleep')!.hidden = true;
  timeOfDay = 0.08; // a fresh morning
  state.health = MAX_HEALTH;
  ui.setHearts(state.health);
  ui.toast('Good morning! ☀️ All hearts restored.');
  bumpStat('sleeps');
  checkAchievements();
  markDirty();
}
document.getElementById('wake-btn')!.addEventListener('click', wakeUp);

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
  ui.refreshCounts(state);
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
    const home = realmHome(state.where as Realm);
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

// ---------- stats, achievements, and daily gifts ----------

function bumpStat(key: string, n = 1): void {
  state.stats![key] = (state.stats![key] ?? 0) + n;
}

let achievementToastQueue = 0;
function checkAchievements(): void {
  for (const a of ACHIEVEMENTS) {
    if (state.achievements!.includes(a.id)) continue;
    if (!a.check(state, state.stats!)) continue;
    state.achievements!.push(a.id);
    const delay = achievementToastQueue++ * 2200;
    window.setTimeout(() => {
      ui.toast(`🏆 Trophy earned: ${a.emoji} ${a.name}!`);
      particles.burst(player.pos.x, player.pos.y + 2.5, player.pos.z, 0xffd24a, 18);
      achievementToastQueue = Math.max(0, achievementToastQueue - 1);
    }, delay);
    markDirty();
  }
}

function collectBlock(id: number): void {
  if (!state.collected!.includes(id)) {
    state.collected!.push(id);
    const total = state.collected!.length;
    if (total % 5 === 0) ui.toast(`📦 Compendium: ${total} block types collected!`);
  }
}

/** The Daily Owl: one small gift per real day, with a streak. */
function dailyOwl(): void {
  const today = new Date().toDateString();
  if (state.lastGiftDay === today) return;
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  state.giftStreak = state.lastGiftDay === yesterday ? (state.giftStreak ?? 0) + 1 : 1;
  state.lastGiftDay = today;
  const gifts: Array<[number, number]> = [[CRYSTAL, 2], [TIMBER, 2], [LANTERN, 1], [CARROT, 3], [BLOSSOM, 2]];
  const [block, count] = gifts[Math.floor(Math.random() * gifts.length)];
  state.resources[block] = (state.resources[block] ?? 0) + count;
  if ((state.giftStreak ?? 0) % 3 === 0) state.foods!.juice++;
  window.setTimeout(() => {
    ui.toast(`🦉 The Daily Owl! Day ${state.giftStreak} streak — ${count}× ${BLOCKS[block].name} in your pouch!`);
    ui.refreshCounts(state);
    checkAchievements();
  }, 4000);
  markDirty();
}

// Pip sniffs out little treasures while he follows you
let pipFindTimer = 150 + Math.random() * 120;
function pipFinds(dt: number): void {
  if (state.pipKidnapped || (state.elfMode ?? 'follow') !== 'follow' || state.where !== 'island') return;
  pipFindTimer -= dt;
  if (pipFindTimer > 0) return;
  pipFindTimer = 150 + Math.random() * 150;
  const finds: Array<[number, number]> = [[CRYSTAL, 1], [TIMBER, 1], [BLOSSOM, 1], [CARROT, 2]];
  const [block, count] = finds[Math.floor(Math.random() * finds.length)];
  state.resources[block] = (state.resources[block] ?? 0) + count;
  particles.burst(elf.pos.x, elf.pos.y + 1, elf.pos.z, 0xffd24a, 8);
  ui.toast(`🐾 Pip dug up ${count}× ${BLOCKS[block].name}! Good elf!`);
  ui.refreshCounts(state);
  markDirty();
}

// ---------- the campaign: enemies, levels, bosses ----------

const enemies = new EnemyManager(scene);
let iframes = 0; // global player invulnerability window
let drainTier = -1;
let patronusCooldown = 0;

function damagePlayer(amount: number, why: string): void {
  if (iframes > 0 || state.peaceful || amount <= 0) return;
  iframes = 1.0;
  takeDamage(amount, `${why} got you!`);
}

const enemyCtx = {
  world: () => world,
  playerPos: player.pos,
  isNight,
  damagePlayer,
  onDefeated: (kind: EnemyKind, pos: THREE.Vector3) => {
    const def = LEVELS[state.level ?? 1];
    if (def?.enemy === kind && !state.peaceful) {
      state.levelKills = (state.levelKills ?? 0) + 1;
      if (state.levelKills >= def.goal) {
        levelComplete();
      } else {
        ui.toast(`${def.emoji} ${KINDS[kind].label} freed! ${state.levelKills}/${def.goal}`);
      }
    }
    bumpStat('kills');
    checkAchievements();
    // little victory loot (shadow enemies drop shadow ore!)
    if (Math.random() < 0.3) {
      const lootId = state.shadowTouched ? VOIDCRYSTAL : CRYSTAL;
      state.resources[lootId] = (state.resources[lootId] ?? 0) + 1;
      collectBlock(lootId);
      ui.refreshCounts(state);
    }
    void pos;
    updateGoal();
    markDirty();
  },
  burst: (x: number, y: number, z: number, color: number, n: number) => particles.burst(x, y, z, color, n),
  summon: (kind: EnemyKind, n: number, around: THREE.Vector3) => {
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      enemies.spawn(kind, around.x + Math.cos(angle) * 4, around.y + 1, around.z + Math.sin(angle) * 4);
    }
  },
  fireAtPlayer: (from: THREE.Vector3, count: number) => {
    for (let i = 0; i < count; i++) enemies.fireBolt(from, player.pos, count > 1 ? 0.5 : 0.12);
  },
};

function isSafeZone(x: number, z: number): boolean {
  if (state.where === 'island') {
    if (Math.hypot(x - spawn.x, z - spawn.z) < 32) return true; // the village
    return nearGate(x, z);
  }
  if (state.where === 'castle') return avoidCastleFootprint(x, z);
  return Math.hypot(x - SHADOW_SPAWN.x, z - SHADOW_SPAWN.z) < 8;
}

const CONCURRENT: Partial<Record<EnemyKind, number>> = {
  slime: 4, werewolf: 3, pixie: 5, spider: 3, troll: 2, dementor: 3, deatheater: 3,
};

function updateCampaign(dt: number): void {
  iframes = Math.max(0, iframes - dt);
  patronusCooldown = Math.max(0, patronusCooldown - dt);
  if (state.peaceful) {
    if (enemies.alive() > 0) enemies.clear();
    updateDrainFX(0);
    ui.setBoss(null);
    return;
  }
  const lvl = state.level ?? 1;
  const def = LEVELS[lvl];
  enemies.update(dt, enemyCtx);

  if (def?.enemy && state.where === def.realm) {
    if (def.enemy === 'basilisk' || def.enemy === 'voldemort') {
      if (enemies.alive(def.enemy) === 0 && (state.levelKills ?? 0) < def.goal) {
        if (def.enemy === 'basilisk') {
          const bx = islandGate.x + 8, bz = islandGate.z + 8;
          if (Math.hypot(player.pos.x - bx, player.pos.z - bz) < 45) {
            const by = world.surfaceY(bx, bz);
            enemies.spawn('basilisk', bx, by + 1, bz);
            ui.toast('🐍 The ground trembles…');
          }
        } else {
          enemies.spawn('voldemort', 32.5, 13, 44.5, lvl >= 12);
          ui.toast(lvl >= 12 ? '⚡ "You cannot defeat a SHADOW, little builder…"' : '⚡ "So. The little builder has come."');
        }
      }
    } else {
      const remaining = def.goal - (state.levelKills ?? 0);
      const want = Math.min(CONCURRENT[def.enemy] ?? 3, Math.max(1, remaining));
      const nightBoost = def.enemy === 'werewolf' && isNight() ? 1 : 0;
      enemies.maintain(def.enemy, want + nightBoost, dt, enemyCtx, isSafeZone, lvl >= 12);
    }
  }

  // boss bar
  const boss = enemies.enemies.find((e) => !e.dead && (e.kind === 'basilisk' || e.kind === 'voldemort'));
  ui.setBoss(boss ? boss.label : null, boss ? boss.hp / boss.maxHp : 1);

  // dementors chill the air (and the screen) — but never finish you off
  let nearest = 99;
  for (const e of enemies.enemies) {
    if (e.kind !== 'dementor' || e.dead || e.stunned > 0) continue;
    nearest = Math.min(nearest, e.pos.distanceTo(player.pos));
  }
  if (nearest < 9) {
    drainTimer -= dt;
    if (drainTimer <= 0) {
      drainTimer = 2;
      if ((state.health ?? MAX_HEALTH) > 1) {
        state.health = state.health! - 1;
        ui.setHearts(state.health);
      }
    }
    updateDrainFX(nearest < 3.5 ? 3 : nearest < 6 ? 2 : 1);
  } else {
    drainTimer = 1;
    updateDrainFX(0);
  }
}

let drainTimer = 1;
function updateDrainFX(tier: number): void {
  if (tier === drainTier) return;
  drainTier = tier;
  const el = renderer.domElement;
  el.classList.remove('drain-1', 'drain-2', 'drain-3');
  if (tier > 0) el.classList.add(`drain-${tier}`);
}

/** The ⚔️ button: whack the nearest enemy — no aiming needed (tablet-friendly). */
function autoAttack(): void {
  if (state.peaceful) return;
  let best: import('./enemies').Enemy | null = null;
  let bestDist = reach() + 2;
  for (const enemy of enemies.enemies) {
    if (enemy.dead) continue;
    const d = enemy.pos.distanceTo(player.pos);
    if (d < bestDist) {
      best = enemy;
      bestDist = d;
    }
  }
  if (!best) {
    doBreak(); // no enemy nearby — behave like a normal whack
    return;
  }
  const dmg = whackDamage();
  best.hit(dmg, player.pos);
  particles.burst(best.pos.x, best.pos.y + 1, best.pos.z, 0xffffff, 6);
}

function nearestEnemyDist(): number {
  let d = 99;
  for (const enemy of enemies.enemies) {
    if (!enemy.dead) d = Math.min(d, enemy.pos.distanceTo(player.pos));
  }
  return d;
}

function patronus(): void {
  if (!state.items.patronus) {
    ui.toast('You need the Patronus Charm — check the crafting bag 🎒');
    return;
  }
  if (patronusCooldown > 0) return;
  patronusCooldown = 3;
  for (let ring = 0; ring < 3; ring++) {
    window.setTimeout(() => {
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        const r = 2 + ring * 3;
        particles.burst(player.pos.x + Math.cos(angle) * r, player.pos.y + 1.2, player.pos.z + Math.sin(angle) * r, 0xcfeaff, 2);
      }
    }, ring * 120);
  }
  const repelled = enemies.repelDementors(player.pos, 13);
  ui.toast(repelled > 0 ? `🦌 EXPECTO! ${repelled} dementor${repelled > 1 ? 's' : ''} flee the light!` : '🦌 A burst of silver light!');
}

function checkLevelOne(): void {
  if ((state.level ?? 1) !== 1) return;
  if (state.items.wand && state.items.broom && state.items.key && state.castleVisited) {
    levelUp(2);
  }
}

function levelUp(next: number): void {
  state.level = next;
  state.levelKills = 0;
  const def = LEVELS[next];
  if (def?.intro) ui.toast(def.intro);
  for (let i = 0; i < 3; i++) {
    window.setTimeout(() => particles.burst(player.pos.x, player.pos.y + 2 + i, player.pos.z, [0xffd24a, 0xf0a6e8, 0x7fd4f0][i], 16), i * 200);
  }
  if (next === 9) {
    state.pipKidnapped = true;
    elf.group.visible = false;
    window.setTimeout(() => ui.toast('😱 PIP IS GONE! The Death Eaters took him! Defeat them all!'), 2600);
  }
  if (next === 10 && castle) {
    ensureShadowGate(castle);
    if (state.where === 'castle') voxels.blockChanged(CASTLE_SHADOW_GATE.x, CASTLE_SHADOW_GATE.z);
  }
  updateGoal();
  saveNow();
}

function levelComplete(): void {
  const lvl = state.level ?? 1;
  if (lvl === 3) {
    // calmed werewolves become village dogs!
    const dogDefs = [
      { name: 'Biscuit', robe: 0xa8825a, hair: 0x8a6a4a },
      { name: 'Waffles', robe: 0x8a6a4a, hair: 0x6e5a3c },
    ];
    for (const dog of dogDefs) {
      const npc = new NPC({
        name: dog.name, robe: dog.robe, hair: dog.hair, nameColor: '#8a6a4a',
        spot: [spawn.x + (Math.random() - 0.5) * 8, spawn.z + (Math.random() - 0.5) * 8],
        indoor: [spawn.x, spawn.z],
        lines: ['Woof!', 'Woof woof! 🐾', '*happy tail wags*'],
      });
      npc.pos.y = spawn.y;
      npc.group.scale.setScalar(0.55);
      scene.add(npc.group);
      npc.group.visible = state.where === 'island';
      islandNpcs.push(npc);
    }
    ui.toast('🐶 Two calmed werewolves became village dogs: Biscuit & Waffles!');
  }
  if (lvl === 9) {
    state.pipKidnapped = false;
    elf.group.visible = true;
    elf.teleportTo(player.pos);
    state.friendship['Pip'] = (state.friendship['Pip'] ?? 0) + 5;
    ui.toast('🎉 PIP IS FREE! He does a little dance of joy!');
    particles.burst(elf.pos.x, elf.pos.y + 1.2, elf.pos.z, 0xff6b9d, 24);
  }
  if (lvl === 10) {
    victory();
    return;
  }
  if (lvl === 15) {
    victory2();
    return;
  }
  levelUp(lvl + 1);
}

function victory2(): void {
  state.level = 16;
  state.levelKills = 0;
  // a rainbow beacon rises beside the golden statue
  const bx = Math.floor(spawn.x) - 3, bz = Math.floor(spawn.z) + 3;
  const by = island.surfaceY(bx, bz);
  for (let i = 1; i <= 7; i++) island.set(bx, by + i, bz, 26);
  island.set(bx, by + 8, bz, MOONSILVER);
  if (state.where === 'island') voxels.blockChanged(bx, bz);
  islandEncDirty = true;
  for (let i = 0; i < 10; i++) {
    window.setTimeout(() => {
      particles.burst(
        player.pos.x + (Math.random() - 0.5) * 16,
        player.pos.y + 4 + Math.random() * 8,
        player.pos.z + (Math.random() - 0.5) * 16,
        [0xe06a6a, 0xf0a04a, 0xf7d44a, 0x6ec46e, 0x5fa8e0, 0xa87ad6][i % 6], 24,
      );
    }, i * 300);
  }
  ui.toast(LEVELS[16].intro);
  window.setTimeout(() => ui.toast('🌈 A rainbow beacon now shines over your village. Forever.'), 3400);
  window.setTimeout(() => ui.toast('Thank you for saving the realm TWICE. Keep building, hero of heroes! 💛'), 6800);
  ui.setBoss(null);
  checkAchievements();
  updateGoal();
  saveNow();
}

function victory(): void {
  state.level = 11;
  state.levelKills = 0;
  // a golden statue rises on the village plaza
  const sx = Math.floor(spawn.x) + 3, sz = Math.floor(spawn.z) + 3;
  const sy = island.surfaceY(sx, sz);
  island.set(sx, sy + 1, sz, 23); // marble pedestal
  island.set(sx, sy + 2, sz, 25); // sun-stone hero
  island.set(sx, sy + 3, sz, 25);
  island.set(sx, sy + 4, sz, 9); // a lantern crown
  if (state.where === 'island') voxels.blockChanged(sx, sz);
  islandEncDirty = true;
  for (let i = 0; i < 8; i++) {
    window.setTimeout(() => {
      particles.burst(
        player.pos.x + (Math.random() - 0.5) * 14,
        player.pos.y + 4 + Math.random() * 6,
        player.pos.z + (Math.random() - 0.5) * 14,
        [0xffd24a, 0xf0a6e8, 0x7fd4f0, 0x7be0a0][i % 4], 22,
      );
    }, i * 350);
  }
  ui.toast(LEVELS[11].intro);
  window.setTimeout(() => ui.toast('🏆 A golden statue of YOU now stands in the village!'), 3200);
  window.setTimeout(() => ui.toast('Thank you for saving the realm, hero. Keep building! 💛'), 6400);
  window.setTimeout(() => ui.toast('…but a dark whisper lingers. Something new waits in your 🎒 bag.'), 9800);
  ui.setBoss(null);
  updateGoal();
  saveNow();
}

// ---------- friendly duels at the village green ----------

let duel: { npc: NPC; mine: number; theirs: number; tagTimer: number } | null = null;

function startDuel(npc: NPC): void {
  duel = { npc, mine: 0, theirs: 0, tagTimer: 2.5 };
  ui.hideDialogue();
  ui.toast(`⚡ DUEL with ${npc.def.name}! First to 3 tags — click them!`);
}

function updateDuel(dt: number): void {
  if (!duel) return;
  const npc = duel.npc;
  if (npc.pos.distanceTo(player.pos) > 24) {
    ui.toast('The duel fizzles — too far apart!');
    duel = null;
    return;
  }
  duel.tagTimer -= dt;
  if (duel.tagTimer <= 0) {
    duel.tagTimer = 2.2 + Math.random() * 1.4;
    enemies.fireBolt(npc.pos, player.pos, 0.35, true);
    // friendly spark: a tag if you stand still, dodge by moving!
    const speed = Math.hypot(player.vel.x, player.vel.z);
    if (speed < 1.2) {
      duel.theirs++;
      ui.hurtFlash();
      ui.toast(`⚡ Tagged! You ${duel.mine} — ${duel.theirs} ${npc.def.name}`);
    }
  }
  if (duel.mine >= 3 || duel.theirs >= 3) {
    const won = duel.mine >= 3;
    particles.burst(player.pos.x, player.pos.y + 2, player.pos.z, won ? 0xffd24a : 0xb9a8ee, 24);
    state.friendship[npc.def.name] = (state.friendship[npc.def.name] ?? 0) + 2;
    if (won) { state.foods!.juice++; bumpStat('duelsWon'); checkAchievements(); }
    ui.setItems(state);
    ui.toast(won ? `🏆 You win the duel! ${npc.def.name} hands you a juice. GG!` : `😄 ${npc.def.name} wins! "Best of luck next time!"`);
    duel = null;
    markDirty();
  }
}

/** Ray-test a friendly duel partner (same slab math as enemies). */
function duelRayTag(): boolean {
  if (!duel) return false;
  const dir = camera.getWorldDirection(new THREE.Vector3());
  const npc = duel.npc;
  const minX = npc.pos.x - 0.5, maxX = npc.pos.x + 0.5;
  const minY = npc.pos.y, maxY = npc.pos.y + 1.9;
  const minZ = npc.pos.z - 0.5, maxZ = npc.pos.z + 0.5;
  let tmin = 0, tmax = 40;
  const o = [camera.position.x, camera.position.y, camera.position.z];
  const d = [dir.x, dir.y, dir.z];
  const lo = [minX, minY, minZ], hi = [maxX, maxY, maxZ];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < lo[i] || o[i] > hi[i]) return false;
    } else {
      let t1 = (lo[i] - o[i]) / d[i], t2 = (hi[i] - o[i]) / d[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  duel.mine++;
  duel.npc.lineIndex++;
  particles.burst(npc.pos.x, npc.pos.y + 1.4, npc.pos.z, 0xf0a6e8, 8);
  ui.toast(`⚡ Tag! You ${duel.mine} — ${duel.theirs} ${npc.def.name}`);
  if (duel.mine >= 3) updateDuel(0);
  return true;
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

function travel(to: Realm): void {
  traveling = true;
  fadeEl.classList.add('show');
  window.setTimeout(() => {
    state.where = to;
    world = realmWorld(to);
    enemies.clear();
    npcRoot.visible = to === 'castle';
    mermaid.group.visible = to === 'island';
    labelsRoot.visible = to === 'island';
    for (const npc of islandNpcs) npc.group.visible = to === 'island';
    player.setFlying(false);
    ui.setDownVisible(false);
    player.vel.set(0, 0, 0);
    if (to === 'castle') {
      player.pos.set(CASTLE_SPAWN.x, CASTLE_SPAWN.y, CASTLE_SPAWN.z);
      state.castleVisited = true;
      ui.toast('🏰 Welcome to the castle!');
    } else if (to === 'island') {
      player.pos.set(islandGate.x + 1.5, islandGate.y, islandGate.z + 2.5);
      ui.toast('🏝️ Home again!');
    } else {
      player.pos.set(SHADOW_SPAWN.x, SHADOW_SPAWN.y, SHADOW_SPAWN.z);
      ui.toast('🌑 The Shadow Realm. He knows you are here.');
    }
    voxels.setWorld(world, player.pos.x, player.pos.z);
    wasInGate = true; // don't bounce straight back
    if (!state.pipKidnapped) elf.teleportTo(player.pos); // Pip comes along through the portal
    checkLevelOne();
    updateGoal();
    saveNow();
    window.setTimeout(() => fadeEl.classList.remove('show'), 150);
    traveling = false;
  }, 420);
}

interface PortalRoute { gate: Gate; to: Realm; locked?: () => string | null }
function portalRoutes(): PortalRoute[] {
  switch (state.where as Realm) {
    case 'island':
      return [{
        gate: islandGate, to: 'castle',
        locked: () => (state.items.key ? null : 'The stone ring sleeps… it wants a Portal Key 🗝️'),
      }];
    case 'castle': {
      const routes: PortalRoute[] = [{ gate: CASTLE_GATE, to: 'island' }];
      if ((state.level ?? 1) >= 10) routes.push({ gate: CASTLE_SHADOW_GATE, to: 'shadow' });
      return routes;
    }
    case 'shadow':
      return [{ gate: SHADOW_RETURN_GATE, to: 'castle' }];
  }
}

function checkPortals(): void {
  if (traveling) return;
  let anyInside = false;
  for (const route of portalRoutes()) {
    if (!inGate(route.gate, player.pos)) continue;
    anyInside = true;
    if (wasInGate) break;
    wasInGate = true;
    const lockMsg = route.locked?.();
    if (lockMsg) ui.toast(lockMsg);
    else travel(route.to);
    break;
  }
  if (!anyInside) wasInGate = false;
}

// portal sparkle so it reads as magical from far away
let sparkleTimer = 0;
function portalSparkle(dt: number): void {
  sparkleTimer -= dt;
  if (sparkleTimer > 0) return;
  sparkleTimer = 0.4;
  const route = portalRoutes()[0];
  if (!route) return;
  const gate = route.gate;
  const active = state.where !== 'island' || state.items.key;
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
controls.onPatronus = patronus;
ui.onEat = eat;
ui.onPatronusChip = patronus;

// ---------- Shadow-Touched mode: the world remixed after victory ----------

function shadowOrePass(w: World): void {
  if (w.data.includes(VOIDCRYSTAL)) return;
  for (let i = 0; i < w.data.length; i++) {
    if (w.data[i] !== 3) continue; // only old stone
    const r = Math.random();
    if (r < 0.02) w.data[i] = VOIDCRYSTAL;
    else if (r < 0.026) w.data[i] = MOONSILVER;
  }
}

function beginShadowTouched(): void {
  if (state.shadowTouched) return;
  state.shadowTouched = true;
  shadowOrePass(island);
  if (castle) shadowOrePass(castle);
  islandEncDirty = true;
  voxels.setWorld(world, player.pos.x, player.pos.z); // remesh with the new ores
  ui.setShadowButton(false);
  ui.toggleCraft(false);
  levelUp(12);
  window.setTimeout(() => ui.toast('💎 Void Crystal and Moon Silver now hide in old stone. Re-mine EVERYTHING!'), 3000);
  checkAchievements();
  saveNow();
}

function refreshBagExtras(): void {
  ui.setShadowButton((state.level ?? 1) >= 11 && !state.shadowTouched);
  ui.setWorldCode(seed.toString(36).toUpperCase());
}

ui.onShadowMode = beginShadowTouched;

ui.onPeaceful = (on) => {
  state.peaceful = on;
  if (on) {
    enemies.clear();
    updateDrainFX(0);
    ui.setBoss(null);
    duel = null;
    ui.toast('😴 Enemies are napping. Build in peace!');
  } else {
    ui.toast('⚔️ Enemies are awake again. Brave hero!');
  }
  updateGoal();
  markDirty();
};
ui.setPeacefulBox(state.peaceful ?? false);
if (levelToastPending) {
  const msg = levelToastPending;
  window.setTimeout(() => ui.toast(msg), 1500);
}
player.setStarblade(state.items.starblade);
refreshBagExtras();
dailyOwl();
checkAchievements();

ui.onSelect = (i) => ui.select(i);
ui.onStart = () => { if (!touch) controls.lock(); };
ui.onCraft = craftRecipe;
ui.onFlyChip = toggleFly;
ui.onCraftToggle = (open) => {
  if (open) {
    controls.unlock();
    ui.renderCraft(state);
    refreshBagExtras();
  }
};
ui.onReset = () => {
  clearSave();
  // shareable seed codes: type a friend's code to grow THEIR island
  const code = window.prompt('🌱 Type a world code to grow a friend\'s island — or leave blank for a surprise:', '');
  const parsed = code && /^[0-9a-z]+$/i.test(code.trim()) ? parseInt(code.trim().toLowerCase(), 36) | 0 : NaN;
  seed = Number.isFinite(parsed) && parsed !== 0 ? parsed : (Math.random() * 2 ** 31) | 0;
  const keepPeaceful = state.peaceful ?? false; // a worried parent's setting survives
  Object.assign(state, defaultState());
  state.peaceful = keepPeaceful;
  enemies.clear();
  duel = null;
  shadow = null;
  ui.setBoss(null);
  updateDrainFX(0);
  islandEncDirty = true;
  island = new World(ISLAND_SIZE, ISLAND_SIZE); // new islands grow BIG
  generateIsland(island, seed);
  islandGate = buildIslandPortal(island);
  spawn = findSpawn(island);
  floraPass(island, Math.round(3 * island.sizeX / 64), nearGate);
  cropsPass(island, nearGate);
  treasurePass(island, spawn, nearGate);
  const mspot = findMermaidSpot(island);
  mermaid.setHome(mspot.x, mspot.z);
  mermaid.group.visible = true;
  castle = null;
  world = island;
  npcRoot.visible = false;
  hamletSites = findHamletSites(island, spawn);
  placeIslandVillagers();
  buildRoomLabels();
  for (const npc of islandNpcs) npc.group.visible = true;
  const s = spawn;
  player.pos.set(s.x, s.y, s.z);
  voxels.setWorld(island, s.x, s.z);
  elf.teleportTo(player.pos);
  player.vel.set(0, 0, 0);
  player.setFlying(false);
  player.setWandVisible(false);
  ui.setItems(state);
  ui.renderCraft(state);
  ui.setFlyButtonVisible(false);
  ui.setDownVisible(false);
  ui.refreshCounts(state);
  refreshBagExtras();
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
    patronus,
    fight: autoAttack,
    inventory: () => ui.toggleInventory(),
  });
  document.body.classList.add('touch'); // hides the bulky hotbar; the inventory replaces it
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

  if (sleeping) {
    // the world holds its breath while you sleep
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
    return;
  }

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
    const home = realmHome(state.where as Realm);
    player.pos.set(home.x, home.y + 2, home.z);
    player.vel.set(0, 0, 0);
  }

  applyDayNight(dt);

  if (state.where === 'castle') {
    for (const npc of npcs) npc.update(dt, world, player.pos, isNight());
  } else {
    mermaid.update(dt, world, player.pos);
    for (const npc of islandNpcs) {
      // only the villagers near you need to think
      if (npc.pos.distanceToSquared(player.pos) < 70 * 70) npc.update(dt, world, player.pos, isNight());
    }
  }
  elf.update(dt, world, player.pos, state.elfMode ?? 'follow');

  voxels.update(player.pos.x, player.pos.z, 3); // stream the world in around the player
  dome.position.copy(camera.position); // the sky travels with you

  checkWillowWhomp(dt);
  updateCampaign(dt);
  updateDuel(dt);
  pipFinds(dt);
  if (touch) {
    ui.setPatronusVisible(state.items.patronus && (state.level ?? 1) >= 8);
    ui.setFightVisible(!state.peaceful && nearestEnemyDist() < 12);
  }
  checkPortals();
  portalSparkle(dt);
  updateCamera(dt);

  const hit = targetBlock();
  highlight.visible = !!hit;
  if (hit) highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  if (touch) {
    const aimedId = hit ? world.get(hit.x, hit.y, hit.z) : AIR;
    const interactable = aimedId === BED || aimedId === DOOR || aimedId === DOOR_OPEN;
    ui.setTalkVisible(!!nearestTalkable() || interactable);
  }

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
  doBreak, doPlace, talk, toggleFly, travel, craftRecipe, targetBlock, trySleep,
  enemies, patronus, levelUp, levelComplete,
  setLevel: (n: number) => { state.level = n; state.levelKills = 0; updateGoal(); },
  setTime: (t: number) => { timeOfDay = t; },
  get timeOfDay() { return timeOfDay; },
  get daylight() { return daylight; },
  islandNpcs: () => islandNpcs,
  get islandGate() { return islandGate; },
  get seed() { return seed; },
};

export {};
