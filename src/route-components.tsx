import { Navigate, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { useWalletAddress } from '@/hooks/use-wallet-address'
import { DEFAULT_VALUE_CAP } from '@/lib/settings'
import { ConnectPage } from '@/pages/connect'
import { OverviewPage } from '@/pages/overview'
import { PlanPage } from '@/pages/plan'

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
  const navigate = useNavigate({ from: '/plan/$chain' })
  if (!wallet.address) return <Navigate to="/" />
  return <PlanPage chain={chain} onBack={() => navigate({ to: '/' })} />
}

export function NotFoundRoute() {
  return <Navigate to="/" />
}
