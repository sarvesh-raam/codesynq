import { TextOperation, transformSelection } from './text-operation.js';

// Client-side OT state machine. A client has at most one operation in flight
// to the server; edits made while waiting for its acknowledgement are composed
// into a single buffered operation and sent once the ack arrives.
//
//   Synchronized       -- nothing pending
//   AwaitingConfirm    -- one operation sent, waiting for ack
//   AwaitingWithBuffer -- one operation sent, more local edits buffered

class Synchronized {
  applyClient(client, operation) {
    client.sendOperation(client.revision, operation);
    return new AwaitingConfirm(operation);
  }

  applyServer(client, operation) {
    client.applyOperation(operation);
    return this;
  }

  serverAck() {
    throw new Error('Received an acknowledgement with no pending operation');
  }

  transformSelection(selection) {
    return selection;
  }
}

const synchronized = new Synchronized();

class AwaitingConfirm {
  constructor(outstanding) {
    this.outstanding = outstanding;
  }

  applyClient(client, operation) {
    return new AwaitingWithBuffer(this.outstanding, operation);
  }

  applyServer(client, operation) {
    const [outstanding, incoming] = TextOperation.transform(this.outstanding, operation);
    client.applyOperation(incoming);
    return new AwaitingConfirm(outstanding);
  }

  serverAck() {
    return synchronized;
  }

  transformSelection(selection) {
    return transformSelection(selection, this.outstanding);
  }
}

class AwaitingWithBuffer {
  constructor(outstanding, buffer) {
    this.outstanding = outstanding;
    this.buffer = buffer;
  }

  applyClient(client, operation) {
    return new AwaitingWithBuffer(this.outstanding, this.buffer.compose(operation));
  }

  applyServer(client, operation) {
    const [outstanding, incoming1] = TextOperation.transform(this.outstanding, operation);
    const [buffer, incoming2] = TextOperation.transform(this.buffer, incoming1);
    client.applyOperation(incoming2);
    return new AwaitingWithBuffer(outstanding, buffer);
  }

  serverAck(client) {
    client.sendOperation(client.revision, this.buffer);
    return new AwaitingConfirm(this.buffer);
  }

  transformSelection(selection) {
    return transformSelection(transformSelection(selection, this.outstanding), this.buffer);
  }
}

export class OTClient {
  /**
   * @param {number} revision  server revision the local document is at
   * @param {object} handlers
   * @param {(revision: number, op: TextOperation) => void} handlers.sendOperation
   * @param {(op: TextOperation) => void} handlers.applyOperation  apply a remote op to the editor
   */
  constructor(revision, { sendOperation, applyOperation }) {
    this.revision = revision;
    this.state = synchronized;
    this.sendOperation = sendOperation;
    this.applyOperation = applyOperation;
  }

  get isSynchronized() {
    return this.state === synchronized;
  }

  // The user edited the document.
  applyClient(operation) {
    this.state = this.state.applyClient(this, operation);
  }

  // Another user's operation arrived from the server.
  applyServer(operation) {
    this.revision++;
    this.state = this.state.applyServer(this, operation);
  }

  // The server acknowledged our in-flight operation.
  serverAck() {
    this.revision++;
    this.state = this.state.serverAck(this);
  }

  // Maps a selection that is relative to the server's document onto the local
  // document, which may contain edits the server has not seen yet.
  transformSelection(selection) {
    return this.state.transformSelection(selection);
  }
}
