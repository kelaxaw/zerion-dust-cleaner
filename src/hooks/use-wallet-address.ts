import { useSearch } from '@tanstack/react-router'
import { useConnection } from 'wagmi'
import type { Address } from 'viem'

export type WalletAddress = { address: Address; readOnly: boolean } | { address: undefined; readOnly: false }

// The dev-only ?address= override (validated on the root route) wins over the connected wallet.
// It is read-only: nothing can be signed for it.
export function useWalletAddress(): WalletAddress {
  const connection = useConnection()
  const { address: override } = useSearch({ strict: false })
  if (override) return { address: override, readOnly: true }
  if (connection.status === 'connected') return { address: connection.address, readOnly: false }
  return { address: undefined, readOnly: false }
}
