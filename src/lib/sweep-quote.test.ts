import { describe, expect, it } from 'vitest'
import { computeLoss, judgeQuote, MAX_LOSS, pickQuote, targetFungibleId, USDC_FUNGIBLE_ID, type RouteQuote } from '@/lib/sweep'
import type { Position, SwapOffer } from '@/lib/zerion'

// Numbers below are from a real Zerion quote: 3.7826 AERO → USDC on Base (Vitalik's wallet, 2026-09-29).

const AERO: Position = {
  id: 'aero-base',
  attributes: {
    position_type: 'wallet',
    value: 3.2047490177809443,
    quantity: { int: '3782620924200000000', float: 3.7826209242 },
    flags: { is_trash: false },
    fungible_info: {
      symbol: 'AERO',
      name: 'Aerodrome Finance',
      icon: null,
      implementations: [{ chain_id: 'base', address: '0x940181a94a35a4569e4529a3cdfb74e38fd98631', decimals: 18 }],
    },
  },
  relationships: { fungible: { data: { id: '430f1d3d-9a4b-4a56-b804-896b34843ac0' } }, chain: { data: { id: 'base' } } },
}

// The quote's swap router, trusted in these tests.
const ROUTERS = ['0x02e5be68d46dac0b524905bff209cf47ee6db2a9' as const]

const tx = (to: string, data: string, value = '0x0') => ({ evm: { from: '0xd8da', to, data, value, gas: '0xff64', nonce: '0x46', chain_id: '0x2105' } })

function offer(over: Partial<SwapOffer['attributes']> = {}): SwapOffer {
  return {
    id: 'uniswap',
    attributes: {
      liquidity_source: { id: 'uniswap', name: 'Uniswap' },
      input_amount: { quantity: '3.7826209242', usd_value: 3.2031340421513166 },
      output_amount: { quantity: '3.204132', usd_value: 3.2037314835 },
      output_amount_after_fees: { usd_value: 3.20082219204744 },
      minimum_output_amount: { quantity: '3.140049', usd_value: 3.139656493875 },
      network_fee: { amount: { quantity: '0.000001071432', usd_value: 0.00290929145256 }, free: false },
      transaction_approve: tx('0x940181a94a35a4569e4529a3cdfb74e38fd98631', '0x095ea7b3aa'),
      transaction_swap: tx('0x02e5be68d46dac0b524905bff209cf47ee6db2a9', '0x2894adf9bb'),
      ...over,
    },
  }
}

describe('computeLoss', () => {
  it('is 1 − received / input', () => {
    expect(computeLoss(100, 97)).toBeCloseTo(0.03, 10)
  })

  it('is about 0.07% for the real AERO → USDC quote (gas already taken off)', () => {
    expect(computeLoss(3.2031340421513166, 3.20082219204744)).toBeCloseTo(0.000722, 6)
  })

  it('is negative when the swap pays more than the market price', () => {
    expect(computeLoss(3, 3.03)).toBeCloseTo(-0.01, 10)
  })

  it('can exceed 100% when gas costs more than the token is worth', () => {
    expect(computeLoss(0.1, -0.4)).toBeCloseTo(5, 10)
  })

  it('is Infinity when the input has no value to measure against', () => {
    expect(computeLoss(0, 1)).toBe(Infinity)
  })
})

describe('judgeQuote', () => {
  const route = (loss: number) => ({ kind: 'route', loss }) as RouteQuote

  it('no route → won’t swap, no_route', () => {
    expect(judgeQuote({ kind: 'no_route' })).toEqual({ kind: 'wont_swap', reason: 'no_route' })
  })

  it('loss under the limit → sweepable', () => {
    expect(judgeQuote(route(0.03))).toEqual({ kind: 'sweepable' })
  })

  it('loss exactly at the limit → sweepable (inclusive)', () => {
    expect(judgeQuote(route(MAX_LOSS))).toEqual({ kind: 'sweepable' })
  })

  it('loss over the limit → won’t swap, blocked', () => {
    expect(judgeQuote(route(MAX_LOSS + 0.0001))).toEqual({ kind: 'wont_swap', reason: 'blocked' })
  })

  it('negative loss (better than market) → sweepable', () => {
    expect(judgeQuote(route(-0.01))).toEqual({ kind: 'sweepable' })
  })

  it.each([NaN, Infinity])('%s loss → blocked', (loss) => {
    expect(judgeQuote(route(loss))).toEqual({ kind: 'wont_swap', reason: 'blocked' })
  })
})

describe('pickQuote', () => {
  it('maps the best offer into a route quote', () => {
    const q = pickQuote([offer()], AERO, ROUTERS)
    expect(q).toMatchObject({
      kind: 'route',
      out: 3.204132,
      outUsd: 3.2037314835,
      networkFeeUsd: 0.00290929145256,
      amountIn: 3782620924200000000n,
    })
    expect(q.kind === 'route' && q.loss).toBeCloseTo(0.000722, 6)
  })

  it('keeps only to, data and value of each transaction (no nonce, no gas)', () => {
    const q = pickQuote([offer()], AERO, ROUTERS)
    expect(q.kind === 'route' && q.calls).toEqual({
      approve: { to: '0x940181a94a35a4569e4529a3cdfb74e38fd98631', data: '0x095ea7b3aa', value: 0n },
      swap: { to: '0x02e5be68d46dac0b524905bff209cf47ee6db2a9', data: '0x2894adf9bb', value: 0n },
    })
  })

  it('decodes a hex value into a bigint', () => {
    const q = pickQuote([offer({ transaction_swap: tx('0x02e5be68d46dac0b524905bff209cf47ee6db2a9', '0x28', '0x10') })], AERO, ROUTERS)
    expect(q.kind === 'route' && q.calls.swap.value).toBe(16n)
  })

  it('leaves approve out when the allowance is already there', () => {
    const q = pickQuote([offer({ transaction_approve: null })], AERO, ROUTERS)
    expect(q.kind === 'route' && q.calls.approve).toBeUndefined()
  })

  it('takes the first offer: Zerion sorts them best first', () => {
    const best = offer({ output_amount: { quantity: '3.2', usd_value: 3.2 } })
    const worse = offer({ output_amount: { quantity: '3.1', usd_value: 3.1 } })
    expect(pickQuote([best, worse], AERO, ROUTERS)).toMatchObject({ out: 3.2 })
  })

  it('skips offers with an error, without a swap transaction, or without a USD value', () => {
    const good = offer({ output_amount: { quantity: '3.19', usd_value: 3.19 } })
    const offers = [
      offer({ error: { code: 'insufficient_balance' } }),
      offer({ transaction_swap: null }),
      offer({ output_amount_after_fees: {} }),
      good,
    ]
    expect(pickQuote(offers, AERO, ROUTERS)).toMatchObject({ out: 3.19 })
  })

  it('falls back to the position’s value when the offer has no input USD value', () => {
    const q = pickQuote([offer({ input_amount: { quantity: '3.78' } })], AERO, ROUTERS)
    expect(q.kind === 'route' && q.loss).toBeCloseTo(1 - 3.20082219204744 / 3.2047490177809443, 10)
  })

  it('skips an offer through a router we don’t trust and takes the next trusted one', () => {
    const unknown = offer({ transaction_swap: tx('0x9999999999999999999999999999999999999999', '0x28') })
    const trusted = offer({ output_amount: { quantity: '3.1', usd_value: 3.1 } })
    expect(pickQuote([unknown, trusted], AERO, ROUTERS)).toMatchObject({ out: 3.1 })
  })

  it('matches routers regardless of letter case', () => {
    const upper = offer({ transaction_swap: tx('0x02E5BE68D46DAC0B524905BFF209CF47EE6DB2A9', '0x28') })
    expect(pickQuote([upper], AERO, ROUTERS)).toMatchObject({ kind: 'route' })
  })

  it('no trusted router among the offers → no route', () => {
    expect(pickQuote([offer()], AERO, [])).toEqual({ kind: 'no_route' })
  })

  it('no offers → no route', () => {
    expect(pickQuote([], AERO, ROUTERS)).toEqual({ kind: 'no_route' })
  })

  it('only unusable offers → no route', () => {
    expect(pickQuote([offer({ error: { code: 'no_liquidity' } })], AERO, ROUTERS)).toEqual({ kind: 'no_route' })
  })
})

describe('targetFungibleId', () => {
  it('USDC is the same id on every chain', () => {
    expect(targetFungibleId('USDC', 'base')).toBe(USDC_FUNGIBLE_ID)
    expect(targetFungibleId('USDC', 'polygon')).toBe(USDC_FUNGIBLE_ID)
  })

  it('the gas target is that chain’s gas token', () => {
    expect(targetFungibleId('gas', 'base')).toBe('eth')
    expect(targetFungibleId('gas', 'arbitrum')).toBe('eth')
    expect(targetFungibleId('gas', 'polygon')).toBe('7560001f-9b6d-4115-b14a-6c44c4334ef2')
    expect(targetFungibleId('gas', 'binance-smart-chain')).toBe('0xb8c77482e45f1f44de1745f52c74426c631bdd52')
  })
})
