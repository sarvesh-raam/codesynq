import { OTClient, TextOperation, isRetain, isInsert, languageForFile, transformSelection } from '@codesynq/shared';
import { monaco } from './monaco.js';

const { Range } = monaco;
const STICKY = monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges;

// Connects one Monaco text model to the OT client for one shared file, and
// draws the cursors and selections of other users in that file.
export class FileBinding {
  /**
   * @param {import('./session.js').CollabSession} session
   * @param {{ id: string, name: string, content: string, revision: number }} file
   */
  constructor(session, file) {
    this.session = session;
    this.id = file.id;
    this.name = file.name;
    this.viewState = null;
    /** @type {Map<string, Array<{ anchor: number, head: number }>>} userId -> ranges */
    this.remote = new Map();
    this.decorationIds = [];
    this.applyingRemote = false;

    this.model = monaco.editor.createModel(
      file.content,
      languageForFile(file.name).monaco,
      monaco.Uri.parse(`file:///${file.id}/${encodeURIComponent(file.name)}`),
    );
    // Both sides count characters with LF line endings.
    this.model.setEOL(monaco.editor.EndOfLineSequence.LF);
    this.length = this.model.getValueLength();

    this.client = new OTClient(file.revision, {
      sendOperation: (revision, operation) => this.#send(revision, operation),
      applyOperation: (operation) => this.#applyRemote(operation),
    });
    this.subscription = this.model.onDidChangeContent((e) => this.#onLocalChange(e));
  }

  get synchronized() {
    return this.client.isSynchronized;
  }

  rename(name) {
    this.name = name;
    monaco.editor.setModelLanguage(this.model, languageForFile(name).monaco);
  }

  // A server operation from another user.
  receive(operation) {
    this.client.applyServer(TextOperation.fromJSON(operation));
  }

  // `ranges` are relative to the server document; map them onto ours.
  setRemoteSelection(userId, ranges) {
    if (ranges) this.remote.set(userId, this.client.transformSelection(ranges));
    else this.remote.delete(userId);
    this.render();
  }

  removeUser(userId) {
    if (this.remote.delete(userId)) this.render();
  }

  // Converts a Monaco content change event into a TextOperation. All changes
  // in one event refer to the document as it was before the event.
  #onLocalChange(event) {
    if (this.applyingRemote) return;
    const operation = new TextOperation();
    let cursor = 0;
    const changes = [...event.changes].sort((a, b) => a.rangeOffset - b.rangeOffset);
    for (const change of changes) {
      operation.retain(change.rangeOffset - cursor);
      operation.delete(change.rangeLength);
      operation.insert(change.text);
      cursor = change.rangeOffset + change.rangeLength;
    }
    operation.retain(this.length - cursor);
    this.length = this.model.getValueLength();

    if (operation.targetLength !== this.length) {
      // Should never happen; recover by reloading the file from the server.
      this.session.resync(this.id, 'Local edit could not be tracked');
      return;
    }

    for (const [userId, ranges] of this.remote) this.remote.set(userId, transformSelection(ranges, operation));
    const wasSynchronized = this.synchronized;
    this.client.applyClient(operation);
    if (wasSynchronized) this.session.changed();
    this.render();
  }

  #send(revision, operation) {
    this.session.socket.emit('op', { fileId: this.id, revision, operation: operation.toJSON() }, (res) => {
      if (this.session.bindings.get(this.id) !== this) return; // replaced since
      if (!res?.ok) {
        this.session.resync(this.id, res?.error);
        return;
      }
      this.client.serverAck();
      if (this.synchronized) this.session.onSynchronized(this);
    });
  }

  #applyRemote(operation) {
    // Build one edit per contiguous change; an insert directly followed by a
    // delete at the same spot becomes a single replace.
    const edits = [];
    let index = 0;
    for (const c of operation.ops) {
      if (isRetain(c)) {
        index += c;
        continue;
      }
      const edit = isInsert(c) ? { start: index, end: index, text: c } : { start: index, end: index - c, text: '' };
      if (!isInsert(c)) index -= c;
      const last = edits[edits.length - 1];
      if (last && last.end === edit.start) {
        last.end = edit.end;
        last.text += edit.text;
      } else {
        edits.push(edit);
      }
    }

    const monacoEdits = edits.map(({ start, end, text }) => ({
      range: Range.fromPositions(this.model.getPositionAt(start), this.model.getPositionAt(end)),
      text,
    }));

    this.applyingRemote = true;
    try {
      // pushEditOperations keeps the undo stack consistent with the document.
      this.model.pushEditOperations([], monacoEdits, () => null);
    } finally {
      this.applyingRemote = false;
    }
    this.length = this.model.getValueLength();

    for (const [userId, ranges] of this.remote) this.remote.set(userId, transformSelection(ranges, operation));
    this.render();
  }

  render() {
    const decorations = [];
    for (const [userId, ranges] of this.remote) {
      const user = this.session.users.get(userId);
      if (!user) continue;
      const cls = this.session.userClass(userId);
      ranges.forEach(({ anchor, head }, i) => {
        const a = this.model.getPositionAt(anchor);
        const h = this.model.getPositionAt(head);
        if (anchor !== head) {
          decorations.push({
            // Range normalizes start/end, so backwards selections work too.
            range: Range.fromPositions(a, h),
            options: { className: `remote-selection ${cls}`, stickiness: STICKY },
          });
        }
        decorations.push({
          range: Range.fromPositions(h, h),
          options: {
            beforeContentClassName: `remote-cursor ${cls}${i === 0 ? ' remote-cursor-label' : ''}`,
            hoverMessage: { value: user.name },
            stickiness: STICKY,
          },
        });
      });
    }
    this.decorationIds = this.model.deltaDecorations(this.decorationIds, decorations);
  }

  dispose() {
    this.subscription.dispose();
    this.model.dispose();
  }
}
