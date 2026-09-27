import type { CSSProperties } from 'react'
import { useConnect, useConnectors } from 'wagmi'
import { Button } from '@/components/ui/button'

function errorText(error: Error): string {
  if (error.name === 'ProviderNotFoundError') return 'No browser wallet found. Install MetaMask or Rabby, then reload.'
  return 'shortMessage' in error && typeof error.shortMessage === 'string' ? error.shortMessage : error.message
}

export function ConnectPage() {
  const connectors = useConnectors()
  const connect = useConnect()
  const connector = connectors[0]

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-popup flex-col justify-center gap-8 px-4 py-10">
      <div className="flex flex-col gap-4">
        <div className="reveal eyebrow" style={{ '--i': 0 } as CSSProperties}>
          DUST CLEANUP
        </div>
        <h1 className="reveal display text-display" style={{ '--i': 1 } as CSSProperties}>
          Sweep the dust.
        </h1>
        <p className="reveal text-md text-muted-foreground" style={{ '--i': 2 } as CSSProperties}>
          Swap the small balances on one chain into USDC or the chain’s gas token.
        </p>
      </div>
      <div className="reveal flex flex-col gap-3" style={{ '--i': 3 } as CSSProperties}>
        <Button size="xl" disabled={!connector || connect.isPending} onClick={() => connector && connect.mutate({ connector })}>
          {connect.isPending ? 'Confirm in your wallet…' : 'Connect wallet'}
        </Button>
        {connect.error && <p className="text-caption text-destructive">{errorText(connect.error)}</p>}
      </div>
    </main>
  )
}
