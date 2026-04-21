// Step2Container.tsx — Step 2 of the wizard: account, container, and GA4 Measurement ID selection.
// Fetches GTM accounts/containers, validates the Measurement ID, checks workspace limits, and creates a dated workspace.

import { useEffect, useState } from 'react'
import { listAccounts, listContainers, listWorkspaces, createWorkspace } from '../services/gtmApi'
import { useLog } from '../logging/LogContext'
import type { GtmAccount, GtmContainer, GtmWorkspace } from '../types'
import './Step2Container.css'

interface Step2ContainerProps {
  accessToken: string
  onContainerSelected: (container: GtmContainer, workspace: GtmWorkspace, measurementId: string) => void
}

// GA4 Measurement IDs follow the pattern G- followed by 7-10 uppercase alphanumeric characters
const MEASUREMENT_ID_REGEX = /^G-[A-Z0-9]{7,10}$/

// Free GTM allows at most 3 workspaces per container
const MAX_WORKSPACES = 3

// Project decision: always create a new dated workspace per session for traceability.
// We intentionally do not reuse existing "S4D Automation" workspaces.

export function Step2Container({ accessToken, onContainerSelected }: Step2ContainerProps) {
  const { logger } = useLog()

  const [accounts, setAccounts] = useState<GtmAccount[]>([])
  const [containers, setContainers] = useState<GtmContainer[]>([])
  const [selectedAccountPath, setSelectedAccountPath] = useState('')
  const [selectedContainerPath, setSelectedContainerPath] = useState('')
  const [measurementId, setMeasurementId] = useState('')
  const [measurementIdError, setMeasurementIdError] = useState('')
  const [error, setError] = useState('')
  const [workspaceWarning, setWorkspaceWarning] = useState('')
  // Prevents the Next button from enabling before the workspace count API call completes
  const [workspaceCheckDone, setWorkspaceCheckDone] = useState(false)
  const [loading, setLoading] = useState(false)

  // Fetch accounts on mount
  useEffect(() => {
    fetchAccounts()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAccounts() {
    logger.info('GTM-API', 'Fetching accounts...')
    try {
      const result = await listAccounts(accessToken)
      logger.success('GTM-API', `Fetched ${result.length} accounts`)
      setAccounts(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch accounts'
      logger.error('GTM-API', msg)
      setError(msg)
    }
  }

  async function handleAccountChange(accountPath: string) {
    setSelectedAccountPath(accountPath)
    setSelectedContainerPath('')
    setContainers([])
    setWorkspaceWarning('')
    setWorkspaceCheckDone(false)
    setError('')

    if (!accountPath) return

    logger.info('GTM-API', `Fetching containers for ${accountPath}...`)
    try {
      const result = await listContainers(accessToken, accountPath)
      logger.success('GTM-API', `Fetched ${result.length} containers`)
      setContainers(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch containers'
      logger.error('GTM-API', msg)
      setError(msg)
    }
  }

  async function handleContainerChange(containerPath: string) {
    setSelectedContainerPath(containerPath)
    setWorkspaceWarning('')
    setWorkspaceCheckDone(false)
    setError('')

    if (!containerPath) return

    logger.info('GTM-API', `Checking workspaces for ${containerPath}...`)
    try {
      const workspaces = await listWorkspaces(accessToken, containerPath)
      logger.success('GTM-API', `Found ${workspaces.length} existing workspaces`)

      if (workspaces.length >= MAX_WORKSPACES) {
        const msg = `This container has ${workspaces.length} workspaces (maximum ${MAX_WORKSPACES}). Delete or publish an existing workspace in GTM before continuing.`
        logger.warn('GTM-API', msg)
        setWorkspaceWarning(msg)
      }
      setWorkspaceCheckDone(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to check workspaces'
      logger.error('GTM-API', msg)
      setError(msg)
    }
  }

  function validateMeasurementId(value: string) {
    if (value && !MEASUREMENT_ID_REGEX.test(value)) {
      const msg = 'Measurement ID must match format G-XXXXXXXXXX'
      setMeasurementIdError(msg)
      logger.warn('VALIDATION', `Invalid Measurement ID: "${value}"`)
    } else {
      setMeasurementIdError('')
    }
  }

  const selectedContainer = containers.find(c => c.path === selectedContainerPath)
  const isValid =
    selectedAccountPath &&
    selectedContainerPath &&
    MEASUREMENT_ID_REGEX.test(measurementId) &&
    !workspaceWarning &&
    workspaceCheckDone

  async function handleNext() {
    if (!selectedContainer || !isValid) return

    setLoading(true)
    setError('')

    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const workspaceName = `S4D Automation - ${today}`

    logger.info('GTM-API', `Creating workspace "${workspaceName}"...`)
    try {
      const workspace = await createWorkspace(accessToken, selectedContainerPath, workspaceName)
      logger.success('GTM-API', `Created workspace "${workspace.name}"`)
      logger.success('WIZARD', 'Step 2 complete — container and workspace selected')
      onContainerSelected(selectedContainer, workspace, measurementId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create workspace'
      logger.error('GTM-API', msg)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="step2-container">
      <h2>Step 2 of 5</h2>
      <p>Select the GTM account and container, then enter your GA4 Measurement ID.</p>

      {error && (
        <div className="step2-error" role="alert">
          {error}
        </div>
      )}

      {workspaceWarning && (
        <div className="step2-warning" role="alert">
          {workspaceWarning}
        </div>
      )}

      <div className="step2-field">
        <label htmlFor="account-select">Account</label>
        <select
          id="account-select"
          value={selectedAccountPath}
          onChange={e => handleAccountChange(e.target.value)}
        >
          <option value="">-- Select an account --</option>
          {accounts.map(a => (
            <option key={a.accountId} value={a.path}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="step2-field">
        <label htmlFor="container-select">Container</label>
        <select
          id="container-select"
          value={selectedContainerPath}
          onChange={e => handleContainerChange(e.target.value)}
          disabled={!selectedAccountPath || containers.length === 0}
        >
          <option value="">-- Select a container --</option>
          {containers.map(c => (
            <option key={c.containerId} value={c.path}>
              {c.name} ({c.publicId})
            </option>
          ))}
        </select>
      </div>

      <div className="step2-field">
        <label htmlFor="measurement-id">GA4 Measurement ID</label>
        <input
          id="measurement-id"
          type="text"
          placeholder="G-XXXXXXXXXX"
          value={measurementId}
          onChange={e => {
            setMeasurementId(e.target.value)
            // Clear error while typing so user isn't nagged mid-entry
            if (measurementIdError) setMeasurementIdError('')
          }}
          onBlur={e => validateMeasurementId(e.target.value)}
        />
        {measurementIdError && (
          <div className="step2-inline-error">{measurementIdError}</div>
        )}
      </div>

      <div className="step2-actions">
        <button
          className="btn-primary"
          onClick={handleNext}
          disabled={!isValid || loading}
        >
          {loading ? 'Creating workspace...' : 'Next'}
        </button>
      </div>
    </div>
  )
}
