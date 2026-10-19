import React from 'react'
import { createRoot } from 'react-dom/client'
import Site from './site/Site.jsx'

// one-time cleanup: the retired layout editor stored offsets here
try { localStorage.removeItem('lh-layout-v1'); localStorage.removeItem('lh-layout-v2') } catch {}

createRoot(document.getElementById('root')).render(<Site />)
