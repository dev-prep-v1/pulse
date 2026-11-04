import { get, set } from 'idb-keyval'
import { useStore, type State } from '../store'

/* Google Drive sync.
   Uses Google Identity Services (token flow) with scope drive.file, so the app can only
   touch files it created. Layout in Drive:  Pulse/  pulse-data.json · Pulse expenses (Google Sheet) · sound */

const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const API = 'https://www.googleapis.com/drive/v3'
const UP = 'https://www.googleapis.com/upload/drive/v3'
declare const google: any

let token: { v: string; exp: number } | null = null

function loadGsi() {
  return new Promise<void>((res, rej) => {
    if ((window as any).google?.accounts) return res()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.onload = () => res(); s.onerror = () => rej(new Error('Offline: cannot reach Google'))
    document.head.appendChild(s)
  })
}

// Client IDs are public identifiers (not secrets), so the default ships in the bundle; the env var can override it.
const DEFAULT_CLIENT_ID = '978213242169-bhvs51emj4sce7lasevq02h2d46vreud.apps.googleusercontent.com'
export const clientIdOf = () => (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || DEFAULT_CLIENT_ID || useStore.getState().driveClientId.trim()

const LINK = 'pulse-drive-linked'
const linked = () => { try { return localStorage.getItem(LINK) === '1' } catch { return false } }
let silent = false

export type DriveStatus = 'off' | 'syncing' | 'ok' | 'error'
let status: DriveStatus = linked() ? 'ok' : 'off'
const subs = new Set<() => void>()
const setStatus = (s: DriveStatus) => { status = s; subs.forEach((f) => f()) }
export const driveStatus = { get: () => status, sub: (f: () => void) => { subs.add(f); return () => { subs.delete(f) } } }

async function auth(): Promise<string> {
  if (token && token.exp > Date.now() + 30000) return token.v
  const clientId = clientIdOf()
  if (!clientId) throw new Error('Add your Google OAuth Client ID first')
  await loadGsi()
  return new Promise((res, rej) => {
    const c = google.accounts.oauth2.initTokenClient({
      client_id: clientId, scope: SCOPE,
      callback: (r: any) => {
        if (r.error) return rej(new Error(r.error))
        token = { v: r.access_token, exp: Date.now() + r.expires_in * 1000 }
        try { localStorage.setItem(LINK, '1') } catch { /* ignore */ }
        res(token.v)
      },
      error_callback: (e: any) => rej(new Error(e?.type || 'auth failed')),
    })
    c.requestAccessToken({ prompt: silent ? 'none' : linked() ? '' : 'consent' })
  })
}

async function api(url: string, init: RequestInit = {}) {
  const t = await auth()
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${t}`, ...(init.headers || {}) } })
  if (!r.ok) throw new Error(`Drive ${r.status}: ${await r.text()}`)
  return r
}

async function findOrCreate(name: string, mime: string, parent?: string): Promise<string> {
  const cacheKey = `drive:${name}`
  const cached = (await get(cacheKey)) as string | undefined
  if (cached) return cached
  const q = `name='${name}' and mimeType='${mime}' and trashed=false` + (parent ? ` and '${parent}' in parents` : '')
  const found = await (await api(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id)`)).json()
  let id = found.files?.[0]?.id as string | undefined
  if (!id) {
    const created = await (await api(`${API}/files`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: mime, parents: parent ? [parent] : undefined }),
    })).json()
    id = created.id
  }
  await set(cacheKey, id)
  return id!
}

async function upsert(name: string, parent: string, body: Blob | string, mime: string, convertTo?: string) {
  const key = `drive:file:${name}`
  let id = (await get(key)) as string | undefined
  const meta = { name, parents: id ? undefined : [parent], mimeType: convertTo }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }))
  form.append('file', new Blob([body], { type: mime }))
  const url = id ? `${UP}/files/${id}?uploadType=multipart` : `${UP}/files?uploadType=multipart`
  const r = await (await api(url, { method: id ? 'PATCH' : 'POST', body: form })).json()
  id = r.id; await set(key, id)
  return id!
}

const merge = <T extends { id: string }>(a: T[], b: T[]) => {
  const m = new Map<string, T>(); [...b, ...a].forEach((x) => m.set(x.id, x))
  return [...m.values()]
}

export function expensesCsv(s: State) {
  const rows = [['Date', 'Time', 'Amount', 'Category', 'Note']]
  for (const e of [...s.expenses].sort((a, b) => a.ts - b.ts)) {
    const d = new Date(e.ts)
    rows.push([d.toLocaleDateString('en-CA'), d.toLocaleTimeString('en-GB').slice(0, 5), String(e.amount),
      s.cats.find((c) => c.id === e.cat)?.name ?? e.cat, e.note])
  }
  return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
}

/** Manual only: bring entries back from the Drive backup. Adds what is missing locally, never removes anything. */
export async function restoreFromDrive(): Promise<string> {
  await findOrCreate('Pulse', 'application/vnd.google-apps.folder')
  const fileId = (await get('drive:file:pulse-data.json')) as string | undefined
  if (!fileId) return 'No backup found on this device yet'
  const remote = await (await api(`${API}/files/${fileId}?alt=media`)).json()
  const before = useStore.getState().expenses.length
  // read state AFTER the download so anything added meanwhile is kept
  const fresh = useStore.getState()
  fresh.patch({
    expenses: merge(fresh.expenses, remote.expenses ?? []),
    water: merge(fresh.water, remote.water ?? []),
    wlogs: merge(fresh.wlogs, remote.wlogs ?? []),
  })
  return `Restored ${useStore.getState().expenses.length - before} missing expenses`
}

/** One-way backup: the phone is the source of truth, Drive only ever receives a copy. */
export async function syncNow(): Promise<string> {
  const folder = await findOrCreate('Pulse', 'application/vnd.google-apps.folder')
  const cur = useStore.getState()
  const data = {
    expenses: cur.expenses, water: cur.water, wlogs: cur.wlogs,
    config: { navOrder: cur.navOrder, budgets: cur.budgets, cats: cur.cats, waterGoal: cur.waterGoal, currency: cur.currency, lanes: cur.lanes.map((l) => ({ ...l, endAt: null, leftMs: null, idx: 0 })), workouts: cur.workouts, reminders: cur.reminders },
  }
  await upsert('pulse-data.json', folder, JSON.stringify(data), 'application/json')
  await upsert('Pulse expenses', folder, expensesCsv(cur), 'text/csv', 'application/vnd.google-apps.spreadsheet')
  for (const snd of cur.customSounds) {
    const blob = (await get(`snd:${snd.id}`)) as File | undefined
    if (blob) await upsert(`sound-${snd.name}`, folder, blob, blob.type || 'audio/mpeg')
  }
  useStore.getState().patch({ lastSync: Date.now() })
  setStatus('ok')
  return 'Synced to Drive/Pulse'
}

let timer: ReturnType<typeof setTimeout> | undefined
let running = false
let dirty = false

/** Quiet sync: never opens a Google popup, so it can fail silently when the session needs re-consent. */
export async function quietSync() {
  if (running || !navigator.onLine || !clientIdOf() || !linked()) return
  running = true; silent = true; dirty = false; setStatus('syncing')
  try { await syncNow(); setStatus('ok') } catch { setStatus('error') }
  silent = false; running = false
  if (dirty) { dirty = false; clearTimeout(timer); timer = setTimeout(quietSync, 1500) }
}

/** Syncs on app open, when the tab returns to view, when back online, and ~4s after any data or settings change. */
export function autoSync() {
  const watched = ['expenses', 'water', 'wlogs', 'budgets', 'cats', 'workouts', 'reminders', 'lanes', 'blockSounds', 'customSounds', 'waterGoal', 'currency'] as const
  useStore.subscribe((s, p) => {
    if (s.lastSync !== p.lastSync) return
    if (watched.every((k) => s[k] === p[k])) return
    if (running) { dirty = true; return }
    clearTimeout(timer)
    timer = setTimeout(quietSync, 4000)
  })
  window.addEventListener('online', quietSync)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') quietSync() })
  setTimeout(quietSync, 1500)
}
