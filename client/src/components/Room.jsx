import { useEffect, useState, useSyncExternalStore } from 'react';
import { languageForFile } from '@codesynq/shared';
import { CollabSession } from '../lib/session.js';
import Editor from './Editor.jsx';
import FileTree from './FileTree.jsx';
import OutputPanel from './OutputPanel.jsx';

function useRunnableExtensions() {
  // null = unknown (execution service unreachable); let the server decide.
  const [runnable, setRunnable] = useState(null);
  useEffect(() => {
    fetch('/api/runtimes')
      .then((r) => r.json())
      .then((body) => body.ok && setRunnable(new Set(body.runnable)))
      .catch(() => {});
  }, []);
  return runnable;
}

export default function Room({ roomId, name, onLeave }) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    const s = new CollabSession(roomId, name);
    setSession(s);
    return () => s.dispose();
  }, [roomId, name]);

  if (!session) return null;
  return <RoomView session={session} roomId={roomId} onLeave={onLeave} />;
}

function RoomView({ session, roomId, onLeave }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const runnable = useRunnableExtensions();
  const [stdin, setStdin] = useState('');
  const [copied, setCopied] = useState(false);

  const activeFile = state.files.find((f) => f.id === state.activeFileId);
  const language = activeFile ? languageForFile(activeFile.name) : null;
  const canRun = Boolean(language?.piston) && (runnable === null || runnable.has(language.ext));
  const runDisabled = !canRun || state.run.running || state.status !== 'connected';

  const run = () => {
    if (!runDisabled) session.runActiveFile(stdin);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      session.notify('Copy failed. Share the address bar URL instead.', 'error');
    }
  };

  if (state.status === 'error') {
    return (
      <div className="landing">
        <div className="landing-card">
          <h2>Couldn&rsquo;t join this room</h2>
          <p className="form-error">{state.error}</p>
          <button className="btn btn-primary" onClick={onLeave}>Back to start</button>
        </div>
      </div>
    );
  }

  const everyone = state.you ? [state.you, ...state.users] : state.users;

  return (
    <div className="room">
      <header className="topbar">
        <button className="brand" onClick={onLeave} title="Leave room">
          <span className="brand-mark">{'</>'}</span> CodeSynq
        </button>
        <div className="room-id">
          <span className="muted">Room</span> <code>{roomId}</code>
          <button className="btn btn-small" onClick={copyLink}>{copied ? 'Copied!' : 'Copy invite link'}</button>
        </div>
        <div className="spacer" />
        <ul className="avatars" aria-label="People in this room">
          {everyone.map((u) => (
            <li key={u.id} style={{ background: u.color }} title={u.id === state.you?.id ? `${u.name} (you)` : u.name}>
              {u.name.slice(0, 1).toUpperCase()}
            </li>
          ))}
        </ul>
        <button
          className="btn btn-run"
          onClick={run}
          disabled={runDisabled}
          title={canRun ? 'Run the current file (Ctrl+Enter)' : `${language?.label ?? 'This file'} can’t be run`}
        >
          {state.run.running ? 'Running…' : '▶ Run'}
        </button>
      </header>

      <div className="workspace">
        <FileTree session={session} files={state.files} activeFileId={state.activeFileId} users={state.users} />
        <main className="main">
          <div className="editor-wrap">
            <Editor session={session} onRun={run} />
            {state.status !== 'connected' && (
              <div className="overlay">{state.status === 'connecting' ? 'Connecting…' : 'Connection lost. Reconnecting…'}</div>
            )}
          </div>
          <div className="statusbar">
            <span>{language?.label ?? ''}</span>
            <span className="spacer" />
            <span className={state.synchronized ? 'ok' : 'muted'}>{state.synchronized ? '● Synced' : '○ Syncing…'}</span>
            <span>{everyone.length} online</span>
          </div>
          <OutputPanel run={state.run} stdin={stdin} onStdinChange={setStdin} />
        </main>
      </div>

      <div className="notices" aria-live="polite">
        {state.notices.map((n) => (
          <div key={n.id} className={`notice notice-${n.kind}`}>{n.text}</div>
        ))}
      </div>
    </div>
  );
}
