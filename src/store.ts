import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { get, set, del } from 'idb-keyval'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export type Expense = { id: string; amount: number; cat: string; note: string; ts: number }
export type WaterLog = { id: string; ml: number; ts: number }
export type Block = { id: string; kind: 'work' | 'break' | 'move'; label: string; mins: number }
export type Lane = {
  id: string; name: string; blocks: Block[]
  idx: number; endAt: number | null; leftMs: number | null // runtime, persisted so reloads keep the timer
}
export type Exercise = { id: string; name: string; mode: 'reps' | 'time'; target: number; rest: number; note: string }
export type WorkoutDay = { name: string; rounds: number; exercises: Exercise[] }
export type WorkoutLog = { id: string; day: string; ts: number; secs: number; sets: number }
export type Cat = { id: string; name: string; icon: string; color: string; personal?: boolean }
export type Sound = { id: string; name: string }
export type Reminder = {
  id: string; kind: 'expense' | 'water' | 'focus' | 'workout'; label: string; sound?: string
  mode: 'at' | 'every'; at: string; every: number; from: string; to: string; enabled: boolean
}

export const DEFAULT_CATS: Cat[] = [
  { id: 'food', name: 'Food', icon: 'food', color: '#ff7a45' },
  { id: 'coffee', name: 'Coffee', icon: 'coffee', color: '#ffc46b' },
  { id: 'ride', name: 'Ride', icon: 'ride', color: '#60a5fa' },
  { id: 'shop', name: 'Shop', icon: 'shop', color: '#ff5d8f' },
  { id: 'bills', name: 'Bills', icon: 'bills', color: '#a3e635' },
  { id: 'fun', name: 'Fun', icon: 'fun', color: '#c084fc' },
  { id: 'health', name: 'Health', icon: 'health', color: '#34d399' },
  { id: 'personal', name: 'Personal', icon: 'heart', color: '#f472b6', personal: true },
  { id: 'other', name: 'Other', icon: 'spark', color: '#f87171' },
]
export type BlockKind = 'work' | 'break' | 'move'
export const DEFAULT_BLOCK_SOUNDS: Record<BlockKind, string> = { work: 'marimba', break: 'drip', move: 'alarm' }

const mkBlocks = (): Block[] => [
  { id: uid(), kind: 'work', label: 'Deep work', mins: 30 },
  { id: uid(), kind: 'break', label: 'Rest', mins: 5 },
  { id: uid(), kind: 'move', label: '30 push-ups', mins: 5 },
]
const emptyDay = (name: string): WorkoutDay => ({ name, rounds: 3, exercises: [] })

export type State = {
  expenses: Expense[]; water: WaterLog[]; waterGoal: number; currency: string
  lanes: Lane[]; workouts: WorkoutDay[]; wlogs: WorkoutLog[]; reminders: Reminder[]
  driveClientId: string; lastSync: number
  voiceOn: boolean; voice: string; voiceRate: number
  budgets: Record<string, number>
  cats: Cat[]; customSounds: Sound[]; blockSounds: Record<BlockKind, string>
  zone: number
  navOrder: number[]
  addExpense: (e: Omit<Expense, 'id' | 'ts'> & { ts?: number }) => void
  delExpense: (id: string) => void
  addWater: (ml: number) => void
  delWater: (id: string) => void
  patch: (p: Partial<State>) => void
  patchLane: (id: string, p: Partial<Lane>) => void
  patchDay: (i: number, p: Partial<WorkoutDay>) => void
  setReminders: (r: Reminder[]) => void
}

const idbStorage: StateStorage = {
  getItem: async (k) => (await get(k)) ?? null,
  setItem: (k, v) => set(k, v),
  removeItem: (k) => del(k),
}

export const useStore = create<State>()(
  persist(
    (setS) => ({
      expenses: [], water: [], waterGoal: 3000, currency: '₹',
      lanes: [
        { id: uid(), name: 'Company A', blocks: mkBlocks(), idx: 0, endAt: null, leftMs: null },
        { id: uid(), name: 'Company B', blocks: mkBlocks(), idx: 0, endAt: null, leftMs: null },
      ],
      workouts: ['Push day', 'Pull day', 'Legs', 'Rest', 'Upper', 'Core + cardio', 'Rest'].map((n, i) =>
        i === 0
          ? {
              name: n, rounds: 3,
              exercises: [
                { id: uid(), name: 'Push-ups', mode: 'reps', target: 15, rest: 45, note: 'Elbows 45°, full range' },
                { id: uid(), name: 'Plank', mode: 'time', target: 40, rest: 30, note: 'Squeeze glutes' },
              ],
            }
          : emptyDay(n)),
      wlogs: [],
      reminders: [
        { id: uid(), kind: 'expense', label: 'Log today’s spending', sound: 'bell', mode: 'at', at: '21:30', every: 60, from: '09:00', to: '22:00', enabled: true },
        { id: uid(), kind: 'water', label: 'Drink water', sound: 'drip', mode: 'every', at: '10:00', every: 60, from: '09:00', to: '21:00', enabled: true },
        { id: uid(), kind: 'workout', label: 'Workout time', sound: 'alarm', mode: 'at', at: '18:00', every: 60, from: '09:00', to: '22:00', enabled: false },
      ],
      driveClientId: '', lastSync: 0, zone: 0, navOrder: [0, 1, 2, 3],
      voiceOn: true, voice: '', voiceRate: 1,
      budgets: {},
      cats: DEFAULT_CATS, customSounds: [], blockSounds: DEFAULT_BLOCK_SOUNDS,
      addExpense: (e) => setS((s) => ({ expenses: [{ id: uid(), ts: Date.now(), ...e }, ...s.expenses] })),
      delExpense: (id) => setS((s) => ({ expenses: s.expenses.filter((x) => x.id !== id) })),
      addWater: (ml) => setS((s) => ({ water: [{ id: uid(), ml, ts: Date.now() }, ...s.water] })),
      delWater: (id) => setS((s) => ({ water: s.water.filter((x) => x.id !== id) })),
      patch: (p) => setS(p as State),
      patchLane: (id, p) => setS((s) => ({ lanes: s.lanes.map((l) => (l.id === id ? { ...l, ...p } : l)) })),
      patchDay: (i, p) => setS((s) => ({ workouts: s.workouts.map((d, j) => (j === i ? { ...d, ...p } : d)) })),
      setReminders: (reminders) => setS({ reminders }),
    }),
    { name: 'pulse-v1', storage: createJSONStorage(() => idbStorage) },
  ),
)

export const startOfDay = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
export const buzz = (ms: number | number[] = 12) => { try { navigator.vibrate?.(ms) } catch { /* unsupported */ } }
export const fmtMoney = (n: number, cur: string) => cur + Math.round(n).toLocaleString()
export const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
