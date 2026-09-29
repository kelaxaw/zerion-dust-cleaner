import { createConfig, http } from 'wagmi'
import { arbitrum, base, bsc, optimism, polygon } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { chainById, type ChainId } from '@/lib/chains'

// Reads (receipts, balances, gas) go to Alchemy through the dev proxy, so the key stays
// server-side: /alchemy/<network> → <network>.g.alchemy.com/v2/<key> (vite.config.ts).
// Signing never touches this: it goes to the wallet.
const alchemy = (chain: ChainId) => http(`${window.location.origin}/alchemy/${chainById(chain).alchemyNetwork}`)

// Same five chains as src/lib/chains.ts. The browser wallet is the only connector.
export const wagmiConfig = createConfig({
  chains: [base, arbitrum, optimism, polygon, bsc],
  connectors: [injected()],
  transports: {
    [base.id]: alchemy('base'),
    [arbitrum.id]: alchemy('arbitrum'),
    [optimism.id]: alchemy('optimism'),
    [polygon.id]: alchemy('polygon'),
    [bsc.id]: alchemy('binance-smart-chain'),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
