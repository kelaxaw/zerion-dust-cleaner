import { describe, expect, it } from 'vitest'
import { sweepReducer, type SweepRow, type SweepState } from '@/hooks/use-sweep'
import type { SweepToken } from '@/lib/sweep'

const token = (id: string) => ({ position: { id } }) as unknown as SweepToken
const a = token('a')
const b = token('b')
const rows: SweepRow[] = [
  { token: a, state: { kind: 'waiting' } },
  { token: b, state: { kind: 'waiting' } },
]
const running: SweepState = { status: 'running', rows, mode: 'one_by_one', batch: null, stopping: false }

describe('sweepReducer', () => {
  it('starts from idle into running with a clean phase', () => {
    expect(sweepReducer({ status: 'idle' }, { type: 'started', rows, mode: 'batch' })).toEqual({
      status: 'running',
      rows,
      mode: 'batch',
      batch: null,
      stopping: false,
    })
  })

  it('restarting (Try again) drops the previous run', () => {
    const finished: SweepState = { status: 'finished', rows }
    const next = sweepReducer(finished, { type: 'started', rows: [rows[1]], mode: 'one_by_one' })
    expect(next).toMatchObject({ status: 'running', rows: [rows[1]], stopping: false })
  })

  it('updates only the matching row', () => {
    const next = sweepReducer(running, { type: 'row', token: b, state: { kind: 'rejected' } })
    expect(next.status === 'running' && next.rows.map((r) => r.state.kind)).toEqual(['waiting', 'rejected'])
  })

  it('sets the batch phase and the stop flag while running', () => {
    const batched = sweepReducer(running, { type: 'batch', phase: 'confirm' })
    expect(batched).toMatchObject({ batch: 'confirm' })
    expect(sweepReducer(running, { type: 'stop' })).toMatchObject({ stopping: true })
  })

  it('finishing keeps the rows and nothing else', () => {
    const stopped: SweepState = { ...running, stopping: true, batch: 'mining' }
    expect(sweepReducer(stopped, { type: 'finished' })).toEqual({ status: 'finished', rows })
  })

  it('ignores late row, batch, stop and finish events outside a run', () => {
    const idle: SweepState = { status: 'idle' }
    const finished: SweepState = { status: 'finished', rows }
    for (const s of [idle, finished]) {
      expect(sweepReducer(s, { type: 'row', token: a, state: { kind: 'rejected' } })).toBe(s)
      expect(sweepReducer(s, { type: 'batch', phase: 'mining' })).toBe(s)
      expect(sweepReducer(s, { type: 'stop' })).toBe(s)
      expect(sweepReducer(s, { type: 'finished' })).toBe(s)
    }
  })

  it('reset goes back to idle from anywhere', () => {
    expect(sweepReducer(running, { type: 'reset' })).toEqual({ status: 'idle' })
  })
})
