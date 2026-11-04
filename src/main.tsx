import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles.css'
import { loadSounds, startScheduler } from './lib/alerts'
import { autoSync } from './lib/drive'
import { useStore, repairExpenses } from './store'

registerSW({ immediate: true })
autoSync()

// wait for IndexedDB hydration before rendering so the UI never flashes defaults
const go = () => { const ex = useStore.getState().expenses; const fixed = repairExpenses(ex); if (fixed !== ex) useStore.getState().patch({ expenses: fixed }); loadSounds(); createRoot(document.getElementById('root')!).render(<App />); startScheduler() }
if (useStore.persist.hasHydrated()) go()
else useStore.persist.onFinishHydration(go)

if (import.meta.env.DEV) (window as unknown as { __store: typeof useStore }).__store = useStore
