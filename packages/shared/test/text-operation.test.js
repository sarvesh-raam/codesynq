import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TextOperation } from '../src/index.js';
import { createRandom, randomString, randomOperation } from './helpers.js';

test('builds canonical operations', () => {
  const op = new TextOperation().retain(2).retain(3).insert('a').insert('b').delete(1).delete(2);
  assert.deepEqual(op.ops, [5, 'ab', -3]);
  assert.equal(op.baseLength, 8);
  assert.equal(op.targetLength, 7);

  // An insert after a delete is moved in front of it.
  const swapped = new TextOperation().retain(1).delete(2).insert('x');
  assert.deepEqual(swapped.ops, [1, 'x', -2]);
});

test('apply', () => {
  const op = new TextOperation().retain(6).delete(5).insert('CodeSynq').retain(1);
  assert.equal(op.apply('Hello world!'), 'Hello CodeSynq!');
  assert.throws(() => op.apply('too short'));
});

test('fromJSON / toJSON round-trip', () => {
  const op = new TextOperation().retain(3).insert('hi').delete(4).retain(1);
  assert.ok(TextOperation.fromJSON(JSON.parse(JSON.stringify(op))).equals(op));
  assert.throws(() => TextOperation.fromJSON([0]));
  assert.throws(() => TextOperation.fromJSON([1.5]));
  assert.throws(() => TextOperation.fromJSON('nope'));
});

test('compose matches sequential application (fuzz)', () => {
  const random = createRandom(1);
  for (let i = 0; i < 500; i++) {
    const doc = randomString(random, 20);
    const a = randomOperation(random, doc);
    const afterA = a.apply(doc);
    const b = randomOperation(random, afterA);
    const ab = a.compose(b);
    assert.equal(ab.apply(doc), b.apply(afterA));
  }
});

test('transform converges (fuzz)', () => {
  const random = createRandom(2);
  for (let i = 0; i < 500; i++) {
    const doc = randomString(random, 20);
    const a = randomOperation(random, doc);
    const b = randomOperation(random, doc);
    const [aPrime, bPrime] = TextOperation.transform(a, b);
    assert.equal(bPrime.apply(a.apply(doc)), aPrime.apply(b.apply(doc)));
  }
});

test('concurrent inserts at the same spot favour the first operation', () => {
  const a = new TextOperation().retain(1).insert('A').retain(1);
  const b = new TextOperation().retain(1).insert('B').retain(1);
  const [aPrime, bPrime] = TextOperation.transform(a, b);
  assert.equal(bPrime.apply(a.apply('xy')), 'xABy');
  assert.equal(aPrime.apply(b.apply('xy')), 'xABy');
});

test('transformIndex keeps cursors attached to their text', () => {
  // "hello world" -> delete "hello " and insert ">> " at the start
  const op = new TextOperation().insert('>> ').delete(6).retain(5);
  assert.equal(op.transformIndex(0), 3);
  assert.equal(op.transformIndex(3), 3); // was inside deleted text
  assert.equal(op.transformIndex(6), 3); // start of "world"
  assert.equal(op.transformIndex(11), 8); // end of document
});
