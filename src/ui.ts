import { BLOCKS, PLACEABLE } from './blocks';
import { Atlas } from './textures';
import { GameState, RECIPES, Recipe, canCraft } from './state';

/** Hotbar, quest banner, item chips, crafting panel, dialogue, toasts. */
export class UI {
  selected = 0;

  onSelect?: (index: number) => void;
  onReset?: () => void;
  onStart?: () => void;
  onCraft?: (recipe: Recipe) => void;
  onCraftToggle?: (open: boolean) => void;
  onFlyChip?: () => void;

  private slots: HTMLButtonElement[] = [];
  private toastEl = document.getElementById('toast')!;
  private toastTimer: number | undefined;
  private dialogueTimer: number | undefined;
  private craftEl = document.getElementById('craft')!;

  constructor(private atlas: Atlas, private touch: boolean) {
    const hotbar = document.getElementById('hotbar')!;
    PLACEABLE.forEach((id, i) => {
      const def = BLOCKS[id];
      const slot = document.createElement('button');
      slot.className = 'slot';
      slot.title = def.name;
      const img = document.createElement('img');
      // grass reads better as its green top; everything else as its side
      img.src = atlas.icon(id === 1 ? def.tiles.top : def.tiles.side, 48);
      img.alt = def.name;
      slot.appendChild(img);
      if (i < 10) {
        const key = document.createElement('span');
        key.className = 'key';
        key.textContent = `${(i + 1) % 10}`;
        slot.appendChild(key);
      }
      slot.addEventListener('click', () => this.onSelect?.(i));
      hotbar.appendChild(slot);
      this.slots.push(slot);
    });
    this.select(0);

    document.getElementById('reset')!.addEventListener('click', () => {
      if (window.confirm('Start a brand new island? Your whole adventure will be erased!')) {
        this.onReset?.();
      }
    });

    document.getElementById('bag')!.addEventListener('click', () => this.toggleCraft());
    document.getElementById('craft-close')!.addEventListener('click', () => this.toggleCraft(false));

    // welcome card
    const keys = document.getElementById('help-keys')!;
    const rows: Array<[string, string]> = touch
      ? [
          ['🕹️', 'joystick to walk'],
          ['👆 drag', 'look around'],
          ['⛏️ / 🧱', 'break and place blocks'],
          ['⬆️', 'jump'],
          ['🎒', 'craft magical things'],
        ]
      : [
          ['W A S D', 'walk'],
          ['mouse', 'look around'],
          ['left click', 'break a block'],
          ['right click', 'place a block'],
          ['space', 'jump'],
          ['1 – 0', 'pick a block'],
          ['C', 'craft magical things'],
          ['E · F', 'talk to friends · fly'],
        ];
    for (const [k, label] of rows) {
      const b = document.createElement('b');
      b.textContent = k;
      const span = document.createElement('span');
      span.textContent = label;
      keys.append(b, span);
    }

    document.getElementById('start')!.addEventListener('click', () => {
      document.getElementById('help')!.classList.add('hidden');
      this.onStart?.();
    });
  }

  // ---------- hotbar ----------

  select(index: number): void {
    this.selected = (index + this.slots.length) % this.slots.length;
    this.slots.forEach((s, i) => s.classList.toggle('selected', i === this.selected));
  }

  selectedBlockId(): number {
    return PLACEABLE[this.selected];
  }

  // ---------- messages ----------

  toast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 1800);
  }

  setGoal(text: string): void {
    document.getElementById('quest')!.textContent = text;
  }

  showDialogue(name: string, color: string, line: string, hearts: number): void {
    const box = document.getElementById('dialogue')!;
    const nameEl = document.getElementById('dlg-name')!;
    nameEl.textContent = name;
    nameEl.style.color = color;
    document.getElementById('dlg-hearts')!.textContent =
      hearts > 0 ? '❤️'.repeat(Math.min(hearts, 8)) + (hearts > 8 ? ` ×${hearts}` : '') : '';
    document.getElementById('dlg-line')!.textContent = line;
    box.hidden = false;
    window.clearTimeout(this.dialogueTimer);
    this.dialogueTimer = window.setTimeout(() => { box.hidden = true; }, 5200);
  }

  // ---------- items & crafting ----------

  setItems(state: GameState): void {
    const wrap = document.getElementById('items')!;
    wrap.innerHTML = '';
    const chip = (label: string, title: string, onClick?: () => void) => {
      const el = document.createElement('button');
      el.className = 'item-chip';
      el.innerHTML = label;
      el.title = title;
      if (onClick) el.addEventListener('click', onClick);
      wrap.appendChild(el);
    };
    if (state.items.wand) chip('🪄', 'Wizard Wand — breaks anything, long reach');
    if (state.items.broom) {
      chip(this.touch ? '🧹' : '🧹 <small>F</small>', 'Flying Broom — tap to fly!', () => this.onFlyChip?.());
    }
    if (state.items.key) chip('🗝️', 'Portal Key — the stone ring is awake');
  }

  isCraftOpen(): boolean {
    return !this.craftEl.hidden;
  }

  toggleCraft(open = this.craftEl.hidden): void {
    this.craftEl.hidden = !open;
    this.onCraftToggle?.(open);
  }

  renderCraft(state: GameState): void {
    // the pouch: collected resources that appear in recipes
    const pouch = document.getElementById('pouch')!;
    pouch.innerHTML = '';
    const shown = new Set<number>();
    for (const r of RECIPES) for (const n of r.needs) shown.add(n.block);
    for (const id of shown) {
      const def = BLOCKS[id];
      const item = document.createElement('div');
      item.className = 'pouch-item';
      const img = document.createElement('img');
      img.src = this.atlas.icon(def.tiles.side, 26);
      const span = document.createElement('span');
      span.textContent = `${def.name} ×${state.resources[id] ?? 0}`;
      item.append(img, span);
      pouch.appendChild(item);
    }

    const list = document.getElementById('recipes')!;
    list.innerHTML = '';
    for (const recipe of RECIPES) {
      const owned = state.items[recipe.id];
      const card = document.createElement('div');
      card.className = 'recipe' + (owned ? ' owned' : '');

      const emoji = document.createElement('div');
      emoji.className = 'emoji';
      emoji.textContent = recipe.emoji;

      const info = document.createElement('div');
      info.className = 'info';
      const title = document.createElement('b');
      title.textContent = recipe.name;
      const blurb = document.createElement('p');
      blurb.textContent = recipe.blurb;
      const needs = document.createElement('div');
      needs.className = 'needs';
      for (const n of recipe.needs) {
        const have = state.resources[n.block] ?? 0;
        const span = document.createElement('span');
        span.className = have >= n.count ? 'ok' : 'miss';
        span.textContent = `${BLOCKS[n.block].name} ${Math.min(have, n.count)}/${n.count}`;
        needs.appendChild(span);
      }
      info.append(title, blurb, needs);

      const btn = document.createElement('button');
      if (owned) {
        btn.textContent = '✓ crafted';
        btn.disabled = true;
      } else {
        btn.textContent = 'Craft!';
        btn.disabled = !canCraft(state, recipe);
        btn.addEventListener('click', () => this.onCraft?.(recipe));
      }

      card.append(emoji, info, btn);
      list.appendChild(card);
    }
  }

  // ---------- touch button visibility ----------

  setTalkVisible(on: boolean): void {
    document.getElementById('btn-talk')!.hidden = !on;
  }

  setFlyButtonVisible(on: boolean): void {
    document.getElementById('btn-fly')!.hidden = !on;
  }

  setDownVisible(on: boolean): void {
    document.getElementById('btn-down')!.hidden = !on;
  }
}
