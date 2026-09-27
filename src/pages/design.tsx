import { useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowLeftIcon, LoaderCircleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ChainCard } from '@/components/domain/chain-card'
import { Notice } from '@/components/domain/notice'
import { Segmented } from '@/components/domain/segmented'
import { StatusBadge } from '@/components/domain/status-badge'
import { TokenRow } from '@/components/domain/token-row'

// Living style guide. Every token and every component state the app can render,
// on one page, with static data. If a state isn't here, it isn't designed.

type Swatch = { name: string; token: string; note: string; ink?: boolean }
const PALETTE: { group: string; swatches: Swatch[] }[] = [
  {
    group: 'Paper',
    swatches: [
      { name: 'background', token: '--background', note: 'Page' },
      { name: 'card', token: '--card', note: 'Raised surface' },
      { name: 'muted', token: '--muted', note: 'Wells, tracks' },
      { name: 'border', token: '--border', note: 'Hairline rules' },
    ],
  },
  {
    group: 'Ink',
    swatches: [
      { name: 'foreground', token: '--foreground', note: 'Text, primary CTA', ink: true },
      { name: 'muted-foreground', token: '--muted-foreground', note: 'Secondary text', ink: true },
      { name: 'faint-foreground', token: '--faint-foreground', note: 'Decorative only', ink: true },
    ],
  },
  {
    group: 'Signal',
    swatches: [
      { name: 'brand', token: '--brand', note: 'In progress, focus', ink: true },
      { name: 'success', token: '--success', note: 'Money received', ink: true },
      { name: 'warning', token: '--warning', note: 'Needs attention', ink: true },
      { name: 'destructive', token: '--destructive', note: 'Failed', ink: true },
    ],
  },
]

const TYPE_SCALE = [
  { sample: '$21.72', cls: 'display num text-display', spec: 'text-display · 56 / 300 / −4.5%' },
  { sample: 'Clean up Base', cls: 'text-xl font-medium tracking-tight', spec: 'text-xl · 20 / 500' },
  { sample: 'DEGEN will be swapped into USDC.', cls: 'text-sm', spec: 'text-sm · 14 / 400' },
  { sample: '1,284.5 · $3.42', cls: 'num text-caption text-muted-foreground', spec: 'text-caption · 13 / 400' },
  { sample: '0x7a3f…c91e · block 18,402,113', cls: 'eyebrow', spec: 'eyebrow · 11 / Geist Mono' },
]

const noop = () => { }

function Section({ n: i, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="reveal grid gap-6 border-t py-12 md:grid-cols-rail" style={{ '--i': i + 2 } as CSSProperties}>
      <div className="md:sticky md:top-8 md:self-start">
        <div className="eyebrow">{String(i).padStart(2, '0')}</div>
        <h2 className="mt-2 text-xl font-medium tracking-tight">{title}</h2>
        {hint && <p className="mt-2 max-w-2xs text-caption text-muted-foreground">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <div className="mt-5 mb-1 px-3 text-caption font-medium text-foreground first:mt-1">{children}</div>
}

// The app renders at this width; components are designed at it.
function Frame({ children }: { children: ReactNode }) {
  return <div className="w-full max-w-popup rounded-2xl bg-card p-2 shadow-raised">{children}</div>
}

export function DesignPage() {
  const [target, setTarget] = useState<'USDC' | 'ETH'>('USDC')
  const [limit, setLimit] = useState<'5' | '10' | '25'>('10')
  const [checked, setChecked] = useState(true)

  return (
    <div className="mx-auto max-w-6xl px-6 pb-32">
      <header className="py-16 md:py-24">
        <div className="reveal eyebrow" style={{ '--i': 0 } as CSSProperties}>
          DUST CLEANUP / DESIGN SYSTEM · v0.1
        </div>
        <h1 className="reveal display mt-5 text-display md:text-display-lg" style={{ '--i': 1 } as CSSProperties}>
          Sweep the dust.
        </h1>
        <p className="reveal mt-6 max-w-lg text-md text-muted-foreground" style={{ '--i': 2 } as CSSProperties}>
          A quiet ledger for small balances. Warm paper, hairline rules, light oversized numbers. Colour appears only when it means
          something: indigo is in progress, green is money received, amber needs attention, red failed.
        </p>
      </header>

      <Section n={1} title="Colour" hint="Variables in index.css, mapped to Tailwind through @theme.">
        <div className="flex flex-col gap-8">
          {PALETTE.map((g) => (
            <div key={g.group}>
              <div className="eyebrow mb-3">{g.group.toUpperCase()}</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {g.swatches.map((c) => (
                  <div key={c.name} className="overflow-hidden rounded-xl bg-card shadow-card">
                    <div className="h-16" style={{ background: `var(${c.token})` }} />
                    <div className="border-t px-3 py-2.5">
                      <div className="text-caption font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section n={2} title="Type" hint="Host Grotesk for everything a person reads, Geist Mono for what a machine wrote.">
        <div className="flex items-end gap-8 pb-8">
          <div className="display text-display-xl">Aa</div>
          <div className="pb-2">
            <div className="text-md font-medium">Host Grotesk</div>
            <div className="eyebrow mt-1">300 · 400 · 500 · 600</div>
          </div>
        </div>
        <div className="divide-y border-y">
          {TYPE_SCALE.map((t) => (
            <div key={t.spec} className="flex flex-wrap items-baseline justify-between gap-4 py-5">
              <div className={t.cls}>{t.sample}</div>
              <div className="eyebrow">{t.spec}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section n={3} title="Buttons" hint="Ink pills. One primary per screen; everything else is outline or ghost.">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="xl">Clean up 4 tokens</Button>
            <Button size="xl" variant="outline">Next: Arbitrum · $12.40</Button>
            <Button size="xl" disabled>Select tokens to swap</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" variant="outline">Try 2 tokens again</Button>
            <Button size="lg" variant="ghost">Stop after this token</Button>
            <Button size="lg" disabled>
              <LoaderCircleIcon className="animate-spin" />
              Getting prices…
            </Button>
            <Button size="icon-lg" variant="ghost" aria-label="Back">
              <ArrowLeftIcon />
            </Button>
          </div>
        </div>
      </Section>

      <Section n={4} title="Controls" hint="Segmented for mutually exclusive settings. The thumb glides; changing a value re-quotes the plan.">
        <div className="flex max-w-popup flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-caption text-muted-foreground">Convert into</span>
            <Segmented label="Convert into" value={target} onChange={setTarget} options={[{ value: 'USDC', label: 'USDC' }, { value: 'ETH', label: 'ETH' }]} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-caption text-muted-foreground">Tokens worth up to</span>
            <Segmented label="Tokens worth up to" value={limit} onChange={setLimit} options={[{ value: '5', label: '$5' }, { value: '10', label: '$10' }, { value: '25', label: '$25' }]} />
          </div>
        </div>
      </Section>

      <Section n={5} title="Status" hint="A badge always carries the reason in words, never colour alone.">
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="brand" pulse>Confirm in wallet</StatusBadge>
          <StatusBadge tone="success">Swapped</StatusBadge>
          <StatusBadge tone="warning">Loses 7.8%</StatusBadge>
          <StatusBadge>No swap route</StatusBadge>
          <StatusBadge>Under $1</StatusBadge>
          <StatusBadge tone="destructive">Failed</StatusBadge>
        </div>
      </Section>

      <Section n={6} title="Network card" hint="Overview. Each chain loads on its own, so one slow network never blanks the rest.">
        <Frame>
          <div className="flex flex-col gap-2 p-1">
            <ChainCard name="Base" state={{ kind: 'ready', tokenCount: 8, valueUsd: 21.72, hasGas: true, nativeSymbol: 'ETH', onOpen: noop }} />
            <ChainCard name="BNB Chain" state={{ kind: 'ready', tokenCount: 2, valueUsd: 3.2, hasGas: true, nativeSymbol: 'BNB', spamHidden: 3, onOpen: noop }} />
            <ChainCard name="Polygon" state={{ kind: 'ready', tokenCount: 3, valueUsd: 4.8, hasGas: false, nativeSymbol: 'POL', onOpen: noop }} />
            <ChainCard name="Arbitrum" state={{ kind: 'loading' }} />
            <ChainCard name="Optimism" state={{ kind: 'error', onRetry: noop }} />
            <ChainCard name="Optimism" state={{ kind: 'error', message: 'Rate limited by Zerion', onRetry: noop }} />
            <ChainCard name="Base" state={{ kind: 'clean' }} />
          </div>
        </Frame>
      </Section>

      <Section n={7} title="Plan row" hint="Quoting, then either ready (toggle) or moved to “Won’t swap” with a reason.">
        <Frame>
          <Label>Getting price</Label>
          <TokenRow symbol="DEGEN" amount={1284.5} valueUsd={3.42} state={{ kind: 'quoting' }} />
          <Label>Ready · click to toggle</Label>
          <TokenRow symbol="BRETT" amount={41.2} valueUsd={2.87} state={{ kind: 'ready', checked, out: 2.8, target: 'USDC', loss: 0.024, onCheckedChange: setChecked }} />
          <Label>Unchecked</Label>
          <TokenRow symbol="AERO" amount={3.1} valueUsd={2.64} state={{ kind: 'ready', checked: false, out: 2.6, target: 'USDC', loss: 0.015, onCheckedChange: noop }} />
          <Label>Blocked · loss over 5%</Label>
          <TokenRow symbol="HIGHER" amount={96} valueUsd={2.3} state={{ kind: 'off', reason: 'blocked', loss: 0.078 }} />
          <Label>No route</Label>
          <TokenRow symbol="MOCHI" amount={9000} valueUsd={1.4} state={{ kind: 'off', reason: 'no_route' }} />
          <Label>Won’t swap</Label>
          <TokenRow symbol="BALD" amount={0.62} valueUsd={0.62} state={{ kind: 'off', reason: 'under_min' }} />
          <TokenRow symbol="WETH" amount={0.0055} valueUsd={14.2} state={{ kind: 'off', reason: 'above_max', maxUsd: 10 }} />
        </Frame>
      </Section>

      <Section n={8} title="Signing row" hint="Per token: approve (if needed), wait for receipt, swap, wait. Declining is a skip, not an error.">
        <Frame>
          <Label>Waiting</Label>
          <TokenRow symbol="AERO" amount={3.1} valueUsd={2.64} state={{ kind: 'waiting' }} />
          <Label>Approve · 1 of 2</Label>
          <TokenRow symbol="DEGEN" amount={1284.5} valueUsd={3.42} state={{ kind: 'confirm', step: 'approve', steps: 2 }} />
          <Label>On-chain</Label>
          <TokenRow symbol="DEGEN" amount={1284.5} valueUsd={3.42} state={{ kind: 'mining', step: 'swap' }} />
          <Label>Swapped</Label>
          <TokenRow symbol="DEGEN" amount={1284.5} valueUsd={3.42} state={{ kind: 'done', out: 3.31, target: 'USDC' }} />
          <Label>Declined</Label>
          <TokenRow symbol="BRETT" amount={41.2} valueUsd={2.87} state={{ kind: 'rejected' }} />
          <Label>Failed · nothing spent</Label>
          <TokenRow symbol="TOSHI" amount={18400} valueUsd={4.15} state={{ kind: 'failed', message: 'Price moved more than 2%' }} />
        </Frame>
      </Section>

      <Section n={9} title="Notices & progress" hint="No gas is shown before signing, not discovered after.">
        <div className="flex max-w-popup flex-col gap-5">
          <Notice tone="warning" action={<Button size="sm" variant="outline" className="bg-card">Get POL</Button>}>
            No POL to pay network fees. You need about $0.02.
          </Notice>
          <Notice>Each token takes 2 signatures: approve, then swap.</Notice>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-caption text-muted-foreground">
              <span>Getting best prices</span>
              <span className="num">3 of 7</span>
            </div>
            <Progress value={43} className="[&>div]:bg-brand" />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <span className="display num text-display-sm">$6.11</span>
              <span className="num text-caption text-muted-foreground">of ~$14.20 USDC</span>
            </div>
            <Progress value={45} className="h-1.5 [&>div]:bg-success" />
          </div>
        </div>
      </Section>
    </div>
  )
}
