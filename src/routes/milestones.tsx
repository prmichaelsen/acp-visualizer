import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/milestones')({
  component: MilestonesLayout,
})

function MilestonesLayout() {
  return <Outlet />
}
