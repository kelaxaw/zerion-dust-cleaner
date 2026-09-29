// Dollar-pegged tokens, by lowercase symbol (CONTEXT.md: Stablecoin). Already money, so never
// dust, and amounts of them read as money. Includes DAI, unlike Zerion CLI.
// Imported by scripts/*.mjs too, so this file must not import anything through '@/'.
export const STABLECOINS: ReadonlySet<string> = new Set(['usdc', 'usdt', 'usdc.e', 'usdt0', 'usds', 'tusd', 'usde', 'dai'])

export function isStablecoin(symbol: string): boolean {
  return STABLECOINS.has(symbol.toLowerCase())
}
