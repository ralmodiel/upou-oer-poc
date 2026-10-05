import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { bootstrapTheme } from './lib/theme'
import './index.css'

// Stored theme goes on <html> before anything renders (no inline script: CSP).
bootstrapTheme()
// The router restores scroll positions once the page is in (App.tsx); the browser's own
// restoration on a reload would land first on the empty shell.
history.scrollRestoration = 'manual'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
