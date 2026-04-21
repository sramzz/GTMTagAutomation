// Step4Preview.tsx — Step 4: fetches existing workspace entities, detects conflicts,
// and lets the user skip or overwrite before applying changes.

import { useState, useEffect, useCallback } from 'react'
import { useLog } from '../logging/LogContext'
import { listVariables, listTriggers, listTags } from '../services/gtmApi'
import { detectConflicts } from '../services/conflictDetection'
import { SummaryBar } from './shared/SummaryBar'
import { LogPanel } from './shared/LogPanel'
import type { ConflictResult, ConflictDecision } from '../types'
import type { EntityLists } from '../services/inputParser'
import './Step4Preview.css'

interface Step4PreviewProps {
  accessToken: string
  workspacePath: string
  entityLists: EntityLists
  onConflictsResolved: (results: ConflictResult[]) => void
}

type SectionKey = 'create' | 'conflict' | 'correct'

export function Step4Preview({ accessToken, workspacePath, entityLists, onConflictsResolved }: Step4PreviewProps) {
  const { logger, entries } = useLog()
  const [results, setResults] = useState<ConflictResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({ create: false, conflict: false, correct: false })

  useEffect(() => {
    fetchAndDetect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAndDetect() {
    logger.info('CONFLICT', 'Fetching existing entities from workspace...')
    try {
      const [existingVars, existingTriggers, existingTags] = await Promise.all([
        listVariables(accessToken, workspacePath),
        listTriggers(accessToken, workspacePath),
        listTags(accessToken, workspacePath),
      ])

      const varResults = detectConflicts(entityLists.variables, existingVars, 'variable')
      logger.info('CONFLICT', `variable: ${varResults.length} checked — ${summarizeResults(varResults)}`)

      const trigResults = detectConflicts(entityLists.triggers, existingTriggers, 'trigger')
      logger.info('CONFLICT', `trigger: ${trigResults.length} checked — ${summarizeResults(trigResults)}`)

      const tagResults = detectConflicts(entityLists.tags, existingTags, 'tag')
      logger.info('CONFLICT', `tag: ${tagResults.length} checked — ${summarizeResults(tagResults)}`)

      setResults([...varResults, ...trigResults, ...tagResults])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
      logger.error('GTM-API', msg)
    } finally {
      setLoading(false)
    }
  }

  const setDecision = useCallback((entityName: string, decision: ConflictDecision) => {
    setResults(prev => prev.map(r =>
      r.entityName === entityName ? { ...r, decision } : r
    ))
  }, [])

  function handleApply() {
    logger.success('WIZARD', 'Apply Changes confirmed — passing resolved conflicts to next step')
    onConflictsResolved(results)
  }

  // Derived counts for SummaryBar
  const toCreate = results.filter(r => r.status === 'WILL_CREATE').length
  const conflicts = results.filter(r => r.status === 'CONFLICT').length
  const skipped = results.filter(r => r.status === 'CONFLICT' && r.decision === 'SKIP').length
  const toOverwrite = results.filter(r => r.status === 'CONFLICT' && r.decision === 'OVERWRITE').length
  const alreadyCorrect = results.filter(r => r.status === 'ALREADY_CORRECT').length
  const allConflictsResolved = results.filter(r => r.status === 'CONFLICT' && r.decision === null).length === 0
  const canApply = !loading && !error && allConflictsResolved

  const toggleSection = useCallback((key: SectionKey) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  if (loading) return <div className="step4-container"><p className="step4-loading">Loading conflict detection...</p></div>
  if (error) return <div className="step4-container"><div className="step4-error" role="alert">{error}</div></div>

  const createItems = results.filter(r => r.status === 'WILL_CREATE')
  const conflictItems = results.filter(r => r.status === 'CONFLICT')
  const correctItems = results.filter(r => r.status === 'ALREADY_CORRECT')

  return (
    <div className="step4-container">
      <h2>Step 4 of 5</h2>
      <p>Review what will be created, updated, or skipped in your workspace.</p>

      <SummaryBar toCreate={toCreate} conflicts={conflicts} skipped={skipped} toOverwrite={toOverwrite} alreadyCorrect={alreadyCorrect} />

      <Section sectionKey="create" label={`Will Create (${createItems.length})`} items={createItems} collapsed={collapsed.create} onToggle={toggleSection} onDecision={setDecision} />
      <Section sectionKey="conflict" label={`Conflict (${conflictItems.length})`} items={conflictItems} collapsed={collapsed.conflict} onToggle={toggleSection} onDecision={setDecision} />
      <Section sectionKey="correct" label={`Already Correct (${correctItems.length})`} items={correctItems} collapsed={collapsed.correct} onToggle={toggleSection} onDecision={setDecision} />

      <div className="step4-actions">
        <button className="btn-primary" onClick={handleApply} disabled={!canApply}>Apply Changes</button>
      </div>

      <LogPanel entries={entries} />
    </div>
  )
}

// --- Helpers ---

function summarizeResults(items: ConflictResult[]): string {
  const c = items.filter(r => r.status === 'WILL_CREATE').length
  const f = items.filter(r => r.status === 'CONFLICT').length
  const a = items.filter(r => r.status === 'ALREADY_CORRECT').length
  return `${c} new, ${f} conflict, ${a} correct`
}

// --- Collapsible section sub-component ---

interface SectionProps {
  sectionKey: SectionKey
  label: string
  items: ConflictResult[]
  collapsed: boolean
  onToggle: (key: SectionKey) => void
  onDecision: (entityName: string, decision: ConflictDecision) => void
}

function Section({ sectionKey, label, items, collapsed, onToggle, onDecision }: SectionProps) {
  if (items.length === 0) return null

  const cssModifier = sectionKey === 'create' ? 'create' : sectionKey === 'conflict' ? 'conflict' : 'correct'

  return (
    <div className={`step4-section step4-section--${cssModifier}`}>
      <button className="step4-section-header" onClick={() => onToggle(sectionKey)} aria-label={label}>
        <span>{label}</span>
        <span>{collapsed ? '+' : '-'}</span>
      </button>
      <div className="step4-section-body" style={{ display: collapsed ? 'none' : 'block' }}>
        {items.map(item => (
          <div key={item.entityName} className="step4-entity-row">
            <span>
              <span className="step4-entity-name">{item.entityName}</span>
              <span className="step4-entity-type">({item.entityType})</span>
            </span>
            {item.status === 'CONFLICT' && (
              <span className="step4-decisions">
                <button className={`step4-decision-btn${item.decision === 'SKIP' ? ' step4-decision-active' : ''}`} onClick={() => onDecision(item.entityName, 'SKIP')}>Skip</button>
                <button className={`step4-decision-btn${item.decision === 'OVERWRITE' ? ' step4-decision-active' : ''}`} onClick={() => onDecision(item.entityName, 'OVERWRITE')}>Overwrite</button>
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
