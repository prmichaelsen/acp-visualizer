import { useRef, useState, useEffect } from 'react'

export function useCollapse(open: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(open ? undefined : 0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (open) {
      setHeight(el.scrollHeight)
      const id = setTimeout(() => setHeight(undefined), 300)
      return () => clearTimeout(id)
    } else {
      setHeight(el.scrollHeight)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight(0))
      })
    }
  }, [open])

  return {
    ref,
    style: {
      height: height != null ? `${height}px` : ('auto' as const),
      overflow: 'hidden' as const,
      transition: 'height 300ms cubic-bezier(0.4, 0, 0.2, 1)',
    },
  }
}
