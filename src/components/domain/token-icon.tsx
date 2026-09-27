import { useState } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  symbol: string
  src?: string | null
  size?: number
  shape?: 'circle' | 'square'
  muted?: boolean
  className?: string
}

// Stable hue per symbol so a token keeps its colour across screens.
function hueOf(symbol: string): number {
  let h = 0
  for (const ch of symbol) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

// Zerion gives an icon URL for most fungibles. Dust tokens often have none or a broken one,
// so the fallback is a first-class state, not an afterthought.
export function TokenIcon({ symbol, src, size = 32, shape = 'circle', muted = false, className }: Props) {
  const [broken, setBroken] = useState(false)
  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-md'
  const style = { width: size, height: size }

  if (src && !broken && !muted) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        onError={() => setBroken(true)}
        className={cn('shrink-0 bg-muted object-cover ring-1 ring-border', radius, className)}
        style={style}
      />
    )
  }

  const hue = hueOf(symbol)
  const letters = symbol.replace(/^(cb|w)(?=[A-Z])/, '').slice(0, 2).toUpperCase()
  return (
    <div
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center font-semibold ring-1 ring-black/5', radius, className)}
      style={{
        ...style,
        fontSize: Math.round(size * 0.34),
        background: muted ? 'var(--muted)' : `oklch(0.95 0.035 ${hue})`,
        color: muted ? 'var(--faint-foreground)' : `oklch(0.45 0.11 ${hue})`,
      }}
    >
      {letters}
    </div>
  )
}
