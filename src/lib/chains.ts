import { arbitrum, base, bsc, optimism, polygon } from 'viem/chains'

// The chains a sweep can run on. Hardcoded on purpose: we never call Zerion /chains.
// `id` is the Zerion chain id, `viemChain` is what wagmi signs against.
// `gasTokenAddress` is how Zerion lists the gas token in `implementations` for this chain:
// null (no contract) everywhere except Polygon, where native POL sits at the 0x…1010 system contract.
export const CHAINS = [
  { id: 'base', name: 'Base', viemChain: base, gasSymbol: 'ETH', gasTokenAddress: null },
  { id: 'arbitrum', name: 'Arbitrum', viemChain: arbitrum, gasSymbol: 'ETH', gasTokenAddress: null },
  { id: 'optimism', name: 'Optimism', viemChain: optimism, gasSymbol: 'ETH', gasTokenAddress: null },
  { id: 'polygon', name: 'Polygon', viemChain: polygon, gasSymbol: 'POL', gasTokenAddress: '0x0000000000000000000000000000000000001010' },
  { id: 'binance-smart-chain', name: 'BNB Chain', viemChain: bsc, gasSymbol: 'BNB', gasTokenAddress: null },
] as const

export type Chain = (typeof CHAINS)[number]
export type ChainId = Chain['id']

export function chainById(id: ChainId): Chain {
  return CHAINS.find((c) => c.id === id)!
}
