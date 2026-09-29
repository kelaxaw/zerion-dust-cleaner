// Step 0 probe: does the key work for positions + swap quotes, and which chain has the best dust?
// Run: npm run probe
// Never prints the key.

import { isStablecoin } from '../src/lib/stablecoins.ts'

const KEY = process.env.ZERION_API_KEY
const ADDR = process.env.DEMO_ADDRESS
if (!KEY || !ADDR) {
  console.error('Fill ZERION_API_KEY and DEMO_ADDRESS in .env first.')
  process.exit(1)
}

const AUTH = 'Basic ' + Buffer.from(`${KEY}:`).toString('base64')
const CHAINS = ['base', 'arbitrum', 'polygon', 'binance-smart-chain']
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const MIN = 1
const MAX = 25

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(path, params) {
  const url = new URL(`https://api.zerion.io/v1${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  for (let i = 0; i < 10; i++) {
    const res = await fetch(url, { headers: { Authorization: AUTH, accept: 'application/json' } })
    if (res.status === 202) { await sleep(1500); continue } // positions not ready yet
    if (res.status === 429) { await sleep(2000 * (i + 1)); continue } // rate limited, back off
    const body = await res.json().catch(() => null)
    return { status: res.status, body }
  }
  return { status: 202, body: null }
}

function toDecimal(intStr, decimals) {
  const big = BigInt(intStr)
  const div = 10n ** BigInt(decimals)
  const frac = (big % div).toString().padStart(decimals, '0').replace(/0+$/, '')
  return frac ? `${big / div}.${frac}` : `${big / div}`
}

const summary = []
for (const chain of CHAINS) {
  const { status, body } = await get(`/wallets/${ADDR}/positions/`, {
    'filter[positions]': 'only_simple',
    'filter[chain_ids]': chain,
    'filter[trash]': 'only_non_trash',
    currency: 'usd',
    sort: 'value',
  })
  if (status !== 200) { console.log(`${chain}: positions HTTP ${status}`); continue }

  const rows = body.data.map((p) => {
    const f = p.attributes.fungible_info
    const impl = f.implementations?.find((i) => i.chain_id === chain)
    return {
      id: p.relationships.fungible.data.id,
      sym: f.symbol,
      value: p.attributes.value,
      native: impl ? impl.address == null : false,
      int: p.attributes.quantity?.int,
      decimals: impl?.decimals,
      type: p.attributes.position_type,
    }
  })
  const native = rows.find((r) => r.native)
  const candidates = rows.filter((r) =>
    r.type === 'wallet' && !r.native && r.id !== USDC && !isStablecoin(r.sym) &&
    r.value != null && r.value >= MIN && r.value <= MAX)

  summary.push({ chain, candidates })
  console.log(`\n${chain}: ${rows.length} positions, native gas ${native ? `${native.sym} $${(native.value ?? 0).toFixed(2)}` : 'NONE'}`)
  for (const r of rows) {
    const tag = candidates.includes(r) ? 'CANDIDATE' : r.native ? 'native' : r.type !== 'wallet' ? r.type : ''
    console.log(`  ${r.sym.padEnd(10)} ${r.value == null ? 'no price' : '$' + r.value.toFixed(2)}  ${tag}`)
  }
}

// Swap-quote check on the chain with the most candidates.
const best = summary.sort((a, b) => b.candidates.length - a.candidates.length)[0]
const c = best?.candidates[0]
if (!c) { console.log('\nNo candidates, skip quote check.'); process.exit(0) }

const { status, body } = await get('/swap/quotes/', {
  from: ADDR,
  to: ADDR,
  'input[chain_id]': best.chain,
  'input[fungible_id]': c.id,
  'input[amount]': toDecimal(c.int, c.decimals),
  'output[chain_id]': best.chain,
  'output[fungible_id]': USDC,
  slippage_percent: '2',
  currency: 'usd',
})
console.log(`\nswap quote ${c.sym} -> USDC on ${best.chain}: HTTP ${status}`)
if (status !== 200) { console.log(JSON.stringify(body?.errors ?? body).slice(0, 400)); process.exit(0) }
const offer = body.data?.[0]?.attributes
console.log(offer
  ? `  out ${offer.output_amount?.quantity} USDC ($${offer.output_amount?.value}), approve tx: ${offer.transaction_approve?.evm ? 'yes' : 'no'}, swap tx: ${offer.transaction_swap?.evm ? 'yes' : 'no'}, error: ${offer.error?.code ?? 'none'}`
  : '  no offers (no_route)')
