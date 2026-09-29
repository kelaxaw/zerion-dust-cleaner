import { CheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RowList } from '@/components/domain/row-list'
import { TokenRow } from '@/components/domain/token-row'
import type { SweepRow } from '@/hooks/use-sweep'
import { formatTokenAmount, formatUsd } from '@/lib/format'
import type { SweepToken } from '@/lib/sweep'

type Props = {
  chainName: string
  target: string
  rows: SweepRow[]
  onDone: () => void
  onRetry: (tokens: SweepToken[]) => void
}

// After a sweep: what arrived and what didn't. Done returns to the chain list for another network.
// Tokens left 'waiting' were never started because the user pressed Stop.
export function ResultPage({ chainName, target, rows, onDone, onRetry }: Props) {
  const done = rows.filter((r) => r.state.kind === 'done')
  const started = rows.filter((r) => r.state.kind !== 'waiting')
  const notStarted = rows.length - started.length
  const retry = rows.filter((r) => r.state.kind !== 'done').map((r) => r.token)
  const receivedOut = done.reduce((s, r) => s + r.token.quote.out, 0)
  const receivedUsd = done.reduce((s, r) => s + r.token.quote.outUsd, 0)

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-popup flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <div className="eyebrow">{chainName.toUpperCase()} · SWEEP DONE</div>
        <h1 className="text-xl font-medium tracking-tight">
          {done.length === 0 ? 'Nothing was swapped' : `Swept ${done.length} of ${rows.length} tokens`}
        </h1>
      </header>

      <div className="flex flex-col gap-2">
        <div className="display num text-display text-success">+{formatTokenAmount(receivedOut, target)}</div>
        <div className="flex items-center gap-1 num text-caption text-muted-foreground">
          {done.length > 0 && <CheckIcon className="size-3.5 text-success" strokeWidth={2.5} />}
          {formatUsd(receivedUsd)} received on {chainName}
        </div>
      </div>

      <RowList
        items={started}
        getKey={(r) => r.token.position.id}
        className="rounded-2xl bg-card p-2 shadow-card"
        renderItem={({ token, state }) => {
          const p = token.position.attributes
          return (
            <TokenRow
              symbol={p.fungible_info.symbol}
              iconUrl={p.fungible_info.icon?.url}
              amount={p.quantity.float}
              valueUsd={p.value}
              state={state}
            />
          )
        }}
      />
      {notStarted > 0 && (
        <p className="px-1 text-caption text-muted-foreground">
          {notStarted} {notStarted === 1 ? 'token was' : 'tokens were'} not started: you stopped the sweep.
        </p>
      )}

      <div className="mt-auto flex flex-col gap-3">
        {retry.length > 0 && (
          <Button size="xl" variant="outline" onClick={() => onRetry(retry)}>
            Try {retry.length} {retry.length === 1 ? 'token' : 'tokens'} again
          </Button>
        )}
        <Button size="xl" onClick={onDone}>
          Done
        </Button>
      </div>
    </main>
  )
}
