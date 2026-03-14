import { createContext, useContext } from 'react'
import type { ProgressData } from '../lib/types'

const ProgressContext = createContext<ProgressData | null>(null)

export function ProgressProvider({
  data,
  children,
}: {
  data: ProgressData | null
  children: React.ReactNode
}) {
  return (
    <ProgressContext.Provider value={data}>
      {children}
    </ProgressContext.Provider>
  )
}

export function useProgressData(): ProgressData | null {
  return useContext(ProgressContext)
}
