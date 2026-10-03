import { motion } from 'framer-motion';

// Ornaments borrowed from the app icon: four-point stars, a lamp glow, a leafy branch.

export function Star({ size = 16, className = '', style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
      <path d="M12 0C12.9 7.6 16.4 11.1 24 12 16.4 12.9 12.9 16.4 12 24 11.1 16.4 7.6 12.9 0 12 7.6 11.1 11.1 7.6 12 0Z" fill="currentColor" />
    </svg>
  );
}

/** A few twinkling stars scattered over a dark surface. Positions are fixed so they don't jump. */
const FIELD = [
  { x: 36, y: 4, s: 9, d: 0 },
  { x: 58, y: 8, s: 13, d: 1.1 },
  { x: 90, y: 34, s: 8, d: 0.4 },
  { x: 47, y: 36, s: 7, d: 2 },
  { x: 80, y: 62, s: 6, d: 1.6 },
  { x: 6, y: 80, s: 8, d: 2.6 },
  { x: 94, y: 86, s: 6, d: 0.8 },
];
export function StarField({ count = FIELD.length }: { count?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {FIELD.slice(0, count).map((p, i) => (
        <Star
          key={i}
          size={p.s}
          className="animate-twinkle absolute text-glow drop-shadow-[0_0_6px_rgba(255,214,150,.9)]"
          style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${p.d}s` }}
        />
      ))}
    </div>
  );
}

/** The leafy sprig from the icon, as a faint silhouette. */
export function Sprig({ className = '', flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 80 160"
      className={className}
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M40 160C38 120 42 80 58 30" stroke="currentColor" strokeWidth="2.5" fill="none" />
      <path d="M57 34C50 16 58 4 74 0 76 16 70 28 57 34Z" />
      <path d="M50 62C36 52 34 38 40 26 52 34 55 48 50 62Z" />
      <path d="M52 66C62 54 74 52 80 56 74 68 64 72 52 66Z" />
      <path d="M44 96C30 88 26 74 30 62 42 70 47 82 44 96Z" />
      <path d="M46 100C56 88 68 86 76 90 70 102 58 106 46 100Z" />
      <path d="M40 132C27 124 24 110 28 99 39 107 43 119 40 132Z" />
    </svg>
  );
}

/** Golden sparks flying out from the middle, for a right answer or a finished page. */
export function Burst({ n = 12, radius = 90, className = '' }: { n?: number; radius?: number; className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 flex items-center justify-center ${className}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + (i % 2 ? 0.2 : 0);
        const r = radius * (i % 3 === 0 ? 1 : 0.72);
        return (
          <motion.span
            key={i}
            className="absolute text-gold"
            initial={{ x: 0, y: 0, scale: 0.2, opacity: 1 }}
            animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r, scale: [0.2, 1, 0.4], opacity: [1, 1, 0], rotate: 90 }}
            transition={{ duration: 0.75, ease: 'easeOut' }}
          >
            <Star size={i % 3 === 0 ? 14 : 9} />
          </motion.span>
        );
      })}
    </div>
  );
}

/** Circular progress, for the daily goal. */
export function Ring({
  value,
  size = 64,
  stroke = 7,
  track = 'var(--color-track)',
  color = 'var(--color-accent)',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  track?: string;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
