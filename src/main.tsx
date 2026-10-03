import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { bootstrapTheme } from './lib/theme'
import './index.css'

// Stored theme goes on <html> before anything renders (no inline script: CSP).
bootstrapTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
