import type { ReactNode } from 'react'
import { FuelIcon, InfoIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  tone?: 'warning' | 'info'
  children: ReactNode
  action?: ReactNode
  className?: string
}

// Inline, non-dismissable notice. Warning = blocks the action (no gas); info = explains it.
export function Notice({ tone = 'info', children, action, className }: Props) {
  const Icon = tone === 'warning' ? FuelIcon : InfoIcon
  return (
    <div
      role={tone === 'warning' ? 'alert' : 'note'}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3.5 py-3 text-caption leading-snug',
        tone === 'warning' ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      <Icon className="size-4 shrink-0" />
      <div className={cn('flex-1', tone === 'warning' && 'text-foreground')}>{children}</div>
      {action}
    </div>
  )
}
