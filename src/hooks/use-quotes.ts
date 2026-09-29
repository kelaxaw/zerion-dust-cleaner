import { useQueries } from '@tanstack/react-query'
import type { Address } from 'viem'
import type { ChainId } from '@/lib/chains'
import { queryKeys } from '@/lib/query-keys'
import type { Target } from '@/lib/settings'
import { quoteSwap } from '@/lib/sweep'
import type { Position } from '@/lib/zerion'

// One quote per dust position. Changing the target re-quotes every token (new query keys).
// Quotes never refetch on their own: quoting a big wallet outlasts a short stale time, and a
// focus refetch would then re-request every quote and run into 429s.
// A failed quote is refetched only by its Retry button.
export function useQuotes(address: Address, chain: ChainId, target: Target, positions: Position[]) {
  return useQueries({
    queries: positions.map((position) => ({
      queryKey: queryKeys.quote(address, chain, target, position.id),
      queryFn: () => quoteSwap({ address, chain, target, position }),
      retry: false,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    })),
  })
}
