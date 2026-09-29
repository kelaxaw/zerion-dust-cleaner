// Collects the swap routers Zerion quotes through, per chain, into src/lib/routers.generated.ts.
// Run: npm run routers [-- 0xWallet]   (default wallet: vitalik.eth, which holds tokens everywhere)
// Never prints the key.
//
// The output is the allowlist validateQuoteCalls trusts. The API only suggests addresses;
// trusting them is a review decision: read `git diff` of the generated file before committing.

import { writeFileSync } from 'node:fs'
import { CHAINS } from '../src/lib/chains.ts'
import { isStablecoin } from '../src/lib/stablecoins.ts'

const KEY = process.env.ZERION_API_KEY
if (!KEY) {
  console.error('Fill ZERION_API_KEY in .env first.')
  process.exit(1)
}
const WALLET = process.argv[2] ?? '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
const AUTH = 'Basic ' + Buffer.from(`${KEY}:`).toString('base64')
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const TOKENS_PER_CHAIN = 2 // each is quoted into USDC and into the gas token: 4 quotes per chain
// Liquidity sources we trust, by Zerion's liquidity_source.id. Offers through anything else
// (Zerion's own SwapProxy, Velora's upgradeable Diamond, Relay's approval proxy) are skipped
// by pickQuote, so a better price there falls back to the best offer through these.
const TRUSTED_SOURCES = new Set(['1inch', '0x', 'kyber'])
const OUT = new URL('../src/lib/routers.generated.ts', import.meta.url)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(path, params) {
  const url = new URL(`https://api.zerion.io/v1${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  for (let i = 0; i < 10; i++) {
    const res = await fetch(url, { headers: { Authorization: AUTH, accept: 'application/json' } })
    if (res.status === 202) { await sleep(1500); continue } // positions not ready yet
    if (res.status === 429) { await sleep(2000 * (i + 1)); continue } // rate limited, back off
    const body = await res.json().catch(() => null)
    if (res.status !== 200) throw new Error(`${path}: HTTP ${res.status} ${JSON.stringify(body?.errors ?? body).slice(0, 200)}`)
    return body
  }
  throw new Error(`${path}: still rate limited or indexing after 10 tries`)
}

function toDecimal(intStr, decimals) {
  const big = BigInt(intStr)
  const div = 10n ** BigInt(decimals)
  const frac = (big % div).toString().padStart(decimals, '0').replace(/0+$/, '')
  return frac ? `${big / div}.${frac}` : `${big / div}`
}

// A few plain ERC-20s worth quoting: priced, not spam, not stable, not the gas token.
async function sampleTokens(chain) {
  const body = await get(`/wallets/${WALLET}/positions/`, {
    'filter[positions]': 'only_simple',
    'filter[chain_ids]': chain.id,
    'filter[trash]': 'only_non_trash',
    currency: 'usd',
    sort: 'value', // highest value first
  })
  const tokens = []
  for (const p of body.data) {
    const a = p.attributes
    const impl = a.fungible_info.implementations.find((i) => i.chain_id === chain.id)
    if (a.position_type !== 'wallet' || !impl?.address || a.value == null || a.value < 1) continue
    if (isStablecoin(a.fungible_info.symbol)) continue
    // Wrapped gas token (WETH, WPOL, WBNB): selling it for the gas token is an unwrap
    // on the token contract itself, which would land in the list as if it were a router.
    if (a.fungible_info.symbol.toUpperCase() === `W${chain.gasSymbol}`) continue
    if (chain.gasTokenAddress && impl.address.toLowerCase() === chain.gasTokenAddress) continue
    tokens.push({ id: p.relationships.fungible.data.id, symbol: a.fungible_info.symbol, amount: toDecimal(a.quantity.int, impl.decimals) })
    if (tokens.length === TOKENS_PER_CHAIN) break
  }
  return tokens
}

// address → the liquidity sources seen behind it
const found = Object.fromEntries(CHAINS.map((c) => [c.id, new Map()]))

for (const chain of CHAINS) {
  const tokens = await sampleTokens(chain)
  if (tokens.length === 0) console.warn(`${chain.id}: no token to quote in ${WALLET}, list stays empty`)
  for (const token of tokens) {
    for (const output of [USDC, chain.gasFungibleId]) {
      const label = `${chain.id}: ${token.symbol} → ${output === USDC ? 'USDC' : chain.gasSymbol}`
      // One failed quote (Zerion answers 500 for some pairs) shouldn't stop the rest.
      const body = await get('/swap/quotes/', {
        from: WALLET,
        to: WALLET,
        'input[chain_id]': chain.id,
        'input[fungible_id]': token.id,
        'input[amount]': token.amount,
        'output[chain_id]': chain.id,
        'output[fungible_id]': output,
        slippage_percent: '2',
        currency: 'usd',
      }).catch((e) => {
        console.warn(`${label}: skipped, ${e.message}`)
        return { data: [] }
      })
      for (const { attributes: o } of body.data) {
        const to = o.transaction_swap?.evm?.to?.toLowerCase()
        if (!to || !TRUSTED_SOURCES.has(o.liquidity_source.id)) continue
        const sources = found[chain.id].get(to) ?? new Set()
        sources.add(o.liquidity_source.id)
        found[chain.id].set(to, sources)
      }
      console.log(`${label}, ${body.data.length} offers`)
      await sleep(500)
    }
  }
}

const lines = [
  '// Generated by scripts/routers.mjs from Zerion swap quotes. Do not edit by hand: rerun `npm run routers`.',
  '// This is the allowlist validateQuoteCalls trusts. Review every added address (git diff) before committing.',
  `// Wallet sampled: ${WALLET}`,
  "import type { Address } from 'viem'",
  "import type { ChainId } from '@/lib/chains'",
  '',
  'export type Router = { address: Address; sources: readonly string[] }',
  '',
  'export const ROUTERS: Record<ChainId, readonly Router[]> = {',
]
for (const chain of CHAINS) {
  lines.push(`  '${chain.id}': [`)
  const entries = [...found[chain.id]].sort(([a], [b]) => a.localeCompare(b))
  for (const [address, sources] of entries) {
    lines.push(`    { address: '${address}', sources: [${[...sources].sort().map((s) => `'${s}'`).join(', ')}] },`)
  }
  lines.push('  ],')
}
lines.push('}', '')
writeFileSync(OUT, lines.join('\n'))

console.log(`\nWrote ${OUT.pathname}`)
for (const chain of CHAINS) console.log(`  ${chain.id}: ${found[chain.id].size} routers`)
