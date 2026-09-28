import { useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import type { RowState } from '@/components/domain/token-row'
import type { ChainId } from '@/lib/chains'
import {
  CALL_REJECTION_TEXT,
  knownRouters,
  sendBatch,
  signStep,
  validateQuoteCalls,
  waitForBatch,
  waitForReceipt,
  type SignMode,
  type SweepToken,
} from '@/lib/sweep'

export type SweepRow = { token: SweepToken; state: RowState }
export type SweepStatus = 'idle' | 'running' | 'finished'
// Batch progress, shown once for the whole batch rather than per row.
export type BatchPhase = 'confirm' | 'mining' | null

type StartOptions = { target: string; chain: ChainId; mode: SignMode }

// Runs a Sweep. Every quote's calls are checked first; a token that fails the check is
// never sent. Then either one batch (one wallet confirmation), or one token at a time:
// approve (if needed) → receipt → swap → receipt.
// Started from a click, not an effect, so StrictMode never signs twice.
export function useSweep() {
  const [rows, setRows] = useState<SweepRow[]>([])
  const [status, setStatus] = useState<SweepStatus>('idle')
  const [mode, setMode] = useState<SignMode>('one_by_one')
  const [batch, setBatch] = useState<BatchPhase>(null)
  const [stopping, setStopping] = useState(false)
  const stopRef = useRef(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  function setState(token: SweepToken, state: RowState) {
    if (alive.current) setRows((rs) => rs.map((r) => (r.token === token ? { ...r, state } : r)))
  }

  async function start(tokens: SweepToken[], { target, chain, mode }: StartOptions) {
    stopRef.current = false
    setStopping(false)
    setMode(mode)

    const routers = knownRouters(chain)
    const valid: SweepToken[] = []
    const initial = tokens.map((token): SweepRow => {
      const problem = checkCalls(token, chain, routers)
      if (problem) return { token, state: { kind: 'failed', message: problem } }
      valid.push(token)
      return { token, state: { kind: 'waiting' } }
    })
    setRows(initial)
    setStatus('running')

    if (mode === 'batch' && valid.length > 1) {
      await runBatch(valid, target, chain)
    } else {
      for (const token of valid) {
        if (stopRef.current || !alive.current) break
        await sweepOne(token, target, (s) => setState(token, s))
      }
    }
    if (alive.current) setStatus('finished')
  }

  async function runBatch(tokens: SweepToken[], target: string, chain: ChainId) {
    setBatch('confirm')
    const sent = await sendBatch(tokens, chain)
    if (sent.kind !== 'sent') {
      for (const t of tokens) setState(t, sent.kind === 'rejected' ? { kind: 'rejected' } : { kind: 'failed', message: sent.message })
      setBatch(null)
      return
    }
    setBatch('mining')
    for (const t of tokens) setState(t, { kind: 'mining', step: 'swap' })
    const result = await waitForBatch(sent.id, tokens)
    for (const t of tokens) {
      const outcome = result.outcomes[t.position.id] ?? { kind: 'reverted', message: 'No receipt for this swap' }
      setState(t, outcome.kind === 'confirmed' ? { kind: 'done', out: t.quote.out, target } : { kind: 'failed', message: outcome.message })
    }
    setBatch(null)
  }

  function stop() {
    stopRef.current = true
    setStopping(true)
  }

  function reset() {
    setRows([])
    setStatus('idle')
  }

  return { rows, status, mode, batch, stopping, start, stop, reset }
}

// Fails closed: a check that throws blocks the token just like one that rejects it.
function checkCalls(token: SweepToken, chain: ChainId, routers: readonly Address[]): string | null {
  try {
    const check = validateQuoteCalls(token.quote, { chain, position: token.position, routers })
    return check.ok ? null : CALL_REJECTION_TEXT[check.reason]
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

async function sweepOne(token: SweepToken, target: string, set: (s: RowState) => void) {
  const steps = token.quote.calls.approve ? (['approve', 'swap'] as const) : (['swap'] as const)
  for (const step of steps) {
    set({ kind: 'confirm', step, steps: steps.length })
    const sent = await signStep(token, step)
    if (sent.kind === 'rejected') return set({ kind: 'rejected' })
    if (sent.kind === 'failed') return set({ kind: 'failed', message: sent.message })
    set({ kind: 'mining', step })
    const receipt = await waitForReceipt(token, sent.hash)
    if (receipt.kind === 'reverted') return set({ kind: 'failed', message: receipt.message })
  }
  set({ kind: 'done', out: token.quote.out, target })
}
