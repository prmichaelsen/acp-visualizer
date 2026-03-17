import { Eye } from 'lucide-react'
import { useSidePanel } from '../contexts/SidePanelContext'

interface PreviewButtonProps {
  type: 'milestone' | 'task'
  id: string
  className?: string
}

export function PreviewButton({ type, id, className = '' }: PreviewButtonProps) {
  const { openMilestone, openTask } = useSidePanel()

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (type === 'milestone') {
      openMilestone(id)
    } else {
      openTask(id)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors opacity-0 group-hover:opacity-100 ${className}`}
      title={`Preview ${type}`}
      aria-label={`Preview ${type}`}
    >
      <Eye className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
    </button>
  )
}
