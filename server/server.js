// Together Mode relay for PrishCraft — a tiny room server for family co-op.
//
// One player HOSTS their island: the server keeps the world snapshot and a
// 5-letter room code. Friends JOIN with the code, get the snapshot, and from
// then on the server only relays block edits, positions, and the clock.
// It never simulates the game and stores nothing on disk.
//
// Dev:  node server/server.js          (ws comes from the repo's node_modules)
// Prod: bundled to server.bundle.cjs, run in a bare node:22-alpine container.

import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8091);
const MAX_ROOMS = 30;
const MAX_PLAYERS = 5; // per room, host included
const MAX_EDITS = 4000; // buffered edits before asking the host to resync
const MAX_CONN_PER_IP = 6;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no lookalike letters

/** code -> { code, host, players: Map<ws, {id,name,look}>, world, size, seed, gate, spawn, time, edits } */
const rooms = new Map();
const ipCounts = new Map();
let nextId = 1;

function makeCode() {
  for (;;) {
    let code = '';
    for (let i = 0; i < 5; i++) code += CODE_ALPHABET[(Math.random() * CODE_ALPHABET.length) | 0];
    if (!rooms.has(code)) return code;
  }
}

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcast(room, except, msg) {
  const text = JSON.stringify(msg);
  for (const ws of room.players.keys()) {
    if (ws !== except && ws.readyState === 1) ws.send(text);
  }
}

function cleanName(name) {
  return String(name || 'Wizard').slice(0, 14).replace(/[<>&]/g, '') || 'Wizard';
}

function cleanLook(look) {
  const num = (v, fallback) => (Number.isFinite(v) ? v & 0xffffff : fallback);
  return {
    name: cleanName(look && look.name),
    body: num(look && look.body, 0xb9a8ee),
    legs: num(look && look.legs, 0x8d7ad6),
    hair: num(look && look.hair, 0x6e5aa8),
  };
}

function closeRoom(room, why) {
  broadcast(room, null, { t: 'end', why });
  for (const ws of room.players.keys()) {
    ws.room = null;
    try { ws.close(); } catch { /* already gone */ }
  }
  rooms.delete(room.code);
  console.log(`[room ${room.code}] closed (${why}) — ${rooms.size} rooms open`);
}

function leaveRoom(ws) {
  const room = ws.room;
  if (!room) return;
  const me = room.players.get(ws);
  room.players.delete(ws);
  ws.room = null;
  if (ws === room.host) {
    closeRoom(room, 'host-left');
  } else if (me) {
    broadcast(room, null, { t: 'player-leave', id: me.id });
    console.log(`[room ${room.code}] ${me.name} left — ${room.players.size} inside`);
  }
}

function handle(ws, msg) {
  const room = ws.room;
  switch (msg.t) {
    case 'host': {
      if (room) return;
      if (rooms.size >= MAX_ROOMS) return send(ws, { t: 'err', msg: 'The meeting stones are all busy — try again soon!' });
      if (typeof msg.world !== 'string' || msg.world.length > 6_000_000) return send(ws, { t: 'err', msg: 'That world is too heavy to carry.' });
      const code = makeCode();
      const me = { id: nextId++, ...cleanLook(msg.look) };
      const newRoom = {
        code, host: ws, players: new Map([[ws, me]]),
        world: msg.world, size: msg.size | 0, seed: msg.seed | 0,
        gate: msg.gate, spawn: msg.spawn, time: Number(msg.time) || 0.1,
        edits: [],
      };
      rooms.set(code, newRoom);
      ws.room = newRoom;
      send(ws, { t: 'hosted', code, id: me.id });
      console.log(`[room ${code}] hosted by ${me.name} (${(msg.world.length / 1024) | 0} KB) — ${rooms.size} rooms open`);
      return;
    }
    case 'join': {
      if (room) return;
      const target = rooms.get(String(msg.code || '').toUpperCase().trim());
      if (!target) return send(ws, { t: 'err', msg: 'No island answers to that code 🤔 Check it and try again!' });
      if (target.players.size >= MAX_PLAYERS) return send(ws, { t: 'err', msg: 'That island is full of friends already!' });
      const me = { id: nextId++, ...cleanLook(msg.look) };
      target.players.set(ws, me);
      ws.room = target;
      const players = [...target.players.entries()]
        .filter(([sock]) => sock !== ws)
        .map(([, p]) => p);
      send(ws, {
        t: 'joined', id: me.id, code: target.code,
        world: target.world, size: target.size, seed: target.seed,
        gate: target.gate, spawn: target.spawn, time: target.time,
        edits: target.edits, players,
      });
      broadcast(target, ws, { t: 'player-join', id: me.id, name: me.name, body: me.body, legs: me.legs, hair: me.hair });
      console.log(`[room ${target.code}] ${me.name} joined — ${target.players.size} inside`);
      return;
    }
    case 'edit': {
      if (!room) return;
      const edit = [msg.x | 0, msg.y | 0, msg.z | 0, msg.id | 0];
      room.edits.push(edit);
      broadcast(room, ws, { t: 'edit', x: edit[0], y: edit[1], z: edit[2], id: edit[3] });
      if (room.edits.length > MAX_EDITS) {
        room.edits = room.edits.slice(-MAX_EDITS); // keep relaying while we wait
        send(room.host, { t: 'resync' });
      }
      return;
    }
    case 'world': { // host answering a resync request
      if (!room || ws !== room.host || typeof msg.world !== 'string' || msg.world.length > 6_000_000) return;
      room.world = msg.world;
      room.edits = [];
      return;
    }
    case 'pos': {
      if (!room) return;
      const me = room.players.get(ws);
      if (!me) return;
      broadcast(room, ws, { t: 'pos', id: me.id, x: +msg.x || 0, y: +msg.y || 0, z: +msg.z || 0 });
      return;
    }
    case 'time': {
      if (!room || ws !== room.host) return;
      room.time = Number(msg.v) || 0;
      broadcast(room, ws, { t: 'time', v: room.time });
      return;
    }
    case 'leave':
      leaveRoom(ws);
      return;
  }
}

const wss = new WebSocketServer({ port: PORT, maxPayload: 8 * 1024 * 1024 });

wss.on('connection', (ws, req) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?').toString().split(',')[0].trim();
  if ((ipCounts.get(ip) || 0) >= MAX_CONN_PER_IP) {
    ws.close();
    return;
  }
  ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
  ws.isAlive = true;
  ws.room = null;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg && typeof msg.t === 'string') handle(ws, msg);
  });
  ws.on('close', () => {
    leaveRoom(ws);
    const n = (ipCounts.get(ip) || 1) - 1;
    if (n <= 0) ipCounts.delete(ip); else ipCounts.set(ip, n);
  });
  ws.on('error', () => { /* close handler does the cleanup */ });
});

// drop dead connections so rooms don't linger forever
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);

console.log(`PrishCraft Together Mode relay listening on :${PORT}`);
