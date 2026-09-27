import { useState, type ReactNode } from 'react'
import { ArrowLeftIcon, LoaderCircleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ChainCard } from '@/components/dust/chain-card'
import { Notice } from '@/components/dust/notice'
import { Segmented } from '@/components/dust/segmented'
import { StatusBadge } from '@/components/dust/status-badge'
import { TokenRow } from '@/components/dust/token-row'

// Living style guide. Every token and every component state the app can render,
// on one page, with static data. If a state isn't here, it isn't designed.

const COLORS: { name: string; token: string; note: string }[] = [
  { name: 'background', token: '--background', note: 'Page' },
  { name: 'card', token: '--card', note: 'Raised surface' },
  { name: 'muted', token: '--muted', note: 'Wells, tracks, skeletons' },
  { name: 'border', token: '--border', note: 'Hairlines' },
  { name: 'foreground', token: '--foreground', note: 'Text, primary CTA' },
  { name: 'muted-foreground', token: '--muted-foreground', note: 'Secondary text' },
  { name: 'faint-foreground', token: '--faint-foreground', note: 'Decorative only' },
  { name: 'brand', token: '--brand', note: 'Focus, in progress' },
  { name: 'success', token: '--success', note: 'Money received' },
  { name: 'warning', token: '--warning', note: 'Needs attention' },
  { name: 'destructive', token: '--destructive', note: 'Failed' },
]

const noop = () => {}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 border-t py-10 md:grid-cols-[220px_1fr]">
      <div>
        <h2 className="font-medium">{title}</h2>
        {hint && <p className="mt-1 text-[13px] text-muted-foreground">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 px-3 text-xs font-medium text-faint-foreground">{children}</div>
}

// The app renders inside this width; components are designed at it.
function Frame({ children }: { children: ReactNode }) {
  return <div className="w-full max-w-[400px] rounded-xl border bg-card p-2 shadow-card">{children}</div>
}

export function DesignPage() {
  const [target, setTarget] = useState<'USDC' | 'ETH'>('USDC')
  const [limit, setLimit] = useState<'5' | '10' | '25'>('10')
  const [checked, setChecked] = useState(true)

  return (
    <div className="mx-auto max-w-5xl px-6 pb-24">
      <header className="py-14">
        <div className="text-[13px] font-medium text-brand">Dust Cleanup</div>
        <h1 className="display mt-2 text-4xl">Design system</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Light, quiet, precise. Greyscale by default; colour only when it means something: indigo is in progress, green is money
          received, amber needs attention, red failed.
        </p>
      </header>

      <Section title="Colour" hint="CSS variables in index.css, mapped to Tailwind via @theme.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {COLORS.map((c) => (
            <div key={c.name} className="overflow-hidden rounded-lg border bg-card">
              <div className="h-14 border-b" style={{ background: `var(${c.token})` }} />
              <div className="px-3 py-2">
                <div className="text-[13px] font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.note}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type" hint="Inter Variable. Numbers are always tabular so columns of money line up.">
        <div className="flex flex-col gap-5">
          <div>
            <div className="display num text-5xl">$21.72</div>
            <div className="mt-1 text-xs text-muted-foreground">Display · 48 / 600 / −3.5%, hero totals</div>
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight">Clean up Base</div>
            <div className="mt-1 text-xs text-muted-foreground">Title · 18 / 600, screen headers</div>
          </div>
          <div>
            <div>DEGEN will be swapped into USDC.</div>
            <div className="mt-1 text-xs text-muted-foreground">Body · 14 / 400</div>
          </div>
          <div>
            <div className="text-[13px] text-muted-foreground">1,284.5 · $3.42</div>
            <div className="mt-1 text-xs text-muted-foreground">Meta · 13 / 400 muted</div>
          </div>
        </div>
      </Section>

      <Section title="Buttons" hint="Pills. One black primary per screen; everything else is outline or ghost.">
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

      <Section title="Controls" hint="Segmented for mutually exclusive settings. Changing one re-quotes the plan.">
        <div className="flex flex-col gap-3">
          <div className="flex max-w-[400px] items-center justify-between">
            <span className="text-[13px] text-muted-foreground">Convert into</span>
            <Segmented label="Convert into" value={target} onChange={setTarget} options={[{ value: 'USDC', label: 'USDC' }, { value: 'ETH', label: 'ETH' }]} />
          </div>
          <div className="flex max-w-[400px] items-center justify-between">
            <span className="text-[13px] text-muted-foreground">Tokens worth up to</span>
            <Segmented label="Tokens worth up to" value={limit} onChange={setLimit} options={[{ value: '5', label: '$5' }, { value: '10', label: '$10' }, { value: '25', label: '$25' }]} />
          </div>
        </div>
      </Section>

      <Section title="Status" hint="Badges carry the reason, never just a colour.">
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="brand" pulse>Confirm in wallet</StatusBadge>
          <StatusBadge tone="success">Swapped</StatusBadge>
          <StatusBadge tone="warning">Loses 7.8%</StatusBadge>
          <StatusBadge>No swap route</StatusBadge>
          <StatusBadge>Under $1</StatusBadge>
          <StatusBadge tone="destructive">Failed</StatusBadge>
        </div>
      </Section>

      <Section title="Network card" hint="Overview. Each chain loads on its own.">
        <Frame>
          <div className="flex flex-col gap-2">
            <ChainCard name="Base" state={{ kind: 'ready', tokenCount: 8, valueUsd: 21.72, hasGas: true, nativeSymbol: 'ETH', onOpen: noop }} />
            <ChainCard name="BNB Chain" state={{ kind: 'ready', tokenCount: 2, valueUsd: 3.2, hasGas: true, nativeSymbol: 'BNB', spamHidden: 3, onOpen: noop }} />
            <ChainCard name="Polygon" state={{ kind: 'ready', tokenCount: 3, valueUsd: 4.8, hasGas: false, nativeSymbol: 'POL', onOpen: noop }} />
            <ChainCard name="Arbitrum" state={{ kind: 'loading' }} />
            <ChainCard name="Optimism" state={{ kind: 'error', onRetry: noop }} />
            <ChainCard name="Base" state={{ kind: 'clean' }} />
          </div>
        </Frame>
      </Section>

      <Section title="Plan row" hint="Quoting → ready (toggle) or moved to “Won’t swap” with a reason.">
        <Frame>
          <Label>GETTING PRICE</Label>
          <TokenRow symbol="DEGEN" amount={1284.5} valueUsd={3.42} state={{ kind: 'quoting' }} />
          <Label>READY · click to toggle</Label>
          <TokenRow symbol="BRETT" amount={41.2} valueUsd={2.87} state={{ kind: 'ready', checked, out: 2.8, target: 'USDC', loss: 0.024, onCheckedChange: setChecked }} />
          <Label>UNCHECKED</Label>
          <TokenRow symbol="AERO" amount={3.1} valueUsd={2.64} state={{ kind: 'ready', checked: false, out: 2.6, target: 'USDC', loss: 0.015, onCheckedChange: noop }} />
          <Label>BLOCKED · LOSS OVER 5%</Label>
          <TokenRow symbol="HIGHER" amount={96} valueUsd={2.3} state={{ kind: 'off', reason: 'blocked', loss: 0.078 }} />
          <Label>NO ROUTE</Label>
          <TokenRow symbol="MOCHI" amount={9000} valueUsd={1.4} state={{ kind: 'off', reason: 'no_route' }} />
          <Label>SKIPPED</Label>
          <TokenRow symbol="DAI" amount={0.62} valueUsd={0.62} state={{ kind: 'off', reason: 'dust' }} />
          <TokenRow symbol="WETH" amount={0.0055} valueUsd={14.2} state={{ kind: 'off', reason: 'above_max', maxUsd: 10 }} />
        </Frame>
      </Section>

      <Section title="Signing row" hint="Per token: approve (if needed) → wait for receipt → swap → wait. Declining is a skip, not an error.">
        <Frame>
          <Label>WAITING</Label>
          <TokenRow symbol="AERO" amount={3.1} valueUsd={2.64} state={{ kind: 'waiting' }} />
          <Label>APPROVE · 1 OF 2</Label>
          <TokenRow symbol="DEGEN" amount={1284.5} valueUsd={3.42} state={{ kind: 'confirm', step: 'approve', steps: 2 }} />
          <Label>ON-CHAIN</Label>
          <TokenRow symbol="DEGEN" amount={1284.5} valueUsd={3.42} state={{ kind: 'mining', step: 'swap' }} />
          <Label>SWAPPED</Label>
          <TokenRow symbol="DEGEN" amount={1284.5} valueUsd={3.42} state={{ kind: 'done', out: 3.31, target: 'USDC' }} />
          <Label>DECLINED</Label>
          <TokenRow symbol="BRETT" amount={41.2} valueUsd={2.87} state={{ kind: 'rejected' }} />
          <Label>FAILED · NOTHING SPENT</Label>
          <TokenRow symbol="TOSHI" amount={18400} valueUsd={4.15} state={{ kind: 'failed', message: 'Price moved more than 2%' }} />
        </Frame>
      </Section>

      <Section title="Notices & progress" hint="No-gas is shown before signing, not discovered after.">
        <div className="flex max-w-[400px] flex-col gap-4">
          <Notice tone="warning" action={<Button size="sm" variant="outline" className="bg-card">Get POL</Button>}>
            No POL to pay network fees. You need about $0.02.
          </Notice>
          <Notice>Each token takes 2 signatures: approve, then swap.</Notice>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[13px] text-muted-foreground">
              <span>Getting best prices</span>
              <span className="num">3 of 7</span>
            </div>
            <Progress value={43} className="[&>div]:bg-brand" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <span className="display num text-3xl">$6.11</span>
              <span className="num text-[13px] text-muted-foreground">of ~$14.20 USDC</span>
            </div>
            <Progress value={45} className="h-1.5 [&>div]:bg-success" />
          </div>
        </div>
      </Section>
    </div>
  )
}
