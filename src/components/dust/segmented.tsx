import { useId } from 'react'
import { motion } from 'motion/react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

type Props<T extends string> = {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}

// Segmented control: Radix ToggleGroup for keyboard + a11y, motion for the sliding thumb.
// The thumb is one element shared via layoutId, so it glides between segments instead of blinking.
// Radix "single" allows deselecting to "", which a picker must never do, hence the guard.
export function Segmented<T extends string>({ label, value, options, onChange, className }: Props<T>) {
  const thumbId = useId()
  return (
    <ToggleGroup
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      spacing={0}
      className={cn('rounded-full bg-muted p-[3px] shadow-[inset_0_0_0_1px_var(--border)]', className)}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <ToggleGroupItem
            key={o.value}
            value={o.value}
            className={cn(
              'relative h-8 min-w-12 rounded-full! border-0! bg-transparent! px-3.5 text-[13px] font-medium transition-colors duration-200',
              on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {on && (
              <motion.span
                layoutId={thumbId}
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-card shadow-pill"
                transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.8 }}
              />
            )}
            <span className="relative num">{o.label}</span>
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
