import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import type { ChainId } from '@/lib/chains'
import { queryKeys } from '@/lib/query-keys'
import { getBatchSupport, type SignMode } from '@/lib/sweep'

// Whether the wallet can take every call in one confirmation on this chain.
// Until the answer arrives, assume it can't: the one-by-one flow works everywhere.
export function useBatchSupport(address: Address, chain: ChainId): SignMode {
  const query = useQuery({
    queryKey: queryKeys.batchSupport(address, chain),
    queryFn: () => getBatchSupport(address, chain),
    staleTime: Infinity,
    retry: false,
  })
  return query.data ?? 'one_by_one'
}
