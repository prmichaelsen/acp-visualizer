import { createContext, useContext, useState, ReactNode } from 'react'

type PanelContent =
  | { type: 'milestone'; id: string }
  | { type: 'task'; id: string }
  | null

interface SidePanelContextValue {
  content: PanelContent
  isOpen: boolean
  width: number
  openMilestone: (id: string) => void
  openTask: (id: string) => void
  close: () => void
  setWidth: (width: number) => void
}

const SidePanelContext = createContext<SidePanelContextValue | undefined>(undefined)

const MIN_WIDTH = 300
const MAX_WIDTH = 800
const DEFAULT_WIDTH = 500

export function SidePanelProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<PanelContent>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [width, setWidthState] = useState(DEFAULT_WIDTH)

  const openMilestone = (id: string) => {
    setContent({ type: 'milestone', id })
    setIsOpen(true)
  }

  const openTask = (id: string) => {
    setContent({ type: 'task', id })
    setIsOpen(true)
  }

  const close = () => {
    setIsOpen(false)
    setTimeout(() => setContent(null), 300) // Wait for animation
  }

  const setWidth = (newWidth: number) => {
    const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth))
    setWidthState(clampedWidth)
  }

  return (
    <SidePanelContext.Provider value={{ content, isOpen, width, openMilestone, openTask, close, setWidth }}>
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
