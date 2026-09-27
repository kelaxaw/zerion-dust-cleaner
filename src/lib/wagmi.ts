import { createConfig, http } from 'wagmi'
import { arbitrum, base, bsc, optimism, polygon } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

// Same five chains as src/lib/chains.ts. The browser wallet is the only connector.
export const wagmiConfig = createConfig({
  chains: [base, arbitrum, optimism, polygon, bsc],
  connectors: [injected()],
  transports: {
    [base.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
