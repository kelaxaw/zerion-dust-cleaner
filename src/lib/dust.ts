import type { ChainId } from '@/lib/chains'
import type { Position } from '@/lib/zerion'

// Dust rules, ported from Zerion CLI `consolidate` (cli/utils/trading/consolidate.js, classifyPosition).
// Pure functions: no React, no fetch. Spec lives in dust.test.ts; terms in CONTEXT.md.
//
// Rule order (first match wins):
//   1. spam (flags.is_trash)        → ignored  'spam'
//   2. position_type !== 'wallet'   → ignored  'non_wallet'
//   3. gas token of this chain      → ignored  'gas_token'
//   4. stablecoin                   → ignored  'stablecoin'
//   5. value === null               → won't swap 'no_price'
//   6. value < MIN_USD              → won't swap 'under_min'
//   7. value > valueCap             → won't swap 'above_max'
//   8. otherwise                    → dust
// Both bounds are inclusive: exactly $1 and exactly the cap are dust.
// No separate Target check: the Target is USDC (a stablecoin) or the gas token, both already out.

export type ValueCap = 5 | 10 | 25
export type DustContext = { chain: ChainId; valueCap: ValueCap }

export type WontSwapReason = 'under_min' | 'above_max' | 'no_price'
export type IgnoreReason = 'spam' | 'non_wallet' | 'gas_token' | 'stablecoin'

export type Classification =
  | { kind: 'dust' }
  | { kind: 'wont_swap'; reason: WontSwapReason }
  | { kind: 'ignored'; reason: IgnoreReason }

export type ChainSummary = {
  dust: Position[]
  wontSwap: { position: Position; reason: WontSwapReason }[]
  dustValueUsd: number
  hasGas: boolean
  spamHidden: number
}

// TODO(you): the smallest USD value that still counts as dust.
export const MIN_USD: number = Number.NaN

// TODO(you): lowercase symbols: usdc, usdt, usdc.e, usdt0, usds, tusd, usde, dai.
export const STABLECOINS: ReadonlySet<string> = new Set<string>()

// Gas token = this chain's implementation of the fungible sits at chainById(chain).gasTokenAddress
// (null on most chains, 0x…1010 on Polygon). Compare addresses case-insensitively.
export function isGasToken(_p: Position, _chain: ChainId): boolean {
  throw new Error('TODO: isGasToken')
}

export function classifyPosition(_p: Position, _ctx: DustContext): Classification {
  throw new Error('TODO: classifyPosition')
}

// Groups one chain's positions. hasGas: a gas-token position with quantity.int > 0 exists
// (spam flag and position_type don't matter here). Spam is counted, never listed.
export function summarizeChain(_positions: Position[], _ctx: DustContext): ChainSummary {
  throw new Error('TODO: summarizeChain')
}
