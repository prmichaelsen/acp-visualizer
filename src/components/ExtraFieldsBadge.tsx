import type { ExtraFields } from '../lib/types'

export function ExtraFieldsBadge({ fields }: { fields: ExtraFields }) {
  const count = Object.keys(fields).length
  if (count === 0) return null

  return (
    <span
      className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded cursor-help"
      title={JSON.stringify(fields, null, 2)}
    >
      +{count}
    </span>
  )
}
