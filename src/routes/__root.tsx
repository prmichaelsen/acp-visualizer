import { HeadContent, Scripts, createRootRoute, Outlet, useRouter, useRouterState } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from 'react'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { Sidebar } from '../components/Sidebar'
import { Header } from '../components/Header'
import { SidePanel } from '../components/SidePanel'
import { getProgressData } from '../services/progress-database.service'
import { listProjects, getProjectProgressPath } from '../services/projects.service'
import { fetchGitHubProgress } from '../services/github.service'
import type { ProgressData } from '../lib/types'
import type { AcpProject } from '../services/projects.service'
import { ProgressProvider } from '../contexts/ProgressContext'
import { SidePanelProvider } from '../contexts/SidePanelContext'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
  shellComponent: RootDocument,

  beforeLoad: async () => {
    let progressData: ProgressData | null = null
    let projects: AcpProject[] = []

    // VITE_HOSTED mode: skip filesystem access entirely (Cloudflare Workers)
    if (!import.meta.env.VITE_HOSTED) {
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
        // No filesystem available
      }
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
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">Page Not Found</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
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

/** Read ?repo=owner/repo from current URL search params */
function getRepoFromUrl(): { owner: string; repo: string } | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const repo = params.get('repo')
  if (!repo) return null
  const parts = repo.split('/')
  if (parts.length < 2) return null
  return { owner: parts[0], repo: parts[1] }
}

/** Update ?repo= search param without full navigation */
function setRepoInUrl(ownerRepo: string | null) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (ownerRepo) {
    url.searchParams.set('repo', ownerRepo)
  } else {
    url.searchParams.delete('repo')
  }
  window.history.replaceState({}, '', url.toString())
}

function RootLayout() {
  const context = Route.useRouteContext()
  const [progressData, setProgressData] = useState(context.progressData)
  const [currentProject, setCurrentProject] = useState<string | null>(
    context.progressData?.project.name || null,
  )
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // On mount, check for ?repo= param and auto-load
  useEffect(() => {
    if (initialLoadDone) return
    setInitialLoadDone(true)

    const repoParam = getRepoFromUrl()
    if (repoParam && !progressData) {
      fetchGitHubProgress({ data: repoParam }).then((result) => {
        if (result.ok) {
          setProgressData(result.data)
          setCurrentProject(`${repoParam.owner}/${repoParam.repo}`)
        }
      })
    }
  }, [initialLoadDone, progressData])

  const handleGitHubLoad = useCallback(async (owner: string, repo: string) => {
    const result = await fetchGitHubProgress({ data: { owner, repo } })
    if (result.ok) {
      setProgressData(result.data)
      setCurrentProject(`${owner}/${repo}`)
      setRepoInUrl(`${owner}/${repo}`)
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
          setRepoInUrl(null) // Clear repo param for local projects
        }
      }
    } catch {
      // Project switch failed — likely no filesystem access
    }
  }, [])

  return (
    <>
      <AutoRefresh />
      <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <Sidebar
          projects={context.projects}
          currentProject={currentProject}
          onProjectSelect={handleProjectSwitch}
          onGitHubLoad={handleGitHubLoad}
        />
        <ProgressProvider data={progressData}>
          <SidePanelProvider>
            <div className="flex-1 flex flex-col overflow-hidden">
              <Header data={progressData} />
              <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
                <Outlet />
              </main>
            </div>
            <SidePanel />
          </SidePanelProvider>
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
