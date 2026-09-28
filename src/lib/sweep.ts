import type { Address, Hex } from 'viem'
import type { ChainId } from '@/lib/chains'
import type { Target } from '@/lib/settings'
import type { Position } from '@/lib/zerion'
import {
  mockBatchSupport,
  mockKnownRouters,
  mockQuote,
  mockSendBatch,
  mockSignStep,
  mockVerdict,
  mockWaitForBatch,
  mockWaitForReceipt,
} from '@/mocks/sweep'

// Quotes and signing for a Sweep. The screens call these functions; the ones marked
// TODO delegate to src/mocks/sweep.ts for now. Replace the bodies one by one.

// Loss above this share moves a token to "Won't swap" (CONTEXT.md: Sweepable).
export const MAX_LOSS = 0.05

// One transaction the wallet will sign, exactly as the quote returned it.
export type Call = { to: Address; data: Hex; value: bigint }

export type RouteQuote = {
  kind: 'route'
  out: number // target tokens that arrive
  outUsd: number
  loss: number // fraction of the position's USD value lost to price impact, fees and gas
  amountIn: bigint // raw units of the dust token being sold
  calls: { approve?: Call; swap: Call } // approve is absent when the allowance is already there
}
export type Quote = RouteQuote | { kind: 'no_route' }

export type QuoteVerdict = { kind: 'sweepable' } | { kind: 'wont_swap'; reason: 'no_route' | 'blocked' }

// A token ticked for the sweep, with the quote the user agreed to.
export type SweepToken = { position: Position; quote: RouteQuote }

export type QuoteRequest = { address: Address; chain: ChainId; target: Target; position: Position }

// TODO: Zerion swap quote for this position into the target.
export function quoteSwap(req: QuoteRequest): Promise<Quote> {
  return mockQuote(req)
}

// TODO: the Sweepable rule (route exists, loss ≤ MAX_LOSS).
export function judgeQuote(quote: Quote): QuoteVerdict {
  return mockVerdict(quote)
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
  void quote
  void ctx
  throw new Error('TODO: validateQuoteCalls')
}

// TODO: the real router allowlist per chain, once Zerion's quote response is known.
export function knownRouters(chain: ChainId): readonly Address[] {
  return mockKnownRouters(chain)
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
