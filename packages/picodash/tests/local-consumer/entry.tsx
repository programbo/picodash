import { createRoot } from 'react-dom/client'
import '@picodash/picodash/style.css'
import '@picodash/dashpanel/resize-handles.css'
import { ConsumerApp } from './app.tsx'

const host = document.getElementById('root')
if (!host) throw new Error('Missing consumer host.')
createRoot(host).render(<ConsumerApp />)
