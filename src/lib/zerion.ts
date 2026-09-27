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

type Deps = {
  fetch?: (url: string, init?: RequestInit) => Promise<Response>
  sleep?: (ms: number) => Promise<void>
}

export function createZerionClient({
  fetch = (url, init) => globalThis.fetch(url, init),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}: Deps = {}) {
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

  async function get<T = unknown>(path: string, params: Record<string, string>): Promise<T> {
    const query = new URLSearchParams(params).toString()
    const url = `/zerion/v1${path}${query ? `?${query}` : ''}`
    await acquire()
    try {
      let rateLimited = 0
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const res = await fetch(url, { headers: { accept: 'application/json' } })
        if (res.status === 202) {
          if (attempt < MAX_ATTEMPTS) await sleep(NOT_READY_DELAY_MS)
          continue
        }
        if (res.status === 429) {
          rateLimited++
          if (attempt < MAX_ATTEMPTS) await sleep(RATE_LIMIT_STEP_MS * rateLimited)
          continue
        }
        if (!res.ok) throw new ZerionError(res.status, await errorTitle(res))
        return (await res.json()) as T
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

async function errorTitle(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { errors?: { title?: string; detail?: string }[] } | null
  const e = body?.errors?.[0]
  return e?.detail ?? e?.title ?? `Zerion HTTP ${res.status}`
}

export const zerion = createZerionClient()
