# Dust Cleanup

Swaps a wallet's small token balances on one chain into a single target token, so the wallet stops carrying dozens of near-worthless positions.

## Language

### The sweep

**Sweep**:
One run of the cleaner on one chain: the chosen dust tokens are swapped into the target. A sweep never crosses chains.
_Avoid_: Consolidation, cleanup (for a single run), conversion

**Target**:
The token every swept balance ends up in: USDC or the chain's gas token (ETH on Base, POL on Polygon, BNB on BNB Chain). Never a bridged copy of another chain's gas token.
_Avoid_: Output token, destination

**Gas token**:
The chain's native token that pays for transactions (ETH on Base, POL on Polygon, BNB on BNB Chain). Never swept.
_Avoid_: Native, fee token

### Choosing what to sweep

**Position**:
One token balance a wallet holds on one chain, as reported by Zerion.
_Avoid_: Holding, asset, balance (for the whole record)

**Value cap**:
The largest USD value a position can have and still count as dust. The user picks $5, $10 or $25; default $10.
_Avoid_: Max value, limit, threshold (alone)

**Dust**:
A position worth at least $0.10 and at most the value cap that is a plain wallet balance, not the gas token, not the target, not a stablecoin, and not spam. Decided from balances alone, before any quote.
_Avoid_: Candidate, small balance

**Stablecoin**:
A dollar-pegged token (USDC, USDT, USDC.e, USDT0, USDS, TUSD, USDe, DAI). Already money, so never dust. Includes DAI, unlike Zerion CLI.

**Sweepable**:
Dust that has a swap route and whose loss is within 5%. Only sweepable tokens can be ticked for a sweep.
_Avoid_: Ready, eligible

**Loss**:
The share of a token's USD value that does not arrive in the target, after price impact, fees and gas. Includes gas, unlike Zerion CLI.
_Avoid_: Slippage (that is the allowed price move, a different number), price impact

**Won't swap**:
The group of positions shown in a plan but excluded from the sweep, each with one reason: under $0.10, over the value cap, no price, no route, or loss too high.
_Avoid_: Skipped (reserved for a token the user declined in the wallet), blocked (for the group)

### Screens

**Overview**:
The per-chain summary of a wallet: how much dust each chain holds and whether the wallet has gas there.

**Plan**:
One chain's dust with a quote per token, where the user picks the target, the value cap and which sweepable tokens to include.
