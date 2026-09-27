import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  size?: number
  children?: ReactNode
  className?: string
}

// The product's one decorative element: scattered pigments (the dust) held in one soft sphere
// (the swept result). Three blurred blobs drift slowly; content sits on a frosted core.
export function DustOrb({ size = 280, children, className }: Props) {
  return (
    <div className={cn('relative isolate grid place-items-center', className)} style={{ width: size, height: size }}>
      <div
        aria-hidden="true"
        className="absolute inset-0 motion-safe:animate-[orb-drift_28s_linear_infinite]"
        style={{ filter: `blur(${Math.round(size * 0.09)}px)` }}
      >
        <span className="absolute top-[4%] left-[12%] size-[58%] rounded-full bg-dust-iris opacity-80" />
        <span className="absolute top-[30%] right-[4%] size-[52%] rounded-full bg-dust-peach opacity-90" />
        <span className="absolute bottom-[2%] left-[22%] size-[50%] rounded-full bg-dust-mint opacity-90" />
      </div>
      {/* Specks: the dust before it's swept */}
      <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 size-full opacity-60">
        {[
          [18, 22, 0.9], [82, 16, 0.7], [90, 58, 1.1], [12, 70, 0.8], [30, 90, 0.6], [70, 88, 0.9], [50, 6, 0.6], [96, 36, 0.5],
        ].map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="var(--foreground)" opacity={0.35} />
        ))}
      </svg>
      <div className="relative">{children}</div>
    </div>
  )
}
