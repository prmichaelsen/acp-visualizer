import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'
import type { ProgressData } from '../lib/types'

interface EstimateChartProps {
  data: ProgressData
}

interface MilestoneEstimate {
  name: string
  estimated: number
  actual: number | null
  status: string
}

function buildEstimateData(data: ProgressData): MilestoneEstimate[] {
  return data.milestones.map((m) => {
    const tasks = data.tasks[m.id] || []

    // Sum estimated hours from tasks
    const estimated = tasks.reduce((sum, t) => {
      const h = parseFloat(t.estimated_hours)
      return sum + (isNaN(h) ? 0 : h)
    }, 0)

    // Calculate actual hours from milestone dates if completed
    let actual: number | null = null
    if (m.status === 'completed' && m.started && m.completed) {
      const start = new Date(m.started)
      const end = new Date(m.completed)
      const days = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      // Assume ~6 productive hours per day
      actual = Math.round(days * 6 * 10) / 10
    }

    // Truncate long names
    const label = m.name.length > 30 ? m.name.slice(0, 28) + '...' : m.name

    return { name: label, estimated, actual, status: m.status }
  })
}

export function EstimateChart({ data }: EstimateChartProps) {
  const chartData = buildEstimateData(data)

  if (chartData.length === 0) {
    return null
  }

  const hasActuals = chartData.some((d) => d.actual !== null)

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">
        Estimated vs Actual Hours
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 50 + 40)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#374151' }}
            label={{ value: 'Hours', position: 'insideBottomRight', offset: -5, fill: '#6b7280', fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={180}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#374151' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#e5e7eb',
            }}
            formatter={(value: unknown, name: unknown) => [
              `${value}h`,
              name === 'estimated' ? 'Estimated' : 'Actual',
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }}
            formatter={(value: string) => (value === 'estimated' ? 'Estimated' : 'Actual')}
          />
          <Bar dataKey="estimated" fill="#3b82f6" barSize={14} radius={[0, 4, 4, 0]} />
          {hasActuals && (
            <Bar dataKey="actual" barSize={14} radius={[0, 4, 4, 0]}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    entry.actual !== null && entry.actual > entry.estimated
                      ? '#ef4444'
                      : '#22c55e'
                  }
                />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
      {!hasActuals && (
        <p className="text-xs text-gray-600 text-center mt-2">
          Actual hours will appear once milestones have start and completion dates
        </p>
      )}
    </div>
  )
}
