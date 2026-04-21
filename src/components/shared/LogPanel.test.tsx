// LogPanel.test.tsx — Tests for the on-screen activity log panel.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogPanel } from './LogPanel'
import type { LogEntry } from '../../types'

const mockEntries: LogEntry[] = [
  { datetime: '2026-04-20 12:34:01', source: 'AUTH', level: 'INFO', message: 'User authenticated' },
  { datetime: '2026-04-20 12:34:05', source: 'GTM-API', level: 'SUCCESS', message: 'Created variable' },
  { datetime: '2026-04-20 12:34:06', source: 'CONFLICT', level: 'WARN', message: 'Conflict detected' },
  { datetime: '2026-04-20 12:34:07', source: 'GTM-API', level: 'ERROR', message: 'Request failed' },
]

describe('LogPanel', () => {
  it('renders all log entries', () => {
    render(<LogPanel entries={mockEntries} />)
    expect(screen.getByText(/User authenticated/)).toBeInTheDocument()
    expect(screen.getByText(/Created variable/)).toBeInTheDocument()
    expect(screen.getByText(/Conflict detected/)).toBeInTheDocument()
    expect(screen.getByText(/Request failed/)).toBeInTheDocument()
  })

  it('shows time only (not full date) for each entry', () => {
    render(<LogPanel entries={mockEntries} />)
    expect(screen.getByText(/12:34:01/)).toBeInTheDocument()
  })

  it('renders empty state when no entries', () => {
    render(<LogPanel entries={[]} />)
    expect(screen.getByText(/No log entries/)).toBeInTheDocument()
  })

  it('can be collapsed and expanded', async () => {
    const user = userEvent.setup()
    render(<LogPanel entries={mockEntries} />)
    const toggleButton = screen.getByRole('button', { name: /collapse/i })
    await user.click(toggleButton)
    expect(screen.queryByText(/User authenticated/)).not.toBeVisible()
  })
})
