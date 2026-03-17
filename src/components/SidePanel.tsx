import { X } from 'lucide-react'
import { useSidePanel } from '../contexts/SidePanelContext'
import { MilestonePreview } from './MilestonePreview'
import { TaskPreview } from './TaskPreview'

export function SidePanel() {
  const { content, isOpen, close } = useSidePanel()

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={close}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 transition-transform duration-300 overflow-auto ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
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
        <div className="p-6">
          {content?.type === 'milestone' && <MilestonePreview milestoneId={content.id} />}
          {content?.type === 'task' && <TaskPreview taskId={content.id} />}
        </div>
      </div>
    </>
  )
}
