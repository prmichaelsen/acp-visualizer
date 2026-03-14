import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/tasks')({
  component: TasksPage,
})

function TasksPage() {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Tasks</h2>
      <p className="text-gray-500 text-sm">Task views coming soon...</p>
    </div>
  )
}
