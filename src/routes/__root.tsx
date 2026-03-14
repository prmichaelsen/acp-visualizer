import { HeadContent, Scripts, createRootRoute, Outlet } from '@tanstack/react-router'
import { useAutoRefresh } from '@/lib/useAutoRefresh'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'
import { ProgressDatabaseService } from '@/services/progress-database.service'
import type { ProgressData } from '@/lib/types'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  beforeLoad: async () => {
    let progressData: ProgressData | null = null

    try {
      const result = ProgressDatabaseService.getProgressData()
      if (result.ok) {
        progressData = result.data
      }
    } catch (error) {
      console.error('[Root] Failed to load progress data:', error)
    }

    return { progressData }
  },

  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      { title: 'ACP Progress Visualizer' },
      {
        name: 'description',
        content: 'Browser-based dashboard for visualizing ACP progress.yaml data',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
    ],
  }),

  shellComponent: RootDocument,
})

function AutoRefresh() {
  useAutoRefresh()
  return null
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { progressData } = Route.useRouteContext()

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <AutoRefresh />
        <div className="flex h-screen bg-gray-950 text-gray-100">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header data={progressData} />
            <main className="flex-1 overflow-auto">
              {children}
            </main>
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  )
}
