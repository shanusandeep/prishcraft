// Together Mode client — talks to the little room relay in server/server.js.
// The game stays fully playable offline; this only lights up when a kid
// taps "Friends can visit" or "Visit a friend" in the bag.

export interface PlayerLook {
  name: string;
  body: number;
  legs: number;
  hair: number;
}

export interface RemotePlayer extends PlayerLook {
  id: number;
}

export interface HostPayload {
  world: string; // RLE+base64, same encoding as the save file
  size: number;
  seed: number;
  gate: unknown;
  spawn: { x: number; y: number; z: number };
  time: number;
}

export interface JoinInfo extends HostPayload {
  id: number;
  code: string;
  edits: Array<[number, number, number, number]>;
  players: RemotePlayer[];
}

/** Where the relay lives: dev talks to the local node process, prod to /ws. */
function relayUrl(): string {
  if (import.meta.env.DEV) return `ws://${location.hostname}:8091`;
  if (location.protocol === 'https:') return `wss://${location.host}/ws`;
  return `ws://${location.hostname}:8091`; // the plain-http :8090 fallback
}

export class Net {
  active = false;
  isHost = false;
  code = '';

  onHosted?: (code: string) => void;
  onJoined?: (info: JoinInfo) => void;
  onPlayerJoin?: (p: RemotePlayer) => void;
  onPlayerLeave?: (id: number) => void;
  onPos?: (id: number, x: number, y: number, z: number) => void;
  onEdit?: (x: number, y: number, z: number, id: number) => void;
  onTime?: (v: number) => void;
  /** the room is over — host left, we left, or the line dropped */
  onEnd?: (why: string) => void;
  onError?: (msg: string) => void;
  /** host-side: the relay wants a fresh world snapshot */
  onResync?: () => string;

  private ws: WebSocket | null = null;
  private closingOnPurpose = false;

  host(look: PlayerLook, payload: HostPayload): void {
    this.open({ t: 'host', look, ...payload });
  }

  join(code: string, look: PlayerLook): void {
    this.open({ t: 'join', code: code.toUpperCase().trim(), look });
  }

  leave(): void {
    if (!this.ws) return;
    this.closingOnPurpose = true;
    this.send({ t: 'leave' });
    this.ws.close();
    this.finish('👋 The visit is over — see you next time!');
  }

  sendEdit(x: number, y: number, z: number, id: number): void {
    if (this.active) this.send({ t: 'edit', x, y, z, id });
  }

  sendPos(x: number, y: number, z: number): void {
    if (this.active) this.send({ t: 'pos', x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2) });
  }

  sendTime(v: number): void {
    if (this.active && this.isHost) this.send({ t: 'time', v });
  }

  sendWorld(world: string): void {
    if (this.active && this.isHost) this.send({ t: 'world', world });
  }

  private open(hello: Record<string, unknown>): void {
    if (this.ws) return; // one room at a time
    this.closingOnPurpose = false;
    let ws: WebSocket;
    try {
      ws = new WebSocket(relayUrl());
    } catch {
      this.onError?.('The meeting stone is quiet… check the internet?');
      return;
    }
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify(hello));
    ws.onmessage = (event) => this.receive(String(event.data));
    ws.onerror = () => {
      if (!this.active) {
        this.ws = null;
        this.onError?.('The meeting stone is quiet… check the internet?');
      }
    };
    ws.onclose = () => {
      if (this.closingOnPurpose) return;
      if (this.active) this.finish('📡 The magic link fizzled out!');
      else this.ws = null;
    };
  }

  private receive(text: string): void {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(text); } catch { return; }
    switch (msg.t) {
      case 'hosted':
        this.active = true;
        this.isHost = true;
        this.code = String(msg.code);
        this.onHosted?.(this.code);
        break;
      case 'joined':
        this.active = true;
        this.isHost = false;
        this.code = String(msg.code);
        this.onJoined?.(msg as unknown as JoinInfo);
        break;
      case 'player-join':
        this.onPlayerJoin?.(msg as unknown as RemotePlayer);
        break;
      case 'player-leave':
        this.onPlayerLeave?.(Number(msg.id));
        break;
      case 'pos':
        this.onPos?.(Number(msg.id), Number(msg.x), Number(msg.y), Number(msg.z));
        break;
      case 'edit':
        this.onEdit?.(Number(msg.x), Number(msg.y), Number(msg.z), Number(msg.id));
        break;
      case 'time':
        this.onTime?.(Number(msg.v));
        break;
      case 'resync':
        if (this.onResync) this.sendWorld(this.onResync());
        break;
      case 'end':
        this.finish(msg.why === 'host-left' ? '🏝️ Your friend closed their island — heading home!' : '👋 The visit is over!');
        break;
      case 'err':
        this.onError?.(String(msg.msg ?? 'Something went sideways.'));
        if (!this.active) { this.closingOnPurpose = true; this.ws?.close(); this.ws = null; }
        break;
    }
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private finish(why: string): void {
    const wasActive = this.active;
    this.active = false;
    this.isHost = false;
    this.code = '';
    this.ws = null;
    if (wasActive) this.onEnd?.(why);
  }
}
