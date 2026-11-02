import { useEffect, useRef, useState } from 'react'
import { motion, Reorder, useDragControls, useMotionValue, useTransform } from 'framer-motion'
import { useStore, uid, mmss, buzz, type Lane, type Block } from '../store'
import { notify, speak } from '../lib/alerts'
import { useHold, Seg, Stepper } from '../lib/ui'
import { Icon } from '../lib/icons'

export const KIND = {
  work: { icon: 'brain', c: '#a78bfa', name: 'Focus' },
  break: { icon: 'coffee', c: '#6ee7b7', name: 'Rest' },
  move: { icon: 'dumbbell', c: '#fbbf24', name: 'Move' },
}
const KINDS = (Object.keys(KIND) as Block['kind'][]).map((k) => ({
  v: k, color: KIND[k].c, label: <><Icon name={KIND[k].icon} size={16} />{KIND[k].name}</>,
}))

export default function Focus() {
  const lanes = useStore((s) => s.lanes)
  const patch = useStore((s) => s.patch)
  return (
    <div className="page wide" style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(min(310px, 100%), 1fr))', alignItems: 'start' }}>
      {lanes.map((l) => <LaneCard key={l.id} lane={l} />)}
      {lanes.length < 3 && (
        <button className="btn ghost" onClick={() => patch({ lanes: [...lanes, { id: uid(), name: 'New lane', blocks: [{ id: uid(), kind: 'work', label: 'Focus', mins: 25 }, { id: uid(), kind: 'break', label: 'Rest', mins: 5 }], idx: 0, endAt: null, leftMs: null }] })}>
          <Icon name="plus" size={16} /> Add lane
        </button>
      )}
    </div>
  )
}

function BlockEditor({ b, onChange, onDelete, canDelete }: { b: Block; onChange: (p: Partial<Block>) => void; onDelete: () => void; canDelete: boolean }) {
  const controls = useDragControls()
  return (
    <Reorder.Item value={b} dragListener={false} dragControls={controls} className="blk">
      <div className="row" style={{ gap: 6 }}>
        <span onPointerDown={(e) => controls.start(e)} style={{ cursor: 'grab', touchAction: 'none', padding: '8px 2px', color: 'var(--mute)' }}><Icon name="grip" stroke={3} /></span>
        <div style={{ flex: 1, minWidth: 0 }}><Seg value={b.kind} onChange={(kind) => onChange({ kind })} options={KINDS} /></div>
        {canDelete && <button onClick={onDelete} style={{ padding: 6, color: 'var(--mute)' }} aria-label="Delete block"><Icon name="trash" size={19} /></button>}
      </div>
      <input className="field" value={b.label} placeholder="What are you doing?" onChange={(e) => onChange({ label: e.target.value })} />
      <Stepper value={b.mins} min={1} max={180} unit="min" onChange={(mins) => onChange({ mins })} />
      <div className="chips" style={{ padding: 0, flexWrap: 'wrap', overflow: 'visible' }}>
        {[5, 10, 15, 25, 30, 45, 60].map((m) => (
          <button key={m} className={'chip' + (b.mins === m ? ' on' : '')} style={{ padding: '6px 11px' }} onClick={() => { buzz(6); onChange({ mins: m }) }}>{m}</button>
        ))}
      </div>
    </Reorder.Item>
  )
}

function LaneCard({ lane }: { lane: Lane }) {
  const { patchLane, lanes, patch, blockSounds } = useStore()
  const [, force] = useState(0)
  const [edit, setEdit] = useState(false)
  const x = useMotionValue(0)
  const skipO = useTransform(x, [20, 70], [0, 1])
  const backO = useTransform(x, [-70, -20], [1, 0])
  const hold = useHold(() => reset(), 800)
  const dragged = useRef(false)
  const b = lane.blocks[lane.idx] ?? lane.blocks[0]
  const running = lane.endAt !== null
  const total = (b?.mins ?? 1) * 60000
  const left = running ? lane.endAt! - Date.now() : lane.leftMs ?? total

  // timestamp-based: stays correct when tab is throttled or phone sleeps
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      force((n) => n + 1)
      if (Date.now() >= lane.endAt!) advance(true)
    }, 250)
    return () => clearInterval(id)
  })

  function advance(auto: boolean, dir = 1) {
    const nextIdx = (lane.idx + dir + lane.blocks.length) % lane.blocks.length
    const nb = lane.blocks[nextIdx]
    if (auto) {
      notify(`${lane.name}: ${nb.label}`, `${nb.mins} min · ${KIND[nb.kind].name}`, lane.id, blockSounds[nb.kind])
      speak(nb.kind === 'break' ? `Break time. ${nb.mins} minutes.` : `${nb.label}. ${nb.mins} minutes.`)
    }
    patchLane(lane.id, { idx: nextIdx, endAt: running || auto ? Date.now() + nb.mins * 60000 : null, leftMs: running || auto ? null : nb.mins * 60000 })
  }
  const toggle = () => {
    buzz(15)
    if (running) patchLane(lane.id, { endAt: null, leftMs: left })
    else patchLane(lane.id, { endAt: Date.now() + left, leftMs: null })
  }
  function reset() { patchLane(lane.id, { idx: 0, endAt: null, leftMs: null }) }

  const R = 92, C = 2 * Math.PI * R
  const frac = Math.max(0, Math.min(1, left / total))
  const kind = KIND[b?.kind ?? 'work']
  const next = lane.blocks[(lane.idx + 1) % lane.blocks.length]
  const setBlocks = (blocks: Block[]) => patchLane(lane.id, { blocks })
  const upd = (id: string, p: Partial<Block>) => setBlocks(lane.blocks.map((y) => (y.id === id ? { ...y, ...p } : y)))

  return (
    <div className="card" style={{ position: 'relative' }}>
      <div className="row">
        <input className="field" style={{ background: 'transparent', border: 0, fontWeight: 800, fontSize: 17, padding: 0 }} value={lane.name}
          onChange={(e) => patchLane(lane.id, { name: e.target.value })} />
        <button className="chip" onClick={() => setEdit(!edit)}>{edit ? <><Icon name="check" size={14} /> Done</> : 'Edit flow'}</button>
        {lanes.length > 1 && edit && <button className="chip" onClick={() => patch({ lanes: lanes.filter((x) => x.id !== lane.id) })} aria-label="Delete lane"><Icon name="trash" size={14} /></button>}
      </div>

      <motion.div
        drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.5} style={{ x, touchAction: 'pan-y', margin: '14px auto 6px', width: 220, height: 220, position: 'relative', cursor: 'pointer' }}
        onDragEnd={(_, i) => { if (i.offset.x > 70) { buzz([10, 30, 10]); advance(false) } else if (i.offset.x < -70) { buzz([10, 30, 10]); advance(false, -1) } }}
        {...hold.bind} onPointerDown={(e) => { dragged.current = false; hold.bind.onPointerDown(e) }} onDragStart={() => { dragged.current = true }}
        onTap={() => { if (!hold.fired.current && !dragged.current) toggle() }} whileTap={{ scale: 0.97 }}
      >
        <motion.div style={{ opacity: skipO, position: 'absolute', right: 4, top: 2, fontSize: 11, fontWeight: 800, color: 'var(--a)' }}>NEXT ›</motion.div>
        <motion.div style={{ opacity: backO, position: 'absolute', left: 4, top: 2, fontSize: 11, fontWeight: 800, color: 'var(--a)' }}>‹ PREV</motion.div>
        <svg width="220" height="220" viewBox="0 0 220 220" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="110" cy="110" r={R} stroke="var(--line)" strokeWidth="12" fill="none" />
          <circle cx="110" cy="110" r={R} stroke={kind.c} strokeWidth="12" fill="none" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: running ? 'stroke-dashoffset .3s linear' : 'none' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div>
            <div style={{ color: kind.c, display: 'grid', placeItems: 'center' }}><Icon name={kind.icon} size={28} /></div>
            <div className="big" style={{ fontSize: 46 }}>{mmss(left)}</div>
            <div style={{ fontWeight: 700, marginTop: 4, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b?.label}</div>
          </div>
        </div>
      </motion.div>
      {next && <div className="hint" style={{ textAlign: 'center' }}>Up next: <b>{next.label}</b></div>}

      <div className="row" style={{ marginTop: 14, gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {lane.blocks.map((x, i) => (
          <span key={x.id} className="chip" style={{ opacity: i === lane.idx ? 1 : 0.5, borderColor: i === lane.idx ? KIND[x.kind].c : undefined, color: KIND[x.kind].c }}>
            <Icon name={KIND[x.kind].icon} size={15} /> <span style={{ color: 'var(--ink)' }}>{x.mins}m</span>
          </span>
        ))}
      </div>

      {edit && (
        <div style={{ marginTop: 16 }}>
          <Reorder.Group axis="y" values={lane.blocks} onReorder={setBlocks} style={{ padding: 0, margin: 0 }}>
            {lane.blocks.map((x) => (
              <BlockEditor key={x.id} b={x} onChange={(p) => upd(x.id, p)} canDelete={lane.blocks.length > 1} onDelete={() => setBlocks(lane.blocks.filter((y) => y.id !== x.id))} />
            ))}
          </Reorder.Group>
          <button className="btn ghost sm" onClick={() => setBlocks([...lane.blocks, { id: uid(), kind: 'work', label: 'Block', mins: 25 }])}><Icon name="plus" size={14} /> Add block</button>
        </div>
      )}
    </div>
  )
}
