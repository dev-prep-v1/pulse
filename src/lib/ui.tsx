import { useEffect, useId, useRef, type ReactNode, type PointerEvent } from 'react'
import { motion, useMotionValue, useTransform, useDragControls, animate } from 'framer-motion'
import { buzz } from '../store'
import { Icon } from './icons'

/** Row you can swipe: left = destructive action, right = secondary action. */
export function SwipeRow({ children, onLeft, onRight, leftLabel = '🗑 Delete', rightLabel = '⎘ Again' }: {
  children: ReactNode; onLeft?: () => void; onRight?: () => void; leftLabel?: string; rightLabel?: string
}) {
  const x = useMotionValue(0)
  const bg = useTransform(x, [-120, 0, 120], ['rgba(255,70,70,.9)', 'rgba(0,0,0,0)', 'rgba(60,200,120,.9)'])
  const crossed = useRef(0)
  return (
    <div className="swipe">
      <motion.div className="under" style={{ background: bg }}>
        <span>{onRight ? rightLabel : ''}</span><span>{onLeft ? leftLabel : ''}</span>
      </motion.div>
      <motion.div
        className="item" style={{ x }} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.55}
        onDrag={(_, i) => { const c = Math.abs(i.offset.x) > 100 ? 1 : 0; if (c !== crossed.current) { crossed.current = c; if (c) buzz(10) } }}
        onDragEnd={(_, i) => {
          crossed.current = 0
          if (i.offset.x < -100 && onLeft) { animate(x, -500, { duration: 0.18 }).then(onLeft); buzz(18) }
          else if (i.offset.x > 100 && onRight) { onRight(); buzz([10, 40, 10]) }
        }}
      >{children}</motion.div>
    </div>
  )
}

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const controls = useDragControls()
  const y = useMotionValue(typeof window === 'undefined' ? 800 : window.innerHeight)
  const bg = useTransform(y, [0, 500], [1, 0])
  useEffect(() => { animate(y, 0, { type: 'spring', damping: 30, stiffness: 320 }) }, [y])
  const close = () => { buzz(8); animate(y, window.innerHeight, { duration: 0.22 }).then(onClose) }
  return (
    <>
      <motion.div className="sheet-bg" style={{ opacity: bg }} onClick={close} />
      <motion.div className="sheet" style={{ y }} drag="y" dragControls={controls} dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, i) => { if (i.offset.y > 120 || i.velocity.y > 500) close() }}>
        <div onPointerDown={(e) => controls.start(e)} style={{ padding: '4px 0 14px', touchAction: 'none', cursor: 'grab' }}>
          <div className="grab" style={{ margin: '0 auto' }} />
        </div>
        {children}
      </motion.div>
    </>
  )
}

/** Press-and-hold that cancels when the finger moves (so drags never trigger it).
 *  `fired` lets the tap/click handler ignore the release that follows a hold. */
export function useHold(onHold: () => void, ms = 650) {
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)
  const clear = () => clearTimeout(t.current)
  const bind = {
    onPointerDown: (e: PointerEvent) => {
      fired.current = false; start.current = { x: e.clientX, y: e.clientY }; clear()
      t.current = setTimeout(() => { fired.current = true; buzz([20, 30, 20]); onHold() }, ms)
    },
    onPointerMove: (e: PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear()
    },
    onPointerUp: clear, onPointerLeave: clear, onPointerCancel: clear,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  }
  return { bind, fired }
}

/** Sliding-pill segmented control (replaces <select>). */
export function Seg<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { v: T; label?: ReactNode; color?: string }[]
}) {
  const id = useId()
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.v} className={o.v === value ? 'on' : ''} onClick={() => { buzz(6); onChange(o.v) }}>
          {o.v === value && <motion.span layoutId={id} className="ind" style={o.color ? { background: o.color } : undefined} transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
          <span className="lab">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

/** − value + with press-and-hold repeat. */
export function Stepper({ value, onChange, min = 0, max = 999, step = 1, unit }: {
  value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; unit?: string
}) {
  const v = useRef(value); v.current = value
  const timers = useRef<{ a?: ReturnType<typeof setTimeout>; b?: ReturnType<typeof setInterval> }>({})
  const bump = (d: number) => { const n = Math.min(max, Math.max(min, v.current + d * step)); if (n !== v.current) { v.current = n; buzz(4); onChange(n) } }
  const stop = () => { clearTimeout(timers.current.a); clearInterval(timers.current.b) }
  const hold = (d: number) => ({
    onPointerDown: () => { bump(d); stop(); timers.current.a = setTimeout(() => { timers.current.b = setInterval(() => bump(d), 80) }, 380) },
    onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop,
  })
  return (
    <div className="stepper">
      <button {...hold(-1)} aria-label="decrease"><Icon name="minus" /></button>
      <div className="v">{value}{unit && <small> {unit}</small>}</div>
      <button {...hold(1)} aria-label="increase"><Icon name="plus" /></button>
    </div>
  )
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button className={'sw' + (on ? ' on' : '')} onClick={() => { buzz(8); onChange(!on) }} role="switch" aria-checked={on}><i /></button>
}
