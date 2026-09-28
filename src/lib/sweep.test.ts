import { describe, expect, it } from 'vitest'
import { encodeFunctionData, erc20Abi, getAddress, maxUint256, type Address, type Hex } from 'viem'
import { validateQuoteCalls, type CallContext, type RouteQuote } from '@/lib/sweep'
import type { Position } from '@/lib/zerion'

// Spec for validateQuoteCalls: every call a quote hands us is checked before the wallet sees it.
// Each "rejects" case breaks exactly one rule, so the order of checks is free.

const ROUTER: Address = '0x1111111254eeb25477b68fb85ed929f73a960582'
const OTHER: Address = '0x2222222222222222222222222222222222222222'
const TOKEN: Address = '0x4ed4e862860bed51a9570b96d89af5e1b0efefed' // the dust token on Base
const BALANCE = 1_284_500_000_000_000_000_000n

function position({ address = TOKEN as string | null, balance = BALANCE } = {}): Position {
  return {
    id: 'degen-base',
    attributes: {
      position_type: 'wallet',
      value: 3.42,
      quantity: { int: balance.toString(), float: 1284.5 },
      flags: { is_trash: false },
      fungible_info: {
        symbol: 'DEGEN',
        name: 'Degen',
        icon: null,
        implementations: [
          { chain_id: 'ethereum', address: '0x9999999999999999999999999999999999999999', decimals: 18 },
          { chain_id: 'base', address, decimals: 18 },
        ],
      },
    },
    relationships: { fungible: { data: { id: 'degen' } }, chain: { data: { id: 'base' } } },
  }
}

const approveData = (spender: Address, amount: bigint): Hex =>
  encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, amount] })

function quote(over: { amountIn?: bigint; approve?: RouteQuote['calls']['approve'] | null; swap?: Partial<RouteQuote['calls']['swap']> } = {}): RouteQuote {
  const amountIn = over.amountIn ?? BALANCE
  const approve = over.approve === null ? undefined : (over.approve ?? { to: TOKEN, value: 0n, data: approveData(ROUTER, amountIn) })
  return {
    kind: 'route',
    out: 3.31,
    outUsd: 3.31,
    loss: 0.03,
    amountIn,
    calls: { approve, swap: { to: ROUTER, value: 0n, data: '0x5ae401dc00000000', ...over.swap } },
  }
}

function ctx(over: Partial<CallContext> = {}): CallContext {
  return { chain: 'base', position: position(), routers: [ROUTER], ...over }
}

describe('validateQuoteCalls', () => {
  describe('accepts', () => {
    it('approve for the exact amount, then swap on a known router', () => {
      expect(validateQuoteCalls(quote(), ctx())).toEqual({ ok: true })
    })

    it('swap alone, when the allowance is already there', () => {
      expect(validateQuoteCalls(quote({ approve: null }), ctx())).toEqual({ ok: true })
    })

    it('selling less than the whole balance', () => {
      expect(validateQuoteCalls(quote({ amountIn: BALANCE - 1n }), ctx())).toEqual({ ok: true })
    })

    it('checksummed addresses against lowercase ones (router, token, spender)', () => {
      const q = quote({
        approve: { to: getAddress(TOKEN), value: 0n, data: approveData(getAddress(ROUTER), BALANCE) },
        swap: { to: getAddress(ROUTER) },
      })
      expect(validateQuoteCalls(q, ctx())).toEqual({ ok: true })
    })

    it('reads the token address for this chain, not another chain', () => {
      // An approve to the token's Ethereum contract is wrong when sweeping on Base.
      const ethereumToken: Address = '0x9999999999999999999999999999999999999999'
      const q = quote({ approve: { to: ethereumToken, value: 0n, data: approveData(ROUTER, BALANCE) } })
      expect(validateQuoteCalls(q, ctx({ chain: 'base' }))).toEqual({ ok: false, reason: 'approve_wrong_token' })
    })
  })

  describe('rejects', () => {
    it('a swap to a contract not in routers', () => {
      const q = quote({ approve: null, swap: { to: OTHER } })
      expect(validateQuoteCalls(q, ctx())).toEqual({ ok: false, reason: 'unknown_router' })
    })

    it('any swap when the router list is empty', () => {
      expect(validateQuoteCalls(quote({ approve: null }), ctx({ routers: [] }))).toEqual({ ok: false, reason: 'unknown_router' })
    })

    it('an approve sent to a different token contract', () => {
      const q = quote({ approve: { to: OTHER, value: 0n, data: approveData(ROUTER, BALANCE) } })
      expect(validateQuoteCalls(q, ctx())).toEqual({ ok: false, reason: 'approve_wrong_token' })
    })

    it('an approve when the token has no contract on this chain', () => {
      const q = quote()
      expect(validateQuoteCalls(q, ctx({ position: position({ address: null }) }))).toEqual({ ok: false, reason: 'approve_wrong_token' })
    })

    it('an "approve" step that is really a transfer', () => {
      const data = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [OTHER, BALANCE] })
      const q = quote({ approve: { to: TOKEN, value: 0n, data } })
      expect(validateQuoteCalls(q, ctx())).toEqual({ ok: false, reason: 'approve_not_approve' })
    })

    it('an "approve" step with calldata that decodes to nothing', () => {
      const q = quote({ approve: { to: TOKEN, value: 0n, data: '0xdeadbeef' } })
      expect(validateQuoteCalls(q, ctx())).toEqual({ ok: false, reason: 'approve_not_approve' })
    })

    it('an approve for a spender other than the swap router', () => {
      const q = quote({ approve: { to: TOKEN, value: 0n, data: approveData(OTHER, BALANCE) } })
      expect(validateQuoteCalls(q, ctx({ routers: [ROUTER, OTHER] }))).toEqual({ ok: false, reason: 'approve_wrong_spender' })
    })

    it('an unlimited approve', () => {
      const q = quote({ approve: { to: TOKEN, value: 0n, data: approveData(ROUTER, maxUint256) } })
      expect(validateQuoteCalls(q, ctx())).toEqual({ ok: false, reason: 'approve_amount' })
    })

    it('an approve for more than the swap sells', () => {
      const q = quote({ amountIn: BALANCE - 10n, approve: { to: TOKEN, value: 0n, data: approveData(ROUTER, BALANCE) } })
      expect(validateQuoteCalls(q, ctx())).toEqual({ ok: false, reason: 'approve_amount' })
    })

    it('an approve for less than the swap sells', () => {
      const q = quote({ approve: { to: TOKEN, value: 0n, data: approveData(ROUTER, BALANCE - 1n) } })
      expect(validateQuoteCalls(q, ctx())).toEqual({ ok: false, reason: 'approve_amount' })
    })

    it('selling more than the position holds', () => {
      const q = quote({ amountIn: BALANCE + 1n, approve: null })
      expect(validateQuoteCalls(q, ctx())).toEqual({ ok: false, reason: 'amount_over_balance' })
    })

    it('native value on the approve', () => {
      const q = quote({ approve: { to: TOKEN, value: 1n, data: approveData(ROUTER, BALANCE) } })
      expect(validateQuoteCalls(q, ctx())).toEqual({ ok: false, reason: 'unexpected_value' })
    })

    it('native value on the swap', () => {
      const q = quote({ approve: null, swap: { value: 1n } })
      expect(validateQuoteCalls(q, ctx())).toEqual({ ok: false, reason: 'unexpected_value' })
    })
  })
})
