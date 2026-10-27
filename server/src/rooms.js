import { randomUUID } from 'node:crypto';
import { ServerDocument, languageForFile, validateFileName } from '@codesynq/shared';
import { config } from './config.js';

const COLORS = [
  '#f87171', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#38bdf8',
  '#818cf8', '#c084fc', '#f472b6', '#a3e635', '#fbbf24', '#22d3ee',
];

export const ROOM_ID = /^[a-zA-Z0-9_-]{3,40}$/;

export class Room {
  constructor(id) {
    this.id = id;
    /** @type {Map<string, { id: string, name: string, doc: ServerDocument }>} */
    this.files = new Map();
    /** @type {Map<string, { id: string, name: string, color: string, selection: object | null }>} */
    this.users = new Map();
    this.emptySince = Date.now();
    this.running = false;
    this.createFile('main.py', languageForFile('main.py').hello);
  }

  createFile(name, content = languageForFile(name).hello) {
    const error = validateFileName(name);
    if (error) throw new Error(error);
    name = name.trim();
    if (this.files.size >= config.maxFilesPerRoom) throw new Error(`A room can hold at most ${config.maxFilesPerRoom} files`);
    if (this.#nameTaken(name)) throw new Error(`"${name}" already exists`);
    const file = {
      id: randomUUID(),
      name,
      doc: new ServerDocument(content, { maxLength: config.maxDocumentLength }),
    };
    this.files.set(file.id, file);
    return file;
  }

  renameFile(fileId, name) {
    const file = this.getFile(fileId);
    const error = validateFileName(name);
    if (error) throw new Error(error);
    name = name.trim();
    if (this.#nameTaken(name, fileId)) throw new Error(`"${name}" already exists`);
    file.name = name;
    return file;
  }

  deleteFile(fileId) {
    this.getFile(fileId);
    if (this.files.size === 1) throw new Error('A room needs at least one file');
    this.files.delete(fileId);
    for (const user of this.users.values()) {
      if (user.selection?.fileId === fileId) user.selection = null;
    }
  }

  getFile(fileId) {
    const file = this.files.get(fileId);
    if (!file) throw new Error('File not found');
    return file;
  }

  addUser(id, name) {
    if (this.users.size >= config.maxUsersPerRoom) throw new Error('This room is full');
    const used = new Set([...this.users.values()].map((u) => u.color));
    const color = COLORS.find((c) => !used.has(c)) ?? COLORS[this.users.size % COLORS.length];
    const user = { id, name, color, selection: null };
    this.users.set(id, user);
    this.emptySince = null;
    return user;
  }

  removeUser(id) {
    this.users.delete(id);
    if (this.users.size === 0) this.emptySince = Date.now();
  }

  snapshot() {
    return {
      id: this.id,
      files: [...this.files.values()].map(serializeFile),
      users: [...this.users.values()],
    };
  }

  #nameTaken(name, exceptId) {
    const lower = name.toLowerCase();
    return [...this.files.values()].some((f) => f.id !== exceptId && f.name.toLowerCase() === lower);
  }
}

export function serializeFile(file) {
  return { id: file.id, name: file.name, content: file.doc.content, revision: file.doc.revision };
}

export class RoomManager {
  constructor() {
    /** @type {Map<string, Room>} */
    this.rooms = new Map();
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref();
  }

  getOrCreate(id) {
    let room = this.rooms.get(id);
    if (!room) {
      room = new Room(id);
      this.rooms.set(id, room);
    }
    return room;
  }

  get(id) {
    return this.rooms.get(id);
  }

  sweep(now = Date.now()) {
    for (const [id, room] of this.rooms) {
      if (room.emptySince !== null && now - room.emptySince > config.roomTtlMs) this.rooms.delete(id);
    }
  }
}
