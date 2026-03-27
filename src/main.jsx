import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Prevenir que Supabase gotrue-js corrompa navigator.locks al hacer alt-tab rápidamente
document.addEventListener('visibilitychange', (e) => {
  e.stopImmediatePropagation();
}, true);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
