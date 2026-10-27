import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OTClient, ServerDocument, TextOperation } from '../src/index.js';
import { createRandom, randomOperation } from './helpers.js';

// Simulates a server and several clients exchanging operations over in-order
// channels with random delays, then checks that every replica ends up equal.
function simulate(seed, { clients: clientCount = 3, steps = 300 } = {}) {
  const random = createRandom(seed);
  const initial = 'The quick brown fox\njumps over the lazy dog\n';
  const server = new ServerDocument(initial);
  const toServer = []; // { clientIndex, revision, operation }
  const clients = [];

  for (let i = 0; i < clientCount; i++) {
    const replica = {
      doc: initial,
      inbox: [], // messages from server, in order: { type: 'op' | 'ack', operation }
    };
    replica.client = new OTClient(0, {
      sendOperation: (revision, operation) => toServer.push({ clientIndex: i, revision, operation }),
      applyOperation: (operation) => {
        replica.doc = operation.apply(replica.doc);
      },
    });
    clients.push(replica);
  }

  const deliverToServer = () => {
    const { clientIndex, revision, operation } = toServer.shift();
    const wire = TextOperation.fromJSON(JSON.parse(JSON.stringify(operation)));
    const transformed = server.receiveOperation(revision, wire);
    clients.forEach((c, i) => {
      c.inbox.push(i === clientIndex ? { type: 'ack' } : { type: 'op', operation: transformed });
    });
  };

  const deliverToClient = (replica) => {
    const message = replica.inbox.shift();
    if (message.type === 'ack') replica.client.serverAck();
    else replica.client.applyServer(message.operation);
  };

  for (let step = 0; step < steps; step++) {
    const r = random();
    if (r < 0.4) {
      const replica = clients[Math.floor(random() * clients.length)];
      const op = randomOperation(random, replica.doc);
      replica.doc = op.apply(replica.doc);
      replica.client.applyClient(op);
    } else if (r < 0.7 && toServer.length) {
      deliverToServer();
    } else {
      const pending = clients.filter((c) => c.inbox.length);
      if (pending.length) deliverToClient(pending[Math.floor(random() * pending.length)]);
    }
  }

  // Drain everything.
  while (toServer.length || clients.some((c) => c.inbox.length)) {
    while (toServer.length) deliverToServer();
    for (const c of clients) while (c.inbox.length) deliverToClient(c);
  }

  return { server, clients };
}

for (const seed of [1, 2, 3, 4, 5, 42, 1337]) {
  test(`server and clients converge (seed ${seed})`, () => {
    const { server, clients } = simulate(seed, { clients: 2 + (seed % 3), steps: 400 });
    for (const c of clients) {
      assert.ok(c.client.isSynchronized);
      assert.equal(c.client.revision, server.revision);
      assert.equal(c.doc, server.content);
    }
  });
}

test('server transforms stale selections', () => {
  const server = new ServerDocument('abcdef');
  server.receiveOperation(0, new TextOperation().insert('XYZ').retain(6));
  const [sel] = server.transformSelection(0, [{ anchor: 2, head: 4 }]);
  assert.deepEqual(sel, { anchor: 5, head: 7 });
});

test('server rejects bad revisions and oversize documents', () => {
  const server = new ServerDocument('ab', { maxLength: 5 });
  assert.throws(() => server.receiveOperation(3, new TextOperation().retain(2)));
  assert.throws(() => server.receiveOperation(0, new TextOperation().retain(2).insert('long text')));
  assert.equal(server.content, 'ab');
});
