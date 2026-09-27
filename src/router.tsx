import { createRootRoute, createRoute, createRouter, Outlet, retainSearchParams } from '@tanstack/react-router'
import { getAddress, isAddress, type Address } from 'viem'
import { CHAINS, type ChainId } from '@/lib/chains'
import type { ValueCap } from '@/lib/dust'
import { parseValueCap } from '@/lib/settings'
import { DesignPage } from '@/pages/design'
import { HomeRoute, NotFoundRoute, PlanRoute } from '@/route-components'

// Code-based routes. Pages stay router-agnostic (plain props); src/route-components.tsx adapts.
//   /              Connect, or Overview once a wallet is known
//   /plan/$chain   Plan for one chain
//   /design        living style guide

type RootSearch = {
  // Dev only: ?address=0x… reads any wallet without connecting. Dropped in production builds.
  address?: Address
  cap?: ValueCap
}

const rootRoute = createRootRoute({
  validateSearch: (search: Record<string, unknown>): RootSearch => {
    const raw = search.address
    return {
      address: import.meta.env.DEV && typeof raw === 'string' && isAddress(raw) ? getAddress(raw) : undefined,
      cap: parseValueCap(search.cap),
    }
  },
  search: { middlewares: [retainSearchParams(['address', 'cap'])] },
  component: Outlet,
  notFoundComponent: NotFoundRoute,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomeRoute,
})

const planRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/plan/$chain',
  params: {
    // Unknown chain ids don't match, so they fall through to notFoundComponent.
    parse: ({ chain }): { chain: ChainId } | false => {
      const known = CHAINS.find((c) => c.id === chain)
      return known ? { chain: known.id } : false
    },
    stringify: ({ chain }) => ({ chain }),
  },
  component: PlanRoute,
})

const designRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/design',
  component: DesignPage,
})

const routeTree = rootRoute.addChildren([indexRoute, planRoute, designRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
