import { HeadContent, Scripts, createRootRoute, Outlet, useRouter } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { Sidebar } from '../components/Sidebar'
import { Header } from '../components/Header'
import { getProgressData } from '../services/progress-database.service'
import { listProjects, getProjectProgressPath } from '../services/projects.service'
import type { ProgressData } from '../lib/types'
import type { AcpProject } from '../services/projects.service'
import { ProgressProvider } from '../contexts/ProgressContext'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  beforeLoad: async () => {
    let progressData: ProgressData | null = null
    let projects: AcpProject[] = []

    try {
      const [result, projectList] = await Promise.all([
        getProgressData({ data: {} }),
        listProjects(),
      ])
      if (result.ok) {
        progressData = result.data
      }
      projects = projectList
    } catch (error) {
      console.error('[Root] Failed to load data:', error)
    }

    return { progressData, projects }
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
  const context = Route.useRouteContext()
  const router = useRouter()
  const [progressData, setProgressData] = useState(context.progressData)
  const [currentProject, setCurrentProject] = useState<string | null>(
    context.progressData?.project.name || null,
  )

  const handleProjectSwitch = useCallback(async (projectId: string) => {
    try {
      const path = await getProjectProgressPath({ data: { projectId } })
      if (path) {
        const result = await getProgressData({ data: { path } })
        if (result.ok) {
          setProgressData(result.data)
          setCurrentProject(projectId)
        }
      }
    } catch (error) {
      console.error('[Root] Failed to switch project:', error)
    }
  }, [])

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <AutoRefresh />
        <div className="flex h-screen bg-gray-950 text-gray-100">
          <Sidebar
            projects={context.projects}
            currentProject={currentProject}
            onProjectSelect={handleProjectSwitch}
          />
          <ProgressProvider data={progressData}>
            <div className="flex-1 flex flex-col overflow-hidden">
              <Header data={progressData} />
              <main className="flex-1 overflow-auto">
                {children}
              </main>
            </div>
          </ProgressProvider>
        </div>
        <Scripts />
      </body>
    </html>
  )
}
