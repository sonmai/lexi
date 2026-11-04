import { useEffect, useState, type CSSProperties, type RefObject } from 'react'

/** Lit share of the border, for the bright head and the faint tail behind it. */
const HEAD = 0.12
const TAIL = 0.3

type Size = { width: number; height: number }

/**
 * A light that runs around the pill-shaped search field: one lap whenever `lap` changes,
 * and repeated laps while `busy` stays true for longer than a quick lookup takes.
 */
export function SearchLed({ field, lap, busy }: {
  field: RefObject<HTMLDivElement | null>
  lap: number
  busy: boolean
}) {
  const [size, setSize] = useState<Size | null>(null)

  useEffect(() => {
    const element = field.current
    if (!element) return
    const observer = new ResizeObserver(() => setSize({ width: element.offsetWidth, height: element.offsetHeight }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [field])

  if (!size) return null
  return (
    <>
      {lap > 0 && <Ring key={lap} size={size} className="search-led-lap" />}
      {busy && <Ring size={size} className="search-led-busy" />}
    </>
  )
}

function Ring({ size: { width, height }, className }: { size: Size; className: string }) {
  const perimeter = 2 * (width - height) + Math.PI * height
  const segment = (share: number, segmentClass: string) => {
    const length = perimeter * share
    // Each segment ends at the head's front edge, so the tail trails behind it.
    const start = length - perimeter * HEAD
    return (
      <rect
        className={segmentClass}
        width={width}
        height={height}
        rx={height / 2}
        strokeDasharray={`${length} ${perimeter - length}`}
        style={{ '--led-from': `${start}px`, '--led-to': `${start - perimeter}px` } as CSSProperties}
      />
    )
  }
  return (
    <svg className={'search-led ' + className} width={width} height={height} aria-hidden="true">
      {segment(TAIL, 'search-led-tail')}
      {segment(HEAD, 'search-led-head')}
    </svg>
  )
}
