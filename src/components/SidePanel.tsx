import { X } from 'lucide-react'
import { useRef, useState, useEffect } from 'react'
import { useSidePanel } from '../contexts/SidePanelContext'
import { MilestonePreview } from './MilestonePreview'
import { TaskPreview } from './TaskPreview'

export function SidePanel() {
  const { content, isOpen, width, close, setWidth } = useSidePanel()
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Handle resize drag
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return
      const panelRect = panelRef.current.getBoundingClientRect()
      const newWidth = panelRect.right - e.clientX
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, setWidth])

  // Prevent text selection while resizing
  useEffect(() => {
    if (isResizing) {
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'ew-resize'
    } else {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isResizing])

  // Don't render at all until first open
  if (!content && !isOpen) {
    return null
  }

  return (
    <div
      ref={panelRef}
      className={`relative h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-lg overflow-hidden transition-all duration-300 flex-shrink-0 ${
        isOpen ? 'opacity-100' : 'opacity-0 w-0 border-l-0'
      }`}
      style={{ width: isOpen ? `${width}px` : '0px' }}
    >
      {/* Resize Handle */}
      <div
        className={`absolute top-0 left-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 hover:w-1 transition-all z-20 ${
          isResizing ? 'bg-blue-500 w-1' : 'bg-transparent'
        }`}
        onMouseDown={() => setIsResizing(true)}
        aria-label="Resize panel"
      />

      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between z-10">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Preview</h2>
        <button
          onClick={close}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Close panel"
        >
          <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="p-6 overflow-auto h-[calc(100%-57px)]">
        {content?.type === 'milestone' && <MilestonePreview milestoneId={content.id} />}
        {content?.type === 'task' && <TaskPreview taskId={content.id} />}
      </div>
    </div>
  )
}
