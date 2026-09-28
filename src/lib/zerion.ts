import axios, { type AxiosRequestConfig } from 'axios'
import type { ChainId } from '@/lib/chains'

// Zerion API through the Vite dev proxy (/zerion/* → api.zerion.io, auth added server-side).
// The dev key rate-limits fast, so the client queues requests and retries on its own;
// callers (TanStack Query) should not retry on top.

// Subset of a JSON:API position record, only the fields the app reads.
export type Position = {
  id: string
  attributes: {
    position_type: string
    value: number | null
    quantity: { int: string; float: number }
    flags: { is_trash: boolean }
    fungible_info: {
      symbol: string
      name: string
      icon: { url: string } | null
      implementations: { chain_id: string; address: string | null; decimals: number }[]
    }
  }
  relationships: {
    fungible: { data: { id: string } }
    chain: { data: { id: string } }
  }
}

export class ZerionError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ZerionError'
    this.status = status
  }
}

const MAX_ATTEMPTS = 10
const NOT_READY_DELAY_MS = 1500 // 202: positions are still being indexed
const RATE_LIMIT_STEP_MS = 2000 // 429: wait 2s, 4s, 6s…
const MAX_CONCURRENT = 2
const TIMEOUT_MS = 20_000 // a hung connection fails the card (Retry button) instead of holding a slot

type Deps = {
  adapter?: AxiosRequestConfig['adapter'] // tests swap the network for canned responses
  sleep?: (ms: number) => Promise<void>
}

export function createZerionClient({ adapter, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }: Deps = {}) {
  const http = axios.create({
    baseURL: '/zerion/v1',
    timeout: TIMEOUT_MS,
    transitional: { clarifyTimeoutError: true }, // timeout → ETIMEDOUT, not the generic ECONNABORTED
    headers: { accept: 'application/json' },
    validateStatus: () => true, // statuses are handled below, not thrown by axios
    adapter,
  })

  let active = 0
  const waiting: (() => void)[] = []

  async function acquire() {
    if (active < MAX_CONCURRENT) {
      active++
      return
    }
    // The releasing request hands its slot over directly, so `active` stays the same.
    await new Promise<void>((r) => waiting.push(r))
  }

  function release() {
    const next = waiting.shift()
    if (next) next()
    else active--
  }

  async function send(path: string, params: Record<string, string>) {
    try {
      return await http.get(path, { params })
    } catch (e) {
      if (axios.isAxiosError(e) && e.code === 'ETIMEDOUT') throw new ZerionError(0, 'Zerion did not respond')
      if (axios.isAxiosError(e)) throw new ZerionError(0, 'Can’t reach Zerion')
      throw e
    }
  }

  async function get<T = unknown>(path: string, params: Record<string, string>): Promise<T> {
    await acquire()
    try {
      let rateLimited = 0
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const res = await send(path, params)
        if (res.status === 202) {
          if (attempt < MAX_ATTEMPTS) await sleep(NOT_READY_DELAY_MS)
          continue
        }
        if (res.status === 429) {
          rateLimited++
          if (attempt < MAX_ATTEMPTS) await sleep(RATE_LIMIT_STEP_MS * rateLimited)
          continue
        }
        if (res.status < 200 || res.status >= 300) throw new ZerionError(res.status, errorTitle(res.status, res.data))
        return res.data as T
      }
      throw new ZerionError(rateLimited ? 429 : 202, rateLimited ? 'Rate limited by Zerion' : 'Zerion is still indexing this wallet')
    } finally {
      release()
    }
  }

  async function getPositions(address: string, chain: ChainId): Promise<Position[]> {
    const body = await get<{ data: Position[] }>(`/wallets/${address}/positions/`, {
      'filter[positions]': 'only_simple',
      'filter[chain_ids]': chain,
      'filter[trash]': 'no_filter', // spam is counted, not shown
      currency: 'usd',
      sort: 'value',
    })
    return body.data
  }

  return { get, getPositions }
}

function errorTitle(status: number, body: unknown): string {
  const e = (body as { errors?: { title?: string; detail?: string }[] } | null)?.errors?.[0]
  return e?.detail ?? e?.title ?? `Zerion HTTP ${status}`
}

export const zerion = createZerionClient()
