import { createContext, useContext, useState, ReactNode } from 'react'

type PanelContent =
  | { type: 'milestone'; id: string }
  | { type: 'task'; id: string }
  | null

interface SidePanelContextValue {
  content: PanelContent
  isOpen: boolean
  openMilestone: (id: string) => void
  openTask: (id: string) => void
  close: () => void
}

const SidePanelContext = createContext<SidePanelContextValue | undefined>(undefined)

export function SidePanelProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<PanelContent>(null)
  const [isOpen, setIsOpen] = useState(false)

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

  return (
    <SidePanelContext.Provider value={{ content, isOpen, openMilestone, openTask, close }}>
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
