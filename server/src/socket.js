import { TextOperation } from '@codesynq/shared';
import { ROOM_ID, serializeFile } from './rooms.js';
import { execute } from './execute.js';

// Wraps a handler so thrown errors are reported through the socket.io ack
// callback instead of crashing the connection.
function handle(fn) {
  return async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      const result = await fn(payload ?? {});
      reply({ ok: true, ...result });
    } catch (err) {
      reply({ ok: false, error: err.message || 'Something went wrong' });
    }
  };
}

function parseSelection(selection) {
  if (!Array.isArray(selection) || selection.length > 32) throw new Error('Invalid selection');
  return selection.map((r) => {
    if (!Number.isInteger(r?.anchor) || !Number.isInteger(r?.head)) throw new Error('Invalid selection');
    return { anchor: r.anchor, head: r.head };
  });
}

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {import('./rooms.js').RoomManager} rooms
 */
export function registerSocketHandlers(io, socket, rooms) {
  const current = () => {
    const room = socket.data.roomId && rooms.get(socket.data.roomId);
    if (!room || !room.users.has(socket.id)) throw new Error('Join a room first');
    return room;
  };

  const leave = () => {
    const room = socket.data.roomId && rooms.get(socket.data.roomId);
    if (!room) return;
    room.removeUser(socket.id);
    socket.leave(room.id);
    socket.to(room.id).emit('user:left', { userId: socket.id });
    socket.data.roomId = null;
  };

  socket.on('join', handle(({ roomId, name }) => {
    if (typeof roomId !== 'string' || !ROOM_ID.test(roomId)) throw new Error('Invalid room id');
    const displayName = typeof name === 'string' ? name.trim().slice(0, 32) : '';
    if (!displayName) throw new Error('Name is required');

    leave();
    const room = rooms.getOrCreate(roomId);
    const user = room.addUser(socket.id, displayName);
    socket.data.roomId = roomId;
    socket.join(roomId);
    socket.to(roomId).emit('user:joined', user);
    return { you: user, room: room.snapshot() };
  }));

  socket.on('op', handle(({ fileId, revision, operation }) => {
    const room = current();
    const file = room.getFile(fileId);
    const transformed = file.doc.receiveOperation(revision, TextOperation.fromJSON(operation));
    socket.to(room.id).emit('op', { fileId, userId: socket.id, operation: transformed.toJSON() });
    return { revision: file.doc.revision };
  }));

  socket.on('selection', handle(({ fileId, revision, selection }) => {
    const room = current();
    const user = room.users.get(socket.id);
    if (fileId === null) {
      user.selection = null;
    } else {
      const file = room.getFile(fileId);
      user.selection = { fileId, ranges: file.doc.transformSelection(revision, parseSelection(selection)) };
    }
    socket.to(room.id).emit('selection', { userId: socket.id, selection: user.selection });
    return {};
  }));

  // Lets a client that got out of step reload one file from the server.
  socket.on('file:resync', handle(({ fileId }) => {
    const file = current().getFile(fileId);
    return { file: serializeFile(file) };
  }));

  socket.on('file:create', handle(({ name }) => {
    const room = current();
    const file = room.createFile(name);
    io.to(room.id).emit('file:created', { file: serializeFile(file), userId: socket.id });
    return { fileId: file.id };
  }));

  socket.on('file:rename', handle(({ fileId, name }) => {
    const room = current();
    const file = room.renameFile(fileId, name);
    io.to(room.id).emit('file:renamed', { fileId, name: file.name });
    return {};
  }));

  socket.on('file:delete', handle(({ fileId }) => {
    const room = current();
    room.deleteFile(fileId);
    io.to(room.id).emit('file:deleted', { fileId });
    return {};
  }));

  socket.on('run', handle(async ({ fileId, stdin }) => {
    const room = current();
    const file = room.getFile(fileId);
    if (room.running) throw new Error('Someone in this room is already running code');
    const user = room.users.get(socket.id);

    room.running = true;
    io.to(room.id).emit('run:started', { userId: socket.id, userName: user.name, fileName: file.name });
    let result;
    try {
      const others = [...room.files.values()].filter((f) => f.id !== file.id);
      const output = await execute(
        { name: file.name, content: file.doc.content },
        others.map((f) => ({ name: f.name, content: f.doc.content })),
        typeof stdin === 'string' ? stdin : '',
      );
      result = { ok: true, ...output };
    } catch (err) {
      result = { ok: false, error: err.name === 'TimeoutError' ? 'Execution timed out' : err.message };
    } finally {
      room.running = false;
    }
    io.to(room.id).emit('run:result', { userName: user.name, fileName: file.name, ...result });
    return {};
  }));

  socket.on('disconnect', leave);
}
