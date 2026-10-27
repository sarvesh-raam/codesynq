import { TextOperation } from '../src/index.js';

// Small deterministic PRNG (mulberry32) so fuzz failures are reproducible.
export function createRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABET = 'abcdefghij \n';

export function randomString(random, maxLength) {
  const length = Math.floor(random() * (maxLength + 1));
  let s = '';
  for (let i = 0; i < length; i++) s += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return s;
}

export function randomOperation(random, doc) {
  const op = new TextOperation();
  let remaining = doc.length;
  while (remaining > 0) {
    const n = 1 + Math.floor(random() * Math.min(remaining, 5));
    const r = random();
    if (r < 0.2) op.insert(randomString(random, 4) || 'x');
    else if (r < 0.5) {
      op.delete(n);
      remaining -= n;
    } else {
      op.retain(n);
      remaining -= n;
    }
  }
  if (random() < 0.3) op.insert(randomString(random, 4) || 'y');
  return op;
}
