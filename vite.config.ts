import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// The Zerion key uses Basic auth, so it must never reach the browser.
// The dev server proxies /zerion/* to api.zerion.io and adds the header here.
// No VITE_ prefix on the variable = Vite never inlines it into the bundle.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const auth = 'Basic ' + Buffer.from(`${env.ZERION_API_KEY ?? ''}:`).toString('base64')

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
      },
    },
  }
})
