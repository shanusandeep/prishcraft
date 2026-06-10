# ✨ SpellCraft — The Castle Update

A cozy, kid-friendly voxel sandbox that runs in the browser. You start on a
small magical island where you walk, jump, break blocks, and build with 14
pastel block types. Breaking blocks fills your **pouch**, and from the pouch
you craft three magical items:

1. **🪄 Wizard Wand** — the all-in-one tool: breaks *any* block (stone-family
   blocks are too hard for bare hands) and doubles your reach.
2. **🧹 Flying Broom** — press `F` to fly: Space rises, Shift sinks.
3. **🗝️ Portal Key** — wakes the mysterious stone ring on the east side of
   the island…

Step through the awakened ring and you arrive at the **castle realm**: a
walled castle with four towers (spiral stairs inside, flag on top), a great
hall with feast tables and lantern-lit columns, a library, banners, and a
courtyard. Four friendly characters live there — walk up and press `E` to
talk. Chat enough and they each share a little wish (bring me 3 Star
Lanterns…); grant it and your friendship hearts jump. The return portal in
the courtyard takes you home.

All art is original procedural pixel art. The character names live in one
file ([src/characters.ts](src/characters.ts)) — they're fine for a private
family build, but **rename them there before ever sharing or publishing**.

Built with **TypeScript + Three.js + Vite**. No backend, no accounts, no
network — the island saves itself to the browser's localStorage.

## Run it

```bash
npm install
npm run dev        # then open the printed http://localhost:5173 (or PORT)
```

Other commands: `npm run build` (typecheck + production build into `dist/`),
`npm run preview` (serve the built version). The `dist/` folder is plain
static files — host it anywhere (or open via any static file server) to put
it on the kids' devices.

## Controls

| Desktop | Touch (iPad etc.) |
| --- | --- |
| `W A S D` walk, `Space` jump | left joystick walk, ⬆️ jump |
| Mouse (pointer lock) or arrow keys to look | drag anywhere to look |
| Left click break, right click place | ⛏️ break, 🧱 place buttons |
| `1`–`0` or scroll wheel to pick a block | tap the hotbar |
| `C` open crafting | tap 🎒 |
| `E` talk to a friend | 💬 button (appears near friends) |
| `F` fly (with broom), `Shift` to sink | 🧹 button, ⬇️ to sink |

The 🌱 **New Island** button (top right) erases everything and grows a fresh
island from a new seed (it asks first).

## How it works, file by file

| File | What it does |
| --- | --- |
| [src/main.ts](src/main.ts) | Wires everything together: scene, sky dome, clouds, lights, the game loop, camera follow (with terrain occlusion), block targeting, break/place actions, auto-save. |
| [src/world.ts](src/world.ts) | The voxel data. The whole 64×48×64 island is one flat `Uint8Array` of block ids (~196 KB), indexed `x + z*64 + y*64*64`. |
| [src/blocks.ts](src/blocks.ts) | The block registry: 10 block types with their atlas tiles, material bucket (opaque / glass / glow), solidity, and particle color. |
| [src/textures.ts](src/textures.ts) | Draws all 12 texture tiles (16×16 px each) onto one canvas atlas at startup — pure procedural pixel art, zero asset files. Also makes the hotbar icons. |
| [src/terrain.ts](src/terrain.ts) | Island generation: seeded value-noise heightmap with a radial falloff (so it's an island in a sea), beaches near the waterline, trees, crystal clusters, star lanterns, blossom bushes. Same seed → same island. |
| [src/mesher.ts](src/mesher.ts) | Turns voxel data into renderable geometry. The world is 4×4 chunks of 16×16 columns; only faces touching air/see-through blocks are emitted, with per-face shading baked into vertex colors. Editing a block rebuilds just its chunk. Glow blocks use an unlit material so they look bright. |
| [src/raycast.ts](src/raycast.ts) | Amanatides–Woo voxel traversal: steps the camera ray cell by cell to find the targeted block and which face was hit (that face's normal is where a new block goes). |
| [src/player.ts](src/player.ts) | The cute avatar (boxes + a canvas-drawn face) and physics: per-axis AABB collision against the voxel grid, gravity, jumping, gentle swimming in water, walk animation, invisible walls at the map edge. |
| [src/controls.ts](src/controls.ts) | Keyboard + pointer-lock mouse input. |
| [src/touch.ts](src/touch.ts) | On-screen joystick, look-drag, and jump/break/place buttons for tablets. |
| [src/save.ts](src/save.ts) | Persistence: world bytes are run-length encoded → base64 → localStorage (a few KB). Saves ~1 s after any edit, on tab hide, and on close. |
| [src/effects.ts](src/effects.ts) | Tiny cube-confetti burst when a block breaks (and hearts when you make friends). |
| [src/ui.ts](src/ui.ts) | Hotbar, quest banner, item chips, crafting panel, dialogue card, toasts, welcome card. |
| [src/state.ts](src/state.ts) | Game progression: the resource pouch, the three recipes, craft logic, friendship, which realm you're in. |
| [src/castle.ts](src/castle.ts) | Generates the entire castle realm: plateau terrain, perimeter walls and battlements, four towers with spiral stairs, the great hall, library, banners, and the return portal. |
| [src/characters.ts](src/characters.ts) | The castle friends — names, robe colors, dialogue lines, and wishes. **Rename here before sharing the game publicly.** |
| [src/npc.ts](src/npc.ts) | Friend behavior: wandering near home, walking around (not through) furniture, facing you when you approach. |
| [src/avatar.ts](src/avatar.ts) | The shared blocky character builder (face, limbs, name labels) used by the player and every friend. |

**Block placement/breaking in one paragraph:** every frame a ray is cast from
the camera through the screen center; the first solid block within reach gets
a white outline. Break sets that cell to air; place writes the selected block
into the neighbor cell on the hit face (refusing to build inside the player or
break the magic-proof bottom layer). The affected 16×16 chunk remeshes in
about a millisecond.

## What to test with the kids

Watch silently for 10 minutes. Specifically look for:

1. Do they understand walking/looking within 60 seconds, unprompted?
2. First instinct — dig down, build up, or explore? (That hints whether
   Phase 1 should lean building tools or exploration.)
3. Does the 6-year-old manage the camera? If he struggles, Phase 1 should add
   an auto-camera or bigger touch buttons.
4. Do they ask "can I…?" questions — pets? water? colors? Write each one
   down; that's the real roadmap.
5. Do they fight over the keyboard? (Then sibling co-op moves up the list.)

## Next candidates (not built yet)

In rough order of expected delight-per-effort:

1. **Their names + character colors** — a tiny settings card; biggest
   emotional payoff for the least code.
2. **Sound effects** — soft pops for place/break, a chime for crafting,
   a whoosh for the broom and portal.
3. **A pet Moonfox that follows you** — one box-model + simple follow logic.
4. **Sibling co-op** — shared screen first, never networking first.
5. **Day/night cycle** — the castle lanterns and Star Lanterns would shine.
6. **The Lost Colors arc** — gray Gloom blocks + a ColorBurst spell + an
   "island restored %" meter; the castle friends could hand out those quests.
