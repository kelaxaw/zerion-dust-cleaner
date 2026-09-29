import type { Position } from '@/lib/zerion'
import { type ChainId, chainById } from '@/lib/chains'
import { isStablecoin } from '@/lib/stablecoins'

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
// Both bounds are inclusive: exactly $0.10 and exactly the cap are dust.
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

export const MIN_USD: number = 0.1

// Gas token = this chain's implementation of the fungible sits at chainById(chain).gasTokenAddress
// (null on most chains, 0x…1010 on Polygon). Compare addresses case-insensitively.
export function isGasToken(p: Position, chain: ChainId): boolean {
  const implementation = p.attributes.fungible_info.implementations.find((i) => i.chain_id === chain)
  if (!implementation) return false
  return implementation.address?.toLowerCase() === chainById(chain).gasTokenAddress?.toLowerCase()
}

export function classifyPosition(p: Position, ctx: DustContext): Classification {
  const { value } = p.attributes
  if (p.attributes.flags.is_trash) return { kind: 'ignored', reason: 'spam' }
  if (p.attributes.position_type !== 'wallet') return { kind: 'ignored', reason: 'non_wallet' }
  if (isGasToken(p, ctx.chain)) return { kind: 'ignored', reason: 'gas_token' }
  if (isStablecoin(p.attributes.fungible_info.symbol)) return { kind: 'ignored', reason: 'stablecoin' }
  if (value === null) return { kind: 'wont_swap', reason: 'no_price' }
  if (value < MIN_USD) return { kind: 'wont_swap', reason: 'under_min' }
  if (value > ctx.valueCap) return { kind: 'wont_swap', reason: 'above_max' }
  return { kind: 'dust' }
}

// Groups one chain's positions. hasGas: a gas-token position with quantity.int > 0 exists
// (spam flag and position_type don't matter here). Spam is counted, never listed.
export function summarizeChain(positions: Position[], ctx: DustContext): ChainSummary {
  return positions.reduce<ChainSummary>(
    (acc, p) => {
      const classified = classifyPosition(p, ctx)
      if (classified.kind === 'dust') {
        acc.dust.push(p)
        acc.dustValueUsd += p.attributes.value ?? 0
      }
      if (classified.kind === 'wont_swap') acc.wontSwap.push({ position: p, reason: classified.reason })
      if (classified.kind === 'ignored' && classified.reason === 'spam') acc.spamHidden += 1
      if (isGasToken(p, ctx.chain) && BigInt(p.attributes.quantity.int) > 0n) acc.hasGas = true
      return acc
    },
    { dust: [], wontSwap: [], dustValueUsd: 0, hasGas: false, spamHidden: 0 },
  )
}
