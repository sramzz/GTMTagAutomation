// logExport.test.ts — Tests for the downloadable log file builder.

import { describe, it, expect } from 'vitest'
import { buildLogFileContent } from './logExport'
import type { LogEntry, SessionInfo } from '../types'

const mockSession: SessionInfo = {
  userEmail: 'ops@solutions4delivery.com',
  accountName: 'Partner Corp',
  containerName: 'Partner XYZ - Web',
  containerPublicId: 'GTM-ABC123',
  workspaceName: 'S4D Automation - 2026-04-20',
  measurementId: 'G-TEST12345',
}

const mockEntries: LogEntry[] = [
  { datetime: '2026-04-20 12:34:01', source: 'AUTH', level: 'INFO', message: 'User authenticated' },
  { datetime: '2026-04-20 12:34:05', source: 'GTM-API', level: 'SUCCESS', message: 'Created variable "DLV - ecommerce.items"' },
  { datetime: '2026-04-20 12:34:06', source: 'GTM-API', level: 'ERROR', message: 'Failed to create trigger: 403' },
]

describe('buildLogFileContent', () => {
  it('includes the header with session info', () => {
    const content = buildLogFileContent(mockSession, mockEntries)

    expect(content).toContain('GTM Automation Tool — Session Log')
    expect(content).toContain('Date: 2026-04-20')
    expect(content).toContain('User: ops@solutions4delivery.com')
    expect(content).toContain('Container: Partner XYZ - Web (GTM-ABC123)')
    expect(content).toContain('Workspace: S4D Automation - 2026-04-20')
    expect(content).toContain('---')
  })

  it('includes all log entries in order', () => {
    const content = buildLogFileContent(mockSession, mockEntries)

    expect(content).toContain('[2026-04-20 12:34:01]')
    expect(content).toContain('User authenticated')
    expect(content).toContain('Created variable "DLV - ecommerce.items"')
    expect(content).toContain('Failed to create trigger: 403')

    // Entries appear in order
    const authIndex = content.indexOf('User authenticated')
    const successIndex = content.indexOf('Created variable')
    const errorIndex = content.indexOf('Failed to create')
    expect(authIndex).toBeLessThan(successIndex)
    expect(successIndex).toBeLessThan(errorIndex)
  })

  it('produces valid content with empty entries', () => {
    const content = buildLogFileContent(mockSession, [])

    expect(content).toContain('GTM Automation Tool — Session Log')
    expect(content).toContain('User: ops@solutions4delivery.com')
    // No log lines after the header separator
    const lines = content.split('\n')
    const separatorIndex = lines.findIndex(l => l.startsWith('---'))
    // After separator, there should be at most an empty trailing line
    const linesAfter = lines.slice(separatorIndex + 1).filter(l => l.trim() !== '')
    expect(linesAfter).toHaveLength(0)
  })
})
