# GTM Automation Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React SPA that automates GTM container setup (variables, triggers, tags) via the GTM API v2, with TDD and three-layer logging.

**Architecture:** Client-side only React 18 SPA. No backend. OAuth PKCE for auth. All GTM API calls made directly from the browser. 5-step linear wizard: Authenticate -> Select Container -> Provide Input -> Preview Conflicts -> Execute. Centralized logger feeds console, on-screen panel, and downloadable log file.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, React Testing Library, Google OAuth 2.0 PKCE, GTM API v2, plain CSS modules.

**Spec:** `docs/superpowers/specs/2026-04-20-gtm-automation-tool-v2-design.md`

**Master mapping source:** `s4d_gtm_master_mapping.json` (project root)

---

## Model Assignments

| Task | Description | Model | Rationale |
|------|-------------|-------|-----------|
| 1 | Project scaffolding | **Sonnet** | Running commands, no judgment needed |
| 2 | TypeScript types | **Sonnet** | Transcribing types from spec |
| 3 | Logger module | **Sonnet** | Simple module, clear test/impl pattern |
| 4 | Log export | **Sonnet** | Simple string builder |
| 5 | Log React context | **Sonnet** | Small React context boilerplate |
| 6 | Entity builder — Variables | **Sonnet** | Straightforward payload construction |
| 7 | Entity builder — Triggers | **Sonnet** | Same pattern as Task 6 |
| 8 | Entity builder — Tags | **Sonnet** | Same pattern, slightly more fields |
| 9 | Input parser | **Opus** | Complex merging: master mapping lookup + auto-derivation + deduplication |
| 10 | Conflict detection | **Opus** | Nuanced comparison logic, edge cases |
| 11 | Auth helper | **Sonnet** | Simple URL builder and token parser |
| 12 | GTM API service | **Opus** | Retry logic, error handling, many endpoints |
| 13 | App shell — Wizard navigation | **Opus** | State management for 5 steps, wiring context |
| 14 | LogPanel component | **Sonnet** | Straightforward React component |
| 15 | SummaryBar component | **Sonnet** | Very simple display component |
| 16 | Step1Auth | **Sonnet** | Simple auth redirect, token parse |
| 17 | Step2Container | **Opus** | Multiple API calls, validation, workspace limit check |
| 18 | Step3Input | **Opus** | Two modes, JSON validation, master mapping integration |
| 19 | Step4Preview | **Opus** | Conflict display, skip/overwrite decisions, summary bar |
| 20 | Step5Execute | **Opus** | Sequential API execution, progress tracking, partial failure, log download |
| 21 | Integration wiring | **Opus** | Connecting all state across steps |
| 22 | GA4 Config Tag | **Opus** | Special case handling within execution flow |
| 23 | Final polish | **Sonnet** | Running build/test commands |

**Summary: 12 Sonnet tasks, 11 Opus tasks.**

---

## File Structure

```
/                                    # Project root
├── s4d_gtm_master_mapping.json      # Source of truth (already exists)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── .env.example                     # VITE_GOOGLE_CLIENT_ID placeholder
├── src/
│   ├── main.tsx                     # Entry point, renders <App />
│   ├── App.tsx                      # Wizard shell: manages step state + LogProvider
│   ├── App.css                      # Global styles
│   ├── App.test.tsx                 # Wizard navigation tests
│   ├── types/
│   │   └── index.ts                 # All shared TypeScript types
│   ├── logging/
│   │   ├── logger.ts                # Core logger: console + in-memory store
│   │   ├── logger.test.ts           # Logger unit tests
│   │   ├── LogContext.tsx            # React context provider for log state
│   │   └── logExport.ts             # Builds downloadable .txt log file
│   │   └── logExport.test.ts        # Log export unit tests
│   ├── data/
│   │   └── masterMapping.json       # Copy of s4d_gtm_master_mapping.json
│   ├── services/
│   │   ├── auth.ts                  # OAuth PKCE flow
│   │   ├── auth.test.ts
│   │   ├── entityBuilder.ts         # Builds GTM variable/trigger/tag payloads
│   │   ├── entityBuilder.test.ts
│   │   ├── conflictDetection.ts     # Classifies entities: WILL_CREATE / ALREADY_CORRECT / CONFLICT
│   │   ├── conflictDetection.test.ts
│   │   ├── gtmApi.ts               # All GTM API v2 calls
│   │   ├── gtmApi.test.ts
│   │   ├── inputParser.ts           # Parses audit JSON, merges with master mapping
│   │   └── inputParser.test.ts
│   ├── components/
│   │   ├── shared/
│   │   │   ├── LogPanel.tsx         # On-screen activity log panel
│   │   │   ├── LogPanel.test.tsx
│   │   │   ├── LogPanel.css
│   │   │   ├── SummaryBar.tsx       # "X to create, Y conflicts, Z correct"
│   │   │   └── SummaryBar.test.tsx
│   │   ├── Step1Auth.tsx
│   │   ├── Step1Auth.test.tsx
│   │   ├── Step1Auth.css
│   │   ├── Step2Container.tsx
│   │   ├── Step2Container.test.tsx
│   │   ├── Step2Container.css
│   │   ├── Step3Input.tsx
│   │   ├── Step3Input.test.tsx
│   │   ├── Step3Input.css
│   │   ├── Step4Preview.tsx
│   │   ├── Step4Preview.test.tsx
│   │   ├── Step4Preview.css
│   │   ├── Step5Execute.tsx
│   │   ├── Step5Execute.test.tsx
│   │   └── Step5Execute.css
```

---

## Task 1: Project Scaffolding `[Sonnet]`

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.env.example`, `src/main.tsx`, `src/App.tsx`, `src/App.css`

- [ ] **Step 1: Initialize the Vite project**

```bash
cd /Users/sramzzs4d/Projects-sramzz/GTMTagAutomation
npm create vite@latest . -- --template react-ts
```

When prompted about the non-empty directory, select "Ignore files and continue". This creates `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, and the `src/` directory with starter files.

- [ ] **Step 2: Install dev dependencies**

```bash
npm install
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 3: Configure Vitest**

Add the test config to `vite.config.ts`:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
})
```

Create `src/test-setup.ts`:

```ts
// Adds custom jest-dom matchers like toBeInTheDocument() for all test files.
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Add test script to package.json**

In `package.json`, ensure the scripts section includes:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

- [ ] **Step 5: Create .env.example**

```
# Google OAuth Client ID — get this from Google Cloud Console.
# See spec Appendix C for setup instructions.
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

- [ ] **Step 6: Copy master mapping into src/data/**

```bash
mkdir -p src/data
cp s4d_gtm_master_mapping.json src/data/masterMapping.json
```

- [ ] **Step 7: Clean up Vite starter files**

Delete the Vite-generated demo files that we don't need:

```bash
rm -f src/assets/react.svg src/App.css src/index.css
```

Replace `src/App.tsx` with a minimal shell:

```tsx
// App.tsx — Wizard shell. Manages the current step and provides global context.

function App() {
  return (
    <div>
      <h1>GTM Automation Tool</h1>
      <p>Step 1 placeholder</p>
    </div>
  )
}

export default App
```

Replace `src/main.tsx` with:

```tsx
// main.tsx — Entry point. Renders the App component into the DOM.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 8: Verify everything works**

```bash
npm run dev
```

Expected: Dev server starts at `http://localhost:5173`. Browser shows "GTM Automation Tool" and "Step 1 placeholder".

```bash
npm run test:run
```

Expected: 0 tests found (no test files yet), exits cleanly with no errors.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html .env.example src/ public/
git commit -m "chore: scaffold Vite + React + TypeScript project with Vitest"
```

---

## Task 2: TypeScript Types `[Sonnet]`

**Files:**
- Create: `src/types/index.ts`

This file defines every shared type used across the app. It is the data model documentation — a developer reads this file and understands the entire system.

- [ ] **Step 1: Create the types file**

Create `src/types/index.ts`:

```ts
// types/index.ts — All shared TypeScript types for the GTM Automation Tool.
// Read this file to understand the data model of the entire app.

// --- Log types ---

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS'

export type LogSource = 'AUTH' | 'GTM-API' | 'CONFLICT' | 'WIZARD' | 'VALIDATION'

export interface LogEntry {
  datetime: string       // "2026-04-20 12:34:01"
  source: LogSource
  level: LogLevel
  message: string
}

// --- Master mapping types ---

export interface MasterMappingVariable {
  dlvPath: string        // e.g. "ecommerce.items"
  gtmVarName: string     // e.g. "DLV - ecommerce.items"
}

export interface MasterMappingParameter {
  paramName: string      // GA4 parameter name, e.g. "items"
  gtmVarRef: string      // GTM variable reference, e.g. "{{DLV - ecommerce.items}}"
}

export type EventStatus = 'LIVE' | 'SYSTEM' | 'SKIP'

export interface MasterMappingEntry {
  id: number
  category: string
  dataLayerEvent: string
  ga4EventName: string | null
  whenItFires: string
  status: EventStatus
  notes?: string
  gtmVariables: MasterMappingVariable[]
  gtmTriggerName: string | null
  gtmTagName: string | null
  ga4Parameters: MasterMappingParameter[]
}

export interface MasterMappingMeta {
  version: string
  source: string
  description: string
  statusValues: Record<string, string>
  namingConventions: Record<string, string>
  totalEvents: number
  liveEvents: number
  systemEvents: number
  skipEvents: number
}

export interface MasterMapping {
  _meta: MasterMappingMeta
  events: MasterMappingEntry[]
}

// --- Audit JSON types (from the data layer audit script) ---

export interface AuditEventData {
  count: number
  variables: string[]
}

// Keys are event names, values are their audit data
export type AuditJson = Record<string, AuditEventData>

// --- GTM API payload types ---

export interface GtmParameter {
  type: string
  key: string
  value: string
}

export interface GtmVariablePayload {
  name: string
  type: string           // "v" for Data Layer Variable
  parameter: GtmParameter[]
}

export interface GtmCustomEventFilter {
  type: string
  parameter: GtmParameter[]
}

export interface GtmTriggerPayload {
  name: string
  type: string           // "customEvent"
  customEventFilter: GtmCustomEventFilter[]
}

export interface GtmEventParameterMap {
  type: 'map'
  map: GtmParameter[]
}

export interface GtmTagPayload {
  name: string
  type: string           // "gaawe" for GA4 Event, "gaawc" for GA4 Config
  parameter: (GtmParameter | {
    key: string
    type: 'list'
    list: GtmEventParameterMap[]
  })[]
  firingTriggerId: string[]
}

// --- GTM API response types ---

export interface GtmEntity {
  name: string
  type: string
  path: string           // Used for update (PUT) operations
  parameter?: GtmParameter[]
  customEventFilter?: GtmCustomEventFilter[]
  firingTriggerId?: string[]
  triggerId?: string     // Returned by API after trigger creation
}

export interface GtmAccount {
  accountId: string
  name: string
  path: string
}

export interface GtmContainer {
  containerId: string
  name: string
  path: string
  publicId: string       // e.g. "GTM-ABC123"
}

export interface GtmWorkspace {
  workspaceId: string
  name: string
  path: string
}

// --- Conflict detection types ---

export type ConflictStatus = 'WILL_CREATE' | 'ALREADY_CORRECT' | 'CONFLICT'

export type ConflictDecision = 'SKIP' | 'OVERWRITE' | null  // null = not yet decided

export type EntityType = 'variable' | 'trigger' | 'tag'

export interface ConflictResult {
  entityName: string
  entityType: EntityType
  status: ConflictStatus
  decision: ConflictDecision
  intendedPayload: GtmVariablePayload | GtmTriggerPayload | GtmTagPayload
  existingEntity?: GtmEntity   // Only present when status is ALREADY_CORRECT or CONFLICT
}

// --- Execution result types ---

export type ExecutionAction = 'CREATED' | 'SKIPPED' | 'OVERWRITTEN' | 'ERROR'

export interface ExecutionResult {
  entityName: string
  entityType: EntityType
  action: ExecutionAction
  errorMessage?: string
}

// --- App state types ---

export interface SessionInfo {
  userEmail: string
  accountName: string
  containerName: string
  containerPublicId: string
  workspaceName: string
  measurementId: string
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add all shared TypeScript types for the GTM Automation Tool"
```

---

## Task 3: Logger Module `[Sonnet]`

**Files:**
- Create: `src/logging/logger.ts`, `src/logging/logger.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/logging/logger.test.ts`:

```ts
// logger.test.ts — Tests for the centralized logger module.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createLogger } from './logger'

describe('createLogger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('stores an INFO entry with correct fields', () => {
    const logger = createLogger()
    logger.info('GTM-API', 'Fetching accounts list...')

    const entries = logger.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].source).toBe('GTM-API')
    expect(entries[0].level).toBe('INFO')
    expect(entries[0].message).toBe('Fetching accounts list...')
    expect(entries[0].datetime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('stores a WARN entry', () => {
    const logger = createLogger()
    logger.warn('CONFLICT', 'Variable "DLV - ecommerce.items" already exists')

    const entries = logger.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].level).toBe('WARN')
    expect(entries[0].source).toBe('CONFLICT')
  })

  it('stores an ERROR entry', () => {
    const logger = createLogger()
    logger.error('GTM-API', 'Failed to create tag: 403 Forbidden')

    const entries = logger.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].level).toBe('ERROR')
  })

  it('stores a SUCCESS entry', () => {
    const logger = createLogger()
    logger.success('GTM-API', 'Created trigger "CE - add_to_cart" (id: 847)')

    const entries = logger.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].level).toBe('SUCCESS')
  })

  it('accumulates multiple entries in order', () => {
    const logger = createLogger()
    logger.info('AUTH', 'First')
    logger.warn('CONFLICT', 'Second')
    logger.error('GTM-API', 'Third')

    const entries = logger.getEntries()
    expect(entries).toHaveLength(3)
    expect(entries[0].message).toBe('First')
    expect(entries[1].message).toBe('Second')
    expect(entries[2].message).toBe('Third')
  })

  it('writes INFO to console.log', () => {
    const logger = createLogger()
    logger.info('AUTH', 'User authenticated')

    expect(console.log).toHaveBeenCalledTimes(1)
    const loggedString = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(loggedString).toContain('[AUTH]')
    expect(loggedString).toContain('INFO')
    expect(loggedString).toContain('User authenticated')
  })

  it('writes WARN to console.warn', () => {
    const logger = createLogger()
    logger.warn('CONFLICT', 'Conflict detected')

    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('writes ERROR to console.error', () => {
    const logger = createLogger()
    logger.error('GTM-API', 'Request failed')

    expect(console.error).toHaveBeenCalledTimes(1)
  })

  it('clears all entries', () => {
    const logger = createLogger()
    logger.info('AUTH', 'Something')
    logger.clear()

    expect(logger.getEntries()).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/logging/logger.test.ts
```

Expected: FAIL — `Cannot find module './logger'`

- [ ] **Step 3: Write the logger implementation**

Create `src/logging/logger.ts`:

```ts
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
  return `[${entry.datetime}] [${padSource(entry.source)}] ${padLevel(entry.level)} ${entry.message}`
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/logging/logger.test.ts
```

Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/logging/logger.ts src/logging/logger.test.ts
git commit -m "feat: add centralized logger with console output and in-memory store"
```

---

## Task 4: Log Export `[Sonnet]`

**Files:**
- Create: `src/logging/logExport.ts`, `src/logging/logExport.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/logging/logExport.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/logging/logExport.test.ts
```

Expected: FAIL — `Cannot find module './logExport'`

- [ ] **Step 3: Write the implementation**

Create `src/logging/logExport.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/logging/logExport.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/logging/logExport.ts src/logging/logExport.test.ts
git commit -m "feat: add log file export with session header and formatted entries"
```

---

## Task 5: Log React Context `[Sonnet]`

**Files:**
- Create: `src/logging/LogContext.tsx`

This connects the logger to React state so the on-screen panel re-renders on each new entry.

- [ ] **Step 1: Create the LogContext provider**

Create `src/logging/LogContext.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/logging/LogContext.tsx
git commit -m "feat: add React context provider for logger state"
```

---

## Task 6: Entity Builder — Variables `[Sonnet]`

**Files:**
- Create: `src/services/entityBuilder.ts`, `src/services/entityBuilder.test.ts`

- [ ] **Step 1: Write the failing tests for variable payload building**

Create `src/services/entityBuilder.test.ts`:

```ts
// entityBuilder.test.ts — Tests for GTM payload construction.

import { describe, it, expect } from 'vitest'
import { buildVariablePayload, buildTriggerPayload, buildGa4EventTagPayload, buildGa4ConfigTagPayload } from './entityBuilder'
import type { MasterMappingVariable, MasterMappingEntry } from '../types'

describe('buildVariablePayload', () => {
  it('builds a standard DLV variable payload', () => {
    const variable: MasterMappingVariable = {
      dlvPath: 'ecommerce.items',
      gtmVarName: 'DLV - ecommerce.items',
    }

    const result = buildVariablePayload(variable)

    expect(result).toEqual({
      name: 'DLV - ecommerce.items',
      // "v" is GTM's internal code for "Data Layer Variable"
      type: 'v',
      parameter: [
        { type: 'integer', key: 'dataLayerVersion', value: '2' },
        { type: 'boolean', key: 'setDefaultValue', value: 'false' },
        { type: 'template', key: 'name', value: 'ecommerce.items' },
      ],
    })
  })

  it('handles the DL- prefix exception (eecPurchase action fields)', () => {
    const variable: MasterMappingVariable = {
      dlvPath: 'ecommerce.purchase.actionField.id',
      gtmVarName: 'DL - ecommerce.purchase.actionField.id',
    }

    const result = buildVariablePayload(variable)

    // The name comes from the master mapping, not auto-generated
    expect(result.name).toBe('DL - ecommerce.purchase.actionField.id')
    expect(result.type).toBe('v')
    expect(result.parameter).toContainEqual({
      type: 'template', key: 'name', value: 'ecommerce.purchase.actionField.id',
    })
  })

  it('handles a simple (non-ecommerce) variable path', () => {
    const variable: MasterMappingVariable = {
      dlvPath: 'coupon_code',
      gtmVarName: 'DLV - coupon_code',
    }

    const result = buildVariablePayload(variable)

    expect(result.name).toBe('DLV - coupon_code')
    expect(result.parameter).toContainEqual({
      type: 'template', key: 'name', value: 'coupon_code',
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/services/entityBuilder.test.ts
```

Expected: FAIL — `Cannot find module './entityBuilder'`

- [ ] **Step 3: Write the variable builder implementation**

Create `src/services/entityBuilder.ts`:

```ts
// entityBuilder.ts — Builds GTM API payload objects from master mapping entries.
// Each function takes mapping data and returns a payload ready for the GTM API.

import type {
  MasterMappingVariable,
  MasterMappingEntry,
  MasterMappingParameter,
  GtmVariablePayload,
  GtmTriggerPayload,
  GtmTagPayload,
} from '../types'

export function buildVariablePayload(variable: MasterMappingVariable): GtmVariablePayload {
  return {
    name: variable.gtmVarName,
    type: 'v', // GTM's internal code for "Data Layer Variable"
    parameter: [
      { type: 'integer', key: 'dataLayerVersion', value: '2' },
      { type: 'boolean', key: 'setDefaultValue', value: 'false' },
      { type: 'template', key: 'name', value: variable.dlvPath },
    ],
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/services/entityBuilder.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/entityBuilder.ts src/services/entityBuilder.test.ts
git commit -m "feat: add variable payload builder with DL- prefix exception support"
```

---

## Task 7: Entity Builder — Triggers `[Sonnet]`

**Files:**
- Modify: `src/services/entityBuilder.ts`, `src/services/entityBuilder.test.ts`

- [ ] **Step 1: Add failing tests for trigger payload building**

Append to `src/services/entityBuilder.test.ts`:

```ts
describe('buildTriggerPayload', () => {
  it('builds a standard custom event trigger payload', () => {
    const result = buildTriggerPayload('CE - add_to_cart', 'add_to_cart')

    expect(result).toEqual({
      name: 'CE - add_to_cart',
      type: 'customEvent',
      customEventFilter: [
        {
          type: 'equals',
          parameter: [
            // {{_event}} is a GTM built-in variable holding the current event name
            { type: 'template', key: 'arg0', value: '{{_event}}' },
            { type: 'template', key: 'arg1', value: 'add_to_cart' },
          ],
        },
      ],
    })
  })

  it('handles non-standard trigger name (eecPurchase uses "EEC purchase")', () => {
    const result = buildTriggerPayload('EEC purchase', 'eecPurchase')

    expect(result.name).toBe('EEC purchase')
    expect(result.customEventFilter[0].parameter[1].value).toBe('eecPurchase')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/services/entityBuilder.test.ts
```

Expected: FAIL — `buildTriggerPayload is not a function` (not exported yet)

- [ ] **Step 3: Add trigger builder to entityBuilder.ts**

Add to `src/services/entityBuilder.ts`:

```ts
export function buildTriggerPayload(triggerName: string, dataLayerEventName: string): GtmTriggerPayload {
  return {
    name: triggerName,
    type: 'customEvent',
    customEventFilter: [
      {
        type: 'equals',
        parameter: [
          // {{_event}} is a GTM built-in variable that holds the current data layer event name
          { type: 'template', key: 'arg0', value: '{{_event}}' },
          { type: 'template', key: 'arg1', value: dataLayerEventName },
        ],
      },
    ],
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/services/entityBuilder.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/entityBuilder.ts src/services/entityBuilder.test.ts
git commit -m "feat: add trigger payload builder"
```

---

## Task 8: Entity Builder — Tags `[Sonnet]`

**Files:**
- Modify: `src/services/entityBuilder.ts`, `src/services/entityBuilder.test.ts`

- [ ] **Step 1: Add failing tests for GA4 Event Tag**

Append to `src/services/entityBuilder.test.ts`:

```ts
describe('buildGa4EventTagPayload', () => {
  it('builds a GA4 Event tag with parameters', () => {
    const params: MasterMappingParameter[] = [
      { paramName: 'items', gtmVarRef: '{{DLV - ecommerce.items}}' },
      { paramName: 'currency', gtmVarRef: '{{DLV - ecommerce.currency}}' },
    ]

    const result = buildGa4EventTagPayload(
      'GA4 Event - add_to_cart',
      'add_to_cart',
      'G-TEST12345',
      params,
      '999',
    )

    expect(result.name).toBe('GA4 Event - add_to_cart')
    expect(result.type).toBe('gaawe') // GTM code for "GA4 Event"
    expect(result.firingTriggerId).toEqual(['999'])
    expect(result.parameter).toContainEqual({
      key: 'eventName', type: 'template', value: 'add_to_cart',
    })
    expect(result.parameter).toContainEqual({
      key: 'measurementIdOverride', type: 'template', value: 'G-TEST12345',
    })

    // Find the eventParameters list
    const eventParams = result.parameter.find(p => p.key === 'eventParameters')
    expect(eventParams).toBeDefined()
    expect(eventParams!.type).toBe('list')
  })

  it('builds a GA4 Event tag with no parameters', () => {
    const result = buildGa4EventTagPayload(
      'GA4 Event - login',
      'login',
      'G-TEST12345',
      [],
      '100',
    )

    // Should still have eventName and measurementIdOverride, but no eventParameters list
    expect(result.parameter).toContainEqual({
      key: 'eventName', type: 'template', value: 'login',
    })
    const eventParams = result.parameter.find(p => p.key === 'eventParameters')
    expect(eventParams).toBeUndefined()
  })
})

describe('buildGa4ConfigTagPayload', () => {
  it('builds a GA4 Configuration tag', () => {
    const result = buildGa4ConfigTagPayload('G-TEST12345')

    expect(result.name).toBe('GA4 - Configuration TAG')
    expect(result.type).toBe('gaawc') // GTM code for "GA4 Configuration"
    // "2147479553" is the GTM built-in trigger ID for "All Pages"
    expect(result.firingTriggerId).toEqual(['2147479553'])
    expect(result.parameter).toContainEqual({
      key: 'measurementId', type: 'template', value: 'G-TEST12345',
    })
    expect(result.parameter).toContainEqual({
      key: 'sendPageView', type: 'boolean', value: 'true',
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/services/entityBuilder.test.ts
```

Expected: FAIL — `buildGa4EventTagPayload is not a function`

- [ ] **Step 3: Add tag builders to entityBuilder.ts**

Add to `src/services/entityBuilder.ts`:

```ts
export function buildGa4EventTagPayload(
  tagName: string,
  ga4EventName: string,
  measurementId: string,
  ga4Parameters: MasterMappingParameter[],
  triggerId: string,
): GtmTagPayload {
  const parameter: GtmTagPayload['parameter'] = [
    { key: 'eventName', type: 'template', value: ga4EventName },
    { key: 'measurementIdOverride', type: 'template', value: measurementId },
  ]

  // Only add the eventParameters list if there are parameters to send.
  if (ga4Parameters.length > 0) {
    parameter.push({
      key: 'eventParameters',
      type: 'list',
      list: ga4Parameters.map(param => ({
        type: 'map' as const,
        map: [
          { type: 'template', key: 'name', value: param.paramName },
          { type: 'template', key: 'value', value: param.gtmVarRef },
        ],
      })),
    })
  }

  return {
    name: tagName,
    type: 'gaawe', // GTM's internal code for "Google Analytics: GA4 Event"
    parameter,
    firingTriggerId: [triggerId],
  }
}

export function buildGa4ConfigTagPayload(measurementId: string): GtmTagPayload {
  return {
    name: 'GA4 - Configuration TAG',
    type: 'gaawc', // GTM's internal code for "Google Analytics: GA4 Configuration"
    parameter: [
      { key: 'measurementId', type: 'template', value: measurementId },
      { key: 'sendPageView', type: 'boolean', value: 'true' },
    ],
    // "2147479553" is the GTM built-in trigger ID for "All Pages" — hardcoded in every GTM container
    firingTriggerId: ['2147479553'],
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/services/entityBuilder.test.ts
```

Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/entityBuilder.ts src/services/entityBuilder.test.ts
git commit -m "feat: add GA4 Event and Configuration tag payload builders"
```

---

## Task 9: Input Parser `[Opus]`

**Files:**
- Create: `src/services/inputParser.ts`, `src/services/inputParser.test.ts`

This module takes audit JSON or the master mapping and produces a flat list of entities to create.

- [ ] **Step 1: Write the failing tests**

Create `src/services/inputParser.test.ts`:

```ts
// inputParser.test.ts — Tests for parsing audit JSON and generating entity lists from the master mapping.

import { describe, it, expect } from 'vitest'
import { parseAuditJson, getEntitiesFromMasterMapping, getEntitiesFromAuditJson } from './inputParser'
import type { AuditJson, MasterMappingEntry } from '../types'

describe('parseAuditJson', () => {
  it('parses valid audit JSON string', () => {
    const input = '{"view_item_list": {"count": 3, "variables": ["event", "ecommerce.items"]}}'
    const result = parseAuditJson(input)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data['view_item_list'].count).toBe(3)
      expect(result.data['view_item_list'].variables).toContain('ecommerce.items')
    }
  })

  it('returns error for invalid JSON', () => {
    const result = parseAuditJson('not json at all')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Invalid JSON')
    }
  })

  it('returns error for JSON that is valid but wrong structure (array instead of object)', () => {
    const result = parseAuditJson('[1, 2, 3]')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('must be an object')
    }
  })

  it('returns error for event missing variables array', () => {
    const result = parseAuditJson('{"some_event": {"count": 1}}')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('variables')
    }
  })
})

describe('getEntitiesFromMasterMapping', () => {
  const liveMappingEntry: MasterMappingEntry = {
    id: 1,
    category: 'TEST',
    dataLayerEvent: 'view_item_list',
    ga4EventName: 'view_item_list',
    whenItFires: 'test',
    status: 'LIVE',
    gtmVariables: [
      { dlvPath: 'ecommerce.items', gtmVarName: 'DLV - ecommerce.items' },
    ],
    gtmTriggerName: 'CE - view_item_list',
    gtmTagName: 'GA4 Event - view_item_list',
    ga4Parameters: [
      { paramName: 'items', gtmVarRef: '{{DLV - ecommerce.items}}' },
    ],
  }

  const systemEntry: MasterMappingEntry = {
    id: 29,
    category: 'CONSENT',
    dataLayerEvent: 'OneTrustLoaded',
    ga4EventName: null,
    whenItFires: 'test',
    status: 'SYSTEM',
    gtmVariables: [
      { dlvPath: 'OnetrustActiveGroups', gtmVarName: 'DLV - OnetrustActiveGroups' },
    ],
    gtmTriggerName: 'CE - OneTrustLoaded',
    gtmTagName: null,
    ga4Parameters: [],
  }

  const skipEntry: MasterMappingEntry = {
    id: 32,
    category: 'GTM SYSTEM',
    dataLayerEvent: 'gtm.js',
    ga4EventName: null,
    whenItFires: 'test',
    status: 'SKIP',
    gtmVariables: [],
    gtmTriggerName: null,
    gtmTagName: null,
    ga4Parameters: [],
  }

  it('produces variables, trigger, and tag for a LIVE entry', () => {
    const result = getEntitiesFromMasterMapping([liveMappingEntry], 'G-TEST12345')

    expect(result.variables).toHaveLength(1)
    expect(result.variables[0].name).toBe('DLV - ecommerce.items')
    expect(result.triggers).toHaveLength(1)
    expect(result.triggers[0].name).toBe('CE - view_item_list')
    expect(result.tags).toHaveLength(1)
    expect(result.tags[0].name).toBe('GA4 Event - view_item_list')
  })

  it('produces variables and trigger but NO tag for a SYSTEM entry', () => {
    const result = getEntitiesFromMasterMapping([systemEntry], 'G-TEST12345')

    expect(result.variables).toHaveLength(1)
    expect(result.triggers).toHaveLength(1)
    expect(result.tags).toHaveLength(0)
  })

  it('produces nothing for a SKIP entry', () => {
    const result = getEntitiesFromMasterMapping([skipEntry], 'G-TEST12345')

    expect(result.variables).toHaveLength(0)
    expect(result.triggers).toHaveLength(0)
    expect(result.tags).toHaveLength(0)
  })

  it('deduplicates variables shared across multiple events', () => {
    const entry2: MasterMappingEntry = {
      ...liveMappingEntry,
      id: 2,
      dataLayerEvent: 'select_item',
      ga4EventName: 'select_item',
      gtmTriggerName: 'CE - select_item',
      gtmTagName: 'GA4 Event - select_item',
      // Same variable as entry 1
      gtmVariables: [
        { dlvPath: 'ecommerce.items', gtmVarName: 'DLV - ecommerce.items' },
      ],
    }

    const result = getEntitiesFromMasterMapping([liveMappingEntry, entry2], 'G-TEST12345')

    // Only one variable even though two events reference it
    expect(result.variables).toHaveLength(1)
    expect(result.triggers).toHaveLength(2)
    expect(result.tags).toHaveLength(2)
  })
})

describe('getEntitiesFromAuditJson', () => {
  const masterEntries: MasterMappingEntry[] = [
    {
      id: 5,
      category: 'CART',
      dataLayerEvent: 'add_to_cart',
      ga4EventName: 'add_to_cart',
      whenItFires: 'test',
      status: 'LIVE',
      gtmVariables: [
        { dlvPath: 'ecommerce.currency', gtmVarName: 'DLV - ecommerce.currency' },
        { dlvPath: 'ecommerce.items', gtmVarName: 'DLV - ecommerce.items' },
      ],
      gtmTriggerName: 'CE - add_to_cart',
      gtmTagName: 'GA4 Event - add_to_cart',
      ga4Parameters: [
        { paramName: 'currency', gtmVarRef: '{{DLV - ecommerce.currency}}' },
        { paramName: 'items', gtmVarRef: '{{DLV - ecommerce.items}}' },
      ],
    },
  ]

  it('uses master mapping config when event name matches', () => {
    const audit: AuditJson = {
      'add_to_cart': { count: 5, variables: ['event', 'ecommerce.currency', 'ecommerce.items'] },
    }

    const result = getEntitiesFromAuditJson(audit, masterEntries, 'G-TEST12345')

    // Should use master mapping names, not auto-derived
    expect(result.triggers[0].name).toBe('CE - add_to_cart')
    expect(result.tags[0].name).toBe('GA4 Event - add_to_cart')
  })

  it('auto-derives config for events not in master mapping', () => {
    const audit: AuditJson = {
      'custom_event': { count: 1, variables: ['event', 'ecommerce.promo_id', 'some_field'] },
    }

    const result = getEntitiesFromAuditJson(audit, masterEntries, 'G-TEST12345')

    expect(result.triggers[0].name).toBe('CE - custom_event')
    expect(result.tags[0].name).toBe('GA4 Event - custom_event')
    // Variables auto-derived: "DLV - ecommerce.promo_id" and "DLV - some_field"
    expect(result.variables.map(v => v.name)).toContain('DLV - ecommerce.promo_id')
    expect(result.variables.map(v => v.name)).toContain('DLV - some_field')
  })

  it('filters out the "event" variable from audit data', () => {
    const audit: AuditJson = {
      'custom_event': { count: 1, variables: ['event', 'my_field'] },
    }

    const result = getEntitiesFromAuditJson(audit, masterEntries, 'G-TEST12345')

    // "event" should not become a variable
    expect(result.variables.map(v => v.name)).not.toContain('DLV - event')
    expect(result.variables).toHaveLength(1)
    expect(result.variables[0].name).toBe('DLV - my_field')
  })

  it('auto-derives GA4 param names by stripping ecommerce prefix', () => {
    const audit: AuditJson = {
      'unknown_event': { count: 1, variables: ['event', 'ecommerce.promotion_id'] },
    }

    const result = getEntitiesFromAuditJson(audit, masterEntries, 'G-TEST12345')

    // GA4 param should be "promotion_id" (ecommerce. prefix stripped)
    const tag = result.tags[0]
    const eventParamsList = tag.parameter.find(p => p.key === 'eventParameters')
    expect(eventParamsList).toBeDefined()
    if (eventParamsList && 'list' in eventParamsList) {
      const firstParam = eventParamsList.list[0]
      const nameParam = firstParam.map.find(m => m.key === 'name')
      expect(nameParam!.value).toBe('promotion_id')
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/services/inputParser.test.ts
```

Expected: FAIL — `Cannot find module './inputParser'`

- [ ] **Step 3: Write the implementation**

Create `src/services/inputParser.ts`:

```ts
// inputParser.ts — Parses audit JSON input and converts master mapping entries
// into flat lists of GTM entity payloads ready for the API.

import type {
  AuditJson,
  MasterMappingEntry,
  GtmVariablePayload,
  GtmTriggerPayload,
  GtmTagPayload,
} from '../types'
import {
  buildVariablePayload,
  buildTriggerPayload,
  buildGa4EventTagPayload,
} from './entityBuilder'

// --- Audit JSON parsing ---

type ParseResult =
  | { success: true; data: AuditJson }
  | { success: false; error: string }

export function parseAuditJson(raw: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { success: false, error: 'Invalid JSON. Check for syntax errors.' }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { success: false, error: 'Audit JSON must be an object with event names as keys, not an array.' }
  }

  const obj = parsed as Record<string, unknown>
  for (const [eventName, eventData] of Object.entries(obj)) {
    if (typeof eventData !== 'object' || eventData === null) {
      return { success: false, error: `Event "${eventName}" must be an object with count and variables.` }
    }
    const data = eventData as Record<string, unknown>
    if (!Array.isArray(data.variables)) {
      return { success: false, error: `Event "${eventName}" is missing a "variables" array.` }
    }
  }

  return { success: true, data: parsed as AuditJson }
}

// --- Entity list generation from master mapping ---

export interface EntityLists {
  variables: GtmVariablePayload[]
  triggers: GtmTriggerPayload[]
  tags: GtmTagPayload[]
}

export function getEntitiesFromMasterMapping(
  entries: MasterMappingEntry[],
  measurementId: string,
): EntityLists {
  const variables: GtmVariablePayload[] = []
  const triggers: GtmTriggerPayload[] = []
  const tags: GtmTagPayload[] = []
  const seenVariableNames = new Set<string>()

  for (const entry of entries) {
    if (entry.status === 'SKIP') continue

    // Build variables (deduplicate by name)
    for (const v of entry.gtmVariables) {
      if (!seenVariableNames.has(v.gtmVarName)) {
        seenVariableNames.add(v.gtmVarName)
        variables.push(buildVariablePayload(v))
      }
    }

    // Build trigger
    if (entry.gtmTriggerName) {
      triggers.push(buildTriggerPayload(entry.gtmTriggerName, entry.dataLayerEvent))
    }

    // Build tag (LIVE only — SYSTEM events get no GA4 Event tag)
    if (entry.status === 'LIVE' && entry.gtmTagName && entry.ga4EventName) {
      tags.push(buildGa4EventTagPayload(
        entry.gtmTagName,
        entry.ga4EventName,
        measurementId,
        entry.ga4Parameters,
        // Trigger ID placeholder — replaced at execution time after the trigger is created
        '__PENDING_TRIGGER_ID__',
      ))
    }
  }

  return { variables, triggers, tags }
}

// --- Entity list generation from audit JSON ---

// Auto-derives a GA4 parameter name from a data layer path.
// Strips "ecommerce." prefix and uses the last segment.
function deriveGa4ParamName(dlvPath: string): string {
  const stripped = dlvPath.startsWith('ecommerce.') ? dlvPath.slice('ecommerce.'.length) : dlvPath
  const segments = stripped.split('.')
  return segments[segments.length - 1]
}

export function getEntitiesFromAuditJson(
  audit: AuditJson,
  masterEntries: MasterMappingEntry[],
  measurementId: string,
): EntityLists {
  const variables: GtmVariablePayload[] = []
  const triggers: GtmTriggerPayload[] = []
  const tags: GtmTagPayload[] = []
  const seenVariableNames = new Set<string>()

  // Build a lookup from event name to master mapping entry
  const masterLookup = new Map<string, MasterMappingEntry>()
  for (const entry of masterEntries) {
    masterLookup.set(entry.dataLayerEvent, entry)
  }

  for (const [eventName, eventData] of Object.entries(audit)) {
    const masterEntry = masterLookup.get(eventName)

    if (masterEntry && masterEntry.status !== 'SKIP') {
      // Event found in master mapping — use its configuration
      for (const v of masterEntry.gtmVariables) {
        if (!seenVariableNames.has(v.gtmVarName)) {
          seenVariableNames.add(v.gtmVarName)
          variables.push(buildVariablePayload(v))
        }
      }

      if (masterEntry.gtmTriggerName) {
        triggers.push(buildTriggerPayload(masterEntry.gtmTriggerName, masterEntry.dataLayerEvent))
      }

      if (masterEntry.status === 'LIVE' && masterEntry.gtmTagName && masterEntry.ga4EventName) {
        tags.push(buildGa4EventTagPayload(
          masterEntry.gtmTagName,
          masterEntry.ga4EventName,
          measurementId,
          masterEntry.ga4Parameters,
          '__PENDING_TRIGGER_ID__',
        ))
      }
    } else if (!masterEntry) {
      // Event not in master mapping — auto-derive everything
      const variablePaths = eventData.variables.filter(v => v !== 'event')

      for (const path of variablePaths) {
        const varName = `DLV - ${path}`
        if (!seenVariableNames.has(varName)) {
          seenVariableNames.add(varName)
          variables.push(buildVariablePayload({ dlvPath: path, gtmVarName: varName }))
        }
      }

      triggers.push(buildTriggerPayload(`CE - ${eventName}`, eventName))

      const autoParams = variablePaths.map(path => ({
        paramName: deriveGa4ParamName(path),
        gtmVarRef: `{{DLV - ${path}}}`,
      }))

      tags.push(buildGa4EventTagPayload(
        `GA4 Event - ${eventName}`,
        eventName,
        measurementId,
        autoParams,
        '__PENDING_TRIGGER_ID__',
      ))
    }
    // If masterEntry exists but is SKIP, do nothing
  }

  return { variables, triggers, tags }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/services/inputParser.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/inputParser.ts src/services/inputParser.test.ts
git commit -m "feat: add input parser with master mapping lookup and auto-derivation"
```

---

## Task 10: Conflict Detection `[Opus]`

**Files:**
- Create: `src/services/conflictDetection.ts`, `src/services/conflictDetection.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/services/conflictDetection.test.ts`:

```ts
// conflictDetection.test.ts — Tests for classifying entities as WILL_CREATE, ALREADY_CORRECT, or CONFLICT.

import { describe, it, expect } from 'vitest'
import { detectConflicts } from './conflictDetection'
import type { GtmVariablePayload, GtmEntity, ConflictResult } from '../types'

// Helper to build a simple variable payload for tests
function makeVar(name: string, dlvPath: string): GtmVariablePayload {
  return {
    name,
    type: 'v',
    parameter: [
      { type: 'integer', key: 'dataLayerVersion', value: '2' },
      { type: 'boolean', key: 'setDefaultValue', value: 'false' },
      { type: 'template', key: 'name', value: dlvPath },
    ],
  }
}

// Helper to build a GtmEntity (simulating what the API returns for existing entities)
function makeExistingVar(name: string, dlvPath: string, path: string): GtmEntity {
  return {
    name,
    type: 'v',
    path,
    parameter: [
      { type: 'integer', key: 'dataLayerVersion', value: '2' },
      { type: 'boolean', key: 'setDefaultValue', value: 'false' },
      { type: 'template', key: 'name', value: dlvPath },
    ],
  }
}

describe('detectConflicts', () => {
  it('marks as WILL_CREATE when no existing entity matches by name', () => {
    const intended = [makeVar('DLV - ecommerce.items', 'ecommerce.items')]
    const existing: GtmEntity[] = []

    const results = detectConflicts(intended, existing, 'variable')

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('WILL_CREATE')
    expect(results[0].decision).toBeNull()
  })

  it('marks as ALREADY_CORRECT when existing entity matches name and parameters', () => {
    const intended = [makeVar('DLV - ecommerce.items', 'ecommerce.items')]
    const existing = [makeExistingVar('DLV - ecommerce.items', 'ecommerce.items', 'accounts/1/containers/2/workspaces/3/variables/4')]

    const results = detectConflicts(intended, existing, 'variable')

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('ALREADY_CORRECT')
    expect(results[0].existingEntity).toBeDefined()
  })

  it('marks as CONFLICT when name matches but parameters differ', () => {
    const intended = [makeVar('DLV - ecommerce.items', 'ecommerce.items')]
    const existing: GtmEntity[] = [{
      name: 'DLV - ecommerce.items',
      type: 'v',
      path: 'accounts/1/containers/2/workspaces/3/variables/4',
      parameter: [
        { type: 'integer', key: 'dataLayerVersion', value: '1' }, // Different version!
        { type: 'boolean', key: 'setDefaultValue', value: 'false' },
        { type: 'template', key: 'name', value: 'ecommerce.items' },
      ],
    }]

    const results = detectConflicts(intended, existing, 'variable')

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('CONFLICT')
    expect(results[0].decision).toBeNull()
    expect(results[0].existingEntity).toBeDefined()
  })

  it('marks as CONFLICT when name matches but type differs', () => {
    const intended = [makeVar('DLV - ecommerce.items', 'ecommerce.items')]
    const existing: GtmEntity[] = [{
      name: 'DLV - ecommerce.items',
      type: 'jsm', // JavaScript macro instead of Data Layer Variable
      path: 'accounts/1/containers/2/workspaces/3/variables/4',
      parameter: [],
    }]

    const results = detectConflicts(intended, existing, 'variable')

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('CONFLICT')
  })

  it('handles multiple entities with mixed statuses', () => {
    const intended = [
      makeVar('DLV - ecommerce.items', 'ecommerce.items'),
      makeVar('DLV - ecommerce.currency', 'ecommerce.currency'),
      makeVar('DLV - ecommerce.value', 'ecommerce.value'),
    ]
    const existing = [
      makeExistingVar('DLV - ecommerce.items', 'ecommerce.items', 'path/1'),       // match
      makeExistingVar('DLV - ecommerce.currency', 'ecommerce.NOT_currency', 'path/2'), // conflict
      // ecommerce.value not present — will create
    ]

    const results = detectConflicts(intended, existing, 'variable')

    expect(results).toHaveLength(3)
    expect(results.find(r => r.entityName === 'DLV - ecommerce.items')!.status).toBe('ALREADY_CORRECT')
    expect(results.find(r => r.entityName === 'DLV - ecommerce.currency')!.status).toBe('CONFLICT')
    expect(results.find(r => r.entityName === 'DLV - ecommerce.value')!.status).toBe('WILL_CREATE')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/services/conflictDetection.test.ts
```

Expected: FAIL — `Cannot find module './conflictDetection'`

- [ ] **Step 3: Write the implementation**

Create `src/services/conflictDetection.ts`:

```ts
// conflictDetection.ts — Compares intended GTM entities against existing ones in the workspace.
// Classifies each as WILL_CREATE (new), ALREADY_CORRECT (identical), or CONFLICT (same name, different config).

import type {
  GtmVariablePayload,
  GtmTriggerPayload,
  GtmTagPayload,
  GtmEntity,
  GtmParameter,
  ConflictResult,
  EntityType,
} from '../types'

type IntendedPayload = GtmVariablePayload | GtmTriggerPayload | GtmTagPayload

// Deep-compares two parameter arrays, ignoring order.
function parametersMatch(intended: GtmParameter[], existing: GtmParameter[] | undefined): boolean {
  if (!existing) return intended.length === 0

  if (intended.length !== existing.length) return false

  // Sort both by key for order-independent comparison
  const sortByKey = (a: GtmParameter, b: GtmParameter) => a.key.localeCompare(b.key)
  const sortedIntended = [...intended].sort(sortByKey)
  const sortedExisting = [...existing].sort(sortByKey)

  return sortedIntended.every((param, i) =>
    param.type === sortedExisting[i].type &&
    param.key === sortedExisting[i].key &&
    param.value === sortedExisting[i].value
  )
}

// Checks if an intended payload matches an existing entity's config.
function entitiesMatch(intended: IntendedPayload, existing: GtmEntity): boolean {
  if (intended.type !== existing.type) return false

  if ('parameter' in intended && intended.parameter) {
    // For variables and tags, compare the parameter arrays.
    // Only compare simple GtmParameter entries (not nested list types like eventParameters).
    const simpleParams = intended.parameter.filter(
      (p): p is GtmParameter => typeof p.value === 'string'
    )
    return parametersMatch(simpleParams, existing.parameter)
  }

  if ('customEventFilter' in intended) {
    // For triggers, compare the custom event filter.
    const intentedFilter = intended.customEventFilter?.[0]?.parameter
    const existingFilter = existing.customEventFilter?.[0]?.parameter
    if (!intentedFilter && !existingFilter) return true
    if (!intentedFilter || !existingFilter) return false
    return parametersMatch(intentedFilter, existingFilter)
  }

  return true
}

export function detectConflicts(
  intended: IntendedPayload[],
  existing: GtmEntity[],
  entityType: EntityType,
): ConflictResult[] {
  // Build lookup of existing entities by name (case-sensitive exact match)
  const existingByName = new Map<string, GtmEntity>()
  for (const entity of existing) {
    existingByName.set(entity.name, entity)
  }

  return intended.map(payload => {
    const existingEntity = existingByName.get(payload.name)

    if (!existingEntity) {
      return {
        entityName: payload.name,
        entityType,
        status: 'WILL_CREATE' as const,
        decision: null,
        intendedPayload: payload,
      }
    }

    if (entitiesMatch(payload, existingEntity)) {
      return {
        entityName: payload.name,
        entityType,
        status: 'ALREADY_CORRECT' as const,
        decision: null,
        intendedPayload: payload,
        existingEntity,
      }
    }

    return {
      entityName: payload.name,
      entityType,
      status: 'CONFLICT' as const,
      decision: null,
      intendedPayload: payload,
      existingEntity,
    }
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/services/conflictDetection.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/conflictDetection.ts src/services/conflictDetection.test.ts
git commit -m "feat: add conflict detection engine with name matching and parameter comparison"
```

---

## Task 11: GTM API Service — Auth Helper `[Sonnet]`

**Files:**
- Create: `src/services/auth.ts`, `src/services/auth.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/services/auth.test.ts`:

```ts
// auth.test.ts — Tests for OAuth URL construction and token parsing.

import { describe, it, expect } from 'vitest'
import { buildOAuthUrl, parseTokenFromHash } from './auth'

describe('buildOAuthUrl', () => {
  it('builds a correct Google OAuth URL with required params', () => {
    const url = buildOAuthUrl('test-client-id.apps.googleusercontent.com', 'http://localhost:5173')

    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url).toContain('client_id=test-client-id.apps.googleusercontent.com')
    expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A5173')
    expect(url).toContain('response_type=token')
    expect(url).toContain('scope=')
    expect(url).toContain('tagmanager.edit.containers')
    expect(url).toContain('tagmanager.readonly')
  })
})

describe('parseTokenFromHash', () => {
  it('extracts access_token from URL hash', () => {
    const hash = '#access_token=ya29.test-token-12345&token_type=Bearer&expires_in=3600'
    const result = parseTokenFromHash(hash)

    expect(result).toBe('ya29.test-token-12345')
  })

  it('returns null when no access_token in hash', () => {
    const result = parseTokenFromHash('#error=access_denied')

    expect(result).toBeNull()
  })

  it('returns null for empty hash', () => {
    const result = parseTokenFromHash('')

    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/services/auth.test.ts
```

Expected: FAIL — `Cannot find module './auth'`

- [ ] **Step 3: Write the implementation**

Create `src/services/auth.ts`:

```ts
// auth.ts — Google OAuth 2.0 implicit flow for GTM API access.
// Uses the implicit flow (response_type=token) because this is a client-side app with no backend.
// The access token is returned in the URL hash fragment and never sent to any server.

const OAUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'

const SCOPES = [
  'https://www.googleapis.com/auth/tagmanager.edit.containers',
  'https://www.googleapis.com/auth/tagmanager.readonly',
]

export function buildOAuthUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: SCOPES.join(' '),
    include_granted_scopes: 'true',
  })
  return `${OAUTH_ENDPOINT}?${params.toString()}`
}

export function parseTokenFromHash(hash: string): string | null {
  if (!hash || hash.length < 2) return null

  // Remove leading '#' and parse as URL search params
  const params = new URLSearchParams(hash.substring(1))
  return params.get('access_token')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/services/auth.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/auth.ts src/services/auth.test.ts
git commit -m "feat: add OAuth URL builder and token parser"
```

---

## Task 12: GTM API Service — API Calls `[Opus]`

**Files:**
- Create: `src/services/gtmApi.ts`, `src/services/gtmApi.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/services/gtmApi.test.ts`:

```ts
// gtmApi.test.ts — Tests for GTM API v2 calls.
// All tests use mocked fetch — we never call the real Google API in tests.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listAccounts, listContainers, listWorkspaces, createWorkspace, listVariables, createVariable, createTrigger, createTag, updateVariable, updateTrigger, updateTag } from './gtmApi'

const mockToken = 'ya29.fake-token'

beforeEach(() => {
  vi.restoreAllMocks()
})

function mockFetch(responseBody: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(responseBody),
    text: () => Promise.resolve(JSON.stringify(responseBody)),
  } as Response)
}

describe('listAccounts', () => {
  it('calls the correct endpoint and returns account list', async () => {
    const mockResponse = {
      account: [
        { accountId: '123', name: 'Test Account', path: 'accounts/123' },
      ],
    }
    const fetchSpy = mockFetch(mockResponse)

    const result = await listAccounts(mockToken)

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://www.googleapis.com/tagmanager/v2/accounts',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer ya29.fake-token',
        }),
      }),
    )
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Test Account')
  })

  it('returns empty array when no accounts', async () => {
    mockFetch({})

    const result = await listAccounts(mockToken)
    expect(result).toEqual([])
  })
})

describe('listContainers', () => {
  it('calls correct endpoint with account path', async () => {
    const mockResponse = {
      container: [
        { containerId: '456', name: 'Web Container', path: 'accounts/123/containers/456', publicId: 'GTM-ABC' },
      ],
    }
    const fetchSpy = mockFetch(mockResponse)

    const result = await listContainers(mockToken, 'accounts/123')

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://www.googleapis.com/tagmanager/v2/accounts/123/containers',
      expect.any(Object),
    )
    expect(result).toHaveLength(1)
    expect(result[0].publicId).toBe('GTM-ABC')
  })
})

describe('createWorkspace', () => {
  it('sends correct payload and returns workspace', async () => {
    const mockResponse = { workspaceId: '789', name: 'S4D Automation - 2026-04-20', path: 'accounts/1/containers/2/workspaces/789' }
    const fetchSpy = mockFetch(mockResponse)

    const result = await createWorkspace(mockToken, 'accounts/1/containers/2', 'S4D Automation - 2026-04-20')

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://www.googleapis.com/tagmanager/v2/accounts/1/containers/2/workspaces',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.name).toBe('S4D Automation - 2026-04-20')
  })
})

describe('retry on 429', () => {
  it('retries with backoff on rate limit and succeeds', async () => {
    const rateLimitResponse = { ok: false, status: 429, json: () => Promise.resolve({}), text: () => Promise.resolve('rate limited') } as Response
    const successResponse = { ok: true, status: 200, json: () => Promise.resolve({ account: [] }), text: () => Promise.resolve('{}') } as Response

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(successResponse)

    // Use a short delay for testing
    const result = await listAccounts(mockToken)

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(result).toEqual([])
  })
})

describe('403 error', () => {
  it('throws an error with a helpful message on 403', async () => {
    mockFetch({ error: { message: 'Forbidden' } }, 403)

    await expect(listAccounts(mockToken)).rejects.toThrow(
      'You need Editor access to this container. Ask the owner to grant it.',
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/services/gtmApi.test.ts
```

Expected: FAIL — `Cannot find module './gtmApi'`

- [ ] **Step 3: Write the implementation**

Create `src/services/gtmApi.ts`:

```ts
// gtmApi.ts — All GTM API v2 calls. Every function takes an access token and returns typed results.
// Handles rate limiting (429) with exponential backoff and surfaces helpful error messages.

import type {
  GtmAccount,
  GtmContainer,
  GtmWorkspace,
  GtmEntity,
  GtmVariablePayload,
  GtmTriggerPayload,
  GtmTagPayload,
} from '../types'

const BASE_URL = 'https://www.googleapis.com/tagmanager/v2'
const MAX_RETRIES = 3

// --- Internal fetch wrapper with retry logic ---

async function gtmFetch(token: string, url: string, options: RequestInit = {}): Promise<unknown> {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, { ...options, headers })

    if (response.ok) {
      return response.json()
    }

    if (response.status === 403) {
      throw new Error('You need Editor access to this container. Ask the owner to grant it.')
    }

    if (response.status === 429 && attempt < MAX_RETRIES) {
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
      lastError = new Error(`Rate limited (attempt ${attempt + 1} of ${MAX_RETRIES})`)
      continue
    }

    const text = await response.text()
    throw new Error(`GTM API error ${response.status}: ${text}`)
  }

  throw lastError || new Error('GTM API request failed after retries')
}

// --- Public API functions ---

export async function listAccounts(token: string): Promise<GtmAccount[]> {
  const data = await gtmFetch(token, `${BASE_URL}/accounts`) as { account?: GtmAccount[] }
  return data.account || []
}

export async function listContainers(token: string, accountPath: string): Promise<GtmContainer[]> {
  const data = await gtmFetch(token, `${BASE_URL}/${accountPath}/containers`) as { container?: GtmContainer[] }
  return data.container || []
}

export async function listWorkspaces(token: string, containerPath: string): Promise<GtmWorkspace[]> {
  const data = await gtmFetch(token, `${BASE_URL}/${containerPath}/workspaces`) as { workspace?: GtmWorkspace[] }
  return data.workspace || []
}

export async function createWorkspace(token: string, containerPath: string, name: string): Promise<GtmWorkspace> {
  return await gtmFetch(token, `${BASE_URL}/${containerPath}/workspaces`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  }) as GtmWorkspace
}

export async function listVariables(token: string, workspacePath: string): Promise<GtmEntity[]> {
  const data = await gtmFetch(token, `${BASE_URL}/${workspacePath}/variables`) as { variable?: GtmEntity[] }
  return data.variable || []
}

export async function listTriggers(token: string, workspacePath: string): Promise<GtmEntity[]> {
  const data = await gtmFetch(token, `${BASE_URL}/${workspacePath}/triggers`) as { trigger?: GtmEntity[] }
  return data.trigger || []
}

export async function listTags(token: string, workspacePath: string): Promise<GtmEntity[]> {
  const data = await gtmFetch(token, `${BASE_URL}/${workspacePath}/tags`) as { tag?: GtmEntity[] }
  return data.tag || []
}

export async function createVariable(token: string, workspacePath: string, payload: GtmVariablePayload): Promise<GtmEntity> {
  return await gtmFetch(token, `${BASE_URL}/${workspacePath}/variables`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as GtmEntity
}

export async function createTrigger(token: string, workspacePath: string, payload: GtmTriggerPayload): Promise<GtmEntity> {
  return await gtmFetch(token, `${BASE_URL}/${workspacePath}/triggers`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as GtmEntity
}

export async function createTag(token: string, workspacePath: string, payload: GtmTagPayload): Promise<GtmEntity> {
  return await gtmFetch(token, `${BASE_URL}/${workspacePath}/tags`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as GtmEntity
}

export async function updateVariable(token: string, entityPath: string, payload: GtmVariablePayload): Promise<GtmEntity> {
  return await gtmFetch(token, `${BASE_URL}/${entityPath}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }) as GtmEntity
}

export async function updateTrigger(token: string, entityPath: string, payload: GtmTriggerPayload): Promise<GtmEntity> {
  return await gtmFetch(token, `${BASE_URL}/${entityPath}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }) as GtmEntity
}

export async function updateTag(token: string, entityPath: string, payload: GtmTagPayload): Promise<GtmEntity> {
  return await gtmFetch(token, `${BASE_URL}/${entityPath}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }) as GtmEntity
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/services/gtmApi.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/gtmApi.ts src/services/gtmApi.test.ts
git commit -m "feat: add GTM API service with retry logic and typed responses"
```

---

## Task 13: App Shell — Wizard Navigation `[Opus]`

**Files:**
- Modify: `src/App.tsx`
- Create: `src/App.test.tsx`, `src/App.css`

- [ ] **Step 1: Write the failing tests**

Create `src/App.test.tsx`:

```tsx
// App.test.tsx — Tests for the wizard shell navigation.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App wizard shell', () => {
  it('renders step 1 (auth) by default', () => {
    render(<App />)
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
  })

  it('shows the app title', () => {
    render(<App />)
    expect(screen.getByText('GTM Automation Tool')).toBeInTheDocument()
  })

  it('shows step indicator', () => {
    render(<App />)
    expect(screen.getByText(/Step 1/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/App.test.tsx
```

Expected: FAIL — no "Sign in with Google" text in the placeholder App.

- [ ] **Step 3: Build the wizard shell**

Replace `src/App.tsx`:

```tsx
// App.tsx — Wizard shell. Manages the current step, authentication state, and provides
// the LogProvider context to all child components.

import { useState } from 'react'
import { LogProvider } from './logging/LogContext'
import type { GtmContainer, GtmWorkspace, ConflictResult, SessionInfo } from './types'
import type { EntityLists } from './services/inputParser'
import './App.css'

const STEP_LABELS = [
  '1. Authenticate',
  '2. Select Container',
  '3. Provide Input',
  '4. Preview',
  '5. Execute',
]

function App() {
  const [currentStep, setCurrentStep] = useState(1)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [selectedContainer, setSelectedContainer] = useState<GtmContainer | null>(null)
  const [workspace, setWorkspace] = useState<GtmWorkspace | null>(null)
  const [measurementId, setMeasurementId] = useState('')
  const [entityLists, setEntityLists] = useState<EntityLists | null>(null)
  const [conflictResults, setConflictResults] = useState<ConflictResult[]>([])
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)

  return (
    <LogProvider>
      <div className="app">
        <header className="app-header">
          <h1>GTM Automation Tool</h1>
          <div className="step-indicator">
            {STEP_LABELS.map((label, i) => (
              <span
                key={label}
                className={`step-label ${i + 1 === currentStep ? 'active' : ''} ${i + 1 < currentStep ? 'completed' : ''}`}
              >
                {label}
              </span>
            ))}
          </div>
        </header>

        <main className="app-main">
          {currentStep === 1 && (
            <div className="step-content">
              <h2>Step 1 of 5</h2>
              <p>Sign in with your Google account to access GTM containers.</p>
              <button className="btn-primary">Sign in with Google</button>
            </div>
          )}

          {currentStep === 2 && (
            <div className="step-content">
              <h2>Step 2 of 5</h2>
              <p>Select container placeholder</p>
            </div>
          )}

          {currentStep === 3 && (
            <div className="step-content">
              <h2>Step 3 of 5</h2>
              <p>Input placeholder</p>
            </div>
          )}

          {currentStep === 4 && (
            <div className="step-content">
              <h2>Step 4 of 5</h2>
              <p>Preview placeholder</p>
            </div>
          )}

          {currentStep === 5 && (
            <div className="step-content">
              <h2>Step 5 of 5</h2>
              <p>Execute placeholder</p>
            </div>
          )}
        </main>
      </div>
    </LogProvider>
  )
}

export default App
```

Create `src/App.css`:

```css
/* App.css — Global styles for the GTM Automation Tool wizard. */

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  color: #333;
}

.app {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem;
}

.app-header {
  margin-bottom: 2rem;
}

.app-header h1 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

.step-indicator {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.step-label {
  font-size: 0.875rem;
  color: #999;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.step-label.active {
  color: #1a73e8;
  font-weight: 600;
  background: #e8f0fe;
}

.step-label.completed {
  color: #34a853;
}

.app-main {
  background: #fff;
  border-radius: 8px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.step-content h2 {
  font-size: 1.125rem;
  margin-bottom: 1rem;
  color: #666;
}

.btn-primary {
  background: #1a73e8;
  color: #fff;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
}

.btn-primary:hover {
  background: #1557b0;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/App.test.tsx
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Verify visually**

```bash
npm run dev
```

Open `http://localhost:5173`. Verify: title, step indicators, step 1 content with "Sign in with Google" button.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/App.css
git commit -m "feat: add wizard shell with step navigation and LogProvider"
```

---

## Task 14: Shared Component — LogPanel `[Sonnet]`

**Files:**
- Create: `src/components/shared/LogPanel.tsx`, `src/components/shared/LogPanel.test.tsx`, `src/components/shared/LogPanel.css`

- [ ] **Step 1: Write the failing tests**

Create `src/components/shared/LogPanel.test.tsx`:

```tsx
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

    // Time portion "12:34:01" should be visible
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

    // After collapsing, entries should not be visible
    expect(screen.queryByText(/User authenticated/)).not.toBeVisible()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/shared/LogPanel.test.tsx
```

Expected: FAIL — `Cannot find module './LogPanel'`

- [ ] **Step 3: Write the implementation**

Create `src/components/shared/LogPanel.tsx`:

```tsx
// LogPanel.tsx — On-screen activity log panel shown during preview and execution.
// Displays log entries with color coding by level. Collapsible.

import { useRef, useEffect, useState } from 'react'
import type { LogEntry } from '../../types'
import './LogPanel.css'

interface LogPanelProps {
  entries: readonly LogEntry[]
}

// Extracts "HH:MM:SS" from "YYYY-MM-DD HH:MM:SS"
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

  // Auto-scroll to bottom when new entries arrive
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
```

Create `src/components/shared/LogPanel.css`:

```css
/* LogPanel.css — Styles for the on-screen activity log panel. */

.log-panel {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  margin-top: 1.5rem;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.8125rem;
}

.log-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: #fafafa;
  border-bottom: 1px solid #e0e0e0;
}

.log-panel-title {
  font-weight: 600;
  font-size: 0.875rem;
}

.log-panel-toggle {
  background: none;
  border: 1px solid #ccc;
  border-radius: 3px;
  padding: 0.2rem 0.5rem;
  cursor: pointer;
  font-size: 0.75rem;
}

.log-panel-body {
  max-height: 300px;
  overflow-y: auto;
  padding: 0.5rem;
}

.log-entry {
  display: flex;
  gap: 0.5rem;
  padding: 0.15rem 0;
  line-height: 1.4;
}

.log-time { color: #888; min-width: 60px; }
.log-source { color: #666; min-width: 90px; }
.log-level { min-width: 55px; font-weight: 600; }
.log-message { flex: 1; }

.log-info .log-level { color: #888; }
.log-success .log-level, .log-success .log-message { color: #34a853; }
.log-warn .log-level, .log-warn .log-message { color: #ea8600; }
.log-error .log-level, .log-error .log-message { color: #d93025; }

.log-empty { color: #999; padding: 0.5rem 0; font-style: italic; }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/shared/LogPanel.test.tsx
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/LogPanel.tsx src/components/shared/LogPanel.test.tsx src/components/shared/LogPanel.css
git commit -m "feat: add on-screen log panel component with collapse/expand"
```

---

## Task 15: Shared Component — SummaryBar `[Sonnet]`

**Files:**
- Create: `src/components/shared/SummaryBar.tsx`, `src/components/shared/SummaryBar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/shared/SummaryBar.test.tsx`:

```tsx
// SummaryBar.test.tsx — Tests for the conflict summary bar.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SummaryBar } from './SummaryBar'

describe('SummaryBar', () => {
  it('shows create, conflict, and correct counts', () => {
    render(<SummaryBar toCreate={5} conflicts={2} skipped={1} toOverwrite={1} alreadyCorrect={3} />)

    expect(screen.getByText(/5 to create/)).toBeInTheDocument()
    expect(screen.getByText(/2 conflicts/)).toBeInTheDocument()
    expect(screen.getByText(/3 already correct/)).toBeInTheDocument()
  })

  it('shows skipped and overwrite breakdown within conflicts', () => {
    render(<SummaryBar toCreate={0} conflicts={4} skipped={3} toOverwrite={1} alreadyCorrect={0} />)

    expect(screen.getByText(/3 skipped/)).toBeInTheDocument()
    expect(screen.getByText(/1 to overwrite/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/shared/SummaryBar.test.tsx
```

Expected: FAIL — `Cannot find module './SummaryBar'`

- [ ] **Step 3: Write the implementation**

Create `src/components/shared/SummaryBar.tsx`:

```tsx
// SummaryBar.tsx — Shows a one-line summary of conflict detection results.
// "X to create, Y conflicts (N skipped / M to overwrite), Z already correct"

interface SummaryBarProps {
  toCreate: number
  conflicts: number
  skipped: number
  toOverwrite: number
  alreadyCorrect: number
}

export function SummaryBar({ toCreate, conflicts, skipped, toOverwrite, alreadyCorrect }: SummaryBarProps) {
  return (
    <div className="summary-bar" style={{
      padding: '0.75rem 1rem',
      background: '#f0f4f9',
      borderRadius: '4px',
      fontSize: '0.9rem',
      marginBottom: '1rem',
    }}>
      <span style={{ color: '#34a853', fontWeight: 600 }}>{toCreate} to create</span>
      {' — '}
      <span style={{ color: '#ea8600', fontWeight: 600 }}>{conflicts} conflicts</span>
      {conflicts > 0 && (
        <span style={{ color: '#666' }}> ({skipped} skipped / {toOverwrite} to overwrite)</span>
      )}
      {' — '}
      <span style={{ color: '#888' }}>{alreadyCorrect} already correct</span>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/shared/SummaryBar.test.tsx
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/SummaryBar.tsx src/components/shared/SummaryBar.test.tsx
git commit -m "feat: add conflict summary bar component"
```

---

## Tasks 16-20: Wizard Step Components `[Mixed — see individual tasks]`

Each wizard step (Step1Auth through Step5Execute) follows the same pattern:

1. Write failing tests for the component's key behaviors
2. Implement the component
3. Run tests to verify
4. Visually verify with `npm run dev`
5. Commit

These are the largest remaining tasks. Each step component wires together the services built in Tasks 3-12 with the shared components from Tasks 14-15. They contain UI logic (form handling, dropdowns, buttons) but no business logic — that lives in the services.

**Due to the size of each step component, these tasks should be implemented one at a time using the subagent-driven-development skill.** Each step component is independent and can be built and tested in isolation. The implementation details for each step are fully specified in:

- **Spec Section 8** — User Flow (what each step does)
- **Spec Section 9** — GTM API Integration (which API calls each step triggers)
- **Spec Section 10** — Conflict Detection Logic (Step 4 behavior)
- **Spec Section 11** — Logging Architecture (what to log and when)
- **Spec Section 14** — Error Handling (error messages per step)

### Task 16: Step1Auth Component `[Sonnet]`

**Files:**
- Create: `src/components/Step1Auth.tsx`, `src/components/Step1Auth.test.tsx`, `src/components/Step1Auth.css`

**Key behaviors to test:**
- [ ] Shows "Sign in with Google" button
- [ ] On click, redirects to Google OAuth URL
- [ ] On return with token in URL hash, calls `onAuthenticated(token)` callback
- [ ] On error (no token in hash), shows error message
- [ ] Logs auth events via logger

### Task 17: Step2Container Component `[Opus]`

**Files:**
- Create: `src/components/Step2Container.tsx`, `src/components/Step2Container.test.tsx`, `src/components/Step2Container.css`

**Key behaviors to test:**
- [ ] Fetches and displays account list on mount
- [ ] On account selection, fetches and displays container list
- [ ] Validates GA4 Measurement ID format (`G-XXXXXXXXXX`)
- [ ] Rejects invalid Measurement ID with inline error
- [ ] "Next" button disabled until account, container, and valid Measurement ID are set
- [ ] Checks workspace count and warns if at limit
- [ ] Creates dated workspace on "Next" click
- [ ] Logs all API calls and results

### Task 18: Step3Input Component `[Opus]`

**Files:**
- Create: `src/components/Step3Input.tsx`, `src/components/Step3Input.test.tsx`, `src/components/Step3Input.css`

**Key behaviors to test:**
- [ ] Toggles between "S4D Standard" and "Custom JSON" modes
- [ ] In S4D Standard mode, shows entity count from master mapping
- [ ] In Custom JSON mode, shows textarea and file upload
- [ ] Validates pasted JSON inline, shows parse errors
- [ ] On valid JSON, shows detected event count
- [ ] "Run Dry Run" button disabled until input is valid
- [ ] Logs input validation results

### Task 19: Step4Preview Component `[Opus]`

**Files:**
- Create: `src/components/Step4Preview.tsx`, `src/components/Step4Preview.test.tsx`, `src/components/Step4Preview.css`

**Key behaviors to test:**
- [ ] Shows three collapsible sections: Will Create (green), Conflict (amber), Already Correct (gray)
- [ ] Each conflict row has Skip/Overwrite buttons
- [ ] "Apply Changes" button disabled until all conflicts have decisions
- [ ] Shows SummaryBar with correct counts
- [ ] Shows LogPanel with conflict detection progress
- [ ] Logs each conflict detection result

### Task 20: Step5Execute Component `[Opus]`

**Files:**
- Create: `src/components/Step5Execute.tsx`, `src/components/Step5Execute.test.tsx`, `src/components/Step5Execute.css`

**Key behaviors to test:**
- [ ] Shows progress: Variables -> Triggers -> Tags
- [ ] On completion, shows results table (Entity Name, Type, Action, Error)
- [ ] Shows "Download Log" button that exports session log as .txt
- [ ] Shows "Open GTM Container" link
- [ ] Shows "Start New Onboarding" button that resets to Step 2
- [ ] Stops on first failure, shows partial results
- [ ] Shows LogPanel with real-time execution progress
- [ ] Logs every create/update/skip/error

---

## Task 21: Integration — Wire Steps Into App Shell `[Opus]`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Write integration test**

Add to `src/App.test.tsx`:

```tsx
it('state flows between steps correctly', () => {
  // This is a smoke test — render the app, verify it doesn't crash,
  // and the initial state shows Step 1.
  render(<App />)
  expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
  expect(screen.getByText(/Step 1/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Wire step components into App.tsx**

Replace the placeholder `{currentStep === N && ...}` blocks in `App.tsx` with the real step components, passing the required props (state, callbacks) from App state down to each step.

- [ ] **Step 3: Run full test suite**

```bash
npm run test:run
```

Expected: All tests PASS.

- [ ] **Step 4: Visual end-to-end check**

```bash
npm run dev
```

Walk through the wizard manually (auth will fail without a real Google Client ID, but all other steps should render and be navigable using the mocked/placeholder state).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: wire all step components into the wizard shell"
```

---

## Task 22: GA4 Configuration Tag Integration `[Opus]`

**Files:**
- Modify: `src/components/Step5Execute.tsx`

The GA4 Configuration Tag is created once per session, before any event tags. This is a special case handled in the execution step.

- [ ] **Step 1: Add test for GA4 Config tag creation**

In `Step5Execute.test.tsx`, add a test that verifies the GA4 Configuration Tag is created first (or detected as existing), before any GA4 Event Tags.

- [ ] **Step 2: Implement in Step5Execute**

At the start of execution, before creating event tags:
1. Check if a "GA4 - Configuration TAG" already exists
2. If not, create it using `buildGa4ConfigTagPayload(measurementId)`
3. If it exists with a different Measurement ID, it was flagged as a conflict in Step 4 — respect the user's skip/overwrite decision
4. Log the result

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/components/Step5Execute.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/Step5Execute.tsx src/components/Step5Execute.test.tsx
git commit -m "feat: add GA4 Configuration Tag creation in execution step"
```

---

## Task 23: Final Polish and Full Test Run `[Sonnet]`

**Files:**
- All files

- [ ] **Step 1: Run the full test suite**

```bash
npm run test:run
```

Expected: All tests PASS, no warnings.

- [ ] **Step 2: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Build for production**

```bash
npm run build
```

Expected: Build succeeds with no errors. Output in `dist/`.

- [ ] **Step 4: Preview the production build**

```bash
npm run preview
```

Open the preview URL. Walk through the wizard visually to check layout, step indicators, and styles.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final polish — all tests pass, production build succeeds"
```
