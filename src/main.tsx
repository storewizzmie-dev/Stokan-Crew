import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

(window as unknown as { __VITE_ACTIVE__?: boolean }).__VITE_ACTIVE__ = true;

createRoot(document.getElementById('root')!).render(<App />);
