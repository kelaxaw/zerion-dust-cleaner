import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import { CHAINS } from './src/lib/chains.ts'

// The Zerion key uses Basic auth, so it must never reach the browser.
// The dev server proxies /zerion/* to api.zerion.io and adds the header here.
// No VITE_ prefix on the variable = Vite never inlines it into the bundle.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const auth = 'Basic ' + Buffer.from(`${env.ZERION_API_KEY ?? ''}:`).toString('base64')

  // Alchemy puts the key in the URL path, so it gets the same treatment: the browser calls
  // /alchemy/<network>, the proxy adds /v2/<key>. ALCHEMY_URL can be any Alchemy URL; only
  // its key is used, the network comes from the chain. Only our chains are proxied.
  const alchemyKey = env.ALCHEMY_URL ? new URL(env.ALCHEMY_URL).pathname.split('/').pop() : ''
  const alchemy: Record<string, ProxyOptions> = Object.fromEntries(
    CHAINS.map(({ alchemyNetwork }) => [
      `/alchemy/${alchemyNetwork}`,
      {
        target: `https://${alchemyNetwork}.g.alchemy.com`,
        changeOrigin: true,
        rewrite: () => `/v2/${alchemyKey}`,
      },
    ]),
  )

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
    server: {
      proxy: {
        '/zerion': {
          target: 'https://api.zerion.io',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/zerion/, ''),
          headers: { Authorization: auth },
        },
        ...alchemy,
      },
    },
  }
})
