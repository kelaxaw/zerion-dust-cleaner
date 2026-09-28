import type { ValueCap } from '@/lib/dust'
import { chainById, type ChainId } from '@/lib/chains'

// USDC, or the gas token of whichever chain is being swept (ETH / POL / BNB).
// The label comes from the chain's `gasSymbol`, never a bridged copy of another chain's gas token.
export type Target = 'USDC' | 'gas'

// The value cap lives in the URL (?cap=), so it survives reloads and is shared by every screen.
export const VALUE_CAPS: readonly ValueCap[] = [5, 10, 25]
export const DEFAULT_VALUE_CAP: ValueCap = 10

export function parseValueCap(raw: unknown): ValueCap | undefined {
  const n = Number(raw)
  return VALUE_CAPS.find((cap) => cap === n)
}

// "USDC", or the gas token's symbol on this chain.
export function targetSymbol(target: Target, chain: ChainId): string {
  return target === 'USDC' ? 'USDC' : chainById(chain).gasSymbol
}
