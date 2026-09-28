import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import type { Address } from 'viem'
import { useBatchSupport } from '@/hooks/use-batch-support'
import { useNextChain } from '@/hooks/use-next-chain'
import { useSweep } from '@/hooks/use-sweep'
import { useWalletAddress } from '@/hooks/use-wallet-address'
import { chainById, type ChainId } from '@/lib/chains'
import { queryKeys } from '@/lib/query-keys'
import { DEFAULT_VALUE_CAP, targetSymbol, type Target } from '@/lib/settings'
import { ConnectPage } from '@/pages/connect'
import { OverviewPage } from '@/pages/overview'
import { PlanPage } from '@/pages/plan'
import { ResultPage } from '@/pages/result'
import { SweepPage } from '@/pages/sweep'

// Adapters between the router and the pages: read params and search, pass plain props down.
// Kept apart from src/router.tsx so this file only exports components (Fast Refresh).

export function HomeRoute() {
  const wallet = useWalletAddress()
  const { cap = DEFAULT_VALUE_CAP } = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })
  if (!wallet.address) return <ConnectPage />
  return (
    <OverviewPage
      address={wallet.address}
      readOnly={wallet.readOnly}
      valueCap={cap}
      onValueCapChange={(next) => navigate({ search: (prev) => ({ ...prev, cap: next }), replace: true })}
      onOpenChain={(chain) => navigate({ to: '/plan/$chain', params: { chain } })}
    />
  )
}

export function PlanRoute() {
  const wallet = useWalletAddress()
  const { chain } = useParams({ from: '/plan/$chain' })
  if (!wallet.address) return <Navigate to="/" />
  // Keyed by chain: "Next: Arbitrum" starts a fresh plan instead of reusing Base's sweep state.
  return <SweepFlow key={chain} address={wallet.address} readOnly={wallet.readOnly} chain={chain} />
}

// Plan → Sweep → Result for one chain. The sweep status picks the screen.
function SweepFlow({ address, readOnly, chain }: { address: Address; readOnly: boolean; chain: ChainId }) {
  const { cap = DEFAULT_VALUE_CAP } = useSearch({ from: '/plan/$chain' })
  const navigate = useNavigate({ from: '/plan/$chain' })
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<Target>('USDC')
  const sweep = useSweep()
  const signMode = useBatchSupport(address, chain)
  const next = useNextChain(address, chain, cap)
  const { name } = chainById(chain)
  const symbol = targetSymbol(target, chain)

  // Plan, Sweep and Result share one URL, so the router doesn't reset scroll between them.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [sweep.status])

  if (sweep.status === 'running') {
    return (
      <SweepPage
        chainName={name}
        target={symbol}
        rows={sweep.rows}
        mode={sweep.mode}
        batch={sweep.batch}
        stopping={sweep.stopping}
        onStop={sweep.stop}
      />
    )
  }

  if (sweep.status === 'finished') {
    return (
      <ResultPage
        chainName={name}
        target={symbol}
        rows={sweep.rows}
        next={next}
        onDone={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.positions(address, chain) })
          navigate({ to: '/' })
        }}
        // TODO: re-quote before retrying; the old quotes may be stale by now.
        onRetry={(tokens) => void sweep.start(tokens, { target: symbol, chain, mode: signMode })}
        onNext={(n) => navigate({ to: '/plan/$chain', params: { chain: n.chain.id } })}
      />
    )
  }

  return (
    <PlanPage
      address={address}
      readOnly={readOnly}
      chain={chain}
      valueCap={cap}
      onValueCapChange={(next) => navigate({ search: (prev) => ({ ...prev, cap: next }), replace: true })}
      target={target}
      signMode={signMode}
      onTargetChange={setTarget}
      onBack={() => navigate({ to: '/' })}
      onSweep={(tokens) => void sweep.start(tokens, { target: symbol, chain, mode: signMode })}
      // TODO: where "Get POL" leads (bridge, onramp, or a help page).
      onGetGas={() => {}}
    />
  )
}

export function NotFoundRoute() {
  return <Navigate to="/" />
}
