import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/domain/status-badge'
import { RowList } from '@/components/domain/row-list'
import { TokenRow } from '@/components/domain/token-row'
import type { BatchPhase, SweepRow } from '@/hooks/use-sweep'
import { formatUsd } from '@/lib/format'
import type { SignMode } from '@/lib/sweep'

type Props = {
  chainName: string
  target: string
  rows: SweepRow[]
  mode: SignMode
  batch: BatchPhase
  stopping: boolean
  onStop: () => void
}

// Signing screen. No back button: leaving mid-sweep would orphan a pending signature.
// Batch mode has one confirmation for everything, so no per-token counter and no Stop.
export function SweepPage({ chainName, target, rows, mode, batch, stopping, onStop }: Props) {
  const expectedUsd = rows.reduce((s, r) => s + r.token.quote.outUsd, 0)
  const receivedUsd = rows.reduce((s, r) => s + (r.state.kind === 'done' ? r.token.quote.outUsd : 0), 0)
  const current = rows.findIndex((r) => r.state.kind === 'confirm' || r.state.kind === 'mining')
  const batchCount = rows.filter((r) => r.state.kind === 'waiting').length

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-popup flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <div className="eyebrow">SWEEPING {chainName.toUpperCase()}</div>
        <h1 className="text-xl font-medium tracking-tight">
          {mode === 'batch' ? (batch === 'mining' ? 'Swapping on-chain…' : 'Confirm the batch in your wallet') : 'Confirm each swap in your wallet'}
        </h1>
        {batch === 'confirm' && (
          <StatusBadge tone="brand" pulse className="self-start">
            {batchCount} swaps · one confirmation
          </StatusBadge>
        )}
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <span className="display num text-display-sm">{formatUsd(receivedUsd)}</span>
          <span className="num text-caption text-muted-foreground">
            of ~{formatUsd(expectedUsd)} in {target}
          </span>
        </div>
        <Progress value={expectedUsd ? (receivedUsd / expectedUsd) * 100 : 0} className="h-1.5 [&>div]:bg-success" />
        {mode === 'one_by_one' && current >= 0 && (
          <div className="num text-caption text-muted-foreground">
            Token {current + 1} of {rows.length}
          </div>
        )}
      </div>

      <RowList
        items={rows}
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

      {mode === 'one_by_one' && (
        <Button size="lg" variant="ghost" className="self-center" disabled={stopping} onClick={onStop}>
          {stopping ? 'Stopping after this token…' : 'Stop after this token'}
        </Button>
      )}
    </main>
  )
}
