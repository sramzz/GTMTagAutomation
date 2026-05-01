// Step3Input.tsx — Step 3 of the wizard: choose S4D Standard mapping or paste Custom JSON.
// Validates input and computes entity lists before triggering the dry run.

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useLog } from '../logging/LogContext'
import {
  getEntitiesFromMasterMapping,
  parseAuditJson,
  getEntitiesFromAuditJson,
  type EntityLists,
} from '../services/inputParser'
import masterMapping from '../data/masterMapping.json'
import type { MasterMappingEntry, AuditJson } from '../types'
import './Step3Input.css'

interface Step3InputProps {
  measurementId: string
  onEntitiesReady: (entities: EntityLists) => void
}

type InputMode = 'standard' | 'custom'

const entries = (masterMapping as { events: MasterMappingEntry[] }).events

export function Step3Input({ measurementId, onEntitiesReady }: Step3InputProps) {
  const { logger } = useLog()

  const [mode, setMode] = useState<InputMode>('standard')
  const [customJson, setCustomJson] = useState('')
  const [parseError, setParseError] = useState('')
  const [parsedAudit, setParsedAudit] = useState<AuditJson | null>(null)
  const [eventCount, setEventCount] = useState<number | null>(null)

  // Memoize so entity computation only reruns when measurementId changes
  const standardEntities = useMemo(
    () => getEntitiesFromMasterMapping(entries, measurementId),
    [measurementId],
  )

  // Log entity counts once on mount (not on every render)
  useEffect(() => {
    logger.info('WIZARD', `Input mode: S4D Standard — ${standardEntities.variables.length} variables, ${standardEntities.triggers.length} triggers, ${standardEntities.tags.length} tags`)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleModeChange = useCallback((newMode: InputMode) => {
    setMode(newMode)
    // Reset custom JSON state when switching modes
    setCustomJson('')
    setParseError('')
    setParsedAudit(null)
    setEventCount(null)

    if (newMode === 'standard') {
      logger.info('WIZARD', 'Switched to S4D Standard mode')
    } else {
      logger.info('WIZARD', 'Switched to Custom JSON mode')
    }
  }, [logger])

  const validateJson = useCallback((raw: string) => {
    if (!raw.trim()) {
      setParseError('')
      setParsedAudit(null)
      setEventCount(null)
      return
    }

    const result = parseAuditJson(raw)
    if (result.success) {
      const count = Object.keys(result.data).length
      setParsedAudit(result.data)
      setEventCount(count)
      setParseError('')
      logger.info('VALIDATION', `JSON valid — ${count} event${count !== 1 ? 's' : ''} detected`)
    } else {
      setParsedAudit(null)
      setEventCount(null)
      setParseError(result.error)
      logger.warn('VALIDATION', result.error)
    }
  }, [logger])

  function handleTextChange(value: string) {
    setCustomJson(value)
    validateJson(value)
  }

  function handleFileUpload(file: File | undefined) {
    if (!file) return

    if (!file.name.endsWith('.json')) {
      setParseError('Only .json files are accepted.')
      setParsedAudit(null)
      setEventCount(null)
      logger.warn('VALIDATION', `Rejected file: ${file.name} — only .json files accepted`)
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setCustomJson(content)
      validateJson(content)
    }
    reader.readAsText(file)
  }

  function handleDryRun() {
    logger.info('WIZARD', 'Dry run triggered')

    if (mode === 'standard') {
      onEntitiesReady(standardEntities)
    } else if (parsedAudit) {
      const auditEntities = getEntitiesFromAuditJson(parsedAudit, entries, measurementId)
      onEntitiesReady(auditEntities)
    }
  }

  const isCustomValid = mode === 'custom' && parsedAudit !== null && !parseError
  const canRun = mode === 'standard' || isCustomValid

  return (
    <div className="step3-container">
      <h2>Step 3 of 5</h2>
      <p>Choose your input source, then run a dry run to preview what will be created.</p>

      <div className="step3-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={mode === 'standard'}
          className="step3-tab"
          onClick={() => handleModeChange('standard')}
        >
          S4D Standard
        </button>
        <button
          role="tab"
          aria-selected={mode === 'custom'}
          className="step3-tab"
          onClick={() => handleModeChange('custom')}
        >
          Custom JSON
        </button>
      </div>

      {mode === 'standard' && (
        <div className="step3-preview">
          <p>Using the full S4D standard master mapping.</p>
          <p>
            This will attempt to create{' '}
            <strong>{standardEntities.variables.length} variable{standardEntities.variables.length !== 1 ? 's' : ''}</strong>,{' '}
            <strong>{standardEntities.triggers.length} trigger{standardEntities.triggers.length !== 1 ? 's' : ''}</strong>, and{' '}
            <strong>{standardEntities.tags.length} tag{standardEntities.tags.length !== 1 ? 's' : ''}</strong>.
          </p>
        </div>
      )}

      {mode === 'custom' && (
        <>
          <div className="step3-audit-help">
            <p>
              Run the audit script on every page of a full site journey, then paste or
              upload the resulting JSON below.
            </p>
            <a
              href="dataLayerAudit.js"
              download="dataLayerAudit.js"
              className="step3-download"
            >
              Download audit script (.js)
            </a>
            <details className="step3-howto">
              <summary>How to run it</summary>
              <ol>
                <li>Open DevTools (F12) → <em>Sources</em> → <em>Snippets</em>.</li>
                <li>
                  Click <em>New snippet</em>, name it <code>dataLayerAudit</code>, and paste the
                  contents of the downloaded file.
                </li>
                <li>
                  On every page you visit during the journey, right-click the snippet and choose
                  <em> Run</em> (or press <kbd>Ctrl/Cmd + Enter</kbd>).
                </li>
                <li>
                  When done, run in the console:{' '}
                  <code>copy(sessionStorage.getItem('dlEventMap'))</code>
                </li>
                <li>Paste the copied JSON below, or save it as <code>.json</code> and upload it.</li>
              </ol>
            </details>
          </div>

          <div className="step3-field">
            <label htmlFor="custom-json-textarea">Paste audit JSON</label>
            <textarea
              id="custom-json-textarea"
              className={`step3-textarea${parseError ? ' step3-textarea--error' : ''}`}
              value={customJson}
              onChange={e => handleTextChange(e.target.value)}
              placeholder='{"event_name": {"count": 1, "variables": ["var1"]}}'
            />
          </div>

          <div className="step3-field">
            <label htmlFor="json-file-upload">Or upload a .json file</label>
            <input
              id="json-file-upload"
              type="file"
              accept=".json"
              className="step3-file-input"
              onChange={e => handleFileUpload(e.target.files?.[0])}
            />
          </div>

          {parseError && (
            <div className="step3-error" role="alert">{parseError}</div>
          )}

          {eventCount !== null && !parseError && (
            <div className="step3-success">
              {eventCount} event{eventCount !== 1 ? 's' : ''} detected
            </div>
          )}
        </>
      )}

      <div className="step3-actions">
        <button
          className="btn-primary"
          onClick={handleDryRun}
          disabled={!canRun}
        >
          Run Dry Run
        </button>
      </div>
    </div>
  )
}
