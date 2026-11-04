import { Component, createRef, type ReactNode } from 'react'

interface Props {
  home: boolean
  children: ReactNode
}

/** Measure the live search form on either side of React's layout change, including browser Back. */
export class LookupHeader extends Component<Props> {
  private header = createRef<HTMLElement>()
  private motion?: Animation

  getSnapshotBeforeUpdate(previous: Props) {
    if (previous.home === this.props.home || matchMedia('(prefers-reduced-motion: reduce)').matches) return null
    return this.header.current?.querySelector('form')?.getBoundingClientRect() ?? null
  }

  componentDidUpdate(previous: Props, _state: unknown, before: DOMRect | null) {
    if (previous.home === this.props.home) return
    this.motion?.cancel()
    const form = this.header.current?.querySelector('form')
    if (!before || !form?.animate) return

    const after = form.getBoundingClientRect()
    this.motion = form.animate([
      {
        transform: `translate(${before.left - after.left}px, ${before.top - after.top}px)`,
        width: `${before.width}px`,
      },
      { transform: 'translate(0, 0)', width: `${after.width}px` },
    ], { duration: this.props.home ? 180 : 220, easing: 'cubic-bezier(.22, .8, .24, 1)' })
  }

  componentWillUnmount() {
    this.motion?.cancel()
  }

  render() {
    return <header className="site-header" ref={this.header}>{this.props.children}</header>
  }
}
