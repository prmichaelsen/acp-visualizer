import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/patterns')({
  component: PatternsLayout,
})

function PatternsLayout() {
  return <Outlet />
}
