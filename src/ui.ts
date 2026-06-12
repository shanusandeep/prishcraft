import { BLOCKS, PLACEABLE, CARROT } from './blocks';
import { Atlas } from './textures';
import { GameState, RECIPES, Recipe, canCraft, MAX_HEALTH } from './state';

/** Hotbar, quest banner, item chips, crafting panel, dialogue, toasts. */
export class UI {
  selected = 0;

  onSelect?: (index: number) => void;
  onReset?: () => void;
  onStart?: () => void;
  onCraft?: (recipe: Recipe) => void;
  onCraftToggle?: (open: boolean) => void;
  onFlyChip?: () => void;
  onEat?: (kind: 'carrot' | 'juice' | 'brew') => void;
  onPeaceful?: (on: boolean) => void;
  onPatronusChip?: () => void;

  private slots: HTMLButtonElement[] = [];
  private slotCounts: HTMLSpanElement[] = [];
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
      const count = document.createElement('span');
      count.className = 'count';
      slot.appendChild(count);
      this.slotCounts.push(count);
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
    document.getElementById('sel-chip')!.addEventListener('click', () => this.toggleInventory(true));
    document.getElementById('inv-close')!.addEventListener('click', () => this.toggleInventory(false));
    document.getElementById('q-close')!.addEventListener('click', () => this.hideQuestions());
    document.getElementById('questions')!.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'questions') this.hideQuestions();
    });
    document.getElementById('inventory')!.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'inventory') this.toggleInventory(false);
    });
    document.getElementById('craft-close')!.addEventListener('click', () => this.toggleCraft(false));
    document.getElementById('peaceful-box')!.addEventListener('change', (e) => {
      this.onPeaceful?.((e.target as HTMLInputElement).checked);
    });

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
    // on phones the hotbar scrolls horizontally — keep the selection in view
    const hotbar = document.getElementById('hotbar')!;
    if (!this.touch && hotbar.scrollWidth > hotbar.clientWidth) {
      this.slots[this.selected].scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
    if (this.lastState) this.updateSelChip(this.lastState);
  }

  selectedBlockId(): number {
    return PLACEABLE[this.selected];
  }

  /** Survival inventory: show how many of each block you've gathered. */
  refreshCounts(state: GameState): void {
    PLACEABLE.forEach((id, i) => {
      if (id === 5) { // water is magic — always free
        this.slotCounts[i].textContent = '∞';
        this.slots[i].classList.remove('empty');
        return;
      }
      const have = state.resources[id] ?? 0;
      this.slotCounts[i].textContent = have > 99 ? '99+' : String(have);
      this.slots[i].classList.toggle('empty', have <= 0);
    });
    this.lastState = state;
    this.updateSelChip(state);
    if (!document.getElementById('inventory')!.hidden) this.renderInventory(state);
  }

  // ---------- the Minecraft-style inventory (replaces the hotbar on touch) ----------

  private lastState: GameState | null = null;

  private updateSelChip(state: GameState): void {
    const chip = document.getElementById('sel-chip')!;
    if (!this.touch) {
      chip.hidden = true;
      return;
    }
    chip.hidden = false;
    const id = this.selectedBlockId();
    const def = BLOCKS[id];
    const have = id === 5 ? '∞' : String(state.resources[id] ?? 0);
    chip.innerHTML = '';
    const img = document.createElement('img');
    img.src = this.atlas.icon(id === 1 ? def.tiles.top : def.tiles.side, 34);
    const name = document.createElement('span');
    name.textContent = def.name;
    const cnt = document.createElement('span');
    cnt.className = 'cnt';
    cnt.textContent = `×${have}`;
    chip.append(img, name, cnt);
  }

  /** The big list of questions you can ask a friend. */
  showQuestions(questions: string[], onPick: (index: number) => void): void {
    const panel = document.getElementById('questions')!;
    const list = document.getElementById('q-list')!;
    list.innerHTML = '';
    questions.forEach((q, i) => {
      const btn = document.createElement('button');
      btn.textContent = q;
      btn.addEventListener('click', () => {
        panel.hidden = true;
        onPick(i);
      });
      list.appendChild(btn);
    });
    panel.hidden = false;
  }

  hideQuestions(): void {
    document.getElementById('questions')!.hidden = true;
  }

  toggleInventory(open?: boolean): void {
    const panel = document.getElementById('inventory')!;
    const next = open ?? panel.hidden;
    panel.hidden = !next;
    if (next && this.lastState) this.renderInventory(this.lastState);
  }

  renderInventory(state: GameState): void {
    const grid = document.getElementById('inv-grid')!;
    grid.innerHTML = '';
    PLACEABLE.forEach((id, i) => {
      const def = BLOCKS[id];
      const have = id === 5 ? Infinity : (state.resources[id] ?? 0);
      const cell = document.createElement('button');
      cell.className = 'inv-cell' + (have <= 0 ? ' none' : '') + (i === this.selected ? ' sel' : '');
      cell.title = def.name;
      const img = document.createElement('img');
      img.src = this.atlas.icon(id === 1 ? def.tiles.top : def.tiles.side, 44);
      img.alt = def.name;
      const cnt = document.createElement('span');
      cnt.className = 'cnt';
      cnt.textContent = id === 5 ? '∞' : have > 99 ? '99+' : String(have);
      cell.append(img, cnt);
      cell.addEventListener('click', () => {
        this.onSelect?.(i);
        this.toggleInventory(false);
      });
      grid.appendChild(cell);
    });

    const items = document.getElementById('inv-items')!;
    items.innerHTML = '';
    const itemChips: Array<[string, boolean]> = [
      ['🪄 Wand', state.items.wand],
      ['🧹 Broom', state.items.broom],
      ['🗝️ Key', state.items.key],
      ['🦌 Patronus', state.items.patronus],
      [`🥕 ×${state.resources[CARROT] ?? 0}`, (state.resources[CARROT] ?? 0) > 0],
      [`🧃 ×${state.foods?.juice ?? 0}`, (state.foods?.juice ?? 0) > 0],
      [`🥤 ×${state.foods?.brew ?? 0}`, (state.foods?.brew ?? 0) > 0],
    ];
    for (const [label, owned] of itemChips) {
      const el = document.createElement('span');
      el.className = 'inv-item' + (owned ? '' : ' missing');
      el.textContent = label;
      items.appendChild(el);
    }
  }

  // ---------- messages ----------

  private iconCache = new Map<number, string>();

  /** Small inline <img> of a block, so kids can SEE what to mine. */
  blockIcon(id: number): string {
    if (!this.iconCache.has(id)) {
      const def = BLOCKS[id];
      this.iconCache.set(id, this.atlas.icon(id === 1 ? def.tiles.top : def.tiles.side, 22));
    }
    return `<img class="block-icon" src="${this.iconCache.get(id)}" alt="${BLOCKS[id].name}">`;
  }

  toast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 1800);
  }

  /** Accepts simple HTML (block icons); content is app-generated, never user input. */
  setGoal(html: string): void {
    document.getElementById('quest')!.innerHTML = html;
  }

  showDialogue(
    name: string,
    color: string,
    line: string,
    hearts: number,
    replies: Array<{ label: string; quiet?: boolean; onPick: () => void }> = [],
  ): void {
    const box = document.getElementById('dialogue')!;
    const nameEl = document.getElementById('dlg-name')!;
    nameEl.textContent = name;
    nameEl.style.color = color;
    document.getElementById('dlg-hearts')!.textContent =
      hearts > 0 ? '❤️'.repeat(Math.min(hearts, 8)) + (hearts > 8 ? ` ×${hearts}` : '') : '';
    document.getElementById('dlg-line')!.textContent = line;

    const repliesEl = document.getElementById('dlg-replies')!;
    repliesEl.innerHTML = '';
    for (const reply of replies) {
      const chip = document.createElement('button');
      chip.className = 'reply-chip' + (reply.quiet ? ' quiet' : '');
      chip.textContent = reply.label;
      chip.addEventListener('click', () => reply.onPick());
      repliesEl.appendChild(chip);
    }

    box.hidden = false;
    window.clearTimeout(this.dialogueTimer);
    // with replies, hang around longer so the kid can choose
    this.dialogueTimer = window.setTimeout(() => { box.hidden = true; }, replies.length ? 16000 : 5200);
  }

  hideDialogue(): void {
    window.clearTimeout(this.dialogueTimer);
    document.getElementById('dialogue')!.hidden = true;
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
    if (state.items.patronus) {
      chip(this.touch ? '🦌' : '🦌 <small>G</small>', 'Patronus Charm — a burst of light against dementors!', () => this.onPatronusChip?.());
    }

    // food chips — tap to munch
    const carrots = state.resources[CARROT] ?? 0;
    const foods = state.foods ?? { juice: 0, brew: 0 };
    if (carrots > 0) chip(`🥕<small>×${carrots}</small>`, 'Carrot — eat for ❤️❤️', () => this.onEat?.('carrot'));
    if (foods.juice > 0) chip(`🧃<small>×${foods.juice}</small>`, 'Pumpkin Juice — drink for ❤️×5', () => this.onEat?.('juice'));
    if (foods.brew > 0) chip(`🥤<small>×${foods.brew}</small>`, 'Butterbrew — heals ALL hearts!', () => this.onEat?.('brew'));
  }

  setHearts(health: number): void {
    const n = Math.max(0, Math.min(MAX_HEALTH, Math.round(health)));
    document.getElementById('hearts')!.textContent = '❤️'.repeat(n) + '🤍'.repeat(MAX_HEALTH - n);
  }

  hurtFlash(): void {
    const el = document.getElementById('hurt')!;
    el.classList.add('flash');
    window.setTimeout(() => el.classList.remove('flash'), 120);
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
        const img = document.createElement('img');
        img.className = 'block-icon';
        img.src = this.atlas.icon(n.block === 1 ? BLOCKS[n.block].tiles.top : BLOCKS[n.block].tiles.side, 22);
        img.alt = BLOCKS[n.block].name;
        span.appendChild(img);
        span.appendChild(document.createTextNode(` ${BLOCKS[n.block].name} ${Math.min(have, n.count)}/${n.count}`));
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

  setPatronusVisible(on: boolean): void {
    document.getElementById('btn-patronus')!.hidden = !on;
  }

  setFightVisible(on: boolean): void {
    document.getElementById('btn-fight')!.hidden = !on;
  }

  setPeacefulBox(on: boolean): void {
    (document.getElementById('peaceful-box') as HTMLInputElement).checked = on;
  }

  setBoss(name: string | null, frac = 1): void {
    const bar = document.getElementById('bossbar')!;
    if (!name) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    document.getElementById('boss-name')!.textContent = name;
    (document.getElementById('boss-fill') as HTMLElement).style.width = `${Math.max(0, frac * 100)}%`;
  }
}
