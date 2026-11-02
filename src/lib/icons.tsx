/* Hand-drawn style icon set: round strokes, slightly wobbly curves, no fills. */
const P: Record<string, string> = {
  coin: 'M12 3.2c4.8-.1 8.9 3.8 8.8 8.7-.1 4.9-3.9 8.9-8.8 8.9-4.9 0-8.8-4-8.7-8.9C3.4 7 7.3 3.3 12 3.2z M9 8h6 M9 10.8h6 M9.2 8c4 0 4 5 0 5l4.3 3.4',
  food: 'M3.5 11.5h17c-.2 4.6-3.4 8-8.5 8s-8.3-3.4-8.5-8z M8 8.2c-.8-1 .8-1.8 0-3 M12 8.2c-.8-1 .8-1.8 0-3 M16 8.2c-.8-1 .8-1.8 0-3',
  coffee: 'M5 9h11v5.5c0 2.8-2.2 4.8-5.5 4.8S5 17.3 5 14.5V9z M16 10.5h1.8c1.6 0 2.4 1 2.4 2.2s-.9 2.3-2.5 2.3H16 M8 4.5c-.6.8.6 1.5 0 2.4 M12 4.5c-.6.8.6 1.5 0 2.4',
  ride: 'M6 18.2a2.6 2.6 0 1 0 .01 0 M18 18.2a2.6 2.6 0 1 0 .01 0 M8.6 18h6.8 M15.4 18l-1.7-11.5h2.7 M10.2 12.4h3.6',
  shop: 'M5 8.5h14l-1 11H6l-1-11z M8.8 8.5V7a3.2 3.2 0 0 1 6.4 0v1.5',
  bills: 'M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4v-17z M9 8h6 M9 11.5h6 M9 15h3',
  fun: 'M7 8h10c2.6 0 4 2.2 4 5.2 0 2.6-.9 4.3-2.5 4.3-1.4 0-2-1-3-2.2H8.5c-1 1.2-1.6 2.2-3 2.2C3.9 17.5 3 15.8 3 13.2 3 10.2 4.4 8 7 8z M8 10.5v3 M6.5 12h3 M15.5 11.3h.01 M17.5 13.3h.01',
  health: 'M10 4.6l9.4 9.4a4.1 4.1 0 0 1-5.8 5.8L4.2 10.4A4.1 4.1 0 0 1 10 4.6z M8 8.6l7.4 7.4',
  spark: 'M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z M18.5 16.5v3 M17 18h3',
  drop: 'M12 3.5c3.2 4 6 7.2 6 10.4a6 6 0 0 1-12 0c0-3.2 2.8-6.4 6-10.4z M9 14.5c.2 1.6 1.2 2.6 2.8 2.9',
  timer: 'M12 7.5a7 7 0 1 0 .01 0z M12 10.5V14l2.4 1.6 M9.5 3.5h5 M18.2 6.2l1.3-1.3',
  flame: 'M12.5 3.2c.5 3-1.6 4.2-3.2 6.2C8 11 7 12.6 7 14.6a5.3 5.3 0 0 0 10.6 0c0-2.4-1.3-3.8-2.4-5.2-.3 1.2-.9 1.9-1.7 2.2.6-3.2-.2-6.3-1-8.4z',
  dumbbell: 'M3.5 9.5v5 M6.5 7.5v9 M17.5 7.5v9 M20.5 9.5v5 M6.5 12h11',
  brain: 'M9.5 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 2.8c0 1 .5 1.8 1.2 2.3-.4.8-.2 2 .7 2.7.4 1.6 2 2.4 3.3 2 .5.9 1.6 1.2 2.3.7V5.3c-.3-.5-.9-.8-1.5-.8z M14.5 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 2.8c0 1-.5 1.8-1.2 2.3.4.8.2 2-.7 2.7-.4 1.6-2 2.4-3.3 2-.5.9-1.6 1.2-2.3.7',
  gear: 'M12 9a3 3 0 1 0 .01 0z M12 3.5v2.2 M12 18.3v2.2 M3.5 12h2.2 M18.3 12h2.2 M6 6l1.6 1.6 M16.4 16.4L18 18 M18 6l-1.6 1.6 M7.6 16.4L6 18',
  bell: 'M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5l1.5-1.5z M10 20a2 2 0 0 0 4 0',
  music: 'M9 17.5V6l10-2v11.5 M9 17.5a2.5 2.5 0 1 1-.01 0 M19 15.5a2.5 2.5 0 1 1-.01 0',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12 M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7',
  trash: 'M5 7h14 M9.5 7V4.8h5V7 M7 7l.8 12.5h8.4L17 7 M10.2 10.5v6 M13.8 10.5v6',
  arrow: 'M5 12h13 M13 6.5l5.5 5.5-5.5 5.5',
  grip: 'M9 6h.01 M9 12h.01 M9 18h.01 M15 6h.01 M15 12h.01 M15 18h.01',
  play: 'M8 5.5v13l11-6.5z',
  backspace: 'M9.5 6h10v12h-10L4 12l5.5-6z M12.5 9.5l4 5 M16.5 9.5l-4 5',
  wallet: 'M4.5 7.5c0-1.1.9-2 2-2H17v3 M4.5 7.5v10c0 1.1.9 2 2 2h12.5v-11H6.5c-1.1 0-2-.9-2-2z M15.5 13.8h.01',
  book: 'M4.5 5.5c2.5-.8 5-.6 7.5 1 2.5-1.6 5-1.8 7.5-1v12c-2.5-.8-5-.6-7.5 1-2.5-1.6-5-1.8-7.5-1z M12 6.5V19',
  gift: 'M4.5 10h15v9h-15z M3.5 7h17v3h-17z M12 7v12 M12 7c-1-3-4.5-3.5-4.5-1.5S10 7 12 7z M12 7c1-3 4.5-3.5 4.5-1.5S14 7 12 7z',
  heart: 'M12 19.5C6 15.2 4 12.4 4 9.6A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 8 1.6c0 2.8-2 5.6-8 9.9z',
  car: 'M4 14.5l1.6-4.8A2 2 0 0 1 7.5 8.3h9a2 2 0 0 1 1.9 1.4L20 14.5v3.5h-2.2v-1.5H6.2V18H4z M7 13.8h.01 M17 13.8h.01',
  phone: 'M8 3.5h8a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V5A1.5 1.5 0 0 1 8 3.5z M10.5 18h3',
  plane: 'M3.5 12.5l17-8-5 15-3.5-5.5-8.5-1.5z M12 14l8.5-9.5',
  paw: 'M12 12.5c-2.3 0-4.5 2.4-4.5 4.4 0 1.5 1.1 2.1 2.3 2.1.9 0 1.4-.4 2.2-.4s1.3.4 2.2.4c1.2 0 2.3-.6 2.3-2.1 0-2-2.2-4.4-4.5-4.4z M6.5 10.5a1.4 1.9 0 1 0 .01 0 M10 7a1.4 2 0 1 0 .01 0 M14 7a1.4 2 0 1 0 .01 0 M17.5 10.5a1.4 1.9 0 1 0 .01 0',
  shirt: 'M8.5 4l-5 3 2 3.5 2-1V20h9V9.5l2 1 2-3.5-5-3c-.4 1.3-1.6 2-3.5 2S8.9 5.3 8.5 4z',
  home: 'M4 11.5L12 4.5l8 7 M6.5 10.5V19.5h11v-9 M10.5 19.5v-5h3v5',
  tv: 'M4.5 6.5h15v10h-15z M9 20h6 M12 16.5V20',
  moon: 'M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z',
  trophy: 'M8 4.5h8v5a4 4 0 0 1-8 0v-5z M8 6H5c0 3 1 4.5 3 5 M16 6h3c0 3-1 4.5-3 5 M12 13.5V17 M8.5 19.5h7',
  cloud: 'M7 18.5a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6-1A4.5 4.5 0 0 1 17.5 18.5z',
}
// rest = coffee cup alias
P.rest = P.coffee

export type IconName = keyof typeof P
/** Icons offered when creating a spend category. */
export const PICK_ICONS = ['food', 'coffee', 'ride', 'car', 'shop', 'shirt', 'bills', 'home', 'fun', 'tv', 'health', 'heart', 'book', 'gift', 'plane', 'phone', 'paw', 'spark', 'coin', 'moon']
export const PALETTE = ['#ff7a45', '#ffc46b', '#ff5d8f', '#c084fc', '#60a5fa', '#34d399', '#a3e635', '#f87171']

export function Icon({ name, size = 22, stroke = 1.9, style }: { name: string; size?: number; stroke?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...style }}>
      <path d={P[name] ?? P.spark} />
    </svg>
  )
}

/** Soft colored tile holding an icon. */
export function Badge({ icon, color, size = 44 }: { icon: string; color: string; size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.34, display: 'grid', placeItems: 'center', flex: 'none', color, background: `color-mix(in srgb, ${color} 20%, transparent)` }}>
      <Icon name={icon} size={size * 0.52} />
    </span>
  )
}
