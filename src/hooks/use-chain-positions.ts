import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import type { ChainId } from '@/lib/chains'
import { zerion } from '@/lib/zerion'

// One query per chain, so each ChainCard loads and fails on its own.
// retry: false because the Zerion client already retries 202 and 429 itself.
export function useChainPositions(address: Address, chain: ChainId) {
  return useQuery({
    queryKey: ['positions', address, chain],
    queryFn: () => zerion.getPositions(address, chain),
    retry: false,
    staleTime: 60_000,
  })
}
