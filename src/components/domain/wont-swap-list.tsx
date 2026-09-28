import { useState } from 'react'
import { Collapsible } from 'radix-ui'
import { ChevronDownIcon, SearchIcon } from 'lucide-react'
import { RowList } from '@/components/domain/row-list'
import { TokenRow, type OffReason } from '@/components/domain/token-row'
import { cn } from '@/lib/utils'

export type WontSwapItem = {
  id: string
  symbol: string
  name: string
  iconUrl?: string | null
  amount: number
  valueUsd: number | null
  reason: OffReason
  loss?: number
}

type Props = {
  items: readonly WontSwapItem[]
  maxUsd: number // the value cap, for the "Over $10" badge
  defaultOpen?: boolean
}

// Collapsed by default: a whale wallet has hundreds of these and they are not actionable.
// Opened, it searches by symbol or name so a user can find a token and see why it's left out.
export function WontSwapList({ items, maxUsd, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const shown = q ? items.filter((t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)) : items

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="rounded-2xl bg-card shadow-card">
      <Collapsible.Trigger className="flex h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 text-left transition-colors hover:bg-accent">
        <span className="text-caption font-medium">Won’t swap</span>
        <span className="flex items-center gap-2 text-caption text-muted-foreground">
          <span className="num">
            {items.length} {items.length === 1 ? 'token' : 'tokens'}
          </span>
          <ChevronDownIcon className={cn('size-4 transition-transform duration-200', open && 'rotate-180')} />
        </span>
      </Collapsible.Trigger>

      <Collapsible.Content className="border-t">
        <div className="p-2">
          <label className="relative block">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or symbol"
              aria-label="Search tokens that won’t swap"
              className="h-9 w-full rounded-lg bg-muted pr-3 pl-9 text-sm shadow-inset outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>
        {shown.length === 0 ? (
          <p className="px-5 pt-2 pb-4 text-caption text-muted-foreground">No token matches “{query.trim()}”.</p>
        ) : (
          <RowList
            items={shown}
            getKey={(t) => t.id}
            scroll="self"
            className="max-h-96 overflow-y-auto px-2 pb-2"
            renderItem={(t) => (
              <TokenRow
                symbol={t.symbol}
                iconUrl={t.iconUrl}
                amount={t.amount}
                valueUsd={t.valueUsd}
                state={{ kind: 'off', reason: t.reason, loss: t.loss, maxUsd }}
              />
            )}
          />
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
