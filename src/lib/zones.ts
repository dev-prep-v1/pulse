export const ZONES = [
  { key: 'Spend', emoji: 'coin', title: 'Spend' },
  { key: 'Water', emoji: 'drop', title: 'Hydrate' },
  { key: 'Focus', emoji: 'timer', title: 'Focus' },
  { key: 'Move', emoji: 'flame', title: 'Move' },
]
export const DEFAULT_ORDER = [0, 1, 2, 3]
/** Saved order, repaired if it is missing zones (e.g. older saves). */
export const fixOrder = (o: number[] | undefined) => (o && o.length === 4 && DEFAULT_ORDER.every((z) => o.includes(z)) ? o : DEFAULT_ORDER)
