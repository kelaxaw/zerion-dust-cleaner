import { useId, type ReactNode } from 'react'
import { CheckIcon, LoaderCircleIcon } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/domain/status-badge'
import { TokenIcon } from '@/components/domain/token-icon'
import { MIN_USD, type WontSwapReason } from '@/lib/dust'
import { formatAmount, formatLoss, formatTokenAmount, formatUsd } from '@/lib/format'
import { cn } from '@/lib/utils'

// Balance-only reasons come from the Dust rules; 'blocked' (loss too high) and 'no_route' come from quotes.
export type OffReason = WontSwapReason | 'blocked' | 'no_route'

// One row, every state it can be in across the plan and signing screens.
// A discriminated union keeps impossible combos (e.g. "failed" with a checkbox) unrepresentable.
export type RowState =
  | { kind: 'quoting' }
  | { kind: 'ready'; checked: boolean; out: number; target: string; loss: number; onCheckedChange: (v: boolean) => void }
  | { kind: 'off'; reason: OffReason; loss?: number; maxUsd?: number }
  | { kind: 'waiting' }
  | { kind: 'confirm'; step: 'approve' | 'swap'; steps: 1 | 2 }
  | { kind: 'mining'; step: 'approve' | 'swap' }
  | { kind: 'done'; out: number; target: string }
  | { kind: 'failed'; message: string }
  | { kind: 'rejected' }

type Props = {
  symbol: string
  iconUrl?: string | null
  amount: number
  valueUsd: number | null
  state: RowState
}

const OFF_LABEL: Record<OffReason, (s: Extract<RowState, { kind: 'off' }>) => { text: string; tone: 'neutral' | 'warning' }> = {
  blocked: (s) => ({ text: `Loses ${formatLoss(s.loss ?? 0).slice(1)}`, tone: 'warning' }),
  no_route: () => ({ text: 'No swap route', tone: 'neutral' }),
  under_min: () => ({ text: `Under ${formatUsd(MIN_USD)}`, tone: 'neutral' }),
  above_max: (s) => ({ text: `Over $${s.maxUsd ?? ''}`, tone: 'neutral' }),
  no_price: () => ({ text: 'No price', tone: 'neutral' }),
}

export function TokenRow({ symbol, iconUrl, amount, valueUsd, state }: Props) {
  const id = useId()
  const dimmed = state.kind === 'off' || (state.kind === 'ready' && !state.checked)
  const active = state.kind === 'confirm' || state.kind === 'mining'

  let sub: ReactNode = `${formatAmount(amount)} · ${formatUsd(valueUsd)}`
  let subClass = 'text-muted-foreground'
  let right: ReactNode = null

  switch (state.kind) {
    case 'quoting':
      right = (
        <div className="flex flex-col items-end gap-1.5" aria-label="Getting price">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-2.5 w-10" />
        </div>
      )
      break
    case 'ready':
      right = (
        <div className="flex items-center gap-4">
          <div className={cn('text-right transition-opacity duration-150', !state.checked && 'opacity-45')}>
            <div className="num font-medium">{formatTokenAmount(state.out, state.target)}</div>
            <div className="num text-xs text-muted-foreground">{formatLoss(state.loss)}</div>
          </div>
          <Checkbox id={id} checked={state.checked} onCheckedChange={(v) => state.onCheckedChange(v === true)} className="size-5 rounded-md" />
        </div>
      )
      break
    case 'off': {
      const l = OFF_LABEL[state.reason](state)
      right = <StatusBadge tone={l.tone}>{l.text}</StatusBadge>
      break
    }
    case 'waiting':
      sub = 'Waiting'
      subClass = 'text-faint-foreground'
      break
    case 'confirm':
      sub = state.steps === 1 ? 'Swap' : state.step === 'approve' ? 'Approve · 1 of 2' : 'Swap · 2 of 2'
      subClass = 'text-foreground'
      right = <StatusBadge tone="brand" pulse>Confirm in wallet</StatusBadge>
      break
    case 'mining':
      sub = state.step === 'approve' ? 'Approving on-chain…' : 'Swapping on-chain…'
      subClass = 'text-foreground'
      right = <LoaderCircleIcon className="size-4 animate-spin text-brand motion-reduce:animate-none" aria-label="Pending" />
      break
    case 'done':
      sub = 'Swapped'
      right = (
        <div className="flex items-center gap-2 text-success">
          <span className="num font-medium">+{formatTokenAmount(state.out, state.target)}</span>
          <CheckIcon className="size-4" strokeWidth={2.5} />
        </div>
      )
      break
    case 'failed':
      sub = state.message
      subClass = 'text-destructive'
      right = <StatusBadge tone="destructive">Failed</StatusBadge>
      break
    case 'rejected':
      sub = 'You declined in wallet'
      right = <StatusBadge>Skipped</StatusBadge>
      break
  }

  const body = (
    <>
      <TokenIcon symbol={symbol} src={iconUrl} muted={state.kind === 'off'} />
      <div className={cn('min-w-0 flex-1 transition-opacity duration-150', state.kind === 'ready' && !state.checked && 'opacity-45')}>
        <div className={cn('font-medium', dimmed && state.kind === 'off' && 'text-muted-foreground')}>{symbol}</div>
        <div className={cn('num truncate text-caption', subClass)}>{sub}</div>
      </div>
      {right}
    </>
  )

  const base = 'flex min-h-14 w-full items-center gap-3 rounded-md px-3 py-2 text-left'

  // Ready rows toggle on click anywhere. A <label> keeps the checkbox as the single
  // interactive element (no button-inside-button) while making the whole row a target.
  if (state.kind === 'ready') {
    return (
      <label htmlFor={id} className={cn(base, 'cursor-pointer transition-colors hover:bg-accent')}>
        {body}
      </label>
    )
  }

  return <div className={cn(base, 'transition-colors duration-200', active && 'bg-brand-soft/60 shadow-active')}>{body}</div>
}
