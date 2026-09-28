import { describe, expect, it } from 'vitest'
import { chainById, type ChainId } from '@/lib/chains'
import { classifyPosition, isGasToken, summarizeChain, type DustContext, type ValueCap } from '@/lib/dust'
import type { Position } from '@/lib/zerion'

// Spec for the Dust rules (CONTEXT.md).

type Fixture = {
  id?: string
  symbol?: string
  value?: number | null
  positionType?: string
  isTrash?: boolean
  chain?: ChainId
  // Contract address on `chain`; null = no contract (the gas token on most chains).
  address?: string | null
  // Implementations on other chains, e.g. ETH is native on Ethereum but an ERC-20 on Polygon.
  otherImplementations?: { chain_id: string; address: string | null }[]
  quantityInt?: string
}

let seq = 0
function makePosition(f: Fixture = {}): Position {
  const chain = f.chain ?? 'base'
  const symbol = f.symbol ?? 'DEGEN'
  const id = f.id ?? `${symbol.toLowerCase()}-${++seq}`
  return {
    id,
    attributes: {
      position_type: f.positionType ?? 'wallet',
      value: f.value === undefined ? 3 : f.value,
      quantity: { int: f.quantityInt ?? '1000000000000000000', float: 1 },
      flags: { is_trash: f.isTrash ?? false },
      fungible_info: {
        symbol,
        name: symbol,
        icon: null,
        implementations: [
          { chain_id: chain, address: f.address === undefined ? `0x${id.padEnd(40, '0').slice(0, 40)}` : f.address, decimals: 18 },
          ...(f.otherImplementations ?? []).map((i) => ({ ...i, decimals: 18 })),
        ],
      },
    },
    relationships: {
      fungible: { data: { id: `fungible-${id}` } },
      chain: { data: { id: chain } },
    },
  }
}

// The gas token as Zerion lists it: null address, or 0x…1010 for POL on Polygon.
const gas = (chain: ChainId, symbol: string, f: Fixture = {}) =>
  makePosition({ chain, symbol, address: chainById(chain).gasTokenAddress, ...f })
const POL_ADDRESS = '0x0000000000000000000000000000000000001010'
const ctx = (valueCap: ValueCap = 10, chain: ChainId = 'base'): DustContext => ({ chain, valueCap })

describe('isGasToken', () => {
  it.each([
    ['base', 'ETH'],
    ['arbitrum', 'ETH'],
    ['optimism', 'ETH'],
    ['polygon', 'POL'],
    ['binance-smart-chain', 'BNB'],
  ] as const)('%s: %s is the gas token', (chain, symbol) => {
    expect(isGasToken(gas(chain, symbol), chain)).toBe(true)
  })

  it('Polygon: POL is listed at the 0x…1010 system contract, not with a null address', () => {
    expect(isGasToken(makePosition({ chain: 'polygon', symbol: 'POL', address: POL_ADDRESS }), 'polygon')).toBe(true)
  })

  it('Polygon: a null address is not the gas token there', () => {
    expect(isGasToken(makePosition({ chain: 'polygon', address: null }), 'polygon')).toBe(false)
  })

  it('the 0x…1010 address is only the gas token on Polygon', () => {
    expect(isGasToken(makePosition({ chain: 'base', address: POL_ADDRESS }), 'base')).toBe(false)
  })

  it('address match ignores case', () => {
    const pol = makePosition({ chain: 'polygon', symbol: 'POL', address: POL_ADDRESS.replace('0x', '0X').toUpperCase() })
    expect(isGasToken(pol, 'polygon')).toBe(true)
  })

  it('an ERC-20 is not the gas token', () => {
    expect(isGasToken(makePosition({ chain: 'base' }), 'base')).toBe(false)
  })

  it('bridged ETH on Polygon is not the gas token, even though ETH is native elsewhere', () => {
    const bridgedEth = makePosition({
      chain: 'polygon',
      symbol: 'ETH',
      address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
      otherImplementations: [{ chain_id: 'ethereum', address: null }],
    })
    expect(isGasToken(bridgedEth, 'polygon')).toBe(false)
  })

  it('a fungible with no implementation on this chain is not the gas token', () => {
    const p = makePosition({ chain: 'base', address: null })
    expect(isGasToken(p, 'polygon')).toBe(false)
  })

  it('a missing implementation is not a null address (chains where the gas token has none)', () => {
    const p = makePosition({ chain: 'polygon', address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174' })
    expect(isGasToken(p, 'base')).toBe(false)
  })
})

describe('classifyPosition', () => {
  describe('dust', () => {
    it('a plain wallet token between $0.10 and the cap is dust', () => {
      expect(classifyPosition(makePosition({ value: 3 }), ctx())).toEqual({ kind: 'dust' })
    })

    it('exactly $0.10 is dust (lower bound is inclusive)', () => {
      expect(classifyPosition(makePosition({ value: 0.1 }), ctx())).toEqual({ kind: 'dust' })
    })

    it.each([5, 10, 25] as const)('exactly the $%i cap is dust (upper bound is inclusive)', (cap) => {
      expect(classifyPosition(makePosition({ value: cap }), ctx(cap))).toEqual({ kind: 'dust' })
    })

    it('bridged ETH on Polygon is plain dust, not the gas token', () => {
      const bridgedEth = makePosition({
        chain: 'polygon',
        symbol: 'ETH',
        value: 4,
        address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
        otherImplementations: [{ chain_id: 'ethereum', address: null }],
      })
      expect(classifyPosition(bridgedEth, ctx(10, 'polygon'))).toEqual({ kind: 'dust' })
    })
  })

  describe("won't swap", () => {
    it('$0.09 is under the minimum', () => {
      expect(classifyPosition(makePosition({ value: 0.09 }), ctx())).toEqual({ kind: 'wont_swap', reason: 'under_min' })
    })

    it('$0 is under the minimum', () => {
      expect(classifyPosition(makePosition({ value: 0 }), ctx())).toEqual({ kind: 'wont_swap', reason: 'under_min' })
    })

    it.each([5, 10, 25] as const)('a cent over the $%i cap is above max', (cap) => {
      expect(classifyPosition(makePosition({ value: cap + 0.01 }), ctx(cap))).toEqual({ kind: 'wont_swap', reason: 'above_max' })
    })

    it('the cap comes from the context: $7 is dust at $10 but above max at $5', () => {
      const p = makePosition({ value: 7 })
      expect(classifyPosition(p, ctx(10))).toEqual({ kind: 'dust' })
      expect(classifyPosition(p, ctx(5))).toEqual({ kind: 'wont_swap', reason: 'above_max' })
    })

    it('no price (value null) is its own reason', () => {
      expect(classifyPosition(makePosition({ value: null }), ctx())).toEqual({ kind: 'wont_swap', reason: 'no_price' })
    })
  })

  describe('ignored', () => {
    it('spam', () => {
      expect(classifyPosition(makePosition({ isTrash: true }), ctx())).toEqual({ kind: 'ignored', reason: 'spam' })
    })

    it.each(['deposit', 'staked', 'loan', 'locked', 'reward'])('non-wallet position type %s', (positionType) => {
      expect(classifyPosition(makePosition({ positionType }), ctx())).toEqual({ kind: 'ignored', reason: 'non_wallet' })
    })

    it.each([
      ['base', 'ETH'],
      ['arbitrum', 'ETH'],
      ['optimism', 'ETH'],
      ['polygon', 'POL'],
      ['binance-smart-chain', 'BNB'],
    ] as const)('%s: gas token %s', (chain, symbol) => {
      expect(classifyPosition(gas(chain, symbol), ctx(10, chain))).toEqual({ kind: 'ignored', reason: 'gas_token' })
    })

    it.each(['USDC', 'USDT', 'USDC.e', 'USDT0', 'USDS', 'TUSD', 'USDe', 'DAI'])('stablecoin %s', (symbol) => {
      expect(classifyPosition(makePosition({ symbol }), ctx())).toEqual({ kind: 'ignored', reason: 'stablecoin' })
    })

    it('stablecoin match ignores case', () => {
      expect(classifyPosition(makePosition({ symbol: 'usdc.E' }), ctx())).toEqual({ kind: 'ignored', reason: 'stablecoin' })
    })

    it('a symbol that only contains a stablecoin name is not a stablecoin', () => {
      expect(classifyPosition(makePosition({ symbol: 'USDCX' }), ctx())).toEqual({ kind: 'dust' })
    })
  })

  describe('rule order', () => {
    it('spam beats non-wallet', () => {
      expect(classifyPosition(makePosition({ isTrash: true, positionType: 'staked' }), ctx())).toEqual({ kind: 'ignored', reason: 'spam' })
    })

    it('spam beats gas token', () => {
      expect(classifyPosition(gas('base', 'ETH', { isTrash: true }), ctx())).toEqual({ kind: 'ignored', reason: 'spam' })
    })

    it('spam beats stablecoin', () => {
      expect(classifyPosition(makePosition({ symbol: 'USDC', isTrash: true }), ctx())).toEqual({ kind: 'ignored', reason: 'spam' })
    })

    it('non-wallet beats gas token', () => {
      expect(classifyPosition(gas('base', 'ETH', { positionType: 'staked' }), ctx())).toEqual({ kind: 'ignored', reason: 'non_wallet' })
    })

    it('non-wallet beats stablecoin', () => {
      expect(classifyPosition(makePosition({ symbol: 'USDC', positionType: 'deposit' }), ctx())).toEqual({ kind: 'ignored', reason: 'non_wallet' })
    })

    it('gas token worth more than the cap is still the gas token', () => {
      expect(classifyPosition(gas('base', 'ETH', { value: 500 }), ctx())).toEqual({ kind: 'ignored', reason: 'gas_token' })
    })

    it('gas token under $0.10 is still the gas token', () => {
      expect(classifyPosition(gas('base', 'ETH', { value: 0.05 }), ctx())).toEqual({ kind: 'ignored', reason: 'gas_token' })
    })

    it('gas token with no price is still the gas token', () => {
      expect(classifyPosition(gas('base', 'ETH', { value: null }), ctx())).toEqual({ kind: 'ignored', reason: 'gas_token' })
    })

    it('stablecoin beats under $0.10 (DAI $0.06)', () => {
      expect(classifyPosition(makePosition({ symbol: 'DAI', value: 0.06 }), ctx())).toEqual({ kind: 'ignored', reason: 'stablecoin' })
    })

    it('stablecoin beats above max', () => {
      expect(classifyPosition(makePosition({ symbol: 'USDT', value: 400 }), ctx())).toEqual({ kind: 'ignored', reason: 'stablecoin' })
    })

    it('stablecoin with no price is still a stablecoin', () => {
      expect(classifyPosition(makePosition({ symbol: 'USDC', value: null }), ctx())).toEqual({ kind: 'ignored', reason: 'stablecoin' })
    })
  })
})

describe('summarizeChain', () => {
  const ids = (ps: Position[]) => ps.map((p) => p.id)

  it('an empty chain has nothing', () => {
    expect(summarizeChain([], ctx())).toEqual({ dust: [], wontSwap: [], dustValueUsd: 0, hasGas: false, spamHidden: 0 })
  })

  it('puts each position in its group', () => {
    const positions = [
      makePosition({ id: 'degen', value: 3 }),
      makePosition({ id: 'brett', value: 2.5 }),
      makePosition({ id: 'tiny', value: 0.04 }),
      makePosition({ id: 'big', value: 40 }),
      makePosition({ id: 'unpriced', value: null }),
      makePosition({ id: 'usdc', symbol: 'USDC', value: 5 }),
      makePosition({ id: 'staked', positionType: 'staked', value: 5 }),
      gas('base', 'ETH', { id: 'eth', value: 12 }),
    ]
    const s = summarizeChain(positions, ctx())
    expect(ids(s.dust)).toEqual(['degen', 'brett'])
    expect(s.wontSwap.map((w) => [w.position.id, w.reason])).toEqual([
      ['tiny', 'under_min'],
      ['big', 'above_max'],
      ['unpriced', 'no_price'],
    ])
  })

  it('sums dust value only', () => {
    const positions = [
      makePosition({ value: 3.1 }),
      makePosition({ value: 2.2 }),
      makePosition({ value: 0.05 }),
      makePosition({ value: 90 }),
      gas('base', 'ETH', { value: 12 }),
    ]
    expect(summarizeChain(positions, ctx()).dustValueUsd).toBeCloseTo(5.3, 10)
  })

  it('applies the value cap from the context', () => {
    const positions = [makePosition({ id: 'a', value: 4 }), makePosition({ id: 'b', value: 8 }), makePosition({ id: 'c', value: 20 })]
    expect(ids(summarizeChain(positions, ctx(5)).dust)).toEqual(['a'])
    expect(ids(summarizeChain(positions, ctx(10)).dust)).toEqual(['a', 'b'])
    expect(ids(summarizeChain(positions, ctx(25)).dust)).toEqual(['a', 'b', 'c'])
  })

  it('only spam: counted, never listed', () => {
    const positions = [makePosition({ isTrash: true }), makePosition({ isTrash: true, value: null }), makePosition({ isTrash: true, value: 0.1 })]
    expect(summarizeChain(positions, ctx())).toEqual({ dust: [], wontSwap: [], dustValueUsd: 0, hasGas: false, spamHidden: 3 })
  })

  it('other ignored positions are neither listed nor counted as spam', () => {
    const positions = [makePosition({ symbol: 'USDC' }), makePosition({ positionType: 'deposit' }), gas('base', 'ETH')]
    const s = summarizeChain(positions, ctx())
    expect(s.dust).toEqual([])
    expect(s.wontSwap).toEqual([])
    expect(s.spamHidden).toBe(0)
  })

  describe('hasGas', () => {
    it('true when the gas token has a balance', () => {
      expect(summarizeChain([makePosition(), gas('base', 'ETH')], ctx()).hasGas).toBe(true)
    })

    it('true on Polygon with POL at 0x…1010', () => {
      expect(summarizeChain([gas('polygon', 'POL')], ctx(10, 'polygon')).hasGas).toBe(true)
    })

    it('false when there is no gas token position', () => {
      expect(summarizeChain([makePosition()], ctx()).hasGas).toBe(false)
    })

    it('false when the gas token balance is zero', () => {
      expect(summarizeChain([gas('base', 'ETH', { quantityInt: '0' })], ctx()).hasGas).toBe(false)
    })

    it('true for a tiny balance: no reserve on Overview', () => {
      expect(summarizeChain([gas('base', 'ETH', { quantityInt: '1', value: 0 })], ctx()).hasGas).toBe(true)
    })

    it('true even when the gas token has no price', () => {
      expect(summarizeChain([gas('base', 'ETH', { value: null })], ctx()).hasGas).toBe(true)
    })

    it('bridged ETH on Polygon does not count as gas', () => {
      const bridgedEth = makePosition({
        chain: 'polygon',
        symbol: 'ETH',
        address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
        otherImplementations: [{ chain_id: 'ethereum', address: null }],
      })
      expect(summarizeChain([bridgedEth], ctx(10, 'polygon')).hasGas).toBe(false)
    })

    it('ignores the spam flag and position type', () => {
      expect(summarizeChain([gas('base', 'ETH', { isTrash: true })], ctx()).hasGas).toBe(true)
      expect(summarizeChain([gas('base', 'ETH', { positionType: 'staked' })], ctx()).hasGas).toBe(true)
    })

    it('handles balances larger than Number.MAX_SAFE_INTEGER', () => {
      expect(summarizeChain([gas('base', 'ETH', { quantityInt: '123456789012345678901234567890' })], ctx()).hasGas).toBe(true)
    })
  })
})
