import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore, buzz, startOfDay } from '../store'
import { SwipeRow } from '../lib/ui'
import { Icon } from '../lib/icons'

const RATE = 220 // ml per second while holding

export default function Water() {
  const { water, waterGoal, addWater, delWater, patch } = useStore()
  const [live, setLive] = useState(0)
  const [holding, setHolding] = useState(false)
  const raf = useRef(0), t0 = useRef(0), liveRef = useRef(0)

  const today = water.filter((w) => w.ts >= startOfDay())
  const total = today.reduce((a, w) => a + w.ml, 0)
  const pct = Math.min(1, (total + live) / waterGoal)

  const loop = () => {
    const ml = Math.min(1500, Math.round(((performance.now() - t0.current) / 1000) * RATE / 10) * 10)
    if (Math.floor(ml / 50) !== Math.floor(liveRef.current / 50)) buzz(5)
    liveRef.current = ml; setLive(ml)
    raf.current = requestAnimationFrame(loop)
  }
  const down = () => { t0.current = performance.now(); liveRef.current = 0; setHolding(true); raf.current = requestAnimationFrame(loop) }
  const up = () => {
    if (!holding) return
    cancelAnimationFrame(raf.current); setHolding(false)
    if (liveRef.current >= 30) { addWater(liveRef.current); buzz([15, 40, 15]) }
    liveRef.current = 0; setLive(0)
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  return (
    <div className="page" style={{ display: 'grid', gap: 18 }}>
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="eyebrow">{holding ? 'Release to log' : 'Press & hold the glass to fill'}</div>
        <motion.div
          onContextMenu={(e) => e.preventDefault()} onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up}
          animate={{ scale: holding ? 1.04 : 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          style={{ margin: '16px auto', width: 190, height: 250, position: 'relative', cursor: 'pointer', touchAction: 'none', borderRadius: '14px 14px 40px 40px / 14px 14px 46px 46px', overflow: 'hidden', border: '3px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.04)' }}
        >
          <motion.div animate={{ height: `${pct * 100}%` }} transition={{ type: 'spring', stiffness: 90, damping: 18 }}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(180deg, var(--a2), var(--a))' }}>
            <svg viewBox="0 0 200 20" preserveAspectRatio="none" style={{ position: 'absolute', top: -14, left: 0, width: '200%', height: 16, animation: 'wave 3s linear infinite' }}>
              <path d="M0 10 Q25 0 50 10 T100 10 T150 10 T200 10 V20 H0Z" fill="var(--a2)" />
            </svg>
          </motion.div>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textShadow: '0 2px 14px rgba(0,0,0,.5)' }}>
            <div>
              <div className="big" style={{ fontSize: 44 }}>{holding ? `+${live}` : Math.round(pct * 100) + '%'}</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{holding ? 'ml' : `${total} / ${waterGoal} ml`}</div>
            </div>
          </div>
        </motion.div>
        <style>{`@keyframes wave { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
        <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          {[150, 250, 500].map((ml) => (
            <button key={ml} className="btn ghost sm" onClick={() => { addWater(ml); buzz([12, 30, 12]) }}>+{ml}</button>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
          <button className="icon-btn" onClick={() => patch({ waterGoal: Math.max(500, waterGoal - 250) })}><Icon name="minus" size={16} /></button>
          <div className="hint">Daily goal <b style={{ color: 'var(--a)' }}>{waterGoal} ml</b></div>
          <button className="icon-btn" onClick={() => patch({ waterGoal: waterGoal + 250 })}><Icon name="plus" size={16} /></button>
        </div>
        <div className="hint" style={{ marginTop: 10 }}>Set sip reminders and your own alarm sound in ⚙️ Setup.</div>
      </div>

      <div>
        <div className="eyebrow sec">Today · swipe ← to undo</div>
        {today.length === 0 && <div className="hint">No sips yet.</div>}
        {today.map((w) => (
          <SwipeRow key={w.id} onLeft={() => delWater(w.id)}>
            <span style={{ color: 'var(--a)', display: 'grid' }}><Icon name="drop" size={24} /></span>
            <div style={{ flex: 1, fontWeight: 700 }}>{w.ml} ml</div>
            <div className="hint">{new Date(w.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </SwipeRow>
        ))}
      </div>
    </div>
  )
}
