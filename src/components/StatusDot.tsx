import type { Status } from '@/lib/types'

const dotStyles: Record<Status, { symbol: string; color: string }> = {
  completed: { symbol: '✓', color: 'text-green-400' },
  in_progress: { symbol: '●', color: 'text-blue-400' },
  not_started: { symbol: '○', color: 'text-gray-500' },
}

export function StatusDot({ status }: { status: Status }) {
  const { symbol, color } = dotStyles[status]
  return <span className={`${color} text-xs w-4 text-center`}>{symbol}</span>
}
