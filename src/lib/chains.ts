import { arbitrum, base, bsc, optimism, polygon } from 'viem/chains'

// The chains a sweep can run on. Hardcoded on purpose: we never call Zerion /chains.
// `id` is the Zerion chain id, `viemChain` is what wagmi signs against.
// `gasTokenAddress` is how Zerion lists the gas token in `implementations` for this chain:
// null (no contract) everywhere except Polygon, where native POL sits at the 0x…1010 system contract.
// `gasFungibleId` is the gas token's Zerion fungible id, used as a swap target.
// `alchemyNetwork` is the subdomain of the chain's Alchemy RPC: https://<alchemyNetwork>.g.alchemy.com/v2/<key>.
export const CHAINS = [
  { id: 'base', name: 'Base', viemChain: base, gasSymbol: 'ETH', gasTokenAddress: null, gasFungibleId: 'eth', alchemyNetwork: 'base-mainnet' },
  { id: 'arbitrum', name: 'Arbitrum', viemChain: arbitrum, gasSymbol: 'ETH', gasTokenAddress: null, gasFungibleId: 'eth', alchemyNetwork: 'arb-mainnet' },
  { id: 'optimism', name: 'Optimism', viemChain: optimism, gasSymbol: 'ETH', gasTokenAddress: null, gasFungibleId: 'eth', alchemyNetwork: 'opt-mainnet' },
  {
    id: 'polygon',
    name: 'Polygon',
    viemChain: polygon,
    gasSymbol: 'POL',
    gasTokenAddress: '0x0000000000000000000000000000000000001010',
    gasFungibleId: '7560001f-9b6d-4115-b14a-6c44c4334ef2',
    alchemyNetwork: 'polygon-mainnet',
  },
  { id: 'binance-smart-chain', name: 'BNB Chain', viemChain: bsc, gasSymbol: 'BNB', gasTokenAddress: null, gasFungibleId: '0xb8c77482e45f1f44de1745f52c74426c631bdd52', alchemyNetwork: 'bnb-mainnet' },
] as const

export type Chain = (typeof CHAINS)[number]
export type ChainId = Chain['id']

export function chainById(id: ChainId): Chain {
  return CHAINS.find((c) => c.id === id)!
}
