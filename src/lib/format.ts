const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n > 0 && n < 0.01) return '<$0.01'
  return usd.format(n)
}

// Token quantities: grouping for big numbers, more precision as the number shrinks.
export function formatAmount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
  if (abs >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 })
  if (abs === 0) return '0'
  return n.toLocaleString('en-US', { maximumSignificantDigits: 4 })
}

const CENT_TOKENS = new Set(['USDC', 'USDT', 'DAI'])

// Dollar-pegged outputs read as money ("2.80 USDC"), everything else as a quantity.
export function formatTokenAmount(n: number | null | undefined, symbol: string): string {
  if (n != null && Number.isFinite(n) && CENT_TOKENS.has(symbol)) return `${n.toFixed(2)} ${symbol}`
  return `${formatAmount(n)} ${symbol}`
}

// Loss as shown to the user: "−3.2%". Uses a real minus sign, not a hyphen.
export function formatLoss(fraction: number): string {
  const pct = Math.abs(fraction * 100)
  const sign = fraction > 0 ? '−' : fraction < 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

// "0x7a3f…c91e": enough to recognise a wallet, short enough for an eyebrow.
export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
