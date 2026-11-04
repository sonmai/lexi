import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { forgetOfflineDictionary } from './dictionary-service'
import './styles.css'

forgetOfflineDictionary()
// The retired service worker recreates its dictionary cache until the new worker takes control.
navigator.serviceWorker?.addEventListener('controllerchange', forgetOfflineDictionary)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
