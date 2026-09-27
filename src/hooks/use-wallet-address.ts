import { useConnection } from 'wagmi'
import { getAddress, isAddress, type Address } from 'viem'

// Dev only: ?address=0x… reads any wallet without connecting. Read-only, it can never sign.
function devAddress(): Address | undefined {
  if (!import.meta.env.DEV) return undefined
  const raw = new URLSearchParams(window.location.search).get('address')
  return raw && isAddress(raw) ? getAddress(raw) : undefined
}

export type WalletAddress = { address: Address; readOnly: boolean } | { address: undefined; readOnly: false }

export function useWalletAddress(): WalletAddress {
  const connection = useConnection()
  const override = devAddress()
  if (override) return { address: override, readOnly: true }
  if (connection.status === 'connected') return { address: connection.address, readOnly: false }
  return { address: undefined, readOnly: false }
}
