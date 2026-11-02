import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, uid, buzz, DEFAULT_BLOCK_SOUNDS, type Reminder, type BlockKind } from '../store'
import { Sheet, Seg, Stepper, Switch } from '../lib/ui'
import { Icon } from '../lib/icons'
import { askPermission, notify, addSound, removeSound, playSound, speak, BUILTIN, REMINDER_SOUND, soundName } from '../lib/alerts'
import { syncNow, expensesCsv } from '../lib/drive'

const KIND_ICON: Record<Reminder['kind'], string> = { expense: 'coin', water: 'drop', focus: 'timer', workout: 'dumbbell' }
const KIND_OPTS = (Object.keys(KIND_ICON) as Reminder['kind'][]).map((k) => ({ v: k, label: <Icon name={KIND_ICON[k]} size={18} /> }))

const mk = (p: Partial<Reminder> & Pick<Reminder, 'kind' | 'label'>): Reminder => ({
  id: uid(), mode: 'at', at: '20:00', every: 60, from: '09:00', to: '21:00', enabled: true, ...p,
})
const PRESETS: { name: string; r: Partial<Reminder> & Pick<Reminder, 'kind' | 'label'> }[] = [
  { name: 'Evening spend log', r: { kind: 'expense', label: 'Log today’s spending', at: '21:30' } },
  { name: 'Lunch spend check', r: { kind: 'expense', label: 'Lunch spent anything?', at: '14:00' } },
  { name: 'Water every hour', r: { kind: 'water', label: 'Drink water', mode: 'every', every: 60 } },
  { name: 'Water every 45 min', r: { kind: 'water', label: 'Sip time', mode: 'every', every: 45 } },
  { name: 'Stand up & stretch', r: { kind: 'workout', label: 'Stand up and stretch', mode: 'every', every: 120, from: '10:00', to: '18:00' } },
  { name: 'Workout time', r: { kind: 'workout', label: 'Time to work out', at: '18:00' } },
  { name: 'Plan tomorrow', r: { kind: 'focus', label: 'Plan tomorrow’s day', at: '22:00' } },
]

/** Tap the row to expand sound choices; tapping a sound previews and selects it. */
function SoundPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const custom = useStore((s) => s.customSounds)
  const [open, setOpen] = useState(false)
  const all = [...BUILTIN, ...custom]
  return (
    <div>
      <button className="chip" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setOpen(!open)}>
        <span className="row" style={{ gap: 8 }}><Icon name="music" size={16} /> {soundName(value)}</span>
        <span style={{ fontSize: 11, color: 'var(--mute)' }}>{open ? 'Done' : 'Change'}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 8 }}>
              {all.map((s) => (
                <button key={s.id} className={'chip' + (s.id === value ? ' on' : '')} onClick={() => { buzz(8); playSound(s.id); onChange(s.id) }}>
                  <Icon name={s.id === value ? 'check' : 'play'} size={13} /> {s.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


/** Spoken-prompt voice: on/off, speed, and a tap-to-preview list of the voices this device has. */
function VoicePicker() {
  const { voiceOn, voice, voiceRate, patch } = useStore()
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [all, setAll] = useState(false)
  useEffect(() => {
    const load = () => setVoices(speechSynthesis.getVoices())
    load(); speechSynthesis.addEventListener?.('voiceschanged', load)
    return () => speechSynthesis.removeEventListener?.('voiceschanged', load)
  }, [])
  const lang = (navigator.language || 'en').slice(0, 2)
  const NOVELTY = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Wobble|Deranged|Good News|Hysterical|Jester|Organ|Superstar|Trinoids|Whisper|Zarvox|Fred|Junior|Kathy|Ralph)\b/
  const rank = (v: SpeechSynthesisVoice) => (/premium|enhanced|siri|neural|natural/i.test(v.name) ? 0 : NOVELTY.test(v.name) ? 3 : v.localService ? 1 : 2)
  const shown = voices
    .filter((v) => all || (v.lang.toLowerCase().startsWith(lang) && !NOVELTY.test(v.name)))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
  const demo = (v?: string, r?: number) => speak('Next up: push-ups. Fifteen reps.', { voice: v, rate: r, force: true })
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="row"><div className="sp" style={{ fontWeight: 700 }}>Spoken prompts</div><Switch on={voiceOn} onChange={(v) => patch({ voiceOn: v })} /></div>
      {voiceOn && (
        <>
          <Seg value={String(voiceRate)} onChange={(v) => { patch({ voiceRate: +v }); demo(undefined, +v) }}
            options={[{ v: '0.85', label: 'Slow' }, { v: '1', label: 'Normal' }, { v: '1.2', label: 'Fast' }]} />
          <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 6 }}>
            <button className={'chip' + (!voice ? ' on' : '')} onClick={() => { patch({ voice: '' }); demo('') }}><Icon name={!voice ? 'check' : 'play'} size={13} /> Device default</button>
            {shown.map((v) => (
              <button key={v.voiceURI} className={'chip' + (v.voiceURI === voice ? ' on' : '')} style={{ justifyContent: 'space-between' }} onClick={() => { buzz(8); patch({ voice: v.voiceURI }); demo(v.voiceURI) }}>
                <span className="row" style={{ gap: 6, minWidth: 0 }}><Icon name={v.voiceURI === voice ? 'check' : 'play'} size={13} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span></span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>{v.lang}</span>
              </button>
            ))}
            {voices.length === 0 && <div className="hint">No voices reported by this browser.</div>}
          </div>
          <button className="chip" style={{ justifySelf: 'start' }} onClick={() => setAll(!all)}>{all ? 'Only my language' : 'Show all languages'}</button>
          <div className="hint">Tap a voice to hear it. Voices come from your phone or computer, so the list differs per device; the downloaded “Enhanced/Premium” ones in system settings sound best.</div>
        </>
      )}
    </div>
  )
}

function ReminderCard({ r, onChange, onDelete }: { r: Reminder; onChange: (p: Partial<Reminder>) => void; onDelete: () => void }) {
  return (
    <div className="card" style={{ padding: 12, marginBottom: 10, display: 'grid', gap: 10, opacity: r.enabled ? 1 : 0.6 }}>
      <div className="row" style={{ gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}><Seg value={r.kind} onChange={(kind) => onChange({ kind, sound: undefined })} options={KIND_OPTS} /></div>
        <Switch on={r.enabled} onChange={(enabled) => onChange({ enabled })} />
        <button onClick={onDelete} style={{ padding: 4, color: 'var(--mute)' }} aria-label="Delete reminder"><Icon name="trash" size={19} /></button>
      </div>
      <input className="field" value={r.label} onChange={(e) => onChange({ label: e.target.value })} />
      <Seg value={r.mode} onChange={(mode) => onChange({ mode })} options={[{ v: 'at', label: 'At a time' }, { v: 'every', label: 'Repeat' }]} />
      {r.mode === 'at' ? (
        <input className="field" type="time" value={r.at} onChange={(e) => onChange({ at: e.target.value })} />
      ) : (
        <>
          <Stepper value={r.every} min={5} max={720} step={5} unit="min" onChange={(every) => onChange({ every })} />
          <div className="two">
            <div><div className="eyebrow">From</div><input className="field" type="time" value={r.from} onChange={(e) => onChange({ from: e.target.value })} /></div>
            <div><div className="eyebrow">Until</div><input className="field" type="time" value={r.to} onChange={(e) => onChange({ to: e.target.value })} /></div>
          </div>
        </>
      )}
      <SoundPicker value={r.sound ?? REMINDER_SOUND[r.kind]} onChange={(sound) => onChange({ sound })} />
    </div>
  )
}

export default function Settings({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const perm = 'Notification' in window ? Notification.permission : 'unsupported'

  const upd = (id: string, p: Partial<Reminder>) => s.setReminders(s.reminders.map((r) => (r.id === id ? { ...r, ...p } : r)))
  const sync = async () => {
    setBusy(true); setMsg('')
    try { setMsg(await syncNow()) } catch (e) { setMsg((e as Error).message) }
    setBusy(false)
  }
  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([expensesCsv(s)], { type: 'text/csv' }))
    a.download = 'pulse-expenses.csv'; a.click()
  }
  const BLOCKS: { k: BlockKind; label: string; icon: string }[] = [
    { k: 'work', label: 'Focus block starts', icon: 'brain' }, { k: 'break', label: 'Rest starts', icon: 'coffee' }, { k: 'move', label: 'Move break starts', icon: 'dumbbell' },
  ]

  return (
    <Sheet onClose={onClose}>
      <h2 style={{ margin: '0 0 2px' }}>Setup</h2>

      <div className="eyebrow sec">Reminders</div>
      {s.reminders.length === 0 && <div className="hint">No reminders yet. Add a ready-made one below.</div>}
      {s.reminders.map((r) => (
        <ReminderCard key={r.id} r={r} onChange={(p) => upd(r.id, p)} onDelete={() => s.setReminders(s.reminders.filter((x) => x.id !== r.id))} />
      ))}

      <div className="eyebrow" style={{ margin: '14px 0 6px' }}>Quick add</div>
      <div className="chips" style={{ flexWrap: 'wrap', overflow: 'visible' }}>
        {PRESETS.map((p) => (
          <button key={p.name} className="chip" onClick={() => { buzz(10); s.setReminders([...s.reminders, mk(p.r)]); setMsg(`Added “${p.name}”`) }}>
            <Icon name={KIND_ICON[p.r.kind]} size={15} /> {p.name}
          </button>
        ))}
        <button className="chip" onClick={() => s.setReminders([...s.reminders, mk({ kind: 'expense', label: 'Reminder' })])}><Icon name="plus" size={15} /> Custom</button>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn ghost sm" onClick={async () => { const p = await askPermission(); setMsg('Notifications: ' + p); if (p === 'granted') notify('Pulse', 'Notifications work', undefined, 'chime') }}>
          <Icon name="bell" size={15} style={{ marginRight: 6, verticalAlign: -3 }} />{perm === 'granted' ? 'Test notification' : 'Allow notifications'}
        </button>
      </div>
      <div className="hint" style={{ marginTop: 8 }}>
        Browsers only fire reminders while Pulse is open or running in the background. For guaranteed delivery with the app fully closed we’ll add push or wrap it as a native app later.
      </div>

      <div className="eyebrow sec">Voice</div>
      <VoicePicker />

      <div className="eyebrow sec">Focus alert sounds</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {BLOCKS.map((b) => (
          <div key={b.k}>
            <div className="eyebrow" style={{ margin: '0 0 4px', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name={b.icon} size={14} /> {b.label}</div>
            <SoundPicker value={s.blockSounds[b.k] ?? DEFAULT_BLOCK_SOUNDS[b.k]} onChange={(id) => s.patch({ blockSounds: { ...s.blockSounds, [b.k]: id } })} />
          </div>
        ))}
      </div>

      <div className="eyebrow sec">Your own sounds</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {s.customSounds.map((c) => (
          <span key={c.id} className="chip"><Icon name="music" size={14} /> {c.name}
            <button onClick={() => removeSound(c.id)} aria-label={`Remove ${c.name}`} style={{ display: 'grid', color: 'var(--mute)' }}><Icon name="close" size={13} /></button>
          </span>
        ))}
        <button className="chip" onClick={() => file.current?.click()}><Icon name="plus" size={14} /> Add audio file</button>
      </div>
      <input ref={file} type="file" accept="audio/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { await addSound(f); setMsg('Sound added, pick it from any list') } e.target.value = '' }} />

      <div className="eyebrow sec">Currency</div>
      <input className="field" style={{ width: 90 }} value={s.currency} onChange={(e) => s.patch({ currency: e.target.value })} />

      <div className="eyebrow sec">Google Drive</div>
      {!import.meta.env.VITE_GOOGLE_CLIENT_ID && <input className="field" placeholder="Google OAuth Client ID (…apps.googleusercontent.com)" value={s.driveClientId} onChange={(e) => s.patch({ driveClientId: e.target.value })} />}
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn sm" disabled={busy} onClick={sync}><Icon name="cloud" size={15} style={{ marginRight: 6, verticalAlign: -3 }} />{busy ? 'Syncing…' : 'Connect & sync'}</button>
        <button className="btn ghost sm" onClick={download}>Export CSV</button>
      </div>
      <div className="hint" style={{ marginTop: 8 }}>
        {s.lastSync ? `Last sync ${new Date(s.lastSync).toLocaleString()}. ` : ''}Creates a “Pulse” folder in your Drive with a backup, an expenses Google Sheet and your sounds. Data is always saved on-device first, so it works offline and syncs when you’re back online.
        Create the Client ID in Google Cloud Console → Credentials → OAuth client (Web), enable the Drive API, and add this site’s URL under Authorized JavaScript origins.
      </div>
      {msg && <div className="hint" style={{ marginTop: 8, color: 'var(--a)' }}>{msg}</div>}
    </Sheet>
  )
}
