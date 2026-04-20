// logExport.ts — Builds the downloadable .txt log file content.
// The file includes a session header (who, when, which container) followed by all log entries.

import type { LogEntry, SessionInfo } from '../types'

function padSource(source: string): string {
  return source.padEnd(10)
}

function padLevel(level: string): string {
  return level.padEnd(7)
}

function formatEntry(entry: LogEntry): string {
  return `[${entry.datetime}] [${padSource(entry.source)}] ${padLevel(entry.level)} ${entry.message}`
}

export function buildLogFileContent(session: SessionInfo, entries: readonly LogEntry[]): string {
  const date = session.workspaceName.replace('S4D Automation - ', '')

  const header = [
    'GTM Automation Tool — Session Log',
    `Date: ${date}`,
    `User: ${session.userEmail}`,
    `Container: ${session.containerName} (${session.containerPublicId})`,
    `Workspace: ${session.workspaceName}`,
    '-------------------------------------------',
  ].join('\n')

  const body = entries.map(formatEntry).join('\n')

  return body ? `${header}\n${body}\n` : `${header}\n`
}

export function downloadLogFile(session: SessionInfo, entries: readonly LogEntry[]): void {
  const content = buildLogFileContent(session, entries)
  const now = new Date()
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('')
  const filename = `gtm-automation-log-${timestamp}.txt`

  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
