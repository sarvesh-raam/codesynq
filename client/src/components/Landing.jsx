import { useState } from 'react';
import { RUNNABLE_LANGUAGE_COUNT } from '@codesynq/shared';

const ROOM_ID = /^[a-zA-Z0-9_-]{3,40}$/;

function newRoomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const s = [...bytes].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10);
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

function parseRoom(input) {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/\/r\/([a-zA-Z0-9_-]{3,40})/);
  return fromUrl ? fromUrl[1] : trimmed;
}

const FEATURES = [
  ['Operational Transformation', 'Concurrent edits are transformed on a central server so every replica converges, character for character.'],
  [`${RUNNABLE_LANGUAGE_COUNT}+ languages`, 'Run code in a sandbox and share the output with everyone in the room.'],
  ['Live presence', 'See collaborators’ cursors and selections, colour-coded and labelled.'],
  ['Multi-file projects', 'Create, rename and delete files together. Other files are available when you run.'],
];

export default function Landing({ initialName, invitedRoom, onEnter }) {
  const [name, setName] = useState(initialName);
  const [room, setRoom] = useState('');
  const [error, setError] = useState('');

  const submit = (roomId) => {
    const displayName = name.trim();
    if (!displayName) return setError('Enter your name first');
    if (!ROOM_ID.test(roomId)) return setError('Room codes use 3-40 letters, digits, - or _');
    setError('');
    onEnter(roomId, displayName.slice(0, 32));
  };

  return (
    <div className="landing">
      <div className="landing-card">
        <div className="brand brand-large">
          <span className="brand-mark">{'</>'}</span> CodeSynq
        </div>
        <p className="tagline">Real-time collaborative code editor. Like Google Docs, for code.</p>

        <form
          className="landing-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit(invitedRoom ?? newRoomId());
          }}
        >
          <label>
            Your name
            <input autoFocus value={name} maxLength={32} placeholder="Ada Lovelace" onChange={(e) => setName(e.target.value)} />
          </label>

          {invitedRoom ? (
            <button className="btn btn-primary" type="submit">
              Join room <code>{invitedRoom}</code>
            </button>
          ) : (
            <>
              <button className="btn btn-primary" type="submit">Create a new room</button>
              <div className="divider"><span>or join one</span></div>
              <div className="join-row">
                <input value={room} placeholder="Room code or link" onChange={(e) => setRoom(e.target.value)} />
                <button className="btn" type="button" onClick={() => submit(parseRoom(room))}>Join</button>
              </div>
            </>
          )}
          {error && <p className="form-error">{error}</p>}
        </form>
      </div>

      <ul className="features">
        {FEATURES.map(([title, body]) => (
          <li key={title}>
            <h3>{title}</h3>
            <p>{body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
