import { encodeFunctionData, erc20Abi, maxUint256, type Address, type Hex } from 'viem'
import { chainById, type ChainId } from '@/lib/chains'
import {
  MAX_LOSS,
  type BatchResult,
  type BatchSent,
  type Quote,
  type QuoteRequest,
  type QuoteVerdict,
  type ReceiptResult,
  type SignMode,
  type SignResult,
  type SweepToken,
} from '@/lib/sweep'

// Fake quotes and signing so every screen and row state can be reviewed end to end.
// Outcomes are derived from the position id, so the same wallet always shows the same mix:
// some tokens have no route, some lose too much, some need an approve, one asks for an
// unlimited approve (fails the call check), one fails on-chain, one is declined.

const GAS_PRICE_USD: Record<string, number> = { ETH: 2600, POL: 0.25, BNB: 600 }

// Not a real router. Only the mocks trust it.
const MOCK_ROUTER: Address = '0x000000000000000000000000000000000000b0b0'

function hash(s: string): number {
  let h = 7
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function mockQuote({ chain, target, position }: QuoteRequest): Promise<Quote> {
  const h = hash(position.id)
  await wait(400 + (h % 1400))
  if (h % 9 === 0) return { kind: 'no_route' }

  const valueUsd = position.attributes.value ?? 0
  const loss = 0.005 + (h % 60) / 1000 // 0.5% … 6.4%
  const outUsd = valueUsd * (1 - loss)
  const out = target === 'USDC' ? outUsd : outUsd / GAS_PRICE_USD[chainById(chain).gasSymbol]

  const amountIn = BigInt(position.attributes.quantity.int)
  const token = position.attributes.fungible_info.implementations.find((i) => i.chain_id === chain)?.address as Address
  const approveAmount = h % 13 === 7 ? maxUint256 : amountIn
  const approve =
    h % 2 === 0
      ? { to: token, value: 0n, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [MOCK_ROUTER, approveAmount] }) }
      : undefined
  const swap = { to: MOCK_ROUTER, value: 0n, data: `0x5ae401dc${h.toString(16).padStart(8, '0')}` as Hex }

  return { kind: 'route', out, outUsd, loss, amountIn, calls: { approve, swap } }
}

export function mockVerdict(quote: Quote): QuoteVerdict {
  if (quote.kind === 'no_route') return { kind: 'wont_swap', reason: 'no_route' }
  if (quote.loss > MAX_LOSS) return { kind: 'wont_swap', reason: 'blocked' }
  return { kind: 'sweepable' }
}

export function mockKnownRouters(chain: ChainId): readonly Address[] {
  void chain
  return [MOCK_ROUTER]
}

export async function mockSignStep(token: SweepToken, step: 'approve' | 'swap'): Promise<SignResult> {
  const h = hash(token.position.id)
  await wait(1200)
  if (step === 'swap' && h % 11 === 3) return { kind: 'rejected' }
  return { kind: 'sent', hash: `0x${h.toString(16).padStart(8, '0')}` }
}

export async function mockWaitForReceipt(token: SweepToken, _hash: string): Promise<ReceiptResult> {
  const h = hash(token.position.id)
  await wait(1400)
  if (h % 7 === 5) return { kind: 'reverted', message: 'Price moved more than 2%' }
  return { kind: 'confirmed' }
}

// Pretends every wallet can batch. Return 'one_by_one' to review the other flow.
export async function mockBatchSupport(address: Address, chain: ChainId): Promise<SignMode> {
  void address
  void chain
  await wait(300)
  return 'batch'
}

export async function mockSendBatch(tokens: SweepToken[], chain: ChainId): Promise<BatchSent> {
  void chain
  await wait(2000)
  return { kind: 'sent', id: `0xbatch${tokens.length}` }
}

// Non-atomic: each token lands or reverts on its own, so the result screen shows a mix.
export async function mockWaitForBatch(_id: string, tokens: SweepToken[]): Promise<BatchResult> {
  await wait(2500)
  const outcomes: Record<string, ReceiptResult> = {}
  for (const t of tokens) {
    outcomes[t.position.id] = hash(t.position.id) % 7 === 5 ? { kind: 'reverted', message: 'Price moved more than 2%' } : { kind: 'confirmed' }
  }
  return { atomic: false, outcomes }
}
