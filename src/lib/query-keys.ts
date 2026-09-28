import type { Address } from 'viem'
import type { ChainId } from '@/lib/chains'
import type { Target } from '@/lib/settings'

// Every React Query key in one place. Hooks and invalidations build keys here,
// never by hand, so a key and the code that invalidates it can't drift apart.
// Keys go from broad to narrow, so a prefix (e.g. ['quote', address, chain]) matches a group.
export const queryKeys = {
  positions: (address: Address, chain: ChainId) => ['positions', address, chain] as const,
  quote: (address: Address, chain: ChainId, target: Target, positionId: string) => ['quote', address, chain, target, positionId] as const,
  batchSupport: (address: Address, chain: ChainId) => ['batch-support', address, chain] as const,
}
