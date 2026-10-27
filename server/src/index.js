import { existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { LANGUAGES } from '@codesynq/shared';
import { config } from './config.js';
import { RoomManager } from './rooms.js';
import { registerSocketHandlers } from './socket.js';
import { getRuntimes } from './execute.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 2e6,
  cors: config.corsOrigin ? { origin: config.corsOrigin.split(',') } : undefined,
});
const rooms = new RoomManager();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.rooms.size });
});

// Which file extensions can actually be run against the configured Piston.
app.get('/api/runtimes', async (_req, res) => {
  try {
    const runtimes = await getRuntimes();
    const installed = new Set(runtimes.flatMap((r) => [r.language, ...(r.aliases ?? [])]));
    const runnable = LANGUAGES.filter((l) => l.piston && installed.has(l.piston)).map((l) => l.ext);
    res.json({ ok: true, runnable });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message, runnable: [] });
  }
});

// Serve the built client in production.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/(api|socket\.io)\/).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

io.on('connection', (socket) => registerSocketHandlers(io, socket, rooms));

server.listen(config.port, () => {
  console.log(`CodeSynq server listening on http://localhost:${config.port}`);
  console.log(`Code execution via ${config.pistonUrl}`);
});
