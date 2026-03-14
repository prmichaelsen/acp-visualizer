import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/search')({
  component: SearchPage,
})

function SearchPage() {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Search</h2>
      <p className="text-gray-500 text-sm">Search coming soon...</p>
    </div>
  )
}
