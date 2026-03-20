import { HeadContent, Scripts, createRootRoute, Outlet } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { Sidebar } from '../components/Sidebar'
import { Header } from '../components/Header'
import { SidePanel } from '../components/SidePanel'
import { getProgressData, type ProgressResult } from '../services/progress-database.service'
import { listProjects, getProjectProgressPath } from '../services/projects.service'
import { fetchGitHubProgress, type GitHubResult } from '../services/github.service'
import { getStoredToken } from '../lib/github-auth'
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
          getProgressData({ data: {} }) as Promise<ProgressResult>,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // On mount, check for ?repo= param and auto-load
  useEffect(() => {
    if (initialLoadDone) return
    setInitialLoadDone(true)

    const repoParam = getRepoFromUrl()
    // Repo param takes precedence over default local data
    // In hosted mode with no repo param, default to prmichaelsen/agent-context-protocol
    const target = repoParam
      || (import.meta.env.VITE_HOSTED && !context.progressData
        ? { owner: 'prmichaelsen', repo: 'agent-context-protocol' }
        : null)

    if (target) {
      const token = getStoredToken()
      void (fetchGitHubProgress({ data: { ...target, token: token || undefined } }) as Promise<GitHubResult>).then((result) => {
        if (result.ok) {
          setProgressData(result.data)
          setCurrentProject(`${target.owner}/${target.repo}`)
          setRepoInUrl(`${target.owner}/${target.repo}`)
        }
      })
    }
  }, [initialLoadDone])

  const handleGitHubLoad = useCallback(async (owner: string, repo: string) => {
    const token = getStoredToken()
    const result = await (fetchGitHubProgress({ data: { owner, repo, token: token || undefined } }) as Promise<GitHubResult>)
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
        const result = await (getProgressData({ data: { path } }) as Promise<ProgressResult>)
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
        {/* Mobile Menu Button - Bottom Right (Thumb Zone) */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden fixed bottom-6 right-6 z-50 p-3 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg transition-transform duration-200"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? (
            <X className="w-6 h-6 text-gray-900 dark:text-gray-100" />
          ) : (
            <Menu className="w-6 h-6 text-gray-900 dark:text-gray-100" />
          )}
        </button>

        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar - Desktop: Always visible | Mobile: Bottom Drawer */}
        <div
          className={`fixed lg:relative bottom-0 left-0 right-0 lg:inset-y-0 lg:right-auto z-50 transition-transform duration-300 lg:translate-y-0 ${
            mobileMenuOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <Sidebar
            projects={context.projects}
            currentProject={currentProject}
            onProjectSelect={handleProjectSwitch}
            onGitHubLoad={handleGitHubLoad}
            onClose={() => setMobileMenuOpen(false)}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        <ProgressProvider data={progressData}>
          <SidePanelProvider>
            <div className="flex-1 flex overflow-hidden">
              {/* Main content area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <Header data={progressData} />
                <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
                  <Outlet />
                </main>
              </div>
              {/* Side panel - renders in flex layout, not overlay */}
              <SidePanel />
            </div>
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
