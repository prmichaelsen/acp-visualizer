import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type PanelContent =
  | { type: 'milestone'; id: string }
  | { type: 'task'; id: string }
  | { type: 'document'; dirPath: string; slug: string }
  | null

interface SidePanelContextValue {
  content: PanelContent
  isOpen: boolean
  width: number
  openMilestone: (id: string) => void
  openTask: (id: string) => void
  openDocument: (dirPath: string, slug: string) => void
  close: () => void
  setWidth: (width: number) => void
}

const SidePanelContext = createContext<SidePanelContextValue | undefined>(undefined)

const MIN_WIDTH = 300
const DEFAULT_WIDTH = 500
const STORAGE_KEY = 'acp-visualizer.side-panel-size'
const PANEL_PARAM = 'panel'

function loadWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    const parsed = Number(stored)
    if (!isNaN(parsed) && parsed >= MIN_WIDTH) return parsed
  }
  return DEFAULT_WIDTH
}

/** Serialize panel content to a URL search param value */
function serializePanel(content: PanelContent): string | null {
  if (!content) return null
  switch (content.type) {
    case 'milestone': return `milestone:${content.id}`
    case 'task': return `task:${content.id}`
    case 'document': return `doc:${content.dirPath}:${content.slug}`
  }
}

/** Parse panel content from a URL search param value */
function deserializePanel(value: string | null): PanelContent {
  if (!value) return null
  if (value.startsWith('milestone:')) {
    return { type: 'milestone', id: value.slice('milestone:'.length) }
  }
  if (value.startsWith('task:')) {
    return { type: 'task', id: value.slice('task:'.length) }
  }
  if (value.startsWith('doc:')) {
    const rest = value.slice('doc:'.length)
    const colonIdx = rest.indexOf(':')
    if (colonIdx === -1) return null
    return { type: 'document', dirPath: rest.slice(0, colonIdx), slug: rest.slice(colonIdx + 1) }
  }
  return null
}

/** Read initial panel state from URL on first render */
function loadPanelFromUrl(): PanelContent {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  return deserializePanel(params.get(PANEL_PARAM))
}

/** Update the panel search param without pushing to browser history */
function syncPanelToUrl(content: PanelContent) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  const serialized = serializePanel(content)
  if (serialized) {
    url.searchParams.set(PANEL_PARAM, serialized)
  } else {
    url.searchParams.delete(PANEL_PARAM)
  }
  window.history.replaceState(window.history.state, '', url.toString())
}

export function SidePanelProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<PanelContent>(loadPanelFromUrl)
  const [isOpen, setIsOpen] = useState(() => loadPanelFromUrl() !== null)
  const [width, setWidthState] = useState(loadWidth)

  const openMilestone = useCallback((id: string) => {
    const panel: PanelContent = { type: 'milestone', id }
    setContent(panel)
    setIsOpen(true)
    syncPanelToUrl(panel)
  }, [])

  const openTask = useCallback((id: string) => {
    const panel: PanelContent = { type: 'task', id }
    setContent(panel)
    setIsOpen(true)
    syncPanelToUrl(panel)
  }, [])

  const openDocument = useCallback((dirPath: string, slug: string) => {
    const panel: PanelContent = { type: 'document', dirPath, slug }
    setContent(panel)
    setIsOpen(true)
    syncPanelToUrl(panel)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    syncPanelToUrl(null)
    setTimeout(() => setContent(null), 300) // Wait for animation
  }, [])

  const setWidth = useCallback((newWidth: number) => {
    const clamped = Math.max(MIN_WIDTH, newWidth)
    setWidthState(clamped)
    localStorage.setItem(STORAGE_KEY, String(clamped))
  }, [])

  return (
    <SidePanelContext.Provider value={{ content, isOpen, width, openMilestone, openTask, openDocument, close, setWidth }}>
      {children}
    </SidePanelContext.Provider>
  )
}

export function useSidePanel() {
  const context = useContext(SidePanelContext)
  if (!context) {
    throw new Error('useSidePanel must be used within SidePanelProvider')
  }
  return context
}
