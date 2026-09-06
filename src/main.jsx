import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

import './index.css'
import App from './App.jsx'

registerSW({
  immediate: true,

  onNeedRefresh() {
    console.log(
      'A new version of Family Recipes is available.'
    )
  },

  onOfflineReady() {
    console.log(
      'Family Recipes is ready to work offline.'
    )
  },
})

createRoot(
  document.getElementById('root')
).render(
  <StrictMode>
    <App />
  </StrictMode>
)