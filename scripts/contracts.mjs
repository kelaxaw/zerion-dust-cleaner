// Tells what contract an address is, through Sourcify (open registry of verified contracts, no key).
// Run: npm run contracts                          every router in src/lib/routers.generated.ts
//      npm run contracts -- base 0xabc… 0xdef…    your own addresses on one chain
//
// For each address: verified contract name, whether it's a proxy (Diamond included) and what it
// points to, and who deployed it. The same address can be a different contract on another chain,
// so every chain is checked on its own. Sourcify has no address labels: to learn whose a deployer
// is, open the explorer link.

import { CHAINS } from '../src/lib/chains.ts'
import { ROUTERS } from '../src/lib/routers.generated.ts'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function lookup(chainId, address) {
  const url = `https://sourcify.dev/server/v2/contract/${chainId}/${address}?fields=compilation,deployment,proxyResolution`
  for (let i = 0; i < 5; i++) {
    await sleep(300)
    const res = await fetch(url)
    if (res.status === 429) { await sleep(1000 * (i + 1)); continue }
    if (res.status === 404) return { verified: false }
    const body = await res.json().catch(() => null)
    if (!res.ok || !body) return { error: `HTTP ${res.status}` }
    return {
      verified: Boolean(body.match), // 'exact_match' or 'match'
      match: body.match,
      name: body.compilation?.name ?? null,
      deployer: body.deployment?.deployer ?? null,
      tx: body.deployment?.transactionHash ?? null,
      proxy: body.proxyResolution?.isProxy ? body.proxyResolution : null,
    }
  }
  return { error: 'still rate limited after 5 tries' }
}

// What to check: CLI args, or every router on its chain.
function targets() {
  const [chainArg, ...addresses] = process.argv.slice(2)
  if (chainArg) {
    const chain = CHAINS.find((c) => c.id === chainArg)
    if (!chain || addresses.length === 0) {
      console.error(`Usage: npm run contracts -- <${CHAINS.map((c) => c.id).join('|')}> 0xAddress…`)
      process.exit(1)
    }
    return addresses.map((address) => ({ chain, address: address.toLowerCase(), label: '' }))
  }
  return CHAINS.flatMap((chain) => ROUTERS[chain.id].map((r) => ({ chain, address: r.address, label: r.sources.join(', ') })))
}

for (const { chain, address, label } of targets()) {
  const explorer = chain.viemChain.blockExplorers.default.url
  const c = await lookup(chain.viemChain.id, address)

  console.log(`\n${chain.id}  ${address}${label ? `  (Zerion says: ${label})` : ''}`)
  if (c.error) console.log(`  error:       ${c.error}`)
  else if (!c.verified) console.log('  ⚠ NOT VERIFIED on Sourcify: no source to read, check the explorer')
  else {
    console.log(`  name:        ${c.name ?? '—'}  (${c.match})`)
    if (c.proxy) {
      console.log(`  proxy:       ${c.proxy.proxyType ?? 'yes'}, upgradeable by its owner`)
      for (const impl of c.proxy.implementations ?? []) console.log(`    → ${impl.address}${impl.name ? `  ${impl.name}` : ''}`)
    }
    console.log(`  deployed by: ${c.deployer ?? '—'}${c.tx ? `  tx ${c.tx}` : ''}`)
  }
  console.log(`  ${explorer}/address/${address}`)
}
