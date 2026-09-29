import { useEffect, useReducer, useRef } from 'react'
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
// Batch progress, shown once for the whole batch rather than per row.
export type BatchPhase = 'confirm' | 'mining' | null

// One object per phase: fields exist only where they mean something,
// so "stopping while idle" or "batch phase after finishing" can't be represented.
export type SweepState =
  | { status: 'idle' }
  | { status: 'running'; rows: SweepRow[]; mode: SignMode; batch: BatchPhase; stopping: boolean }
  | { status: 'finished'; rows: SweepRow[] }

type Action =
  | { type: 'started'; rows: SweepRow[]; mode: SignMode }
  | { type: 'row'; token: SweepToken; state: RowState }
  | { type: 'batch'; phase: BatchPhase }
  | { type: 'stop' }
  | { type: 'finished' }
  | { type: 'reset' }

export function sweepReducer(state: SweepState, action: Action): SweepState {
  switch (action.type) {
    case 'started':
      return { status: 'running', rows: action.rows, mode: action.mode, batch: null, stopping: false }
    case 'row':
      if (state.status !== 'running') return state
      return { ...state, rows: state.rows.map((r) => (r.token === action.token ? { ...r, state: action.state } : r)) }
    case 'batch':
      return state.status === 'running' ? { ...state, batch: action.phase } : state
    case 'stop':
      return state.status === 'running' ? { ...state, stopping: true } : state
    case 'finished':
      return state.status === 'running' ? { status: 'finished', rows: state.rows } : state
    case 'reset':
      return { status: 'idle' }
  }
}

type StartOptions = { target: string; chain: ChainId; mode: SignMode }

// Runs a Sweep. Every quote's calls are checked first; a token that fails the check is
// never sent. Then either one batch (one wallet confirmation), or one token at a time:
// approve (if needed) → receipt → swap → receipt.
// Started from a click, not an effect, so StrictMode never signs twice.
export function useSweep() {
  const [state, dispatch] = useReducer(sweepReducer, { status: 'idle' })
  // Refs, not state: the running loop reads them between awaits and needs the latest value,
  // which a state snapshot captured when start() was called would not have.
  const stopRef = useRef(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  function send(action: Action) {
    if (alive.current) dispatch(action)
  }

  async function start(tokens: SweepToken[], { target, chain, mode }: StartOptions) {
    stopRef.current = false

    const routers = knownRouters(chain)
    const valid: SweepToken[] = []
    const rows = tokens.map((token): SweepRow => {
      const problem = checkCalls(token, chain, routers)
      if (problem) return { token, state: { kind: 'failed', message: problem } }
      valid.push(token)
      return { token, state: { kind: 'waiting' } }
    })
    send({ type: 'started', rows, mode })

    const set = (token: SweepToken, s: RowState) => send({ type: 'row', token, state: s })
    if (mode === 'batch' && valid.length > 1) {
      await runBatch(valid, target, chain, set, (phase) => send({ type: 'batch', phase }))
    } else {
      for (const token of valid) {
        if (stopRef.current || !alive.current) break
        await sweepOne(token, target, (s) => set(token, s))
      }
    }
    send({ type: 'finished' })
  }

  function stop() {
    stopRef.current = true
    dispatch({ type: 'stop' })
  }

  function reset() {
    dispatch({ type: 'reset' })
  }

  return { state, start, stop, reset }
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

async function runBatch(
  tokens: SweepToken[],
  target: string,
  chain: ChainId,
  set: (token: SweepToken, s: RowState) => void,
  setPhase: (phase: BatchPhase) => void,
) {
  setPhase('confirm')
  const sent = await sendBatch(tokens, chain)
  if (sent.kind !== 'sent') {
    for (const t of tokens) set(t, sent.kind === 'rejected' ? { kind: 'rejected' } : { kind: 'failed', message: sent.message })
    setPhase(null)
    return
  }
  setPhase('mining')
  for (const t of tokens) set(t, { kind: 'mining', step: 'swap' })
  const result = await waitForBatch(sent.id, tokens)
  for (const t of tokens) {
    const outcome = result.outcomes[t.position.id] ?? { kind: 'reverted', message: 'No receipt for this swap' }
    set(t, outcome.kind === 'confirmed' ? { kind: 'done', out: t.quote.out, target } : { kind: 'failed', message: outcome.message })
  }
  setPhase(null)
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
