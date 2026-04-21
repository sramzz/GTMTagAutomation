// LogPanel.tsx — On-screen activity log panel shown during preview and execution.
// Displays log entries with color coding by level. Collapsible.

import { useRef, useEffect, useState } from 'react'
import type { LogEntry } from '../../types'
import './LogPanel.css'

interface LogPanelProps {
  entries: readonly LogEntry[]
}

function timeOnly(datetime: string): string {
  return datetime.split(' ')[1] || datetime
}

function levelClass(level: string): string {
  switch (level) {
    case 'SUCCESS': return 'log-success'
    case 'WARN': return 'log-warn'
    case 'ERROR': return 'log-error'
    default: return 'log-info'
  }
}

export function LogPanel({ entries }: LogPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current && !collapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries, collapsed])

  return (
    <div className="log-panel">
      <div className="log-panel-header">
        <span className="log-panel-title">Activity Log</span>
        <button
          className="log-panel-toggle"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand log' : 'Collapse log'}
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      <div
        ref={scrollRef}
        className="log-panel-body"
        style={{ display: collapsed ? 'none' : 'block' }}
      >
        {entries.length === 0 ? (
          <p className="log-empty">No log entries yet.</p>
        ) : (
          entries.map((entry, i) => (
            <div key={i} className={`log-entry ${levelClass(entry.level)}`}>
              <span className="log-time">{timeOnly(entry.datetime)}</span>
              <span className="log-source">[{entry.source}]</span>
              <span className="log-level">{entry.level}</span>
              <span className="log-message">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
