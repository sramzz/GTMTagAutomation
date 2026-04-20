// logger.ts — Centralized logger for the GTM Automation Tool.
// Every module imports this to log events. Each log call writes to the browser
// console AND stores the entry in memory for the on-screen panel and download export.

import type { LogEntry, LogLevel, LogSource } from '../types'

// Pads a source name to 10 chars so console columns align.
function padSource(source: string): string {
  return source.padEnd(10)
}

// Pads a level name to 7 chars so console columns align.
function padLevel(level: string): string {
  return level.padEnd(7)
}

// Returns current datetime as "YYYY-MM-DD HH:MM:SS".
function nowDatetime(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// Formats a log entry as a single line for the console.
function formatForConsole(entry: LogEntry): string {
  return `[${entry.datetime}] ${padSource(`[${entry.source}]`)} ${padLevel(entry.level)} ${entry.message}`
}

export interface Logger {
  info: (source: LogSource, message: string) => void
  warn: (source: LogSource, message: string) => void
  error: (source: LogSource, message: string) => void
  success: (source: LogSource, message: string) => void
  getEntries: () => readonly LogEntry[]
  clear: () => void
  /** Optional callback invoked on each new entry — used by React context to trigger re-renders. */
  onEntry: ((entry: LogEntry) => void) | null
}

export function createLogger(): Logger {
  const entries: LogEntry[] = []
  let onEntryCallback: ((entry: LogEntry) => void) | null = null

  function addEntry(level: LogLevel, source: LogSource, message: string): void {
    const entry: LogEntry = {
      datetime: nowDatetime(),
      source,
      level,
      message,
    }
    entries.push(entry)

    // Write to browser console with the appropriate console method.
    const formatted = formatForConsole(entry)
    if (level === 'ERROR') {
      console.error(formatted)
    } else if (level === 'WARN') {
      console.warn(formatted)
    } else {
      console.log(formatted)
    }

    // Notify React context if a callback is registered.
    if (onEntryCallback) {
      onEntryCallback(entry)
    }
  }

  return {
    info: (source, message) => addEntry('INFO', source, message),
    warn: (source, message) => addEntry('WARN', source, message),
    error: (source, message) => addEntry('ERROR', source, message),
    success: (source, message) => addEntry('SUCCESS', source, message),
    getEntries: () => entries,
    clear: () => { entries.length = 0 },
    get onEntry() { return onEntryCallback },
    set onEntry(cb: ((entry: LogEntry) => void) | null) { onEntryCallback = cb },
  }
}
