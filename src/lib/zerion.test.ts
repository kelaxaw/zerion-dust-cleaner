import { describe, expect, it, vi } from 'vitest'
import { createZerionClient, ZerionError } from '@/lib/zerion'

const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status })

function setup(responses: (() => Response | Promise<Response>)[]) {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => {
    const next = responses.shift()
    if (!next) throw new Error('unexpected fetch')
    return next()
  })
  const sleep = vi.fn(async (_ms: number) => {})
  const client = createZerionClient({ fetch, sleep })
  return { client, fetch, sleep }
}

describe('zerionGet', () => {
  it('calls the dev proxy with the path and query params', async () => {
    const { client, fetch } = setup([() => json(200, { data: [] })])
    await client.get('/wallets/0xabc/positions/', { 'filter[chain_ids]': 'base', currency: 'usd' })
    const url = fetch.mock.calls[0][0]
    expect(url).toBe('/zerion/v1/wallets/0xabc/positions/?filter%5Bchain_ids%5D=base&currency=usd')
  })

  it('returns the parsed body on 200', async () => {
    const { client } = setup([() => json(200, { data: [1, 2] })])
    await expect(client.get('/x', {})).resolves.toEqual({ data: [1, 2] })
  })

  it('retries 202 after 1.5 s until the data is ready', async () => {
    const { client, sleep, fetch } = setup([() => json(202), () => json(202), () => json(200, { ok: true })])
    await expect(client.get('/x', {})).resolves.toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1500, 1500])
  })

  it('gives up after 10 attempts of 202', async () => {
    const { client, fetch } = setup(Array.from({ length: 10 }, () => () => json(202)))
    await expect(client.get('/x', {})).rejects.toBeInstanceOf(ZerionError)
    expect(fetch).toHaveBeenCalledTimes(10)
  })

  it('backs off 2s·n on 429', async () => {
    const { client, sleep } = setup([() => json(429), () => json(429), () => json(200, {})])
    await client.get('/x', {})
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([2000, 4000])
  })

  it('throws ZerionError with the status on other errors, without retrying', async () => {
    const { client, fetch } = setup([() => json(500, { errors: [{ title: 'boom' }] })])
    const err = await client.get('/x', {}).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ZerionError)
    expect((err as ZerionError).status).toBe(500)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('runs at most 2 requests at once', async () => {
    let inFlight = 0
    let peak = 0
    const slow = async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
      return json(200, {})
    }
    const { client } = setup([slow, slow, slow, slow, slow])
    await Promise.all(Array.from({ length: 5 }, () => client.get('/x', {})))
    expect(peak).toBe(2)
  })

  it('frees the slot when a request fails', async () => {
    const { client } = setup([() => json(500), () => json(500), () => json(200, { ok: 1 })])
    await Promise.allSettled([client.get('/a', {}), client.get('/b', {})])
    await expect(client.get('/c', {})).resolves.toEqual({ ok: 1 })
  })
})

describe('getPositions', () => {
  it('asks for simple positions on one chain, spam included, sorted by value', async () => {
    const { client, fetch } = setup([() => json(200, { data: [] })])
    await client.getPositions('0xabc', 'polygon')
    const url = new URL(fetch.mock.calls[0][0], 'http://x')
    expect(url.pathname).toBe('/zerion/v1/wallets/0xabc/positions/')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      'filter[positions]': 'only_simple',
      'filter[chain_ids]': 'polygon',
      'filter[trash]': 'no_filter',
      currency: 'usd',
      sort: 'value',
    })
  })

  it('returns the data array', async () => {
    const { client } = setup([() => json(200, { data: [{ id: 'p1' }] })])
    await expect(client.getPositions('0xabc', 'base')).resolves.toEqual([{ id: 'p1' }])
  })
})
