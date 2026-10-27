import { TextOperation, transformSelection } from './text-operation.js';

// The authoritative copy of a document. Every accepted operation is appended
// to the history; its index + 1 is the document revision it produced.
export class ServerDocument {
  constructor(content = '', { maxLength = 1_000_000 } = {}) {
    this.content = content;
    this.operations = [];
    this.maxLength = maxLength;
  }

  get revision() {
    return this.operations.length;
  }

  /**
   * Accepts an operation that a client made against `revision`, transforms it
   * past every operation the client had not seen, and applies it.
   * Returns the transformed operation, which is what other clients must apply.
   */
  receiveOperation(revision, operation) {
    this.#checkRevision(revision);
    for (const concurrent of this.operations.slice(revision)) {
      [operation] = TextOperation.transform(operation, concurrent);
    }
    if (operation.targetLength > this.maxLength) {
      throw new Error(`Document would exceed ${this.maxLength} characters`);
    }
    this.content = operation.apply(this.content);
    this.operations.push(operation);
    return operation;
  }

  // Brings a selection made at `revision` up to the current revision.
  transformSelection(revision, selection) {
    this.#checkRevision(revision);
    for (const concurrent of this.operations.slice(revision)) {
      selection = transformSelection(selection, concurrent);
    }
    const max = this.content.length;
    const clamp = (n) => Math.max(0, Math.min(max, n));
    return selection.map(({ anchor, head }) => ({ anchor: clamp(anchor), head: clamp(head) }));
  }

  #checkRevision(revision) {
    if (!Number.isInteger(revision) || revision < 0 || revision > this.operations.length) {
      throw new Error(`Invalid revision ${revision} (server is at ${this.operations.length})`);
    }
  }
}
