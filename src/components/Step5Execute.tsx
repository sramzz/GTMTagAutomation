// Step5Execute.tsx — Step 5: executes GTM API calls sequentially, shows progress, results table, and post-execution CTAs.

import { useState, useEffect, useRef } from 'react'
import { useLog } from '../logging/LogContext'
import { downloadLogFile } from '../logging/logExport'
import { LogPanel } from './shared/LogPanel'
import { executeAll, type ExecutionOutcome } from '../services/executeEntities'
import type { ConflictResult, ExecutionResult, SessionInfo, EntityType } from '../types'
import './Step5Execute.css'

interface Step5ExecuteProps {
  accessToken: string
  workspacePath: string
  containerPublicId: string
  measurementId: string
  conflictResults: ConflictResult[]
  sessionInfo: SessionInfo
  onStartNewOnboarding: () => void
}

type Phase = 'variable' | 'trigger' | 'tag'

/** Determine which phase is currently active based on the latest result processed. */
function currentPhase(results: ExecutionResult[]): Phase {
  if (results.length === 0) return 'variable'
  const last = results[results.length - 1]
  return last.entityType
}

export function Step5Execute({
  accessToken, workspacePath, containerPublicId, measurementId, conflictResults, sessionInfo, onStartNewOnboarding,
}: Step5ExecuteProps) {
  const { logger, entries } = useLog()
  const [results, setResults] = useState<ExecutionResult[]>([])
  const [outcome, setOutcome] = useState<ExecutionOutcome | null>(null)
  const [activePhase, setActivePhase] = useState<Phase>('variable')
  const executedRef = useRef(false)

  useEffect(() => {
    // Guard against React strict-mode double-mount
    if (executedRef.current) return
    executedRef.current = true
    runExecution()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function runExecution() {
    const executionOutcome = await executeAll(
      conflictResults,
      accessToken,
      workspacePath,
      logger,
      (progressResults) => {
        setResults(progressResults)
        setActivePhase(currentPhase(progressResults))
      },
      measurementId,
    )
    setOutcome(executionOutcome)
  }

  function handleDownloadLog() {
    downloadLogFile(sessionInfo, entries)
  }

  const gtmUrl = `https://tagmanager.google.com/#/container/${containerPublicId}`
  const done = outcome !== null

  return (
    <div className="step5-container">
      <h2>Step 5 of 5</h2>

      <ProgressBar activePhase={activePhase} done={done} stopped={outcome?.stopped ?? false} />

      {outcome?.stopped && (
        <div className="step5-stopped" role="alert">
          Stopped at {outcome.stoppedAt}. {outcome.successCount} item{outcome.successCount !== 1 ? 's' : ''} created successfully. Review the log and retry — already-created items will be detected as &quot;Already Correct&quot;.
        </div>
      )}

      {results.length > 0 && <ResultsTable results={results} />}

      {done && (
        <div className="step5-actions">
          <button className="btn-secondary" onClick={handleDownloadLog}>Download Log</button>
          <a className="btn-primary step5-gtm-link" href={gtmUrl} target="_blank" rel="noopener noreferrer">
            Open GTM Container
          </a>
          <button className="btn-secondary" onClick={onStartNewOnboarding}>Start New Onboarding</button>
        </div>
      )}

      <LogPanel entries={entries} />
    </div>
  )
}

// --- Progress bar sub-component ---

const PHASES: { key: Phase; label: string }[] = [
  { key: 'variable', label: 'Variables' },
  { key: 'trigger', label: 'Triggers' },
  { key: 'tag', label: 'Tags' },
]

function ProgressBar({ activePhase, done, stopped }: { activePhase: Phase; done: boolean; stopped: boolean }) {
  const phaseOrder: Record<Phase, number> = { variable: 0, trigger: 1, tag: 2 }
  const activeIndex = phaseOrder[activePhase]

  return (
    <div className="step5-progress">
      {PHASES.map(({ key, label }, i) => {
        let status = 'pending'
        if (done && !stopped) status = 'done'
        else if (i < activeIndex) status = 'done'
        else if (i === activeIndex) status = 'active'
        return (
          <div key={key} className={`step5-phase step5-phase--${status}`}>
            <span className="step5-phase-label">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

// --- Results table sub-component ---

function ResultsTable({ results }: { results: ExecutionResult[] }) {
  return (
    <div className="step5-results">
      <h3>Results</h3>
      <table className="step5-results-table">
        <thead>
          <tr>
            <th>Entity Name</th>
            <th>Type</th>
            <th>Action</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={i} className={`step5-row--${r.action.toLowerCase()}`}>
              <td>{r.entityName}</td>
              <td>{r.entityType}</td>
              <td>{r.action}</td>
              <td>{r.errorMessage || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
