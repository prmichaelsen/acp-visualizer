import { HeadContent, Scripts, createRootRoute, Outlet, useRouter } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { Sidebar } from '../components/Sidebar'
import { Header } from '../components/Header'
import { getProgressData } from '../services/progress-database.service'
import { listProjects, getProjectProgressPath } from '../services/projects.service'
import { fetchGitHubProgress } from '../services/github.service'
import type { ProgressData } from '../lib/types'
import type { AcpProject } from '../services/projects.service'
import { ProgressProvider } from '../contexts/ProgressContext'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
  shellComponent: RootDocument,

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
    } catch {
      // Cloudflare Workers or other environment without filesystem
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
})

function NotFound() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-200 mb-2">Page Not Found</h2>
        <p className="text-sm text-gray-400">
          The page you're looking for doesn't exist.
        </p>
      </div>
    </div>
  )
}

function AutoRefresh() {
  useAutoRefresh()
  return null
}

function RootLayout() {
  const context = Route.useRouteContext()
  const [progressData, setProgressData] = useState(context.progressData)
  const [currentProject, setCurrentProject] = useState<string | null>(
    context.progressData?.project.name || null,
  )

  const handleGitHubLoad = useCallback(async (owner: string, repo: string) => {
    const result = await fetchGitHubProgress({ data: { owner, repo } })
    if (result.ok) {
      setProgressData(result.data)
      setCurrentProject(`${owner}/${repo}`)
    } else {
      throw new Error(result.message)
    }
  }, [])

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
    } catch {
      // Project switch failed — likely no filesystem access
    }
  }, [])

  return (
    <>
      <AutoRefresh />
      <div className="flex h-screen bg-gray-950 text-gray-100">
        <Sidebar
          projects={context.projects}
          currentProject={currentProject}
          onProjectSelect={handleProjectSwitch}
          onGitHubLoad={handleGitHubLoad}
        />
        <ProgressProvider data={progressData}>
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header data={progressData} />
            <main className="flex-1 overflow-auto">
              <Outlet />
            </main>
          </div>
        </ProgressProvider>
      </div>
    </>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
