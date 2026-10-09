import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Prevent mouse wheel from changing values on number inputs globally
document.addEventListener(
  'wheel',
  (e) => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && active.type === 'number') {
      active.blur();
    }
    const target = e.target as HTMLElement | null;
    if (target instanceof HTMLInputElement && target.type === 'number') {
      e.preventDefault();
    }
  },
  { passive: false }
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

