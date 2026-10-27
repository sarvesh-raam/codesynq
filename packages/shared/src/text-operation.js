// A TextOperation is a list of components that walk over a document from start
// to end:
//   positive integer  -> retain n characters
//   string            -> insert the string
//   negative integer  -> delete n characters
//
// Operations are kept in canonical form: adjacent components of the same kind
// are merged and an insert always comes before a delete at the same position.
// That makes equal edits produce equal operations, which keeps transform simple.

export const isRetain = (c) => typeof c === 'number' && c > 0;
export const isInsert = (c) => typeof c === 'string';
export const isDelete = (c) => typeof c === 'number' && c < 0;

export class TextOperation {
  constructor() {
    this.ops = [];
    // Length of the document the operation applies to.
    this.baseLength = 0;
    // Length of the document after the operation has been applied.
    this.targetLength = 0;
  }

  retain(n) {
    if (!Number.isInteger(n) || n < 0) throw new TypeError('retain expects a non-negative integer');
    if (n === 0) return this;
    this.baseLength += n;
    this.targetLength += n;
    const last = this.ops.length - 1;
    if (isRetain(this.ops[last])) this.ops[last] += n;
    else this.ops.push(n);
    return this;
  }

  insert(str) {
    if (typeof str !== 'string') throw new TypeError('insert expects a string');
    if (str === '') return this;
    this.targetLength += str.length;
    const ops = this.ops;
    const n = ops.length;
    if (isInsert(ops[n - 1])) {
      ops[n - 1] += str;
    } else if (isDelete(ops[n - 1])) {
      // Keep inserts in front of deletes (canonical form).
      if (isInsert(ops[n - 2])) {
        ops[n - 2] += str;
      } else {
        ops[n] = ops[n - 1];
        ops[n - 1] = str;
      }
    } else {
      ops.push(str);
    }
    return this;
  }

  delete(n) {
    if (typeof n === 'string') n = n.length;
    if (!Number.isInteger(n) || n < 0) throw new TypeError('delete expects a non-negative integer');
    if (n === 0) return this;
    this.baseLength += n;
    const last = this.ops.length - 1;
    if (isDelete(this.ops[last])) this.ops[last] -= n;
    else this.ops.push(-n);
    return this;
  }

  isNoop() {
    return this.ops.length === 0 || (this.ops.length === 1 && isRetain(this.ops[0]));
  }

  equals(other) {
    if (this.baseLength !== other.baseLength || this.targetLength !== other.targetLength) return false;
    if (this.ops.length !== other.ops.length) return false;
    return this.ops.every((c, i) => c === other.ops[i]);
  }

  apply(doc) {
    if (doc.length !== this.baseLength) {
      throw new Error(`Operation base length ${this.baseLength} does not match document length ${doc.length}`);
    }
    const parts = [];
    let index = 0;
    for (const c of this.ops) {
      if (isRetain(c)) {
        parts.push(doc.slice(index, index + c));
        index += c;
      } else if (isInsert(c)) {
        parts.push(c);
      } else {
        index -= c;
      }
    }
    return parts.join('');
  }

  // Returns an operation with the same effect as applying `this` then `other`.
  compose(other) {
    if (this.targetLength !== other.baseLength) {
      throw new Error('Cannot compose: the first operation\'s target length must equal the second\'s base length');
    }
    const result = new TextOperation();
    const a = this.ops;
    const b = other.ops;
    let i = 0;
    let j = 0;
    let opA = a[i++];
    let opB = b[j++];

    while (opA !== undefined || opB !== undefined) {
      if (isDelete(opA)) {
        result.delete(-opA);
        opA = a[i++];
        continue;
      }
      if (isInsert(opB)) {
        result.insert(opB);
        opB = b[j++];
        continue;
      }
      if (opA === undefined || opB === undefined) {
        throw new Error('Cannot compose: operations have incompatible lengths');
      }

      if (isRetain(opA) && isRetain(opB)) {
        if (opA > opB) {
          result.retain(opB);
          opA -= opB;
          opB = b[j++];
        } else if (opA === opB) {
          result.retain(opA);
          opA = a[i++];
          opB = b[j++];
        } else {
          result.retain(opA);
          opB -= opA;
          opA = a[i++];
        }
      } else if (isInsert(opA) && isDelete(opB)) {
        // Text inserted by A and deleted by B cancels out.
        if (opA.length > -opB) {
          opA = opA.slice(-opB);
          opB = b[j++];
        } else if (opA.length === -opB) {
          opA = a[i++];
          opB = b[j++];
        } else {
          opB += opA.length;
          opA = a[i++];
        }
      } else if (isInsert(opA) && isRetain(opB)) {
        if (opA.length > opB) {
          result.insert(opA.slice(0, opB));
          opA = opA.slice(opB);
          opB = b[j++];
        } else if (opA.length === opB) {
          result.insert(opA);
          opA = a[i++];
          opB = b[j++];
        } else {
          result.insert(opA);
          opB -= opA.length;
          opA = a[i++];
        }
      } else if (isRetain(opA) && isDelete(opB)) {
        if (opA > -opB) {
          result.delete(-opB);
          opA += opB;
          opB = b[j++];
        } else if (opA === -opB) {
          result.delete(-opB);
          opA = a[i++];
          opB = b[j++];
        } else {
          result.delete(opA);
          opB += opA;
          opA = a[i++];
        }
      }
    }
    return result;
  }

  // Given two operations A and B that apply to the same document, returns
  // [A', B'] such that apply(apply(doc, A), B') === apply(apply(doc, B), A').
  // When both insert at the same position, A's text is placed first.
  static transform(op1, op2) {
    if (op1.baseLength !== op2.baseLength) {
      throw new Error('Cannot transform: both operations must have the same base length');
    }
    const prime1 = new TextOperation();
    const prime2 = new TextOperation();
    const a = op1.ops;
    const b = op2.ops;
    let i = 0;
    let j = 0;
    let opA = a[i++];
    let opB = b[j++];

    while (opA !== undefined || opB !== undefined) {
      if (isInsert(opA)) {
        prime1.insert(opA);
        prime2.retain(opA.length);
        opA = a[i++];
        continue;
      }
      if (isInsert(opB)) {
        prime1.retain(opB.length);
        prime2.insert(opB);
        opB = b[j++];
        continue;
      }
      if (opA === undefined || opB === undefined) {
        throw new Error('Cannot transform: operations have incompatible lengths');
      }

      let min;
      if (isRetain(opA) && isRetain(opB)) {
        if (opA > opB) {
          min = opB;
          opA -= opB;
          opB = b[j++];
        } else if (opA === opB) {
          min = opB;
          opA = a[i++];
          opB = b[j++];
        } else {
          min = opA;
          opB -= opA;
          opA = a[i++];
        }
        prime1.retain(min);
        prime2.retain(min);
      } else if (isDelete(opA) && isDelete(opB)) {
        // Both sides deleted the same text, so neither needs to delete it again.
        if (-opA > -opB) {
          opA -= opB;
          opB = b[j++];
        } else if (opA === opB) {
          opA = a[i++];
          opB = b[j++];
        } else {
          opB -= opA;
          opA = a[i++];
        }
      } else if (isDelete(opA) && isRetain(opB)) {
        if (-opA > opB) {
          min = opB;
          opA += opB;
          opB = b[j++];
        } else if (-opA === opB) {
          min = opB;
          opA = a[i++];
          opB = b[j++];
        } else {
          min = -opA;
          opB += opA;
          opA = a[i++];
        }
        prime1.delete(min);
      } else if (isRetain(opA) && isDelete(opB)) {
        if (opA > -opB) {
          min = -opB;
          opA += opB;
          opB = b[j++];
        } else if (opA === -opB) {
          min = opA;
          opA = a[i++];
          opB = b[j++];
        } else {
          min = opA;
          opB += opA;
          opA = a[i++];
        }
        prime2.delete(min);
      }
    }
    return [prime1, prime2];
  }

  // Maps a character offset in the base document to the matching offset in
  // the target document. Used to keep cursors in place as text changes.
  transformIndex(index) {
    let newIndex = index;
    let remaining = index;
    for (const c of this.ops) {
      if (isRetain(c)) {
        remaining -= c;
      } else if (isInsert(c)) {
        newIndex += c.length;
      } else {
        newIndex -= Math.min(remaining, -c);
        remaining += c;
      }
      if (remaining < 0) break;
    }
    return newIndex;
  }

  toJSON() {
    return this.ops;
  }

  static fromJSON(ops) {
    if (!Array.isArray(ops)) throw new TypeError('Operation must be an array');
    const op = new TextOperation();
    for (const c of ops) {
      if (isRetain(c)) op.retain(c);
      else if (isInsert(c)) op.insert(c);
      else if (isDelete(c)) op.delete(-c);
      else throw new TypeError(`Invalid operation component: ${JSON.stringify(c)}`);
    }
    return op;
  }
}

// A selection is an array of { anchor, head } character offsets.
export function transformSelection(selection, operation) {
  return selection.map(({ anchor, head }) => ({
    anchor: operation.transformIndex(anchor),
    head: operation.transformIndex(head),
  }));
}
