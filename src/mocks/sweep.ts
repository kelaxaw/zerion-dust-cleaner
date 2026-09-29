import type { Address } from 'viem'
import type { ChainId } from '@/lib/chains'
import type { BatchResult, BatchSent, ReceiptResult, SignMode, SignResult, SweepToken } from '@/lib/sweep'

// Fake signing so every screen and row state can be reviewed end to end. Quotes are real.
// Outcomes are derived from the position id, so the same wallet always shows the same mix:
// one token fails on-chain, one is declined.

function hash(s: string): number {
  let h = 7
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
