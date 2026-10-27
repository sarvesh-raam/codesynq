import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// No StrictMode: the editor session owns a socket and Monaco models, which
// should be created exactly once per room visit.
createRoot(document.getElementById('root')).render(<App />);
