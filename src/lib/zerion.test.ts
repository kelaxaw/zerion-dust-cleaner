import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { createZerionClient, ZerionError } from '@/lib/zerion'

type Reply = (config: InternalAxiosRequestConfig) => AxiosResponse | Promise<AxiosResponse>

// Axios adapter stand-in: gets the final request config, returns a canned response.
// The body is a JSON string, like the network would give; axios parses it.
const json =
  (status: number, body: unknown = {}): Reply =>
  (config) => ({ status, statusText: '', data: JSON.stringify(body), headers: new AxiosHeaders(), config })

const timeout: Reply = (config) => {
  throw new AxiosError('timeout of 20000ms exceeded', AxiosError.ETIMEDOUT, config)
}

function setup(replies: Reply[]) {
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
    const next = replies.shift()
    if (!next) throw new Error('unexpected request')
    return next(config)
  })
  const sleep = vi.fn(async (_ms: number) => {})
  const client = createZerionClient({ adapter, sleep })
  return { client, adapter, sleep }
}

describe('get', () => {
  it('calls the dev proxy with the path and query params', async () => {
    const { client, adapter } = setup([json(200, { data: [] })])
    await client.get('/wallets/0xabc/positions/', { 'filter[chain_ids]': 'base', currency: 'usd' })
    const config = adapter.mock.calls[0][0]
    expect(config.baseURL).toBe('/zerion/v1')
    expect(config.url).toBe('/wallets/0xabc/positions/')
    expect(config.params).toEqual({ 'filter[chain_ids]': 'base', currency: 'usd' })
  })

  it('sets a timeout so a hung connection cannot hold a slot forever', async () => {
    const { client, adapter } = setup([json(200, {})])
    await client.get('/x', {})
    expect(adapter.mock.calls[0][0].timeout).toBeGreaterThan(0)
  })

  it('returns the parsed body on 200', async () => {
    const { client } = setup([json(200, { data: [1, 2] })])
    await expect(client.get('/x', {})).resolves.toEqual({ data: [1, 2] })
  })

  it('retries 202 after 1.5 s until the data is ready', async () => {
    const { client, sleep, adapter } = setup([json(202), json(202), json(200, { ok: true })])
    await expect(client.get('/x', {})).resolves.toEqual({ ok: true })
    expect(adapter).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1500, 1500])
  })

  it('gives up after 10 attempts of 202', async () => {
    const { client, adapter } = setup(Array.from({ length: 10 }, () => json(202)))
    await expect(client.get('/x', {})).rejects.toBeInstanceOf(ZerionError)
    expect(adapter).toHaveBeenCalledTimes(10)
  })

  it('backs off 2s·n on 429', async () => {
    const { client, sleep } = setup([json(429), json(429), json(200, {})])
    await client.get('/x', {})
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([2000, 4000])
  })

  it('throws ZerionError with the status and API message on other errors, without retrying', async () => {
    const { client, adapter } = setup([json(500, { errors: [{ title: 'boom' }] })])
    const err = await client.get('/x', {}).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ZerionError)
    expect((err as ZerionError).status).toBe(500)
    expect((err as ZerionError).message).toBe('boom')
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it('throws ZerionError on timeout, without retrying', async () => {
    const { client, adapter } = setup([timeout])
    const err = await client.get('/x', {}).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ZerionError)
    expect((err as ZerionError).message).toBe('Zerion did not respond')
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it('throws ZerionError on a network error', async () => {
    const down: Reply = (config) => {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config)
    }
    const { client } = setup([down])
    await expect(client.get('/x', {})).rejects.toBeInstanceOf(ZerionError)
  })

  it('runs at most 3 requests at once', async () => {
    let inFlight = 0
    let peak = 0
    const slow: Reply = async (config) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
      return json(200, {})(config)
    }
    const { client } = setup([slow, slow, slow, slow, slow, slow])
    await Promise.all(Array.from({ length: 6 }, () => client.get('/x', {})))
    expect(peak).toBe(3)
  })

  it('frees the slot when a request fails', async () => {
    const { client } = setup([json(500), timeout, json(200, { ok: 1 })])
    await Promise.allSettled([client.get('/a', {}), client.get('/b', {})])
    await expect(client.get('/c', {})).resolves.toEqual({ ok: 1 })
  })
})

describe('getPositions', () => {
  it('asks for simple positions on one chain, spam included, sorted by value', async () => {
    const { client, adapter } = setup([json(200, { data: [] })])
    await client.getPositions('0xabc', 'polygon')
    const config = adapter.mock.calls[0][0]
    expect(config.url).toBe('/wallets/0xabc/positions/')
    expect(config.params).toEqual({
      'filter[positions]': 'only_simple',
      'filter[chain_ids]': 'polygon',
      'filter[trash]': 'no_filter',
      currency: 'usd',
      sort: 'value',
    })
  })

  it('returns the data array', async () => {
    const { client } = setup([json(200, { data: [{ id: 'p1' }] })])
    await expect(client.getPositions('0xabc', 'base')).resolves.toEqual([{ id: 'p1' }])
  })
})

describe('getSwapQuotes', () => {
  it('asks for a same-chain quote with a human-readable amount and returns the offers', async () => {
    const { client, adapter } = setup([json(200, { data: [{ id: 'uniswap' }] })])
    const offers = await client.getSwapQuotes({
      from: '0xabc',
      to: '0xabc',
      chain: 'base',
      inputFungibleId: 'aero',
      inputAmount: '3.7826209242',
      outputFungibleId: 'usdc',
      slippagePercent: 2,
    })
    const config = adapter.mock.calls[0][0]
    expect(config.url).toBe('/swap/quotes/')
    expect(config.params).toEqual({
      from: '0xabc',
      to: '0xabc',
      'input[chain_id]': 'base',
      'input[fungible_id]': 'aero',
      'input[amount]': '3.7826209242',
      'output[chain_id]': 'base',
      'output[fungible_id]': 'usdc',
      slippage_percent: '2',
      currency: 'usd',
    })
    expect(offers).toEqual([{ id: 'uniswap' }])
  })
})
