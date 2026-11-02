import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useAnimationControls, useMotionValue, useTransform, animate } from 'framer-motion'
import { useStore, buzz, startOfDay, fmtMoney, uid, monthKey, type Cat } from '../store'
import { SwipeRow, useHold, Sheet, Switch } from '../lib/ui'
import { Icon, Badge, PICK_ICONS, PALETTE } from '../lib/icons'

const MAX = 999999
const tierOf = (n: number) => (n >= 100000 ? 5 : n >= 50000 ? 4 : n >= 10000 ? 3 : n >= 5000 ? 2 : n >= 1000 ? 1 : 0)
const TIER_MSG = ['', 'THOUSAND CLUB', 'BIG SPENDER', 'WALLET ON FIRE', 'CALL THE BANK', 'LAKH! WALLET DOWN']
const TIER_FLASH = ['', '#ffd16655', '#ff9a3d66', '#ff5a1f88', '#ff2a1faa', '#ffffffcc']
const DIG = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
const money = (n: number, cur: string) => (n < 0 ? '−' : '') + cur + Math.abs(Math.round(n)).toLocaleString('en-IN')

/* Coins that burst out when the amount crosses a big threshold. */
function Burst({ tier }: { tier: number }) {
  const parts = useMemo(() => Array.from({ length: 10 + tier * 6 }, (_, i) => {
    const a = (i / (10 + tier * 6)) * Math.PI * 2 + Math.random() * 0.4
    const d = 90 + Math.random() * 90
    return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.8 - 20, r: (Math.random() - 0.5) * 540, s: 0.7 + Math.random() * 0.8 }
  }), [tier])
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', pointerEvents: 'none', zIndex: 4 }}>
      {parts.map((p, i) => (
        <motion.div key={i} initial={{ x: 0, y: 0, opacity: 1, scale: 0.3, rotate: 0 }} animate={{ x: p.x, y: p.y, opacity: 0, scale: p.s, rotate: p.r }}
          transition={{ duration: 0.9 + tier * 0.1, ease: 'easeOut' }} style={{ position: 'absolute', color: '#ffd34d', marginLeft: -11, marginTop: -11 }}>
          <Icon name={i % 3 === 0 ? 'spark' : 'coin'} size={22} />
        </motion.div>
      ))}
    </div>
  )
}

/* Coins pouring over the whole screen + a colour flash for the big tiers. */
function Rain({ tier }: { tier: number }) {
  const parts = useMemo(() => Array.from({ length: tier * 14 }, () => ({ x: Math.random() * 100, d: Math.random() * 1.1, s: 0.8 + Math.random() * 0.9, r: (Math.random() - 0.5) * 720 })), [tier])
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 60, overflow: 'hidden' }}>
      <motion.div initial={{ opacity: 0.85 }} animate={{ opacity: 0 }} transition={{ duration: 0.6 }} style={{ position: 'absolute', inset: 0, background: TIER_FLASH[tier] }} />
      {tier >= 3 && parts.map((p, i) => (
        <motion.div key={i} initial={{ y: -40, rotate: 0 }} animate={{ y: '108vh', rotate: p.r }} transition={{ duration: 1.3 + p.s, delay: p.d, ease: 'easeIn' }} style={{ position: 'absolute', left: p.x + '%', color: '#ffd34d' }}>
          <Icon name="coin" size={22 * p.s} />
        </motion.div>
      ))}
    </div>
  )
}

/* Plain phone keypad. */
function Keypad({ onDigit, onDouble, onBack }: { onDigit: (d: number) => void; onDouble: () => void; onBack: () => void }) {
  const key = (label: React.ReactNode, fn: () => void, k: string) => (
    <motion.button key={k} className="pad-key" whileTap={{ scale: 0.9, backgroundColor: 'rgba(255,255,255,.14)' }} onClick={() => { buzz(5); fn() }} aria-label={typeof label === 'string' ? label : 'Delete'}>{label}</motion.button>
  )
  return (
    <div className="pad">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => key(d, () => onDigit(d), 'd' + d))}
      {key('00', onDouble, 'dd')}
      {key(0, () => onDigit(0), 'd0')}
      {key(<Icon name="backspace" size={26} />, onBack, 'bk')}
    </div>
  )
}

/* Flick circle: press the middle puck, slide toward a digit, release to type it. Tapping a digit works too. */
const P = (r: number, deg: number) => [r * Math.sin((deg * Math.PI) / 180), -r * Math.cos((deg * Math.PI) / 180)]
function wedge(a: number, b: number, r0: number, r1: number) {
  const pt = (r: number, d: number) => P(r, d).map((n) => n.toFixed(1)).join(' ')
  return `M${pt(r0, a)} L${pt(r1, a)} A${r1} ${r1} 0 0 1 ${pt(r1, b)} L${pt(r0, b)} A${r0} ${r0} 0 0 0 ${pt(r0, a)}Z`
}
function FlickCircle({ onDigit }: { onDigit: (d: number) => void }) {
  const svg = useRef<SVGSVGElement>(null)
  const down = useRef(false)
  const selRef = useRef(-1)
  const [sel, setSel] = useState(-1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [drag, setDrag] = useState(false)

  const handle = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect(), s = 300 / r.width
    const x = (e.clientX - r.left - r.width / 2) * s, y = (e.clientY - r.top - r.height / 2) * s
    const rad = Math.hypot(x, y), k = rad > 112 ? 112 / rad : 1
    setPos({ x: x * k, y: y * k })
    const a = ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360
    const i = rad < 44 ? -1 : Math.round(a / 36) % 10
    if (i !== selRef.current) { selRef.current = i; setSel(i); if (i >= 0) buzz(4) }
  }
  const end = () => {
    if (!down.current) return
    down.current = false; setDrag(false); setPos({ x: 0, y: 0 })
    const i = selRef.current
    selRef.current = -1; setSel(-1)
    if (i >= 0) { onDigit(DIG[i]); buzz([10, 20, 10]) }
  }
  return (
    <svg ref={svg} viewBox="-150 -150 300 300" style={{ width: '100%', display: 'block', touchAction: 'none', cursor: 'grab', overflow: 'visible' }}
      onPointerDown={(e) => { svg.current!.setPointerCapture(e.pointerId); down.current = true; setDrag(true); selRef.current = -2; handle(e) }}
      onPointerMove={(e) => down.current && handle(e)} onPointerUp={end} onPointerCancel={end}>
      <circle r="148" fill="rgba(0,0,0,.32)" stroke="var(--line)" />
      {sel >= 0 && <path d={wedge(sel * 36 - 18, sel * 36 + 18, 44, 148)} fill="color-mix(in srgb, var(--a) 24%, transparent)" />}
      {DIG.map((d, i) => {
        const [x, y] = P(108, i * 36), on = i === sel
        return (
          <g key={d}>
            <circle cx={x} cy={y} r="22" fill={on ? 'var(--a)' : 'rgba(255,255,255,.08)'} stroke={on ? 'none' : 'var(--line)'} />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="23" fontWeight="800" fill={on ? 'var(--on)' : '#fff'} style={{ pointerEvents: 'none' }}>{d}</text>
          </g>
        )
      })}
      <g style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, transition: drag ? 'none' : 'transform .22s cubic-bezier(.3,1.5,.5,1)' }}>
        <circle r="38" fill="var(--bg-solid)" stroke="var(--a)" strokeWidth="3" />
        <text y="2" textAnchor="middle" dominantBaseline="central" fontSize="32" fontWeight="800" fill="#fff" style={{ pointerEvents: 'none' }}>{sel >= 0 ? DIG[sel] : '●'}</text>
      </g>
    </svg>
  )
}

function SlideToLog({ onDone, ready }: { onDone: () => void; ready: boolean }) {
  const track = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const fill = useTransform(x, (v) => v + 30)
  const fillO = useTransform(x, [0, 8], [0, 1])
  const half = useRef(false)
  const max = () => (track.current?.clientWidth ?? 300) - 60
  return (
    <div ref={track} className="slide" style={{ opacity: ready ? 1 : 0.55 }}>
      <motion.div className="fillbar" style={{ width: fill, opacity: fillO }} />
      <span className="lbl">{ready ? 'SLIDE TO LOG' : 'ENTER AN AMOUNT'}</span>
      <motion.div className="knob" style={{ x }} drag="x" dragConstraints={track} dragElastic={0.02} dragMomentum={false}
        onDrag={() => { const h = x.get() > max() * 0.5; if (h !== half.current) { half.current = h; buzz(6) } }}
        onDragEnd={() => {
          half.current = false
          if (ready && x.get() > max() * 0.82) { onDone(); animate(x, max(), { duration: 0.12 }).then(() => animate(x, 0, { type: 'spring', stiffness: 260, damping: 26 })) }
          else { if (x.get() > max() * 0.82) buzz([30, 40, 30]); animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 }) }
        }}>
        <Icon name="arrow" size={24} stroke={2.4} />
      </motion.div>
    </div>
  )
}

function CatTile({ cat, on, onPick, onEdit }: { cat: Cat; on: boolean; onPick: () => void; onEdit: () => void }) {
  const hold = useHold(onEdit, 550)
  return (
    <motion.button whileTap={{ scale: 0.92 }} className={'tile' + (on ? ' on' : '')} style={{ ['--c' as string]: cat.color }} {...hold.bind}
      onClick={() => { if (!hold.fired.current) { buzz(8); onPick() } }}>
      <Badge icon={cat.icon} color={cat.color} />
      <span className="n">{cat.name}</span>
    </motion.button>
  )
}

function CatSheet({ cat, onClose, onSaved }: { cat: Cat | null; onClose: () => void; onSaved: (id: string) => void }) {
  const { cats, patch } = useStore()
  const [name, setName] = useState(cat?.name ?? '')
  const [icon, setIcon] = useState(cat?.icon ?? 'spark')
  const [color, setColor] = useState(cat?.color ?? PALETTE[4])
  const [personal, setPersonal] = useState(!!cat?.personal)
  const save = () => {
    const n = name.trim() || 'Category'
    if (cat) patch({ cats: cats.map((c) => (c.id === cat.id ? { ...c, name: n, icon, color, personal } : c)) })
    else { const id = uid(); patch({ cats: [...cats, { id, name: n, icon, color, personal }] }); onSaved(id) }
    onClose()
  }
  return (
    <Sheet onClose={onClose}>
      <div className="row" style={{ marginBottom: 14 }}>
        <Badge icon={icon} color={color} size={56} />
        <input className="field" autoFocus placeholder="Category name" value={name} maxLength={14} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Draw it</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {PICK_ICONS.map((i) => (
          <button key={i} onClick={() => { buzz(6); setIcon(i) }} style={{ height: 48, borderRadius: 14, display: 'grid', placeItems: 'center', background: i === icon ? color : 'var(--card)', color: i === icon ? '#111' : 'var(--ink)' }}>
            <Icon name={i} size={24} />
          </button>
        ))}
      </div>
      <div className="eyebrow" style={{ margin: '14px 0 8px' }}>Colour</div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        {PALETTE.map((c) => (
          <button key={c} onClick={() => { buzz(6); setColor(c) }} style={{ width: 34, height: 34, borderRadius: '50%', background: c, outline: c === color ? '3px solid #fff' : 'none', outlineOffset: 2 }} />
        ))}
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>Personal spending</div>
          <div className="hint" style={{ textAlign: 'left' }}>Counts toward your monthly limit</div>
        </div>
        <Switch on={personal} onChange={setPersonal} />
      </div>
      <div className="row" style={{ marginTop: 20 }}>
        {cat && cats.length > 1 && (
          <button className="btn ghost" style={{ color: '#ff6b6b' }} onClick={() => { patch({ cats: cats.filter((c) => c.id !== cat.id) }); onSaved(''); onClose() }}><Icon name="trash" /></button>
        )}
        <button className="btn sp" onClick={save}>{cat ? 'Save' : 'Add category'}</button>
      </div>
    </Sheet>
  )
}

/* ---------- monthly personal limit ---------- */
function budgetStats(spentMonth: number, spentToday: number, limit: number, daysLeft: number) {
  const left = limit - spentMonth
  const allowance = (limit - (spentMonth - spentToday)) / daysLeft // today's share of what was left this morning
  return { left, leftToday: allowance - spentToday, perDay: left / daysLeft }
}

function BudgetSheet({ onClose }: { onClose: () => void }) {
  const { budgets, cats, currency, patch } = useStore()
  const key = monthKey()
  const prev = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return budgets[monthKey(d)] })()
  const [limit, setLimit] = useState(String(budgets[key] ?? ''))
  const [flags, setFlags] = useState<Record<string, boolean>>(() => Object.fromEntries(cats.map((c) => [c.id, !!c.personal])))
  const month = new Date().toLocaleDateString(undefined, { month: 'long' })
  const save = () => {
    const n = Math.max(0, Math.round(Number(limit) || 0))
    patch({ budgets: { ...budgets, [key]: n }, cats: cats.map((c) => ({ ...c, personal: flags[c.id] })) })
    onClose()
  }
  return (
    <Sheet onClose={onClose}>
      <h2 style={{ margin: '0 0 2px' }}>{month} limit</h2>
      <div className="hint" style={{ textAlign: 'left', marginBottom: 12 }}>How much can you spend on personal things this month?</div>
      <div className="row">
        <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--a)' }}>{currency}</span>
        <input className="field" autoFocus inputMode="numeric" placeholder="e.g. 5000" style={{ fontSize: 24, fontWeight: 800 }} value={limit}
          onChange={(e) => setLimit(e.target.value.replace(/\D/g, '').slice(0, 7))} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </div>
      {prev ? <div className="chips" style={{ marginTop: 8 }}><button className="chip" onClick={() => setLimit(String(prev))}>Same as last month · {money(prev, currency)}</button></div> : null}
      <div className="eyebrow" style={{ margin: '16px 0 8px' }}>Which categories count as personal?</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {cats.map((c) => (
          <button key={c.id} className={'chip' + (flags[c.id] ? ' on' : '')} onClick={() => { buzz(6); setFlags({ ...flags, [c.id]: !flags[c.id] }) }}>
            <Icon name={c.icon} size={15} /> {c.name}
          </button>
        ))}
      </div>
      <button className="btn" style={{ width: '100%', marginTop: 20 }} onClick={save}>Save limit</button>
    </Sheet>
  )
}

function BudgetCard({ limit, spentMonth, spentToday, daysLeft, hasPersonal, currency, onEdit }: {
  limit: number | undefined; spentMonth: number; spentToday: number; daysLeft: number; hasPersonal: boolean; currency: string; onEdit: () => void
}) {
  const month = new Date().toLocaleDateString(undefined, { month: 'long' })
  if (limit === undefined || !hasPersonal) {
    return (
      <button className="card" onClick={onEdit} style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', width: '100%' }}>
        <Badge icon="wallet" color="var(--a)" size={46} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800 }}>Set your {month} personal limit</div>
          <div className="hint" style={{ textAlign: 'left' }}>See what’s left each month and per day.</div>
        </div>
        <Icon name="plus" />
      </button>
    )
  }
  const s = budgetStats(spentMonth, spentToday, limit, daysLeft)
  const pct = limit > 0 ? Math.min(1, spentMonth / limit) : 1
  const over = s.left < 0
  const bar = over ? '#ff4d4d' : pct > 0.75 ? '#ffb020' : 'var(--a)'
  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="row">
        <div className="eyebrow">Personal · {month}</div>
        <div className="sp" />
        <button className="chip" style={{ padding: '5px 10px', fontSize: 12 }} onClick={onEdit}>Limit {money(limit, currency)}</button>
      </div>
      <div className="row" style={{ alignItems: 'flex-end', marginTop: 8 }}>
        <div>
          <div className="hint" style={{ textAlign: 'left' }}>{over ? 'Over by' : 'Left this month'}</div>
          <div className="big" style={{ fontSize: 38, color: over ? '#ff4d4d' : 'var(--ink)' }}>{money(Math.abs(s.left), currency)}</div>
        </div>
        <div className="sp" />
        <div style={{ textAlign: 'right' }}>
          <div className="hint" style={{ textAlign: 'right' }}>Spent</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{money(spentMonth, currency)}</div>
        </div>
      </div>
      <div style={{ height: 8, borderRadius: 6, background: 'var(--line)', margin: '12px 0 10px', overflow: 'hidden' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }} style={{ height: '100%', background: bar, borderRadius: 6 }} />
      </div>
      <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13 }}><b style={{ color: s.leftToday < 0 ? '#ff4d4d' : 'var(--a)' }}>{money(s.leftToday, currency)}</b> <span className="hint">left today</span></span>
        <span style={{ fontSize: 13 }}><b>{money(Math.max(0, s.perDay), currency)}</b> <span className="hint">/day for {daysLeft} {daysLeft === 1 ? 'day' : 'days'}</span></span>
      </div>
    </div>
  )
}

export default function Spend() {
  const { expenses, currency, cats, budgets, addExpense, delExpense } = useStore()
  const [amt, setAmt] = useState(0)
  const [cat, setCat] = useState(cats[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [step, setStep] = useState<1 | 2>(1)
  const [typing, setTyping] = useState(false)
  const [dtext, setDtext] = useState('')
  const [date, setDate] = useState('') // yyyy-mm-dd, '' = today
  const [edit, setEdit] = useState<Cat | 'new' | null>(null)
  const [limitOpen, setLimitOpen] = useState(false)
  const [banner, setBanner] = useState<{ k: number; t: number } | null>(null)
  const [rain, setRain] = useState<{ k: number; t: number } | null>(null)
  const [toast, setToast] = useState<{ k: number; cat: string; amt: number; leftToday: number; left: number; perDay: number } | null>(null)
  const shake = useAnimationControls()
  const tier = tierOf(amt)
  const prev = useRef(0)
  const catOf = (id: string) => cats.find((c) => c.id === id) ?? { id, name: 'Other', icon: 'spark', color: '#999', personal: false }

  const bigShow = (t: number) => {
    buzz(t >= 3 ? [30, 40, 60, 40, 120, 40, 200] : [30, 40, 70])
    const k = 6 + t * 5
    shake.start({ x: [0, -k, k, -k * .8, k * .8, -k * .4, k * .4, 0], rotate: t >= 4 ? [0, -1.2, 1.2, -.8, .8, 0] : 0, transition: { duration: 0.5 + t * 0.08 } })
    setBanner({ k: Date.now(), t }); setTimeout(() => setBanner((b) => (b && b.t === t ? null : b)), 2000)
    setRain({ k: Date.now(), t }); setTimeout(() => setRain(null), 4200)
  }
  useEffect(() => {
    if (tier > prev.current) {
      bigShow(tier)
      prev.current = tier
    }
    prev.current = tier
  }, [tier])
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 4500); return () => clearTimeout(id) }, [toast])

  /* month numbers for the personal limit */
  const now = new Date()
  const m0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const day0 = startOfDay()
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeft = dim - now.getDate() + 1
  const personalIds = new Set(cats.filter((c) => c.personal).map((c) => c.id))
  const personalSpent = (from: number) => expenses.filter((e) => e.ts >= from && personalIds.has(e.cat)).reduce((a, e) => a + e.amount, 0)
  const spentMonth = personalSpent(m0), spentToday = personalSpent(day0)
  const limit = budgets[monthKey()]

  const commit = () => {
    if (!amt) { buzz([30, 40, 30]); return }
    const c = catOf(cat)
    let ts: number | undefined
    if (date) { const [y, m, d] = date.split('-').map(Number); const n = new Date(); ts = Math.min(Date.now(), new Date(y, m - 1, d, n.getHours(), n.getMinutes()).getTime()) }
    const inMonth = ts === undefined || ts >= m0
    const isToday = ts === undefined || ts >= day0
    addExpense({ amount: amt, cat: c.id, note: note.trim(), ts })
    if (c.personal && limit !== undefined && inMonth) {
      const s = budgetStats(spentMonth + amt, spentToday + (isToday ? amt : 0), limit, daysLeft)
      setToast({ k: Date.now(), cat: c.name, amt, leftToday: s.leftToday, left: s.left, perDay: s.perDay })
    }
    if (tierOf(amt) >= 1) bigShow(tierOf(amt)); else buzz([14, 30, 14])
    setAmt(0); setNote(''); setDate(''); setDtext(''); setTyping(false); setStep(1); prev.current = 0
  }
  const commitRef = useRef(commit); commitRef.current = commit
  const stepRef = useRef(step); stepRef.current = step
  const amtRef = useRef(amt); amtRef.current = amt
  const addDigit = (d: number) => setAmt((a) => (a * 10 + d <= MAX ? a * 10 + d : a))

  // desktop: type digits straight away
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || e.metaKey || e.ctrlKey) return
      const st = stepRef.current
      if (st === 2 && /^\d$/.test(e.key)) addDigit(+e.key)
      else if (st === 2 && e.key === 'Backspace') setAmt((a) => Math.floor(a / 10))
      else if (e.key === 'Enter') { if (st === 2) commitRef.current(); else setStep(2) }
    }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [])

  const byTs = (a: { ts: number }, b: { ts: number }) => b.ts - a.ts
  const today = expenses.filter((e) => e.ts >= day0).sort(byTs)
  const earlier = expenses.filter((e) => e.ts < day0 && e.ts >= day0 - 6 * 864e5).sort(byTs)
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const yest = ymd(new Date(day0 - 864e5)), todayStr = ymd(new Date())
  const pickedLabel = date && date !== yest && date !== todayStr ? new Date(date + 'T12:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''
  const todayTotal = today.reduce((a, e) => a + e.amount, 0)
  const monthTotal = useMemo(() => expenses.filter((e) => e.ts >= m0).reduce((a, e) => a + e.amount, 0), [expenses, m0])
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const s = day0 - (6 - i) * 864e5
    return { s, v: expenses.filter((e) => e.ts >= s && e.ts < s + 864e5).reduce((a, e) => a + e.amount, 0) }
  }), [expenses, day0])
  const max = Math.max(1, ...week.map((w) => w.v))
  const selected = catOf(cat)
  // both steps share one grid cell so the card keeps the same height on either step
  const sb = (n: number): React.CSSProperties => ({ gridArea: '1 / 1', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, visibility: step === n ? 'visible' : 'hidden', pointerEvents: step === n ? 'auto' : 'none' })
  const amtStr = amt.toLocaleString('en-IN')
  const amtSize = amtStr.length <= 3 ? 52 : amtStr.length <= 6 ? 40 : 32

  return (
    <div className="page wide" style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(min(310px, 100%), 1fr))', alignItems: 'start' }}>
      <BudgetCard limit={limit} spentMonth={spentMonth} spentToday={spentToday} daysLeft={daysLeft} hasPersonal={personalIds.size > 0} currency={currency} onEdit={() => setLimitOpen(true)} />

      <motion.div className="card" animate={shake} style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)', alignContent: 'start' }}>
        <div className="stepdots">{[1, 2].map((i) => <i key={i} className={i === step ? 'on' : ''} />)}</div>
        {rain && <Rain key={rain.k} tier={rain.t} />}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <div style={sb(1)} aria-hidden={step !== 1}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>What was it? <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>· hold to edit</span></div>
            <div className="cats">
              {cats.map((c) => <CatTile key={c.id} cat={c} on={c.id === cat} onPick={() => setCat(c.id)} onEdit={() => setEdit(c)} />)}
              <button className="tile add" onClick={() => setEdit('new')}><span className="dash"><Icon name="plus" /></span><span className="n">New</span></button>
            </div>
          </div>
          <input className="field" placeholder={`Note for ${selected.name} (optional)`} value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setStep(2)} />
          <div className="chips" style={{ padding: 0 }}>
            <button className={`chip${!date || date === todayStr ? ' on' : ''}`} onClick={() => { setDate(''); setDtext(''); setTyping(false) }}>Today</button>
            <button className={`chip${date === yest ? ' on' : ''}`} onClick={() => { setDate(yest); setDtext(''); setTyping(false) }}>Yesterday</button>
            <button className={`chip${pickedLabel || typing ? ' on' : ''}`} onClick={() => setTyping((v) => !v)}>
              <Icon name="timer" size={14} /> {pickedLabel || 'Type date'}
            </button>
          </div>
          {typing && (
            <div className="row" style={{ gap: 8 }}>
              <input className="field" autoFocus inputMode="numeric" placeholder="DD/MM/YYYY" value={dtext} style={{ flex: 1 }}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, '').slice(0, 8)
                  const txt = d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
                  setDtext(txt)
                  const dd = +d.slice(0, 2), mm = +d.slice(2, 4), yy = d.length === 8 ? +d.slice(4) : d.length === 4 ? new Date().getFullYear() : 0
                  const dt = new Date(yy, mm - 1, dd)
                  if (yy && dt.getDate() === dd && dt.getMonth() === mm - 1 && dt.getTime() <= Date.now()) setDate(ymd(dt) === todayStr ? '' : ymd(dt))
                  else setDate('')
                }} />
              <span className="hint" style={{ whiteSpace: 'nowrap' }}>{dtext && !date ? 'invalid date' : 'DD/MM = this year'}</span>
            </div>
          )}
          <button className="btn" style={{ marginTop: 'auto' }} onClick={() => { buzz(8); setStep(2) }}>Next → amount</button>
        </div>

        <div style={sb(2)} aria-hidden={step !== 2}>
          <button className="notepill" onClick={() => setStep(1)}><Badge icon={selected.icon} color={selected.color} size={22} /> <span>{note.trim() || selected.name}</span> <b>edit</b></button>
          <div className="amtrow" style={{ position: 'relative' }}>
            <div className={`amtnum${tier ? ' t' + tier : ''}`} style={{ fontSize: amtSize }}>
              <span className="cur">{currency}</span>{amtStr}
            </div>
            <div className="amtbtns">
              <button onClick={() => { buzz(6); setAmt((a) => Math.min(MAX, a * 1000)) }}>000</button>
              <button aria-label="Clear" onClick={() => { buzz(6); setAmt(0) }}>C</button>
            </div>
            <AnimatePresence>
              {banner && (
                <motion.div key={banner.k} className="banner" style={{ x: '-50%', top: -36 }} initial={{ y: 12, opacity: 0, scale: 0.5 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
                  <Icon name="flame" size={16} /> {TIER_MSG[banner.t]}
                </motion.div>
              )}
            </AnimatePresence>
            {banner && <Burst key={banner.k} tier={banner.t} />}
          </div>
          <Keypad onDigit={addDigit} onDouble={() => setAmt((a) => Math.min(MAX, a * 100))} onBack={() => setAmt((a) => Math.floor(a / 10))} />
          <SlideToLog ready={amt > 0} onDone={commit} />
        </div>
        </div>
      </motion.div>

      <div>
        <div className="card">
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div>
              <div className="eyebrow">Today</div>
              <div className="big" style={{ fontSize: 40, color: 'var(--a)' }}>{fmtMoney(todayTotal, currency)}</div>
            </div>
            <div className="sp" />
            <div style={{ textAlign: 'right' }}>
              <div className="eyebrow">This month</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{fmtMoney(monthTotal, currency)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 64, marginTop: 16 }}>
            {week.map((w, i) => (
              <div key={w.s} style={{ flex: 1, textAlign: 'center' }}>
                <motion.div initial={{ height: 0 }} animate={{ height: Math.max(4, (w.v / max) * 48) }} style={{ background: i === 6 ? 'var(--a)' : 'var(--line)', borderRadius: 6 }} />
                <div className="hint" style={{ fontSize: 10, marginTop: 4 }}>{new Date(w.s).toLocaleDateString(undefined, { weekday: 'narrow' })}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="sec eyebrow">Today · swipe ← delete · swipe → repeat</div>
        {today.length === 0 && <div className="hint" style={{ padding: '8px 4px' }}>Nothing logged yet.</div>}
        {(() => {
          const row = (e: typeof today[number], withDay: boolean) => {
            const c = catOf(e.cat)
            return (
              <SwipeRow key={e.id} onLeft={() => delExpense(e.id)} onRight={() => addExpense({ amount: e.amount, cat: e.cat, note: e.note })}>
                <Badge icon={c.icon} color={c.color} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.note || c.name}</div>
                  <div className="hint" style={{ textAlign: 'left' }}>{c.name} · {withDay ? new Date(e.ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(e.amount, currency)}</div>
              </SwipeRow>
            )
          }
          return (<>
            {today.map((e) => row(e, false))}
            {earlier.length > 0 && <div className="sec eyebrow">Earlier this week</div>}
            {earlier.map((e) => row(e, true))}
          </>)
        })()}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div key={toast.k} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(92px + var(--safe-b))', maxWidth: 420, margin: '0 auto', zIndex: 30, background: toast.left < 0 ? '#3a1113' : '#1b1b21', border: `1px solid ${toast.left < 0 ? '#ff4d4d' : 'var(--line)'}`, borderRadius: 20, padding: '12px 16px', boxShadow: '0 12px 40px rgba(0,0,0,.5)' }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{money(toast.amt, currency)} on {toast.cat}</div>
            <div style={{ fontSize: 13, marginTop: 4, color: 'var(--mute)' }}>
              <b style={{ color: toast.leftToday < 0 ? '#ff6b6b' : 'var(--a)' }}>{money(toast.leftToday, currency)}</b> left today ·{' '}
              <b style={{ color: toast.left < 0 ? '#ff6b6b' : 'var(--ink)' }}>{money(toast.left, currency)}</b> left this month · <b style={{ color: 'var(--ink)' }}>{money(Math.max(0, toast.perDay), currency)}</b>/day
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {edit && <CatSheet cat={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={(id) => setCat(id || useStore.getState().cats[0]?.id)} />}
      {limitOpen && <BudgetSheet onClose={() => setLimitOpen(false)} />}
    </div>
  )
}
