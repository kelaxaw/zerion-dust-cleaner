import { queryOptions, useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import type { ChainId } from '@/lib/chains'
import { queryKeys } from '@/lib/query-keys'
import { zerion } from '@/lib/zerion'

// One query per chain, so each ChainCard loads and fails on its own.
// retry: false because the Zerion client already retries 202 and 429 itself.
export function positionsQuery(address: Address, chain: ChainId) {
  return queryOptions({
    queryKey: queryKeys.positions(address, chain),
    queryFn: () => zerion.getPositions(address, chain),
    retry: false,
    staleTime: 60_000,
  })
}

export function useChainPositions(address: Address, chain: ChainId) {
  return useQuery(positionsQuery(address, chain))
}
