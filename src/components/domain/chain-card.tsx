import { CheckIcon, ChevronRightIcon, FuelIcon, RotateCcwIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { TokenIcon } from '@/components/domain/token-icon'
import { formatUsd } from '@/lib/format'
import { cn } from '@/lib/utils'

export type ChainCardState =
  | { kind: 'loading' }
  | { kind: 'error'; onRetry: () => void }
  | { kind: 'ready'; tokenCount: number; valueUsd: number; hasGas: boolean; nativeSymbol: string; spamHidden?: number; onOpen: () => void }
  | { kind: 'clean' }

type Props = {
  name: string
  iconUrl?: string | null
  state: ChainCardState
}

// Each chain loads independently, so each card owns its loading / error / empty state.
// One slow or failing chain never blanks the overview.
export function ChainCard({ name, iconUrl, state }: Props) {
  const shell = 'flex min-h-16 w-full items-center gap-3 rounded-xl bg-card px-3.5 py-3 text-left shadow-card'
  const icon = <TokenIcon symbol={name} src={iconUrl} size={36} shape="square" />

  if (state.kind === 'loading') {
    return (
      <div className={shell} aria-busy="true" aria-label={`${name}, loading`}>
        {icon}
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="font-medium">{name}</div>
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-4 w-14" />
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className={shell}>
        {icon}
        <div className="flex-1">
          <div className="font-medium">{name}</div>
          <div className="text-caption text-destructive">Couldn’t load balances</div>
        </div>
        <button
          type="button"
          onClick={state.onRetry}
          className="flex h-8 items-center gap-1.5 rounded-full px-3 text-caption font-medium text-foreground transition-colors hover:bg-accent"
        >
          <RotateCcwIcon className="size-3.5" />
          Retry
        </button>
      </div>
    )
  }

  if (state.kind === 'clean') {
    return (
      <div className={shell}>
        {icon}
        <div className="flex-1">
          <div className="font-medium">{name}</div>
          <div className="flex items-center gap-1 text-caption text-success">
            <CheckIcon className="size-3.5" strokeWidth={2.5} />
            All clean
          </div>
        </div>
      </div>
    )
  }

  const { tokenCount, valueUsd, hasGas, nativeSymbol, spamHidden, onOpen } = state
  const tokens = `${tokenCount} ${tokenCount === 1 ? 'token' : 'tokens'}`
  return (
    <button type="button" onClick={onOpen} className={cn(shell, 'group transition duration-200 ease-out hover:-translate-y-px hover:shadow-raised active:translate-y-0')}>
      {icon}
      <div className="min-w-0 flex-1">
        <div className="font-medium">{name}</div>
        {hasGas ? (
          <div className="truncate text-caption text-muted-foreground">
            {tokens}
            {spamHidden ? ` · ${spamHidden} spam hidden` : ''}
          </div>
        ) : (
          <div className="flex items-center gap-1 text-caption text-warning">
            <FuelIcon className="size-3.5" />
            {tokens} · no {nativeSymbol} for gas
          </div>
        )}
      </div>
      <div className="num font-medium">{formatUsd(valueUsd)}</div>
      <ChevronRightIcon className="size-4 text-faint-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
    </button>
  )
}
