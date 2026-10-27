import { io } from 'socket.io-client';
import { FileBinding } from './file-binding.js';

let noticeId = 0;

// Owns the socket connection for one room and every shared file in it.
// React components read state through subscribe() / getSnapshot().
export class CollabSession {
  constructor(roomId, name) {
    this.roomId = roomId;
    this.name = name;
    /** @type {Map<string, FileBinding>} */
    this.bindings = new Map();
    /** @type {Map<string, { id: string, name: string, color: string, selection: object | null }>} */
    this.users = new Map();
    this.you = null;
    this.status = 'connecting';
    this.error = null;
    this.activeFileId = null;
    this.run = { running: false, userName: null, fileName: null, result: null };
    this.notices = [];
    this.editor = null;
    this.editorSubscriptions = [];
    this.listeners = new Set();
    this.userClasses = new Map();
    this.styleEl = document.createElement('style');
    document.head.appendChild(this.styleEl);
    this.snapshot = this.#buildSnapshot();

    this.socket = io({ transports: ['websocket'] });
    this.#wireSocket();
  }

  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  changed() {
    this.snapshot = this.#buildSnapshot();
    for (const listener of this.listeners) listener();
  }

  #buildSnapshot() {
    const files = [...this.bindings.values()]
      .map((b) => ({ id: b.id, name: b.name, synchronized: b.synchronized }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      status: this.status,
      error: this.error,
      you: this.you,
      users: [...this.users.values()],
      files,
      activeFileId: this.activeFileId,
      synchronized: files.every((f) => f.synchronized),
      run: this.run,
      notices: this.notices,
    };
  }

  notify(text, kind = 'info') {
    const id = ++noticeId;
    this.notices = [...this.notices, { id, text, kind }];
    this.changed();
    setTimeout(() => {
      this.notices = this.notices.filter((n) => n.id !== id);
      this.changed();
    }, 4000);
  }

  // ---- socket events -------------------------------------------------------

  #wireSocket() {
    const s = this.socket;

    s.on('connect', () => this.#join());
    s.on('disconnect', () => {
      this.status = 'reconnecting';
      this.changed();
    });

    s.on('op', ({ fileId, operation }) => this.bindings.get(fileId)?.receive(operation));

    s.on('selection', ({ userId, selection }) => {
      const user = this.users.get(userId);
      if (!user) return;
      user.selection = selection;
      this.#showSelection(user);
      this.changed();
    });

    s.on('user:joined', (user) => {
      this.users.set(user.id, user);
      this.#updateUserStyles();
      this.notify(`${user.name} joined`);
    });

    s.on('user:left', ({ userId }) => {
      const user = this.users.get(userId);
      this.users.delete(userId);
      for (const b of this.bindings.values()) b.removeUser(userId);
      this.#updateUserStyles();
      if (user) this.notify(`${user.name} left`);
    });

    s.on('file:created', ({ file }) => {
      if (!this.bindings.has(file.id)) this.bindings.set(file.id, new FileBinding(this, file));
      this.changed();
    });

    s.on('file:renamed', ({ fileId, name }) => {
      this.bindings.get(fileId)?.rename(name);
      this.changed();
    });

    s.on('file:deleted', ({ fileId }) => {
      const binding = this.bindings.get(fileId);
      if (!binding) return;
      this.bindings.delete(fileId);
      if (this.activeFileId === fileId) this.setActiveFile(this.snapshot.files.find((f) => f.id !== fileId)?.id);
      binding.dispose();
      this.changed();
    });

    s.on('run:started', ({ userName, fileName }) => {
      this.run = { running: true, userName, fileName, result: null };
      this.changed();
    });

    s.on('run:result', (result) => {
      this.run = { running: false, userName: result.userName, fileName: result.fileName, result };
      this.changed();
    });
  }

  #join() {
    this.socket.emit('join', { roomId: this.roomId, name: this.name }, (res) => {
      if (!res?.ok) {
        this.status = 'error';
        this.error = res?.error || 'Could not join the room';
        this.changed();
        return;
      }
      this.#load(res);
    });
  }

  #load({ you, room }) {
    const hadUnsentEdits = [...this.bindings.values()].some((b) => !b.synchronized);
    const previousActive = this.bindings.get(this.activeFileId)?.name;

    this.you = you;
    this.users = new Map(room.users.filter((u) => u.id !== you.id).map((u) => [u.id, u]));
    this.#updateUserStyles();

    if (this.editor) this.editor.setModel(null);
    for (const b of this.bindings.values()) b.dispose();
    this.bindings = new Map(room.files.map((f) => [f.id, new FileBinding(this, f)]));
    for (const user of this.users.values()) this.#showSelection(user);

    const sorted = [...this.bindings.values()].sort((a, b) => a.name.localeCompare(b.name));
    const active = sorted.find((b) => b.name === previousActive) ?? sorted[0];
    this.activeFileId = null;
    this.status = 'connected';
    this.error = null;
    this.setActiveFile(active?.id);
    if (hadUnsentEdits) this.notify('Reconnected. Edits made while offline were discarded.', 'error');
  }

  #showSelection(user) {
    for (const b of this.bindings.values()) {
      b.setRemoteSelection(user.id, user.selection?.fileId === b.id ? user.selection.ranges : null);
    }
  }

  // ---- presence styling ----------------------------------------------------

  userClass(userId) {
    if (!this.userClasses.has(userId)) this.userClasses.set(userId, `u${this.userClasses.size}`);
    return this.userClasses.get(userId);
  }

  #updateUserStyles() {
    const css = [];
    for (const user of this.users.values()) {
      const cls = this.userClass(user.id);
      const label = user.name.replace(/["\\\r\n]/g, ' ');
      css.push(
        `.remote-selection.${cls} { background: ${user.color}40; }`,
        `.remote-cursor.${cls} { border-left-color: ${user.color}; }`,
        `.remote-cursor-label.${cls}::after { content: "${label}"; background: ${user.color}; }`,
      );
    }
    this.styleEl.textContent = css.join('\n');
    for (const b of this.bindings.values()) b.render();
  }

  // ---- editor --------------------------------------------------------------

  /** @param {import('monaco-editor').editor.IStandaloneCodeEditor} editor */
  attachEditor(editor) {
    this.editor = editor;
    this.editorSubscriptions = [editor.onDidChangeCursorSelection(() => this.#scheduleSelection())];
    const active = this.bindings.get(this.activeFileId);
    if (active) editor.setModel(active.model);
  }

  detachEditor() {
    for (const s of this.editorSubscriptions) s.dispose();
    this.editorSubscriptions = [];
    this.editor = null;
  }

  setActiveFile(fileId) {
    const previous = this.bindings.get(this.activeFileId);
    if (previous && this.editor?.getModel() === previous.model) previous.viewState = this.editor.saveViewState();

    const next = this.bindings.get(fileId);
    this.activeFileId = next?.id ?? null;
    if (this.editor) {
      this.editor.setModel(next?.model ?? null);
      if (next?.viewState) this.editor.restoreViewState(next.viewState);
      this.editor.focus();
    }
    this.sendSelection();
    this.changed();
  }

  #scheduleSelection() {
    clearTimeout(this.selectionTimer);
    this.selectionTimer = setTimeout(() => this.sendSelection(), 30);
  }

  sendSelection() {
    if (this.status !== 'connected') return;
    const binding = this.bindings.get(this.activeFileId);
    if (!binding || !this.editor || this.editor.getModel() !== binding.model) {
      this.socket.emit('selection', { fileId: null });
      return;
    }
    // Selections are only meaningful to the server once our edits are
    // acknowledged; onSynchronized() sends the latest one when that happens.
    if (!binding.synchronized) return;
    const model = binding.model;
    const selection = this.editor.getSelections().map((s) => ({
      anchor: model.getOffsetAt({ lineNumber: s.selectionStartLineNumber, column: s.selectionStartColumn }),
      head: model.getOffsetAt(s.getPosition()),
    }));
    this.socket.emit('selection', { fileId: binding.id, revision: binding.client.revision, selection });
  }

  onSynchronized(binding) {
    if (binding.id === this.activeFileId) this.sendSelection();
    this.changed();
  }

  resync(fileId, reason) {
    this.socket.emit('file:resync', { fileId }, (res) => {
      if (!res?.ok) return;
      const old = this.bindings.get(fileId);
      const binding = new FileBinding(this, res.file);
      this.bindings.set(fileId, binding);
      for (const user of this.users.values()) this.#showSelection(user);
      if (this.activeFileId === fileId && this.editor) {
        const viewState = this.editor.saveViewState();
        this.editor.setModel(binding.model);
        this.editor.restoreViewState(viewState);
      }
      old?.dispose();
      this.changed();
      this.notify(`Reloaded ${res.file.name}${reason ? `: ${reason}` : ''}`, 'error');
    });
  }

  // ---- actions -------------------------------------------------------------

  #request(event, payload) {
    return new Promise((resolve, reject) => {
      this.socket.timeout(10_000).emit(event, payload, (err, res) => {
        if (err) reject(new Error('The server did not respond'));
        else if (!res?.ok) reject(new Error(res?.error || 'Request failed'));
        else resolve(res);
      });
    });
  }

  async createFile(name) {
    const { fileId } = await this.#request('file:create', { name });
    this.setActiveFile(fileId);
  }

  renameFile(fileId, name) {
    return this.#request('file:rename', { fileId, name });
  }

  deleteFile(fileId) {
    return this.#request('file:delete', { fileId });
  }

  async runActiveFile(stdin) {
    if (!this.activeFileId) return;
    try {
      // Execution happens on the server's copy of the files, so make sure our
      // latest keystrokes have reached it first.
      await this.#waitForSync();
      await new Promise((resolve, reject) => {
        this.socket.emit('run', { fileId: this.activeFileId, stdin }, (res) =>
          res?.ok ? resolve() : reject(new Error(res?.error || 'Could not run the file')));
      });
    } catch (err) {
      this.notify(err.message, 'error');
    }
  }

  #waitForSync(timeoutMs = 5000) {
    if (this.snapshot.synchronized) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error('Still sending your edits to the server, try again'));
      }, timeoutMs);
      const unsubscribe = this.subscribe(() => {
        if (!this.snapshot.synchronized) return;
        clearTimeout(timer);
        unsubscribe();
        resolve();
      });
    });
  }

  dispose() {
    clearTimeout(this.selectionTimer);
    this.socket.disconnect();
    this.detachEditor();
    for (const b of this.bindings.values()) b.dispose();
    this.bindings.clear();
    this.styleEl.remove();
    this.listeners.clear();
  }
}
