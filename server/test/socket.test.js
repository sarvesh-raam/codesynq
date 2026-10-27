import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { OTClient, TextOperation } from '@codesynq/shared';

const PORT = 4000 + Math.floor(Math.random() * 1000);
const SERVER_URL = `http://localhost:${PORT}`;
let server;
let piston;
const pistonRequests = [];

// Stand-in for the Piston API: one Python runtime that echoes the files it got.
function startFakePiston() {
  return new Promise((resolve) => {
    piston = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        if (req.url === '/api/v2/runtimes') {
          res.end(JSON.stringify([{ language: 'python', version: '3.12.0', aliases: ['py'] }]));
        } else if (req.url === '/api/v2/execute') {
          const job = JSON.parse(body);
          pistonRequests.push(job);
          res.end(JSON.stringify({
            language: job.language,
            version: job.version,
            run: { stdout: `ran ${job.files.map((f) => f.name).join(',')} stdin=${job.stdin}`, stderr: '', code: 0, signal: null },
          }));
        } else {
          res.statusCode = 404;
          res.end('{}');
        }
      });
    });
    piston.listen(0, () => resolve(piston.address().port));
  });
}

before(async () => {
  const pistonPort = await startFakePiston();
  server = spawn(process.execPath, [fileURLToPath(new URL('../src/index.js', import.meta.url))], {
    env: { ...process.env, PORT: String(PORT), PISTON_URL: `http://localhost:${pistonPort}/api/v2` },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve) => server.stdout.on('data', (d) => d.toString().includes('listening') && resolve()));
});

after(() => {
  server.kill();
  piston.close();
});

const request = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));

// A headless client: a plain string document driven by the shared OT client.
async function connect(roomId, name) {
  const socket = io(SERVER_URL, { transports: ['websocket'], forceNew: true });
  const joined = await request(socket, 'join', { roomId, name });
  assert.ok(joined.ok, joined.error);
  const file = joined.room.files[0];
  const peer = { socket, joined, fileId: file.id, doc: file.content, events: [] };
  peer.client = new OTClient(file.revision, {
    sendOperation: (revision, operation) => {
      socket.emit('op', { fileId: file.id, revision, operation: operation.toJSON() }, (res) => {
        assert.ok(res.ok, res.error);
        peer.client.serverAck();
      });
    },
    applyOperation: (operation) => {
      peer.doc = operation.apply(peer.doc);
    },
  });
  socket.on('op', ({ fileId, operation }) => {
    if (fileId === file.id) peer.client.applyServer(TextOperation.fromJSON(operation));
  });
  socket.onAny((event, payload) => peer.events.push({ event, payload }));
  peer.edit = (operation) => {
    peer.doc = operation.apply(peer.doc);
    peer.client.applyClient(operation);
  };
  return peer;
}

const settle = () => new Promise((r) => setTimeout(r, 300));

test('concurrent edits from two users converge', async () => {
  const room = `test-${Date.now()}`;
  const a = await connect(room, 'Alice');
  const b = await connect(room, 'Bob');
  const start = a.doc;

  // Both type at the start of the document at the same moment, several times.
  for (let i = 0; i < 20; i++) {
    a.edit(new TextOperation().insert(`a${i} `).retain(a.doc.length));
    b.edit(new TextOperation().retain(b.doc.length).insert(` b${i}`));
    if (b.doc.length > 3) b.edit(new TextOperation().retain(1).delete(1).retain(b.doc.length - 2));
  }
  await settle();

  assert.equal(a.doc, b.doc);
  assert.ok(a.client.isSynchronized && b.client.isSynchronized);
  const resync = await request(a.socket, 'file:resync', { fileId: a.fileId });
  assert.equal(resync.file.content, a.doc);
  assert.notEqual(a.doc, start);

  a.socket.close();
  b.socket.close();
});

test('presence, selections and file operations are broadcast', async () => {
  const room = `test-${Date.now()}-2`;
  const a = await connect(room, 'Alice');
  const b = await connect(room, 'Bob');
  await settle();
  assert.ok(a.events.some((e) => e.event === 'user:joined' && e.payload.name === 'Bob'));

  await request(a.socket, 'selection', { fileId: a.fileId, revision: a.client.revision, selection: [{ anchor: 0, head: 5 }] });
  const created = await request(b.socket, 'file:create', { name: 'util.js' });
  assert.ok(created.ok);
  const duplicate = await request(b.socket, 'file:create', { name: 'UTIL.js' });
  assert.equal(duplicate.ok, false);
  assert.ok((await request(a.socket, 'file:rename', { fileId: created.fileId, name: 'helpers.js' })).ok);
  assert.ok((await request(a.socket, 'file:delete', { fileId: created.fileId })).ok);
  assert.equal((await request(a.socket, 'file:delete', { fileId: a.fileId })).ok, false, 'last file cannot be deleted');
  await settle();

  const sel = b.events.find((e) => e.event === 'selection');
  assert.deepEqual(sel.payload.selection, { fileId: a.fileId, ranges: [{ anchor: 0, head: 5 }] });
  const names = b.events.map((e) => e.event);
  for (const event of ['file:created', 'file:renamed', 'file:deleted']) assert.ok(names.includes(event), event);

  b.socket.close();
  await settle();
  assert.ok(a.events.some((e) => e.event === 'user:left'));
  a.socket.close();
});

test('rejects invalid input', async () => {
  const socket = io(SERVER_URL, { transports: ['websocket'], forceNew: true });
  assert.equal((await request(socket, 'join', { roomId: 'x', name: 'A' })).ok, false);
  assert.equal((await request(socket, 'join', { roomId: 'valid-room', name: '  ' })).ok, false);
  assert.equal((await request(socket, 'op', { fileId: 'nope', revision: 0, operation: [] })).ok, false);
  const joined = await request(socket, 'join', { roomId: `test-${Date.now()}-3`, name: 'A' });
  const fileId = joined.room.files[0].id;
  assert.equal((await request(socket, 'op', { fileId, revision: 99, operation: [1] })).ok, false);
  assert.equal((await request(socket, 'op', { fileId, revision: 0, operation: [1] })).ok, false, 'wrong base length');
  assert.equal((await request(socket, 'file:create', { name: '../evil' })).ok, false);
  socket.close();
});

test('runs code and broadcasts the result to the room', async () => {
  const room = `test-${Date.now()}-run`;
  const a = await connect(room, 'Alice');
  const b = await connect(room, 'Bob');
  await request(b.socket, 'file:create', { name: 'helpers.py' });
  const notes = await request(b.socket, 'file:create', { name: 'notes.md' });

  const res = await request(a.socket, 'run', { fileId: a.fileId, stdin: '42' });
  assert.ok(res.ok, res.error);
  await settle();

  const job = pistonRequests.at(-1);
  assert.equal(job.language, 'python');
  assert.equal(job.version, '3.12.0');
  assert.equal(job.files[0].name, 'main.py', 'the file being run goes first');
  assert.deepEqual(job.files.map((f) => f.name).sort(), ['helpers.py', 'main.py', 'notes.md']);

  for (const peer of [a, b]) {
    assert.ok(peer.events.some((e) => e.event === 'run:started' && e.payload.userName === 'Alice'));
    const result = peer.events.find((e) => e.event === 'run:result').payload;
    assert.equal(result.ok, true);
    assert.equal(result.run.stdout, 'ran main.py,helpers.py,notes.md stdin=42');
    assert.equal(result.run.code, 0);
  }

  await request(a.socket, 'run', { fileId: notes.fileId });
  await settle();
  const failed = a.events.filter((e) => e.event === 'run:result').at(-1).payload;
  assert.equal(failed.ok, false);
  assert.match(failed.error, /cannot be executed/);

  const runtimes = await (await fetch(`${SERVER_URL}/api/runtimes`)).json();
  assert.deepEqual(runtimes.runnable, ['py']);

  a.socket.close();
  b.socket.close();
});
