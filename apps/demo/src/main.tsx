import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'panel/style.css'
import { App } from './App.tsx'
import './style.css'

const root = document.querySelector<HTMLDivElement>('#root')

if (!root) {
  throw new Error('Missing root element')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
