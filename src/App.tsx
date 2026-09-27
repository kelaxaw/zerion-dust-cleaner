import { useState } from 'react'
import { useWalletAddress } from '@/hooks/use-wallet-address'
import type { ChainId } from '@/lib/chains'
import { DEFAULT_SETTINGS, type Settings } from '@/lib/settings'
import { ConnectPage } from '@/pages/connect'
import { DesignPage } from '@/pages/design'
import { OverviewPage } from '@/pages/overview'
import { PlanPage } from '@/pages/plan'

type Screen = { name: 'overview' } | { name: 'plan'; chain: ChainId }

export default function App() {
  if (window.location.pathname === '/design') return <DesignPage />
  return <Flow />
}

// No router: Overview → Plan (→ Signing → Result later) is a linear flow held in state.
function Flow() {
  const wallet = useWalletAddress()
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [screen, setScreen] = useState<Screen>({ name: 'overview' })

  if (!wallet.address) return <ConnectPage />
  if (screen.name === 'plan') return <PlanPage chain={screen.chain} onBack={() => setScreen({ name: 'overview' })} />
  return (
    <OverviewPage
      address={wallet.address}
      readOnly={wallet.readOnly}
      settings={settings}
      onSettingsChange={setSettings}
      onOpenChain={(chain) => setScreen({ name: 'plan', chain })}
    />
  )
}
