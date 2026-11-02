import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion'
import { useStore, uid, buzz, mmss, type Exercise, type WorkoutDay } from '../store'
import { playSound, speak } from '../lib/alerts'
import { Icon } from '../lib/icons'
import { Seg, Stepper } from '../lib/ui'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const todayIdx = () => (new Date().getDay() + 6) % 7

export default function Workout() {
  const { workouts, patchDay, wlogs } = useStore()
  const [sel, setSel] = useState(todayIdx())
  const [running, setRunning] = useState(false)
  const day = workouts[sel]
  const [edit, setEdit] = useState(false)

  const streak = useMemo(() => {
    const days = new Set(wlogs.map((w) => new Date(w.ts).toDateString()))
    let n = 0; const d = new Date()
    if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1)
    while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1) }
    return n
  }, [wlogs])

  const setEx = (exercises: Exercise[]) => patchDay(sel, { exercises })
  const upd = (id: string, p: Partial<Exercise>) => setEx(day.exercises.map((e) => (e.id === id ? { ...e, ...p } : e)))

  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 14 }}>
        {DAYS.map((d, i) => (
          <motion.button key={d} whileTap={{ scale: 0.9 }} onClick={() => { buzz(6); setSel(i); setEdit(false) }}
            style={{ flex: 1, padding: '10px 0', borderRadius: 14, fontSize: 12, fontWeight: 800, border: '1px solid var(--line)',
              background: i === sel ? 'var(--a)' : 'var(--card)', color: i === sel ? 'var(--on)' : i === todayIdx() ? 'var(--a)' : 'var(--ink)' }}>
            {d}
          </motion.button>
        ))}
      </div>

      <motion.div key={sel} className="card" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
        drag={edit ? false : 'x'} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.4} style={{ touchAction: 'pan-y' }}
        onDragEnd={(_, i) => { if (i.offset.x < -80 && sel < 6) setSel(sel + 1); if (i.offset.x > 80 && sel > 0) setSel(sel - 1) }}>
        <div className="row">
          <div style={{ flex: 1 }}>
            <div className="eyebrow">{DAYS[sel]}{sel === todayIdx() ? ' · today' : ''}</div>
            <input className="field" style={{ background: 'transparent', border: 0, padding: 0, fontSize: 28, fontWeight: 800 }}
              value={day.name} onChange={(e) => patchDay(sel, { name: e.target.value })} />
          </div>
          {streak > 0 && <div className="chip on"><Icon name="flame" size={15} /> {streak}d</div>}
        </div>
        <div className="hint">{day.exercises.length} exercises × {day.rounds} rounds · swipe card for other days</div>

        <div style={{ marginTop: 14 }}>
          {day.exercises.length === 0 && <div className="hint" style={{ padding: '14px 0' }}>Rest day, or add some exercises ↓</div>}
          <Reorder.Group axis="y" values={day.exercises} onReorder={setEx} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {day.exercises.map((e, i) => (
              <ExRow key={e.id} e={e} i={i} edit={edit} upd={(p) => upd(e.id, p)} del={() => setEx(day.exercises.filter((x) => x.id !== e.id))} />
            ))}
          </Reorder.Group>
        </div>

        {edit && (
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn ghost sm" onClick={() => setEx([...day.exercises, { id: uid(), name: 'New exercise', mode: 'reps', target: 10, rest: 45, note: '' }])}>+ Exercise</button>
            <div className="sp" />
            <span className="hint">Rounds</span>
            <button className="icon-btn" onClick={() => patchDay(sel, { rounds: Math.max(1, day.rounds - 1) })}><Icon name="minus" size={16} /></button>
            <b>{day.rounds}</b>
            <button className="icon-btn" onClick={() => patchDay(sel, { rounds: day.rounds + 1 })}><Icon name="plus" size={16} /></button>
          </div>
        )}
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn ghost" onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Edit'}</button>
          <button className="btn sp" disabled={!day.exercises.length} style={{ opacity: day.exercises.length ? 1 : 0.4 }} onClick={() => { buzz(30); setRunning(true) }}>Start workout</button>
        </div>
      </motion.div>

      <AnimatePresence>{running && <Runner day={day} onExit={() => setRunning(false)} />}</AnimatePresence>
    </div>
  )
}

type Step = { ex: Exercise; round: number; setNo: number }

function Runner({ day, onExit }: { day: WorkoutDay; onExit: () => void }) {
  const steps = useMemo<Step[]>(() => {
    const out: Step[] = []
    for (let r = 0; r < day.rounds; r++) day.exercises.forEach((ex) => out.push({ ex, round: r + 1, setNo: out.length + 1 }))
    return out
  }, [day])
  const [i, setI] = useState(0)
  const [phase, setPhase] = useState<'go' | 'rest' | 'done'>('go')
  const [endAt, setEndAt] = useState<number | null>(null)
  const [, force] = useState(0)
  const started = useRef(Date.now())
  const step = steps[i]
  const next = steps[i + 1]

  const announce = (s: Step) => speak(`${s.ex.name}. ${s.ex.mode === 'reps' ? s.ex.target + ' reps' : s.ex.target + ' seconds'}`)

  useEffect(() => {
    announce(steps[0])
    if (steps[0].ex.mode === 'time') setEndAt(Date.now() + steps[0].ex.target * 1000)
  }, [])

  useEffect(() => {
    if (endAt === null) return
    const id = setInterval(() => { force((n) => n + 1); if (Date.now() >= endAt) timeUp() }, 200)
    return () => clearInterval(id)
  })

  const finishSet = () => {
    buzz([20, 40, 20]); playSound()
    if (!next) {
      setPhase('done'); setEndAt(null); speak('Workout complete. Great work.')
      useStore.setState((s) => ({ wlogs: [{ id: uid(), day: day.name, ts: Date.now(), secs: Math.round((Date.now() - started.current) / 1000), sets: steps.length }, ...s.wlogs] }))
      return
    }
    setPhase('rest'); setEndAt(Date.now() + step.ex.rest * 1000)
    speak(`Rest ${step.ex.rest} seconds. Next: ${next.ex.name}`)
  }
  const startNext = () => {
    setI(i + 1); setPhase('go'); announce(next)
    setEndAt(next.ex.mode === 'time' ? Date.now() + next.ex.target * 1000 : null)
  }
  const timeUp = () => { phase === 'rest' ? startNext() : finishSet() }

  const left = endAt ? endAt - Date.now() : 0
  const totalMs = (phase === 'rest' ? step.ex.rest : step.ex.target) * 1000
  const C = 2 * Math.PI * 120

  return (
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 32, stiffness: 300 }}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'var(--bg)', padding: 'calc(var(--safe-t) + 18px) 22px calc(24px + var(--safe-b))', display: 'flex', flexDirection: 'column' }}>
      <div className="row">
        <button className="icon-btn" onClick={onExit}><Icon name="close" size={18} /></button>
        <div className="sp" />
        <div className="eyebrow">{phase === 'done' ? 'Finished' : `Set ${i + 1}/${steps.length} · Round ${step.round}/${day.rounds}`}</div>
        <div className="sp" />
        <div style={{ width: 38 }} />
      </div>
      <div style={{ height: 6, borderRadius: 4, background: 'var(--line)', marginTop: 14, overflow: 'hidden' }}>
        <motion.div initial={{ width: '0%' }} animate={{ width: `${((phase === 'done' ? steps.length : i) / steps.length) * 100}%` }} style={{ height: '100%', background: 'var(--a)' }} />
      </div>

      {phase === 'done' ? (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div>
            <div style={{ color: 'var(--a)', display: 'grid', placeItems: 'center' }}><Icon name="trophy" size={84} stroke={1.5} /></div>
            <div className="big" style={{ fontSize: 40 }}>Done.</div>
            <div className="hint" style={{ margin: '10px 0 24px' }}>{steps.length} sets · {mmss((Date.now() - started.current))} · logged</div>
            <button className="btn" onClick={onExit}>Close</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
            <div>
              <div className="eyebrow" style={{ color: phase === 'rest' ? '#6ee7b7' : 'var(--a)' }}>{phase === 'rest' ? 'Rest · next up' : 'Go'}</div>
              <div style={{ fontSize: 32, fontWeight: 800, margin: '6px 0 4px' }}>{phase === 'rest' ? next?.ex.name : step.ex.name}</div>
              <div className="hint" style={{ maxWidth: 300, margin: '0 auto' }}>{(phase === 'rest' ? next?.ex : step.ex)?.note}</div>

              {(phase === 'rest' || step.ex.mode === 'time') ? (
                <motion.div whileTap={{ scale: 0.97 }} style={{ position: 'relative', width: 260, height: 260, margin: '22px auto' }}>
                  <svg width="260" height="260" viewBox="0 0 260 260" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="130" cy="130" r="120" stroke="var(--line)" strokeWidth="14" fill="none" />
                    <circle cx="130" cy="130" r="120" stroke={phase === 'rest' ? '#6ee7b7' : 'var(--a)'} strokeWidth="14" fill="none" strokeLinecap="round"
                      strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0, left / totalMs))} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><div className="big" style={{ fontSize: 68 }}>{mmss(left)}</div></div>
                </motion.div>
              ) : (
                <motion.div
                  drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.7, bottom: 0 }} style={{ touchAction: 'none', margin: '22px auto', width: 240, height: 240, borderRadius: '50%', background: 'var(--card)', border: '2px dashed var(--a)', display: 'grid', placeItems: 'center', cursor: 'grab' }}
                  onDragEnd={(_, p) => { if (p.offset.y < -80) finishSet() }}>
                  <div><div className="big" style={{ fontSize: 96, color: 'var(--a)' }}>{step.ex.target}</div><div className="eyebrow" style={{ marginTop: 2 }}>reps</div><div className="hint" style={{ fontSize: 11, marginTop: 6 }}>flick up when done ↑</div></div>
                </motion.div>
              )}
            </div>
          </div>
          <div className="row">
            {phase === 'rest' ? (
              <>
                <button className="btn ghost" onClick={() => setEndAt((endAt ?? Date.now()) + 15000)}>+15s</button>
                <button className="btn sp" onClick={startNext}>Skip rest →</button>
              </>
            ) : (
              <button className="btn sp" onClick={finishSet}>{step.ex.mode === 'time' ? 'Skip timer' : 'Set done'}</button>
            )}
          </div>
        </>
      )}
    </motion.div>
  )
}

function ExRow({ e, i, edit, upd, del }: { e: Exercise; i: number; edit: boolean; upd: (p: Partial<Exercise>) => void; del: () => void }) {
  const c = useDragControls()
  return (
    <Reorder.Item value={e} dragListener={false} dragControls={c} style={{ marginBottom: 8, listStyle: 'none' }}>
      {edit ? (
        <div className="blk">
          <div className="row" style={{ gap: 6 }}>
            <span onPointerDown={(ev) => c.start(ev)} style={{ cursor: 'grab', touchAction: 'none', padding: '8px 2px', color: 'var(--mute)' }}><Icon name="grip" stroke={3} /></span>
            <input className="field" value={e.name} onChange={(x) => upd({ name: x.target.value })} />
            <button onClick={del} style={{ padding: 6, color: 'var(--mute)' }} aria-label="Delete exercise"><Icon name="trash" size={19} /></button>
          </div>
          <Seg value={e.mode} onChange={(mode) => upd({ mode })} options={[{ v: 'reps', label: 'Count reps' }, { v: 'time', label: 'Timed hold' }]} />
          <div className="two">
            <div><div className="eyebrow">{e.mode === 'reps' ? 'Reps' : 'Seconds'}</div><Stepper value={e.target} min={1} max={999} step={e.mode === 'reps' ? 1 : 5} onChange={(target) => upd({ target })} /></div>
            <div><div className="eyebrow">Rest after</div><Stepper value={e.rest} min={0} max={300} step={5} unit="s" onChange={(rest) => upd({ rest })} /></div>
          </div>
          <textarea className="field" rows={2} placeholder="Focus notes (form cues…)" value={e.note} onChange={(x) => upd({ note: x.target.value })} />
        </div>
      ) : (
        <div className="item">
          <div style={{ width: 28, height: 28, borderRadius: 9, background: 'var(--a)', color: 'var(--on)', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{i + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{e.name}</div>
            {e.note && <div className="hint">{e.note}</div>}
          </div>
          <div style={{ fontWeight: 800 }}>{e.mode === 'reps' ? `${e.target} reps` : `${e.target}s`}</div>
        </div>
      )}
    </Reorder.Item>
  )
}
