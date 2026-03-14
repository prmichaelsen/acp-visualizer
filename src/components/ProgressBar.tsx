interface ProgressBarProps {
  value: number
  size?: 'sm' | 'md'
}

export function ProgressBar({ value, size = 'md' }: ProgressBarProps) {
  const height = size === 'sm' ? 'h-1.5' : 'h-2.5'
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div className={`w-full bg-gray-800 rounded-full ${height} overflow-hidden`}>
      <div
        className={`${height} rounded-full transition-all duration-300 ${
          clamped === 100 ? 'bg-green-500' : 'bg-blue-500'
        }`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
