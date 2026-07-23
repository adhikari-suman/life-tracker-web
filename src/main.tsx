import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Fonts are self-hosted via @fontsource rather than linked from the Google Fonts CDN. A finance
// tool should not tell a third party every time someone opens it, and a CDN outage should not be
// able to reflow the one screen where a misread figure costs money. Only the weights the tokens
// actually name are imported — five files, not the whole family.
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'

// The design tokens, imported once — here and nowhere else. Every component reads the custom
// properties; no component re-imports this file.
import './styles/tokens.css'

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
