import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">
        ACP Progress Visualizer
      </h1>
      <p className="mt-2 text-gray-400 text-sm font-mono">
        Dashboard loading...
      </p>
    </div>
  )
}
