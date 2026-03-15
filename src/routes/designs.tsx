import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/designs')({
  component: DesignsLayout,
})

function DesignsLayout() {
  return <Outlet />
}
