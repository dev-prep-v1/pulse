import { useEffect, useState, useSyncExternalStore } from 'react'
import { motion, type PanInfo } from 'framer-motion'
import { useStore, buzz } from './store'
import Spend from './zones/Spend'
import Water from './zones/Water'
import Focus from './zones/Focus'
import Workout from './zones/Workout'
import Settings from './zones/Settings'
import { Icon } from './lib/icons'
import { driveStatus, quietSync } from './lib/drive'

import { ZONES, fixOrder } from './lib/zones'

export default function App() {
  const zone = useStore((s) => s.zone)
  const order = fixOrder(useStore((s) => s.navOrder))
  const pos = order.indexOf(zone)
  const patch = useStore((s) => s.patch)
  const [settings, setSettings] = useState(false)
  const ds = useSyncExternalStore(driveStatus.sub, driveStatus.get)
  const lastSync = useStore((s) => s.lastSync)
  const [, tick] = useState(0)
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(i) }, [])
  const ago = (() => { if (!lastSync) return ''; const m = Math.floor((Date.now() - lastSync) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago` })()
  const go = (z: number) => { if (z !== zone && z >= 0 && z < 4) { buzz(8); patch({ zone: z }) } }
  const goPos = (p: number) => { if (p >= 0 && p < 4) go(order[p]) }

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key >= '1' && e.key <= '4') goPos(Number(e.key) - 1)
      if (e.key === 'ArrowRight' && e.altKey) goPos(pos + 1)
      if (e.key === 'ArrowLeft' && e.altKey) goPos(pos - 1)
    }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  })

  // scrub along the dock to switch zones
  const scrub = (_: unknown, i: PanInfo) => {
    if (Math.abs(i.offset.x) > 40) goPos(pos + (i.offset.x < 0 ? 1 : -1))
  }

  return (
    <div className="app" data-zone={zone}>
      <div className="glow" />
      <nav className="rail">
        <div className="logo">PULSE</div>
        {order.map((i) => (
          <button key={ZONES[i].key} className={i === zone ? 'on' : ''} onClick={() => go(i)}><b><Icon name={ZONES[i].emoji} size={23} /></b>{ZONES[i].title}</button>
        ))}
        <div className="sp" />
        <button onClick={() => setSettings(true)}><b><Icon name="gear" size={23} /></b>Setup</button>
      </nav>

      <div className="main">
        <header className="top">
          <div>
            <h1>{ZONES[zone].title}</h1>
            <div className="sub">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</div>
          </div>
          {ds !== 'off' && (
            <button className={`syncchip ${ds}`} onClick={() => (ds === 'error' ? setSettings(true) : quietSync())}>
              <Icon name="cloud" size={14} />
              {ds === 'syncing' ? 'Syncing…' : ds === 'error' ? 'Reconnect' : `Synced ${ago}`.trim()}
            </button>
          )}
          <button className="icon-btn" onClick={() => setSettings(true)} aria-label="Settings"><Icon name="gear" size={19} /></button>
        </header>
        <motion.div key={zone} className="scroll" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
          {zone === 0 && <Spend />}
          {zone === 1 && <Water />}
          {zone === 2 && <Focus />}
          {zone === 3 && <Workout />}
        </motion.div>

        <motion.nav className="dock" onPanEnd={scrub}>
          <motion.div className="pill" animate={{ left: `calc(${pos * 25}% + 3px)` }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
          {order.map((i) => (
            <button key={ZONES[i].key} className={i === zone ? 'on' : ''} onClick={() => go(i)}><b><Icon name={ZONES[i].emoji} size={23} /></b>{ZONES[i].key}</button>
          ))}
        </motion.nav>
      </div>
      {settings && <Settings onClose={() => setSettings(false)} />}
    </div>
  )
}
