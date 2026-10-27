import { useEffect, useState } from 'react';
import Landing from './components/Landing.jsx';
import Room from './components/Room.jsx';

const NAME_KEY = 'codesynq:name';

function roomFromPath() {
  const match = window.location.pathname.match(/^\/r\/([a-zA-Z0-9_-]{3,40})\/?$/);
  return match ? match[1] : null;
}

function loadName() {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

export default function App() {
  const [roomId, setRoomId] = useState(roomFromPath);
  const [name, setName] = useState(loadName);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const onPop = () => {
      setRoomId(roomFromPath());
      setJoined(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const enter = (id, displayName) => {
    try {
      localStorage.setItem(NAME_KEY, displayName);
    } catch {
      // Name just won't be remembered.
    }
    setName(displayName);
    if (id !== roomFromPath()) window.history.pushState(null, '', `/r/${id}`);
    setRoomId(id);
    setJoined(true);
  };

  const leave = () => {
    window.history.pushState(null, '', '/');
    setRoomId(null);
    setJoined(false);
  };

  if (roomId && joined) return <Room roomId={roomId} name={name} onLeave={leave} />;
  return <Landing initialName={name} invitedRoom={roomId} onEnter={enter} />;
}
