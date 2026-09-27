import type { CSSProperties } from 'react'
import type { Address } from 'viem'
import { useDisconnect } from 'wagmi'
import { Button } from '@/components/ui/button'
import { ChainCard, type ChainCardState } from '@/components/domain/chain-card'
import { Segmented } from '@/components/domain/segmented'
import { StatusBadge } from '@/components/domain/status-badge'
import { useChainPositions } from '@/hooks/use-chain-positions'
import { CHAINS, type Chain, type ChainId } from '@/lib/chains'
import { summarizeChain, type ValueCap } from '@/lib/dust'
import { formatAddress } from '@/lib/format'
import { VALUE_CAPS, type Settings } from '@/lib/settings'

type Props = {
  address: Address
  readOnly: boolean
  settings: Settings
  onSettingsChange: (s: Settings) => void
  onOpenChain: (chain: ChainId) => void
}

const CAP_OPTIONS = VALUE_CAPS.map((cap) => ({ value: String(cap), label: `$${cap}` }))

export function OverviewPage({ address, readOnly, settings, onSettingsChange, onOpenChain }: Props) {
  const disconnect = useDisconnect()

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-popup flex-col gap-8 px-4 py-10">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="eyebrow" title={address}>
            {formatAddress(address)}
          </span>
          {readOnly && <StatusBadge>Read-only</StatusBadge>}
        </div>
        {!readOnly && (
          <Button variant="ghost" size="sm" onClick={() => disconnect.mutate()}>
            Disconnect
          </Button>
        )}
      </header>

      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-medium tracking-tight">Pick a chain to sweep</h1>
        <p className="text-caption text-muted-foreground">Dust is anything worth from $1 up to your cap. Stablecoins, spam and gas stay put.</p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-caption text-muted-foreground">Tokens worth up to</span>
        <Segmented
          label="Tokens worth up to"
          value={String(settings.valueCap)}
          options={CAP_OPTIONS}
          onChange={(v) => onSettingsChange({ ...settings, valueCap: Number(v) as ValueCap })}
        />
      </div>

      <div className="flex flex-col gap-2">
        {CHAINS.map((chain, i) => (
          <div key={chain.id} className="reveal" style={{ '--i': i } as CSSProperties}>
            <ChainRow chain={chain} address={address} valueCap={settings.valueCap} onOpen={() => onOpenChain(chain.id)} />
          </div>
        ))}
      </div>
    </main>
  )
}

function ChainRow({ chain, address, valueCap, onOpen }: { chain: Chain; address: Address; valueCap: ValueCap; onOpen: () => void }) {
  const query = useChainPositions(address, chain.id)
  const onRetry = () => void query.refetch()

  let state: ChainCardState
  if (query.isPending || (query.isError && query.isFetching)) {
    state = { kind: 'loading' }
  } else if (query.isError) {
    state = { kind: 'error', message: query.error.message, onRetry }
  } else {
    try {
      const summary = summarizeChain(query.data, { chain: chain.id, valueCap })
      state =
        summary.dust.length === 0
          ? { kind: 'clean' }
          : {
              kind: 'ready',
              tokenCount: summary.dust.length,
              valueUsd: summary.dustValueUsd,
              hasGas: summary.hasGas,
              nativeSymbol: chain.gasSymbol,
              spamHidden: summary.spamHidden,
              onOpen,
            }
    } catch (e) {
      state = { kind: 'error', message: e instanceof Error ? e.message : String(e), onRetry }
    }
  }

  return <ChainCard name={chain.name} state={state} />
}
