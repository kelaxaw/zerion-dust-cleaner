import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

type Props<T extends string> = {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}

// Linear-style segmented control: grey track, selected segment lifts to white.
// Radix ToggleGroup "single" allows deselecting to "", which a picker must never do.
export function Segmented<T extends string>({ label, value, options, onChange, className }: Props<T>) {
  return (
    <ToggleGroup
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      spacing={0}
      className={cn('rounded-full bg-muted p-0.5', className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className={cn(
            'h-8 min-w-12 rounded-full! border-0! px-3 text-[13px] text-muted-foreground transition-[color,background-color,box-shadow] duration-150',
            'hover:bg-transparent hover:text-foreground',
            'data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-card',
          )}
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
