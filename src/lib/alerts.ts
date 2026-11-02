import { get, set, del } from 'idb-keyval'
import { useStore, uid, DEFAULT_BLOCK_SOUNDS, type Reminder } from '../store'

/* ---------- sounds: built-in synth tones + user uploads ---------- */
export const BUILTIN = [
  { id: 'chime', name: 'Chime' }, { id: 'bell', name: 'Bell' }, { id: 'drip', name: 'Drip' },
  { id: 'marimba', name: 'Marimba' }, { id: 'pulse', name: 'Pulse' }, { id: 'alarm', name: 'Alarm' }, { id: 'zen', name: 'Zen' },
]
export const REMINDER_SOUND: Record<Reminder['kind'], string> = { expense: 'bell', water: 'drip', focus: 'marimba', workout: 'alarm' }
export const soundName = (id: string | undefined) =>
  BUILTIN.find((s) => s.id === id)?.name ?? useStore.getState().customSounds.find((s) => s.id === id)?.name ?? 'Chime'

const urls = new Map<string, string>()
export async function loadSounds() {
  for (const s of useStore.getState().customSounds) {
    const blob = (await get(`snd:${s.id}`)) as Blob | undefined
    if (blob) urls.set(s.id, URL.createObjectURL(blob))
  }
}
export async function addSound(file: File) {
  const id = 'c:' + uid()
  await set(`snd:${id}`, file)
  urls.set(id, URL.createObjectURL(file))
  const st = useStore.getState()
  st.patch({ customSounds: [...st.customSounds, { id, name: file.name.replace(/\.[^.]+$/, '') }] })
  return id
}
export async function removeSound(id: string) {
  await del(`snd:${id}`); urls.delete(id)
  const st = useStore.getState()
  st.patch({
    customSounds: st.customSounds.filter((s) => s.id !== id),
    reminders: st.reminders.map((r) => (r.sound === id ? { ...r, sound: undefined } : r)),
    blockSounds: Object.fromEntries(Object.entries(st.blockSounds).map(([k, v]) => [k, v === id ? DEFAULT_BLOCK_SOUNDS[k as keyof typeof DEFAULT_BLOCK_SOUNDS] : v])) as typeof st.blockSounds,
  })
}

let ctx: AudioContext | null = null
function tone(f: number, t0: number, dur: number, o: { type?: OscillatorType; vol?: number; to?: number } = {}) {
  ctx ??= new AudioContext()
  ctx.resume?.()
  const c = ctx, t = c.currentTime + t0
  const osc = c.createOscillator(), g = c.createGain()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(f, t)
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.25, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(c.destination); osc.start(t); osc.stop(t + dur + 0.05)
}
const SYNTH: Record<string, () => void> = {
  chime: () => [660, 880, 1320].forEach((f, i) => tone(f, i * 0.14, 0.3)),
  bell: () => { tone(880, 0, 1.4, { vol: 0.3 }); tone(1760, 0, 0.9, { vol: 0.12 }); tone(2640, 0, 0.5, { vol: 0.06 }) },
  drip: () => { tone(1500, 0, 0.16, { to: 500, vol: 0.3 }); tone(1300, 0.32, 0.16, { to: 450, vol: 0.22 }) },
  marimba: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.22, { type: 'triangle', vol: 0.3 })),
  pulse: () => [0, 0.18, 0.36].forEach((t) => tone(440, t, 0.12, { type: 'square', vol: 0.08 })),
  alarm: () => [0, 1, 2, 3].forEach((i) => tone(i % 2 ? 660 : 880, i * 0.2, 0.18, { type: 'sawtooth', vol: 0.1 })),
  zen: () => { tone(396, 0, 1.8, { vol: 0.2 }); tone(594, 0.15, 1.6, { vol: 0.12 }) },
}
export function playSound(id = 'chime') {
  const u = urls.get(id)
  if (u) { new Audio(u).play().catch(SYNTH.chime); return }
  ;(SYNTH[id] ?? SYNTH.chime)()
}

export function speak(text: string, o: { voice?: string; rate?: number; force?: boolean } = {}) {
  const st = useStore.getState()
  if (!st.voiceOn && !o.force) return
  try {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const uri = o.voice ?? st.voice
    const v = uri ? speechSynthesis.getVoices().find((x) => x.voiceURI === uri) : undefined
    if (v) { u.voice = v; u.lang = v.lang }
    u.rate = o.rate ?? st.voiceRate
    speechSynthesis.speak(u)
  } catch { /* unsupported */ }
}

export async function askPermission() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.requestPermission()
}

export async function notify(title: string, body: string, tag?: string, sound?: string) {
  playSound(sound)
  navigator.vibrate?.([200, 80, 200])
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const opts = { body, tag, icon: '/icon.svg', badge: '/icon.svg' } as NotificationOptions
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) return void (await reg.showNotification(title, opts))
  } catch { /* fall through */ }
  new Notification(title, opts)
}

/* ---------- reminder scheduler ---------- */
const mins = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
const fired = new Map<string, number>()

function due(r: Reminder, now: Date) {
  const cur = now.getHours() * 60 + now.getMinutes()
  if (r.mode === 'at') return cur === mins(r.at)
  const from = mins(r.from), to = mins(r.to)
  if (cur < from || cur > to) return false
  return (cur - from) % Math.max(1, r.every) === 0
}

const TITLES: Record<Reminder['kind'], string> = { expense: 'Spend check', water: 'Sip time', focus: 'Focus', workout: 'Move' }

export function startScheduler() {
  const tick = () => {
    const now = new Date()
    const key = Math.floor(now.getTime() / 60000)
    for (const r of useStore.getState().reminders) {
      if (!r.enabled || fired.get(r.id) === key || !due(r, now)) continue
      fired.set(r.id, key)
      notify(TITLES[r.kind], r.label, r.id, r.sound ?? REMINDER_SOUND[r.kind])
    }
  }
  tick()
  const id = setInterval(tick, 15000)
  document.addEventListener('visibilitychange', tick)
  return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
}
