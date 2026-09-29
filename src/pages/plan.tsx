import { useState, type ReactNode } from 'react'
import type { Address } from 'viem'
import { ArrowLeftIcon, LoaderCircleIcon, RotateCcwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Notice } from '@/components/domain/notice'
import { Segmented } from '@/components/domain/segmented'
import { RowList } from '@/components/domain/row-list'
import { TokenRow, type OffReason } from '@/components/domain/token-row'
import { WontSwapList, type WontSwapItem } from '@/components/domain/wont-swap-list'
import { useChainPositions } from '@/hooks/use-chain-positions'
import { useQuotes } from '@/hooks/use-quotes'
import { chainById, type ChainId } from '@/lib/chains'
import { MIN_USD, summarizeChain, type ValueCap } from '@/lib/dust'
import { formatTokenAmount, formatUsd } from '@/lib/format'
import { parseValueCap, targetSymbol, VALUE_CAPS, type Target } from '@/lib/settings'
import { judgeQuote, type Quote, type SignMode, type SweepToken } from '@/lib/sweep'
import type { Position } from '@/lib/zerion'

type Props = {
  address: Address
  readOnly: boolean
  chain: ChainId
  valueCap: ValueCap
  onValueCapChange: (cap: ValueCap) => void
  target: Target
  signMode: SignMode
  onTargetChange: (target: Target) => void
  onBack: () => void
  onSweep: (tokens: SweepToken[]) => void
  onGetGas: () => void
}

const CAP_OPTIONS = VALUE_CAPS.map((cap) => ({ value: String(cap), label: `$${cap}` }))
// Quotes go out one per token and the dev key allows 3 requests per second, so only the most
// valuable tokens are quoted up front; the tail is priced on demand, this many at a time.
const QUOTE_BATCH = 20

type Off = { position: Position; reason: OffReason; loss?: number }

// Rows in the main list: still quoting, quote request failed, or sweepable. Tokens that won't swap go to the dropdown.
type MainRow = { position: Position; token?: SweepToken; error?: { message: string; retry: () => void } }

function toWontSwapItem({ position, reason, loss }: Off): WontSwapItem {
  const p = position.attributes
  return {
    id: position.id,
    symbol: p.fungible_info.symbol,
    name: p.fungible_info.name,
    iconUrl: p.fungible_info.icon?.url,
    amount: p.quantity.float,
    valueUsd: p.value,
    reason,
    loss,
  }
}

export function PlanPage({ address, readOnly, chain, valueCap, onValueCapChange, target, signMode, onTargetChange, onBack, onSweep, onGetGas }: Props) {
  const { name, gasSymbol } = chainById(chain)
  const symbol = targetSymbol(target, chain)
  const positions = useChainPositions(address, chain)
  const summary = positions.data ? summarizeChain(positions.data, { chain, valueCap }) : null
  const dust = summary?.dust ?? []
  const [quoteLimit, setQuoteLimit] = useState(QUOTE_BATCH)
  const quoted = [...dust].sort((a, b) => (b.attributes.value ?? 0) - (a.attributes.value ?? 0)).slice(0, quoteLimit)
  const unquoted = dust.length - quoted.length
  const quotes = useQuotes(address, chain, target, quoted)
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set())

  // Split quoted dust into sweepable and "won't swap"; the balance-only reasons come from the summary.
  const main: MainRow[] = []
  const sweepable: SweepToken[] = []
  const off: Off[] = []
  let pending = 0
  quoted.forEach((position, i) => {
    const q = quotes[i]
    // A failed quote being retried has no data and isn't pending, so it's caught by isFetching.
    if (q.isPending || (q.isFetching && !q.data)) {
      pending++
      main.push({ position })
      return
    }
    // A failed request (429, timeout) is not "no route": it stays in the list with Retry.
    if (!q.data) {
      main.push({ position, error: { message: q.error?.message ?? 'Couldn’t get a price', retry: () => void q.refetch() } })
      return
    }
    const quote: Quote = q.data
    const verdict = judgeQuote(quote)
    if (verdict.kind === 'sweepable' && quote.kind === 'route') {
      const token = { position, quote }
      sweepable.push(token)
      main.push({ position, token })
    } else if (verdict.kind === 'wont_swap') off.push({ position, reason: verdict.reason, loss: quote.kind === 'route' ? quote.loss : undefined })
  })
  for (const w of summary?.wontSwap ?? []) off.push(w)

  const selected = sweepable.filter((t) => !unticked.has(t.position.id))
  const selectedUsd = selected.reduce((s, t) => s + (t.position.attributes.value ?? 0), 0)
  const selectedOut = selected.reduce((s, t) => s + t.quote.out, 0)
  const approvals = selected.filter((t) => t.quote.calls.approve).length
  const hasGas = summary?.hasGas ?? true

  function toggle(id: string, on: boolean) {
    setUnticked((prev) => {
      const next = new Set(prev)
      if (on) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Tokens already quoted can be swept while the rest are still pricing.
  let cta: ReactNode
  if (!hasGas) cta = `No ${gasSymbol} for fees`
  else if (selected.length > 0) cta = `Clean up ${selected.length} ${selected.length === 1 ? 'token' : 'tokens'}`
  else if (pending > 0)
    cta = (
      <>
        <LoaderCircleIcon className="animate-spin" />
        Getting prices…
      </>
    )
  else cta = 'Select tokens to swap'
  const canSweep = hasGas && selected.length > 0
  const nextBatch = Math.min(unquoted, QUOTE_BATCH)

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-popup flex-col gap-6 px-4 pt-10">
      <header className="flex items-center gap-2">
        <Button size="icon-lg" variant="ghost" aria-label="Back" onClick={onBack}>
          <ArrowLeftIcon />
        </Button>
        <h1 className="text-xl font-medium tracking-tight">Clean up {name}</h1>
      </header>

      {dust.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="display num text-display">{formatUsd(selectedUsd)}</div>
          <div className="num text-caption text-muted-foreground">
            ≈ {formatTokenAmount(selectedOut, symbol)} after fees · {selected.length} of {dust.length} tokens
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-caption text-muted-foreground">Convert into</span>
          <Segmented
            label="Convert into"
            value={target}
            onChange={onTargetChange}
            options={[
              { value: 'USDC', label: 'USDC' },
              { value: 'gas', label: gasSymbol },
            ]}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-caption text-muted-foreground">Tokens worth up to</span>
          <Segmented
            label="Tokens worth up to"
            value={String(valueCap)}
            options={CAP_OPTIONS}
            onChange={(v) => onValueCapChange(parseValueCap(v) ?? valueCap)}
          />
        </div>
      </div>

      {!hasGas && (
        <Notice
          tone="warning"
          action={
            <Button size="sm" variant="outline" className="bg-card" onClick={onGetGas}>
              Get {gasSymbol}
            </Button>
          }
        >
          No {gasSymbol} to pay network fees.
        </Notice>
      )}
      {readOnly && <Notice>Read-only wallet: the sweep is simulated, nothing is signed.</Notice>}
      {signMode === 'batch' && selected.length > 1 && (
        <Notice>One confirmation in your wallet for all {selected.length} tokens, approvals included.</Notice>
      )}
      {signMode === 'one_by_one' && approvals > 0 && (
        <Notice>
          {approvals === 1 ? '1 token takes' : `${approvals} tokens take`} 2 signatures: approve, then swap.
        </Notice>
      )}

      {pending > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-caption text-muted-foreground">
            <span>Getting best prices</span>
            <span className="num">
              {quoted.length - pending} of {quoted.length}
            </span>
          </div>
          <Progress value={((quoted.length - pending) / quoted.length) * 100} className="[&>div]:bg-brand" />
        </div>
      )}

      {positions.isPending && (
        <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-card" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-2.5 w-28" />
              </div>
            </div>
          ))}
        </div>
      )}

      {positions.isError && (
        <Notice
          tone="warning"
          action={
            <Button size="sm" variant="outline" className="bg-card" onClick={() => void positions.refetch()}>
              <RotateCcwIcon />
              Retry
            </Button>
          }
        >
          {positions.error.message}
        </Notice>
      )}

      {summary && dust.length === 0 && (
        <Notice>
          No dust on {name} between {formatUsd(MIN_USD)} and ${valueCap}.
        </Notice>
      )}

      {main.length > 0 && (
        <RowList
          items={main}
          getKey={(r) => r.position.id}
          className="rounded-2xl bg-card p-2 shadow-card"
          renderItem={({ position, token, error }) => {
            const p = position.attributes
            const row = { symbol: p.fungible_info.symbol, iconUrl: p.fungible_info.icon?.url, amount: p.quantity.float, valueUsd: p.value }
            if (error) return <TokenRow {...row} state={{ kind: 'quote_failed', message: error.message, onRetry: error.retry }} />
            if (!token) return <TokenRow {...row} state={{ kind: 'quoting' }} />
            return (
              <TokenRow
                {...row}
                state={{
                  kind: 'ready',
                  checked: !unticked.has(position.id),
                  out: token.quote.out,
                  target: symbol,
                  loss: token.quote.loss,
                  onCheckedChange: (v) => toggle(position.id, v),
                }}
              />
            )
          }}
        />
      )}

      {unquoted > 0 && (
        <Button variant="outline" className="w-full" onClick={() => setQuoteLimit((n) => n + QUOTE_BATCH)}>
          Get prices for {nextBatch} more {nextBatch === 1 ? 'token' : 'tokens'}
          {unquoted > nextBatch && <span className="num text-muted-foreground">· {unquoted} left</span>}
        </Button>
      )}

      {off.length > 0 && <WontSwapList items={off.map(toWontSwapItem)} maxUsd={valueCap} />}

      <div className="sticky bottom-0 mt-auto bg-background pt-2 pb-6">
        <Button size="xl" className="w-full" disabled={!canSweep} onClick={() => onSweep(selected)}>
          {cta}
        </Button>
      </div>
    </main>
  )
}
