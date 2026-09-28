import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useVirtualizer, useWindowVirtualizer, type Virtualizer } from '@tanstack/react-virtual'

// Short lists render every row. Past VIRTUALIZE_AFTER rows only the visible ones mount.
// Hooks can't be called conditionally, so the choice is made by picking a component.
export const VIRTUALIZE_AFTER = 10
const ROW_ESTIMATE = 56 // TokenRow is min-h-14; real heights are measured
const OVERSCAN = 8

type Props<T> = {
  items: readonly T[]
  getKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  // 'window': the page scrolls. 'self': the list is its own scroll box (give it max-h-* overflow-y-auto).
  // The scroll box must be the list's own element: an ancestor's ref isn't attached yet
  // when the virtualizer first measures, so it would never find its scroll element.
  scroll?: 'window' | 'self'
  className?: string
}

export function RowList<T>(props: Props<T>) {
  if (props.items.length <= VIRTUALIZE_AFTER) {
    return (
      <div className={props.className}>
        {props.items.map((item) => (
          <Fragment key={props.getKey(item)}>{props.renderItem(item)}</Fragment>
        ))}
      </div>
    )
  }
  return props.scroll === 'self' ? <SelfScrollList {...props} /> : <WindowList {...props} />
}

function WindowList<T>({ items, getKey, renderItem, className }: Props<T>) {
  const ref = useRef<HTMLDivElement>(null)
  // Distance from the page top to the list. Re-measured whenever the page resizes, since
  // notices and the quote progress bar above the list come and go.
  const [scrollMargin, setScrollMargin] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setScrollMargin(el.getBoundingClientRect().top + window.scrollY)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(document.body)
    return () => observer.disconnect()
  }, [])

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => ROW_ESTIMATE,
    overscan: OVERSCAN,
    scrollMargin,
    getItemKey: (i) => getKey(items[i]),
  })

  return (
    <div className={className}>
      <div ref={ref}>
        <Rows virtualizer={virtualizer} items={items} renderItem={renderItem} />
      </div>
    </div>
  )
}

function SelfScrollList<T>({ items, getKey, renderItem, className }: Props<T>) {
  const ref = useRef<HTMLDivElement>(null)
  // oxlint-disable-next-line react/incompatible-library -- no React Compiler in this project
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => ref.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: OVERSCAN,
    getItemKey: (i) => getKey(items[i]),
  })

  return (
    <div ref={ref} className={className}>
      <Rows virtualizer={virtualizer} items={items} renderItem={renderItem} />
    </div>
  )
}

function Rows<T, S extends Element | Window>({
  virtualizer,
  items,
  renderItem,
}: {
  virtualizer: Virtualizer<S, Element>
  items: readonly T[]
  renderItem: (item: T) => ReactNode
}) {
  const margin = virtualizer.options.scrollMargin
  return (
    <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((row) => (
        <div
          key={row.key}
          data-index={row.index}
          ref={virtualizer.measureElement}
          className="absolute top-0 left-0 w-full"
          style={{ transform: `translateY(${row.start - margin}px)` }}
        >
          {renderItem(items[row.index])}
        </div>
      ))}
    </div>
  )
}
