// LogContext.tsx — React context that provides the logger and log entries to all components.
// Wrap the app in <LogProvider> to make logger available via useLog().

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'
import { createLogger, type Logger } from './logger'
import type { LogEntry } from '../types'

interface LogContextValue {
  logger: Logger
  entries: readonly LogEntry[]
}

const LogContext = createContext<LogContextValue | null>(null)

export function LogProvider({ children }: { children: ReactNode }) {
  const loggerRef = useRef(createLogger())
  const [entries, setEntries] = useState<readonly LogEntry[]>([])

  useEffect(() => {
    // When the logger gets a new entry, update React state so the UI re-renders.
    loggerRef.current.onEntry = () => {
      setEntries([...loggerRef.current.getEntries()])
    }
    return () => { loggerRef.current.onEntry = null }
  }, [])

  return (
    <LogContext.Provider value={{ logger: loggerRef.current, entries }}>
      {children}
    </LogContext.Provider>
  )
}

export function useLog(): LogContextValue {
  const context = useContext(LogContext)
  if (!context) {
    throw new Error('useLog must be used within a LogProvider')
  }
  return context
}
