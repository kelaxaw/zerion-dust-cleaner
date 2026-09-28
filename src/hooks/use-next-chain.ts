import { useQueries } from '@tanstack/react-query'
import type { Address } from 'viem'
import { positionsQuery } from '@/hooks/use-chain-positions'
import { CHAINS, type Chain, type ChainId } from '@/lib/chains'
import { summarizeChain, type ValueCap } from '@/lib/dust'

export type NextChain = { chain: Chain; valueUsd: number }

// The first other chain (in CHAINS order) that still has dust and gas to sweep it.
// Reads the same queries as the Overview, so it is usually served from cache.
export function useNextChain(address: Address, current: ChainId, valueCap: ValueCap): NextChain | null {
  const others = CHAINS.filter((c) => c.id !== current)
  const results = useQueries({ queries: others.map((c) => positionsQuery(address, c.id)) })
  for (const [i, chain] of others.entries()) {
    const data = results[i].data
    if (!data) continue
    const summary = summarizeChain(data, { chain: chain.id, valueCap })
    if (summary.dust.length > 0 && summary.hasGas) return { chain, valueUsd: summary.dustValueUsd }
  }
  return null
}
