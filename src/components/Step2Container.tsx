// Step2Container.tsx — Step 2 of the wizard: account, container, workspace, and GA4 Measurement ID selection.
// Fetches GTM accounts/containers/workspaces, validates the Measurement ID, and selects or creates a workspace.

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

// Sentinel value for the "create new dated workspace" dropdown option.
// All other option values are real workspace paths.
const CREATE_NEW_WORKSPACE = '__create_new__'

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
  const [workspaces, setWorkspaces] = useState<GtmWorkspace[]>([])
  const [selectedWorkspaceValue, setSelectedWorkspaceValue] = useState('')
  // Prevents the Next button from enabling before the workspace count API call completes
  const [workspaceCheckDone, setWorkspaceCheckDone] = useState(false)
  const [loading, setLoading] = useState(false)

  // Fetch accounts on mount
  useEffect(() => {
    let cancelled = false
    logger.info('GTM-API', 'Fetching accounts...')

    listAccounts(accessToken).then(result => {
      if (cancelled) return
      logger.success('GTM-API', `Fetched ${result.length} accounts`)
      setAccounts(result)
    }).catch(err => {
      if (cancelled) return
      const msg = err instanceof Error ? err.message : 'Failed to fetch accounts'
      logger.error('GTM-API', msg)
      setError(msg)
    })

    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAccountChange(accountPath: string) {
    setSelectedAccountPath(accountPath)
    setSelectedContainerPath('')
    setContainers([])
    setWorkspaces([])
    setSelectedWorkspaceValue('')
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
    setWorkspaces([])
    setSelectedWorkspaceValue('')
    setWorkspaceWarning('')
    setWorkspaceCheckDone(false)
    setError('')

    if (!containerPath) return

    logger.info('GTM-API', `Checking workspaces for ${containerPath}...`)
    try {
      const result = await listWorkspaces(accessToken, containerPath)
      logger.success('GTM-API', `Found ${result.length} existing workspaces`)
      setWorkspaces(result)

      if (result.length >= MAX_WORKSPACES) {
        const msg = `This container has ${result.length} workspaces (maximum ${MAX_WORKSPACES}). Pick an existing workspace below, or delete one in GTM to create a new one.`
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

  const today = new Date().toISOString().slice(0, 10)
  const todayWorkspaceName = `S4D Automation - ${today}`
  const todayWorkspaceExists = workspaces.some(w => w.name === todayWorkspaceName)
  const atWorkspaceLimit = workspaces.length >= MAX_WORKSPACES
  const canCreateNew = !todayWorkspaceExists && !atWorkspaceLimit

  const selectedContainer = containers.find(c => c.path === selectedContainerPath)
  const isValid = Boolean(
    selectedAccountPath &&
    selectedContainerPath &&
    MEASUREMENT_ID_REGEX.test(measurementId) &&
    workspaceCheckDone &&
    selectedWorkspaceValue
  )

  async function handleNext() {
    if (!selectedContainer || !isValid) return

    setLoading(true)
    setError('')

    try {
      let workspace: GtmWorkspace

      if (selectedWorkspaceValue === CREATE_NEW_WORKSPACE) {
        logger.info('GTM-API', `Creating workspace "${todayWorkspaceName}"...`)
        workspace = await createWorkspace(accessToken, selectedContainerPath, todayWorkspaceName)
        logger.success('GTM-API', `Created workspace "${workspace.name}"`)
      } else {
        const existing = workspaces.find(w => w.path === selectedWorkspaceValue)
        if (!existing) {
          throw new Error('Selected workspace not found')
        }
        workspace = existing
        logger.info('GTM-API', `Reusing existing workspace "${workspace.name}"`)
      }

      logger.success('WIZARD', 'Step 2 complete — container and workspace selected')
      onContainerSelected(selectedContainer, workspace, measurementId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to select workspace'
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

      {selectedContainerPath && workspaceCheckDone && (
        <div className="step2-field">
          <label htmlFor="workspace-select">Workspace</label>
          <select
            id="workspace-select"
            value={selectedWorkspaceValue}
            onChange={e => setSelectedWorkspaceValue(e.target.value)}
          >
            <option value="">-- Select a workspace --</option>
            {canCreateNew && (
              <option value={CREATE_NEW_WORKSPACE}>
                Create new: {todayWorkspaceName}
              </option>
            )}
            {workspaces.map(w => (
              <option key={w.workspaceId} value={w.path}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      )}

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
          {loading ? 'Selecting workspace...' : 'Next'}
        </button>
      </div>
    </div>
  )
}
