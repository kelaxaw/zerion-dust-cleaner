import type { ValueCap } from '@/lib/dust'

// USDC, or the gas token of whichever chain is being swept (ETH / POL / BNB).
// The label comes from the chain's `gasSymbol`, never a bridged copy of another chain's gas token.
export type Target = 'USDC' | 'gas'

// Chosen once, shared by every screen. Overview counts Dust with the current cap.
export type Settings = { target: Target; valueCap: ValueCap }

export const DEFAULT_SETTINGS: Settings = { target: 'USDC', valueCap: 10 }

export const VALUE_CAPS: readonly ValueCap[] = [5, 10, 25]
