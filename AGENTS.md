# Dust Cleanup

Wallet UI that sweeps small token balances on one chain into USDC or ETH, built on the Zerion API. Business rules are ported from Zerion CLI `consolidate` (MIT).

## Pointers

- **Styling**: before writing or editing any `className`, CSS, or design token, read [docs/styling.md](docs/styling.md).

## Gotchas

- The Zerion key is server-side only. The Vite dev proxy (`/zerion/*` in `vite.config.ts`) adds the Basic-auth header; the key has no `VITE_` prefix so it never reaches the bundle. Call the API through `/zerion/v1/...`.
- The dev key rate-limits after a few rapid calls (429). Quote requests run one at a time with backoff.
- Zerion swap quotes return 500 on testnets. Develop against mainnet read-only data.
- `cn` is imported from the `cn` package (shadcn's clsx + tailwind-merge replacement), re-exported by `src/lib/utils.ts`.
