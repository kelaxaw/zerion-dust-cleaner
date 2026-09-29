import { decodeFunctionData, erc20Abi, formatUnits, hexToBigInt, isAddressEqual, type Address, type Hex } from 'viem'
import { chainById, type ChainId } from '@/lib/chains'
import type { Target } from '@/lib/settings'
import { zerion, type EvmTransaction, type Position, type SwapOffer } from '@/lib/zerion'
import { ROUTERS } from '@/lib/routers.generated'
import { mockBatchSupport, mockSendBatch, mockSignStep, mockWaitForBatch, mockWaitForReceipt } from '@/mocks/sweep'

// Quotes and signing for a Sweep. The screens call these functions; the ones marked
// TODO delegate to src/mocks/sweep.ts for now. Replace the bodies one by one.

// Loss above this share moves a token to "Won't swap" (CONTEXT.md: Sweepable).
export const MAX_LOSS = 0.05
// Allowed price move between quote and execution. Beyond it the swap reverts instead of filling worse.
export const SLIPPAGE_PERCENT = 2
// Zerion's fungible id for USDC. The same id covers every chain's USDC implementation.
export const USDC_FUNGIBLE_ID = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'

// One transaction the wallet will sign, exactly as the quote returned it.
export type Call = { to: Address; data: Hex; value: bigint }

export type RouteQuote = {
  kind: 'route'
  out: number // target tokens that arrive
  outUsd: number // their USD value
  networkFeeUsd: number // gas for approve + swap, paid from the gas token balance
  loss: number // fraction of the position's USD value lost to price impact, fees and gas (computeLoss)
  amountIn: bigint // raw units of the dust token being sold
  calls: { approve?: Call; swap: Call } // approve is absent when the allowance is already there
}
export type Quote = RouteQuote | { kind: 'no_route' }

export type QuoteVerdict = { kind: 'sweepable' } | { kind: 'wont_swap'; reason: 'no_route' | 'blocked' }

// A token ticked for the sweep, with the quote the user agreed to.
export type SweepToken = { position: Position; quote: RouteQuote }

export type QuoteRequest = { address: Address; chain: ChainId; target: Target; position: Position }

export function targetFungibleId(target: Target, chain: ChainId): string {
  return target === 'USDC' ? USDC_FUNGIBLE_ID : chainById(chain).gasFungibleId
}

// Sells the whole position into the target on the same chain; the user receives the output.
export async function quoteSwap({ address, chain, target, position }: QuoteRequest): Promise<Quote> {
  const impl = position.attributes.fungible_info.implementations.find((i) => i.chain_id === chain)
  if (!impl) return { kind: 'no_route' }
  const offers = await zerion.getSwapQuotes({
    from: address,
    to: address,
    chain,
    inputFungibleId: position.relationships.fungible.data.id,
    inputAmount: formatUnits(BigInt(position.attributes.quantity.int), impl.decimals),
    outputFungibleId: targetFungibleId(target, chain),
    slippagePercent: SLIPPAGE_PERCENT,
  })
  return pickQuote(offers, position, knownRouters(chain))
}

// Offers arrive best first, so the first one we can use wins. An offer is usable when it has
// no error, a swap transaction through a router we trust, and USD values to judge the loss by.
// Skipping untrusted routers here means a better offer through an unknown contract falls back
// to the next trusted one instead of failing the call check at signing time.
export function pickQuote(offers: readonly SwapOffer[], position: Position, routers: readonly Address[]): Quote {
  const trusted = new Set(routers.map((r) => r.toLowerCase()))
  for (const { attributes: o } of offers) {
    const swap = o.transaction_swap?.evm
    const inputUsd = o.input_amount.usd_value ?? position.attributes.value
    const receivedUsd = o.output_amount_after_fees.usd_value
    if (o.error || !swap || !trusted.has(swap.to.toLowerCase()) || inputUsd == null || receivedUsd == null) continue
    const approve = o.transaction_approve?.evm
    return {
      kind: 'route',
      out: Number(o.output_amount.quantity ?? 0),
      outUsd: o.output_amount.usd_value ?? receivedUsd,
      networkFeeUsd: o.network_fee.amount.usd_value ?? 0,
      loss: computeLoss(inputUsd, receivedUsd),
      amountIn: BigInt(position.attributes.quantity.int),
      calls: { approve: approve ? toCall(approve) : undefined, swap: toCall(swap) },
    }
  }
  return { kind: 'no_route' }
}

// Only what the wallet needs. Zerion's nonce and gas are dropped: the wallet fills them,
// and in a batch Zerion's sequential nonces would be wrong anyway.
function toCall(tx: EvmTransaction): Call {
  return { to: tx.to as Address, data: tx.data as Hex, value: hexToBigInt(tx.value as Hex) }
}

// Loss = 1 − receivedUsd / inputUsd
//   inputUsd:    what the tokens being sold are worth
//   receivedUsd: Zerion's output_amount_after_fees, i.e. the output's USD value minus the
//                network fee (gas) and Zerion's fee, so gas is already in
// 0.03 means 3% of the value is lost. Negative means the swap pays more than the market price.
export function computeLoss(inputUsd: number, receivedUsd: number): number {
  if (!(inputUsd > 0)) return Infinity // nothing to measure against: never sweepable
  return 1 - receivedUsd / inputUsd
}

// Sweepable: a route exists and the loss is at most MAX_LOSS (inclusive). NaN or Infinity never passes.
export function judgeQuote(quote: Quote): QuoteVerdict {
  if (quote.kind === 'no_route') return { kind: 'wont_swap', reason: 'no_route' }
  if (!(quote.loss <= MAX_LOSS)) return { kind: 'wont_swap', reason: 'blocked' }
  return { kind: 'sweepable' }
}

export type CallContext = {
  chain: ChainId
  position: Position // the dust token being sold
  routers: readonly Address[] // swap contracts we trust on this chain
}

export type CallRejection =
  | 'unknown_router' // swap.to is not in routers
  | 'approve_wrong_token' // approve.to is not the dust token's contract on this chain
  | 'approve_not_approve' // approve.data is not an ERC-20 approve(spender, amount)
  | 'approve_wrong_spender' // approve spender is not swap.to
  | 'approve_amount' // approve amount is not exactly quote.amountIn (unlimited counts as wrong)
  | 'amount_over_balance' // quote.amountIn is more than the position holds
  | 'unexpected_value' // approve or swap sends native value; selling an ERC-20 never should

export type CallCheck = { ok: true } | { ok: false; reason: CallRejection }

export const CALL_REJECTION_TEXT: Record<CallRejection, string> = {
  unknown_router: 'Swap goes to an unknown contract',
  approve_wrong_token: 'Approval is for a different token',
  approve_not_approve: 'Approval step is not an approval',
  approve_wrong_spender: 'Approval is for a different contract',
  approve_amount: 'Approval amount doesn’t match the swap',
  amount_over_balance: 'Swap sells more than you hold',
  unexpected_value: 'Swap would also send native coins',
}

// Pure check of one quote's calls against what the user agreed to. Runs before signing,
// in both the batch and the one-by-one flow. Spec: sweep.test.ts.
// The recipient can't be checked here: it sits inside router-specific calldata.
export function validateQuoteCalls(quote: RouteQuote, ctx: CallContext): CallCheck {
  const { approve, swap } = quote.calls
  const reject = (reason: CallRejection): CallCheck => ({ ok: false, reason })

  if (!ctx.routers.some((router) => isAddressEqual(router, swap.to))) return reject('unknown_router')
  if (quote.amountIn > BigInt(ctx.position.attributes.quantity.int)) return reject('amount_over_balance')
  if (swap.value !== 0n || (approve && approve.value !== 0n)) return reject('unexpected_value')
  if (!approve) return { ok: true }

  // The dust token's contract on this chain; null means the gas token, which is never approved.
  const implementation = ctx.position.attributes.fungible_info.implementations.find((i) => i.chain_id === ctx.chain)
  if (!implementation?.address || !isAddressEqual(implementation.address as Address, approve.to)) return reject('approve_wrong_token')

  const args = decodeApprove(approve.data)
  if (!args) return reject('approve_not_approve')
  const [spender, amount] = args
  if (!isAddressEqual(spender, swap.to)) return reject('approve_wrong_spender')
  if (amount !== quote.amountIn) return reject('approve_amount')

  return { ok: true }
}

// [spender, amount] when the calldata is an ERC-20 approve, null for anything else.
// decodeFunctionData throws on a selector outside the ABI, so garbage lands here too.
function decodeApprove(data: Hex): readonly [Address, bigint] | null {
  try {
    const call = decodeFunctionData({ abi: erc20Abi, data })
    return call.functionName === 'approve' ? call.args : null
  } catch {
    return null
  }
}

// Swap contracts we trust on this chain: src/lib/routers.generated.ts, built by `npm run routers`
// and reviewed before commit.
export function knownRouters(chain: ChainId): readonly Address[] {
  return ROUTERS[chain].map((r) => r.address)
}

export type SignResult = { kind: 'sent'; hash: string } | { kind: 'rejected' } | { kind: 'failed'; message: string }
export type ReceiptResult = { kind: 'confirmed' } | { kind: 'reverted'; message: string }

// TODO: ask the wallet to sign one step (approve or swap) through wagmi.
export function signStep(token: SweepToken, step: 'approve' | 'swap'): Promise<SignResult> {
  return mockSignStep(token, step)
}

// TODO: wait for the transaction receipt through wagmi.
export function waitForReceipt(token: SweepToken, hash: string): Promise<ReceiptResult> {
  return mockWaitForReceipt(token, hash)
}

// 'batch': one wallet confirmation for every call. 'one_by_one': a confirmation per call.
export type SignMode = 'batch' | 'one_by_one'

// TODO: wagmi getCapabilities for this account and chain; 'batch' when
// capabilities.atomic.status is 'supported' or 'ready'.
export function getBatchSupport(address: Address, chain: ChainId): Promise<SignMode> {
  return mockBatchSupport(address, chain)
}

export type BatchSent = { kind: 'sent'; id: string } | { kind: 'rejected' } | { kind: 'failed'; message: string }

// Result per token, keyed by position id. An atomic batch reverts every token together.
export type BatchResult = { atomic: boolean; outcomes: Record<string, ReceiptResult> }

// TODO: wagmi sendCalls with [approve?, swap] for each token, in order. No forceAtomic:
// one bad token shouldn't sink the rest if the wallet can run them apart.
export function sendBatch(tokens: SweepToken[], chain: ChainId): Promise<BatchSent> {
  return mockSendBatch(tokens, chain)
}

// TODO: wagmi waitForCallsStatus, then map receipts back to tokens.
export function waitForBatch(id: string, tokens: SweepToken[]): Promise<BatchResult> {
  return mockWaitForBatch(id, tokens)
}
