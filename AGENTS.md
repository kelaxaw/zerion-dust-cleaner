# Dust Cleanup

Wallet UI that sweeps small token balances on one chain into USDC or ETH, built on the Zerion API. Business rules are ported from Zerion CLI `consolidate` (MIT).

## Pointers

- **Styling**: before writing or editing any `className`, CSS, or design token, read [docs/styling.md](docs/styling.md).

## Gotchas

- The Zerion key is server-side only. The Vite dev proxy (`/zerion/*` in `vite.config.ts`) adds the Basic-auth header; the key has no `VITE_` prefix so it never reaches the bundle. Call the API through `/zerion/v1/...`.
- The Alchemy key is server-side too. `ALCHEMY_URL` in `.env` supplies only the key; the proxy maps `/alchemy/<network>` (from `alchemyNetwork` in `src/lib/chains.ts`) to that chain's Alchemy RPC. wagmi's transports in `src/lib/wagmi.ts` point there; there's no separate RPC client.
- The dev key allows 3 requests per second and 2,000 per day (resets at midnight UTC). The client (`src/lib/zerion.ts`) runs up to 3 requests at once and backs off on 429; Plan quotes only the 20 most valuable dust tokens up front.
- Zerion swap quotes return 500 on testnets. Develop against mainnet read-only data.
- Zerion lists a chain's gas token with a `null` address, except native POL on Polygon: it sits at `0x…1010`. Use `gasTokenAddress` from `src/lib/chains.ts`, never `address == null`.
- Dev only: `?address=0x…` opens any wallet read-only, no wallet connection needed. It and `?cap=` are root search params (`src/router.tsx`), kept across navigation by `retainSearchParams`.
- Routing is TanStack Router, code-based (no file-route plugin). Pages take plain props; `src/route-components.tsx` reads params/search and adapts.
- `cn` is imported from the `cn` package (shadcn's clsx + tailwind-merge replacement), re-exported by `src/lib/utils.ts`.
