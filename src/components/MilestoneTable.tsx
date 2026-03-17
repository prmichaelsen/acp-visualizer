import { Fragment, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from '@tanstack/react-table'
import { ChevronDown, ChevronRight, ArrowUpDown } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { PriorityBadge } from './PriorityBadge'
import { ProgressBar } from './ProgressBar'
import { TaskList } from './TaskList'
import type { Milestone, Task } from '../lib/types'

const columnHelper = createColumnHelper<Milestone>()

interface MilestoneTableProps {
  milestones: Milestone[]
  tasks: Record<string, Task[]>
}

export function MilestoneTable({ milestones, tasks }: MilestoneTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const columns = [
    columnHelper.display({
      id: 'expand',
      cell: (info) => (
        <button
          onClick={() => toggle(info.row.original.id)}
          className="p-0.5 text-gray-500 hover:text-gray-300"
        >
          {expanded.has(info.row.original.id) ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      ),
      size: 32,
    }),
    columnHelper.accessor('name', {
      header: 'Milestone',
      cell: (info) => (
        <Link
          to="/milestones/$milestoneId"
          params={{ milestoneId: info.row.original.id }}
          className="text-sm font-medium text-gray-200 hover:text-blue-400 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => <StatusBadge status={info.getValue()} />,
      size: 120,
    }),
    columnHelper.accessor('priority', {
      header: 'Priority',
      cell: (info) => <PriorityBadge priority={info.getValue()} />,
      size: 100,
    }),
    columnHelper.accessor('progress', {
      header: 'Progress',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <div className="w-20">
            <ProgressBar value={info.getValue()} size="sm" />
          </div>
          <span className="text-xs text-gray-400 font-mono w-8">
            {info.getValue()}%
          </span>
        </div>
      ),
      size: 140,
    }),
    columnHelper.display({
      id: 'tasks',
      header: 'Tasks',
      cell: (info) => (
        <span className="font-mono text-xs text-gray-400">
          {info.row.original.tasks_completed}/{info.row.original.tasks_total}
        </span>
      ),
      size: 80,
    }),
    columnHelper.accessor('started', {
      header: 'Started',
      cell: (info) => (
        <span className="text-xs text-gray-500">{info.getValue() || '—'}</span>
      ),
      size: 100,
    }),
    columnHelper.accessor('estimated_weeks', {
      header: 'Est.',
      cell: (info) => (
        <span className="text-xs text-gray-500 font-mono">
          {info.getValue()}w
        </span>
      ),
      size: 60,
    }),
  ]

  const table = useReactTable({
    data: milestones,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (milestones.length === 0) {
    return <p className="text-gray-600 text-sm">No milestones</p>
  }

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-gray-800 bg-gray-900/50">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="text-left text-xs text-gray-400 font-medium px-3 py-2 cursor-pointer select-none hover:text-gray-200"
                  style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center gap-1">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() && (
                      <ArrowUpDown className="w-3 h-3 text-gray-600" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <Fragment key={row.id}>
              <tr className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
              {expanded.has(row.original.id) && (
                <tr>
                  <td colSpan={columns.length} className="bg-gray-900/30 px-3 py-1">
                    <TaskList tasks={tasks[row.original.id] || []} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
