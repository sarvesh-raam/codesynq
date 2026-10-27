# CodeSynq

A real-time collaborative code editor, like Google Docs for code. Share a link and everyone in the room edits the same files at the same time, sees each other's cursors, and runs the code together.

- **Operational Transformation.** A hand-written OT engine with a central server keeps every copy of a document identical, however many people type at once.
- **Live code execution in 47 languages.** Programs run in a [Piston](https://github.com/engineer-man/piston) sandbox, and stdout, stderr and exit codes are shown to the whole room.
- **Cursor presence.** Each collaborator's cursor and selection are shown in their own colour with a name label. The file list shows who is in which file.
- **Multi-file rooms.** Create, rename and delete files together. When you run a file, the other files in the room sit next to it, so imports work.
- **Monaco editor.** The editor from VS Code, with syntax highlighting chosen by file extension.

## Quick start

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open <http://localhost:5173>, enter a name and create a room. Open the invite link in another window to collaborate with yourself.

`npm run dev` starts the API and Socket.IO server on port 3001 and the Vite dev server on port 5173, which proxies to it.

### Code execution

The public Piston API at emkc.org has been allow-list only since 15 February 2026, so to run code you need your own Piston instance:

```bash
docker compose up -d piston
npm run runtimes                        # installs python, node, typescript, gcc, java, go, rust, ruby, php, bash
npm run runtimes -- kotlin swift dart   # or name specific Piston packages
npm run runtimes -- --all               # or install everything

# then point the server at it
PISTON_URL=http://localhost:2000/api/v2 npm run dev
```

The Run button is enabled only for files whose language has an installed runtime. You can also press **Ctrl/Cmd + Enter** in the editor.

### Production

`docker-compose.prod.yml` runs the whole stack: Caddy for HTTPS, the app, Piston, and a one-off job that installs language runtimes. Only ports 80 and 443 are exposed.

```bash
echo "DOMAIN=code.example.com" > .env
docker compose -f docker-compose.prod.yml up -d --build
```

Without Docker, run `npm run build && npm start`. The server then serves the built client from `client/dist`.

### Deploy free on Google Cloud

Google Cloud's free tier includes one e2-micro VM, which is enough for a small CodeSynq server with a few languages.

1. In the [Google Cloud console](https://console.cloud.google.com/compute/instances), create a VM instance:
   - **Region:** `us-central1`, `us-west1` or `us-east1` (only these are free)
   - **Machine type:** `e2-micro`
   - **Boot disk:** Debian 12, standard persistent disk, 30 GB
   - **Firewall:** tick *Allow HTTP traffic* and *Allow HTTPS traffic*
2. Click **SSH** next to the new VM and run:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/sarvesh-raam/codesynq/main/deploy/gcp-setup.sh | bash
   ```

   The script adds swap, installs Docker, builds the app and prints your URL, such as `https://34-12-56-78.sslip.io`. [sslip.io](https://sslip.io) maps that name to your VM's IP address, so you don't need a domain. The first build takes 5–10 minutes.

3. To use your own domain, point an A record at the VM and run `DOMAIN=code.example.com bash deploy/gcp-setup.sh` in `~/codesynq`. Install more languages with `RUNTIMES="python node gcc java go rust"`; each one uses disk space, and 1 GB of RAM limits how many programs can run at once.

Run the same command again to deploy the latest code. If you stop and start the VM, its IP address can change; re-run the script to get the new URL.

## How it works

```
 Browser (React + Monaco)                       Node server (Express + Socket.IO)
┌─────────────────────────────┐   op(rev, ops)    ┌───────────────────────────────┐
│ Monaco model ── FileBinding │ ────────────────▶ │ Room                          │
│        ▲            │       │                   │  └ File                       │
│        │       OTClient     │ ◀──── ack ─────── │     └ ServerDocument          │
│   apply remote   (state     │ ◀── op (others) ─ │        content + op history   │
│                   machine)  │                   │                               │
└─────────────────────────────┘                   │ run ──▶ Piston /execute       │
                                                  └───────────────────────────────┘
```

### The OT engine (`packages/shared`)

An edit is a `TextOperation`: a list of *retain n*, *insert "text"* and *delete n* steps that walks the whole document. Two functions do the real work:

- `compose(a, b)` merges two edits made one after the other into a single edit.
- `transform(a, b)` takes two edits made at the same time on the same document and returns `[a', b']` such that `apply(apply(doc, a), b') === apply(apply(doc, b), a')`.

The server holds the authoritative document and a history of every operation it has accepted. Each client tags its operation with the revision it was based on. The server transforms the operation past everything that happened since that revision, applies it, sends it to the other clients and acknowledges it to the sender.

Each client runs a three-state machine (`Synchronized` → `AwaitingConfirm` → `AwaitingWithBuffer`). It keeps at most one operation in flight and composes any further keystrokes into a buffer until the server acknowledges. When an operation from another user arrives, it is transformed against the client's own unacknowledged edits before being applied to the editor. Because the server puts every operation in one order, this is enough to make all copies converge. The tests check this by fuzzing several simulated clients with random edits and random message delays.

Cursor positions go through the same transforms (`transformIndex`), so a collaborator's cursor stays on the same text while other people type around it.

### Project layout

```
packages/shared/   OT engine (TextOperation, OTClient, ServerDocument) + language table
server/            Express + Socket.IO: rooms, OT server, presence, execution via Piston
client/            React + Vite + Monaco: editor binding, session, UI
scripts/           install-runtimes.mjs for a self-hosted Piston
```

### Socket events

| Client → server | Purpose |
| --- | --- |
| `join {roomId, name}` | Join or create a room; the reply contains every file and user |
| `op {fileId, revision, operation}` | Submit an edit; the reply is the acknowledgement |
| `selection {fileId, revision, selection}` | Cursor and selection ranges, transformed on the server to the current revision |
| `file:create` / `file:rename` / `file:delete` | Manage files |
| `file:resync {fileId}` | Reload a file if a client gets out of step |
| `run {fileId, stdin}` | Run a file; one run at a time per room |

The server broadcasts `op`, `selection`, `user:joined`, `user:left`, `file:created`, `file:renamed`, `file:deleted`, `run:started` and `run:result`.

## Testing

```bash
npm test
```

- **OT unit and fuzz tests:** compose and transform correctness, plus convergence of a server and several clients under random interleavings.
- **Server integration tests:** a real server with headless Socket.IO clients making concurrent edits, presence and file operations, input validation, and code execution against a stand-in Piston.

## Configuration

| Variable | Default | |
| --- | --- | --- |
| `PORT` | `3001` | HTTP and WebSocket port |
| `PISTON_URL` | `https://emkc.org/api/v2/piston` | Piston API base URL |
| `PISTON_TOKEN` | | Sent as `Authorization` if set (for an allow-listed public API key) |
| `RUN_TIMEOUT_MS` | `10000` | Request timeout for execution |
| `ROOM_TTL_MINUTES` | `60` | How long an empty room is kept in memory |
| `MAX_FILES_PER_ROOM` | `30` | |
| `MAX_USERS_PER_ROOM` | `25` | |
| `MAX_DOCUMENT_LENGTH` | `500000` | Characters per file |
| `CORS_ORIGIN` | | Comma-separated origins, if the client is hosted elsewhere |
| `CODESYNQ_SERVER` | `http://localhost:3001` | Where the Vite dev server proxies to |

## Limitations

- Rooms live in memory. They survive reconnects but not a server restart.
- If the connection drops while you have unacknowledged edits, those edits are discarded when you reconnect, and a notice tells you so.
- Undo (Ctrl+Z) works on the shared document, so it can undo a collaborator's change as well as your own.
- One server process; scaling across processes would need a shared store for the operation history.

## License

MIT
