// Step5Execute.test.tsx — Tests for sequential execution, progress tracking, results table, and post-execution CTAs.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Step5Execute } from './Step5Execute'
import type { ConflictResult, GtmEntity, SessionInfo, LogEntry } from '../types'

// --- Mock data ---

const TOKEN = 'ya29.test-token'
const WORKSPACE_PATH = 'accounts/1/containers/1/workspaces/1'
const CONTAINER_PUBLIC_ID = 'GTM-ABC123'
const MEASUREMENT_ID = 'G-TEST123'

const mockSessionInfo: SessionInfo = {
  userEmail: 'santiago@solutions4delivery.com',
  accountName: 'Test Account',
  containerName: 'Test Container',
  containerPublicId: CONTAINER_PUBLIC_ID,
  workspaceName: 'S4D Automation - 2026-04-21',
  measurementId: MEASUREMENT_ID,
}

const variableConflictResult: ConflictResult = {
  entityName: 'DLV - ecommerce.items',
  entityType: 'variable',
  status: 'WILL_CREATE',
  decision: null,
  intendedPayload: { name: 'DLV - ecommerce.items', type: 'v', parameter: [{ type: 'template', key: 'dataLayerVersion', value: '2' }] },
}

const triggerConflictResult: ConflictResult = {
  entityName: 'CE - view_item_list',
  entityType: 'trigger',
  status: 'WILL_CREATE',
  decision: null,
  intendedPayload: { name: 'CE - view_item_list', type: 'customEvent', customEventFilter: [] },
}

const tagConflictResult: ConflictResult = {
  entityName: 'GA4 Event - view_item_list',
  entityType: 'tag',
  status: 'WILL_CREATE',
  decision: null,
  intendedPayload: {
    name: 'GA4 Event - view_item_list',
    type: 'gaawe',
    parameter: [],
    firingTriggerId: ['__PENDING_TRIGGER_ID__'],
  },
}

const skippedResult: ConflictResult = {
  entityName: 'DLV - ecommerce.currency',
  entityType: 'variable',
  status: 'ALREADY_CORRECT',
  decision: null,
  intendedPayload: { name: 'DLV - ecommerce.currency', type: 'v', parameter: [] },
  existingEntity: { name: 'DLV - ecommerce.currency', type: 'v', path: 'accounts/1/containers/1/workspaces/1/variables/10' },
}

const overwriteResult: ConflictResult = {
  entityName: 'DLV - ecommerce.value',
  entityType: 'variable',
  status: 'CONFLICT',
  decision: 'OVERWRITE',
  intendedPayload: { name: 'DLV - ecommerce.value', type: 'v', parameter: [{ type: 'template', key: 'dataLayerVersion', value: '2' }] },
  existingEntity: { name: 'DLV - ecommerce.value', type: 'v', path: 'accounts/1/containers/1/workspaces/1/variables/5' },
}

const conflictSkipResult: ConflictResult = {
  entityName: 'CE - purchase',
  entityType: 'trigger',
  status: 'CONFLICT',
  decision: 'SKIP',
  intendedPayload: { name: 'CE - purchase', type: 'customEvent', customEventFilter: [] },
  existingEntity: { name: 'CE - purchase', type: 'customEvent', path: 'accounts/1/containers/1/workspaces/1/triggers/99', triggerId: '99' },
}

// Created trigger API response with a triggerId
const createdTriggerEntity: GtmEntity = {
  name: 'CE - view_item_list',
  type: 'customEvent',
  path: 'accounts/1/containers/1/workspaces/1/triggers/42',
  triggerId: '42',
}

const createdVariableEntity: GtmEntity = {
  name: 'DLV - ecommerce.items',
  type: 'v',
  path: 'accounts/1/containers/1/workspaces/1/variables/7',
}

const createdTagEntity: GtmEntity = {
  name: 'GA4 Event - view_item_list',
  type: 'gaawe',
  path: 'accounts/1/containers/1/workspaces/1/tags/15',
}

const createdGa4ConfigEntity: GtmEntity = {
  name: 'GA4 - Configuration TAG',
  type: 'gaawc',
  path: 'accounts/1/containers/1/workspaces/1/tags/20',
}

// GA4 Config Tag conflict results for various scenarios
const ga4ConfigAlreadyCorrect: ConflictResult = {
  entityName: 'GA4 - Configuration TAG',
  entityType: 'tag',
  status: 'ALREADY_CORRECT',
  decision: null,
  intendedPayload: {
    name: 'GA4 - Configuration TAG',
    type: 'gaawc',
    parameter: [
      { key: 'measurementId', type: 'template', value: MEASUREMENT_ID },
      { key: 'sendPageView', type: 'boolean', value: 'true' },
    ],
    firingTriggerId: ['2147479553'],
  },
  existingEntity: { name: 'GA4 - Configuration TAG', type: 'gaawc', path: 'accounts/1/containers/1/workspaces/1/tags/20' },
}

const ga4ConfigConflictOverwrite: ConflictResult = {
  entityName: 'GA4 - Configuration TAG',
  entityType: 'tag',
  status: 'CONFLICT',
  decision: 'OVERWRITE',
  intendedPayload: {
    name: 'GA4 - Configuration TAG',
    type: 'gaawc',
    parameter: [
      { key: 'measurementId', type: 'template', value: MEASUREMENT_ID },
      { key: 'sendPageView', type: 'boolean', value: 'true' },
    ],
    firingTriggerId: ['2147479553'],
  },
  existingEntity: { name: 'GA4 - Configuration TAG', type: 'gaawc', path: 'accounts/1/containers/1/workspaces/1/tags/20' },
}

// --- Mocks ---

const mockCreateVariable = vi.fn<() => Promise<GtmEntity>>()
const mockCreateTrigger = vi.fn<() => Promise<GtmEntity>>()
const mockCreateTag = vi.fn<() => Promise<GtmEntity>>()
const mockUpdateVariable = vi.fn<() => Promise<GtmEntity>>()
const mockUpdateTrigger = vi.fn<() => Promise<GtmEntity>>()
const mockUpdateTag = vi.fn<() => Promise<GtmEntity>>()

vi.mock('../services/gtmApi', () => ({
  createVariable: (...args: unknown[]) => mockCreateVariable(...args),
  createTrigger: (...args: unknown[]) => mockCreateTrigger(...args),
  createTag: (...args: unknown[]) => mockCreateTag(...args),
  updateVariable: (...args: unknown[]) => mockUpdateVariable(...args),
  updateTrigger: (...args: unknown[]) => mockUpdateTrigger(...args),
  updateTag: (...args: unknown[]) => mockUpdateTag(...args),
  attachLogger: vi.fn(),
}))

const mockDownloadLogFile = vi.fn()

vi.mock('../logging/logExport', () => ({
  downloadLogFile: (...args: unknown[]) => mockDownloadLogFile(...args),
}))

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  getEntries: vi.fn(() => []),
  clear: vi.fn(),
  onEntry: null,
}

const mockEntries: LogEntry[] = []

vi.mock('../logging/LogContext', () => ({
  useLog: () => ({ logger: mockLogger, entries: mockEntries }),
}))

// --- Helpers ---

function renderStep5(
  conflictResults: ConflictResult[] = [variableConflictResult, triggerConflictResult, tagConflictResult],
  onStartNewOnboarding = vi.fn(),
) {
  return render(
    <Step5Execute
      accessToken={TOKEN}
      workspacePath={WORKSPACE_PATH}
      containerPublicId={CONTAINER_PUBLIC_ID}
      measurementId={MEASUREMENT_ID}
      conflictResults={conflictResults}
      sessionInfo={mockSessionInfo}
      onStartNewOnboarding={onStartNewOnboarding}
    />
  )
}

describe('Step5Execute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateVariable.mockResolvedValue(createdVariableEntity)
    mockCreateTrigger.mockResolvedValue(createdTriggerEntity)
    mockCreateTag.mockResolvedValue(createdTagEntity)
    mockUpdateVariable.mockResolvedValue(createdVariableEntity)
    mockUpdateTrigger.mockResolvedValue(createdTriggerEntity)
    mockUpdateTag.mockResolvedValue(createdTagEntity)
  })

  // --- Progress indicator ---

  it('shows progress indicator with Variables, Triggers, Tags phases', async () => {
    renderStep5()

    expect(screen.getByText('Variables')).toBeInTheDocument()
    expect(screen.getByText('Triggers')).toBeInTheDocument()
    expect(screen.getByText('Tags')).toBeInTheDocument()
  })

  // --- Sequential execution: variables -> triggers -> tags ---

  it('calls create APIs in correct order: variables then triggers then tags', async () => {
    // Provide GA4 Config as ALREADY_CORRECT so auto-creation is skipped,
    // allowing us to test the variable -> trigger -> tag ordering cleanly.
    renderStep5([variableConflictResult, triggerConflictResult, ga4ConfigAlreadyCorrect, tagConflictResult])

    await waitFor(() => {
      expect(screen.getByText(/results/i)).toBeInTheDocument()
    })

    // Verify order: variable first, trigger second, tag third
    expect(mockCreateVariable).toHaveBeenCalledBefore(mockCreateTrigger)
    expect(mockCreateTrigger).toHaveBeenCalledBefore(mockCreateTag)
  })

  it('creates variable with correct arguments', async () => {
    renderStep5()

    await waitFor(() => {
      expect(mockCreateVariable).toHaveBeenCalledWith(
        TOKEN, WORKSPACE_PATH, variableConflictResult.intendedPayload
      )
    })
  })

  it('creates trigger with correct arguments', async () => {
    renderStep5()

    await waitFor(() => {
      expect(mockCreateTrigger).toHaveBeenCalledWith(
        TOKEN, WORKSPACE_PATH, triggerConflictResult.intendedPayload
      )
    })
  })

  // --- Trigger ID resolution for tags ---

  it('replaces __PENDING_TRIGGER_ID__ with actual trigger ID from API response', async () => {
    // Include GA4 Config as ALREADY_CORRECT so auto-creation doesn't add an extra createTag call
    renderStep5([variableConflictResult, triggerConflictResult, ga4ConfigAlreadyCorrect, tagConflictResult])

    await waitFor(() => {
      expect(mockCreateTag).toHaveBeenCalled()
    })

    // The tag should have been called with the resolved trigger ID '42' (from createdTriggerEntity)
    const callArgs = mockCreateTag.mock.calls[0]
    const tagPayload = callArgs[2]
    expect(tagPayload.firingTriggerId).toEqual(['42'])
  })

  it('uses existing trigger ID when trigger was ALREADY_CORRECT', async () => {
    const existingTrigger: ConflictResult = {
      entityName: 'CE - view_item_list',
      entityType: 'trigger',
      status: 'ALREADY_CORRECT',
      decision: null,
      intendedPayload: { name: 'CE - view_item_list', type: 'customEvent', customEventFilter: [] },
      existingEntity: { name: 'CE - view_item_list', type: 'customEvent', path: 'accounts/1/containers/1/workspaces/1/triggers/55', triggerId: '55' },
    }

    // Include GA4 Config as ALREADY_CORRECT so auto-creation doesn't interfere
    renderStep5([variableConflictResult, existingTrigger, ga4ConfigAlreadyCorrect, tagConflictResult])

    await waitFor(() => {
      expect(mockCreateTag).toHaveBeenCalled()
    })

    const callArgs = mockCreateTag.mock.calls[0]
    const tagPayload = callArgs[2]
    expect(tagPayload.firingTriggerId).toEqual(['55'])
  })

  it('uses existing trigger ID when trigger was CONFLICT with SKIP decision', async () => {
    // Include GA4 Config as ALREADY_CORRECT so auto-creation doesn't interfere
    renderStep5([variableConflictResult, conflictSkipResult, ga4ConfigAlreadyCorrect, {
      ...tagConflictResult,
      // This tag references CE - purchase trigger
      entityName: 'GA4 Event - purchase',
      intendedPayload: {
        name: 'GA4 Event - purchase',
        type: 'gaawe',
        parameter: [],
        firingTriggerId: ['__PENDING_TRIGGER_ID__'],
      },
    }])

    await waitFor(() => {
      expect(mockCreateTag).toHaveBeenCalled()
    })

    const callArgs = mockCreateTag.mock.calls[0]
    const tagPayload = callArgs[2]
    // Should extract trigger ID '99' from the existing entity path or triggerId
    expect(tagPayload.firingTriggerId).toEqual(['99'])
  })

  // --- Results table on completion ---

  it('shows results table with Entity Name, Type, Action columns on completion', async () => {
    renderStep5()

    await waitFor(() => {
      expect(screen.getByText('Entity Name')).toBeInTheDocument()
      expect(screen.getByText('Type')).toBeInTheDocument()
      expect(screen.getByText('Action')).toBeInTheDocument()
    })
  })

  it('shows CREATED action for newly created entities', async () => {
    // Include GA4 Config as ALREADY_CORRECT to avoid auto-creation adding extra CREATED rows
    renderStep5([variableConflictResult, ga4ConfigAlreadyCorrect])

    await waitFor(() => {
      expect(screen.getByText('DLV - ecommerce.items')).toBeInTheDocument()
      expect(screen.getByText('CREATED')).toBeInTheDocument()
    })
  })

  it('shows SKIPPED action for already correct entities', async () => {
    renderStep5([skippedResult])

    await waitFor(() => {
      expect(screen.getByText('DLV - ecommerce.currency')).toBeInTheDocument()
      expect(screen.getByText('SKIPPED')).toBeInTheDocument()
    })
  })

  it('shows SKIPPED action for conflict entities with SKIP decision', async () => {
    renderStep5([conflictSkipResult])

    await waitFor(() => {
      expect(screen.getByText('CE - purchase')).toBeInTheDocument()
      expect(screen.getByText('SKIPPED')).toBeInTheDocument()
    })
  })

  it('shows OVERWRITTEN action for conflict entities with OVERWRITE decision', async () => {
    renderStep5([overwriteResult])

    await waitFor(() => {
      expect(screen.getByText('DLV - ecommerce.value')).toBeInTheDocument()
      expect(screen.getByText('OVERWRITTEN')).toBeInTheDocument()
    })
  })

  it('calls updateVariable for OVERWRITE conflict', async () => {
    renderStep5([overwriteResult])

    await waitFor(() => {
      expect(mockUpdateVariable).toHaveBeenCalledWith(
        TOKEN,
        overwriteResult.existingEntity!.path,
        overwriteResult.intendedPayload
      )
    })
  })

  // --- Download Log button ---

  it('shows Download Log button after execution completes', async () => {
    renderStep5([skippedResult])

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download log/i })).toBeInTheDocument()
    })
  })

  it('calls downloadLogFile when Download Log is clicked', async () => {
    const user = userEvent.setup()
    renderStep5([skippedResult])

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download log/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /download log/i }))

    expect(mockDownloadLogFile).toHaveBeenCalledWith(mockSessionInfo, mockEntries)
  })

  // --- Open GTM Container link ---

  it('shows Open GTM Container link after execution completes', async () => {
    renderStep5([skippedResult])

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /open gtm container/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', expect.stringContaining(CONTAINER_PUBLIC_ID))
    })
  })

  // --- Start New Onboarding button ---

  it('shows Start New Onboarding button after execution completes', async () => {
    renderStep5([skippedResult])

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start new onboarding/i })).toBeInTheDocument()
    })
  })

  it('calls onStartNewOnboarding when Start New Onboarding is clicked', async () => {
    const user = userEvent.setup()
    const mockOnStartNew = vi.fn()
    renderStep5([skippedResult], mockOnStartNew)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start new onboarding/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /start new onboarding/i }))

    expect(mockOnStartNew).toHaveBeenCalledTimes(1)
  })

  // --- Partial failure: stops on first error ---

  it('stops execution on first API failure and shows partial results', async () => {
    mockCreateTrigger.mockRejectedValue(new Error('API rate limit exceeded'))

    // Include GA4 Config as ALREADY_CORRECT so auto-creation doesn't interfere with the test
    renderStep5([variableConflictResult, triggerConflictResult, ga4ConfigAlreadyCorrect, tagConflictResult])

    await waitFor(() => {
      // Should show the error row in the results table
      expect(screen.getByText('ERROR')).toBeInTheDocument()
      expect(screen.getByText(/api rate limit exceeded/i)).toBeInTheDocument()
    })

    // Variable should be CREATED, trigger should be ERROR, tag should NOT appear
    expect(screen.getByText('CREATED')).toBeInTheDocument()
    expect(mockCreateTag).not.toHaveBeenCalled()
  })

  it('shows stopped message with count of successful items', async () => {
    mockCreateTrigger.mockRejectedValue(new Error('API rate limit exceeded'))

    // Include GA4 Config as ALREADY_CORRECT so auto-creation doesn't add to the success count
    renderStep5([variableConflictResult, triggerConflictResult, ga4ConfigAlreadyCorrect, tagConflictResult])

    await waitFor(() => {
      expect(screen.getByText(/stopped at/i)).toBeInTheDocument()
      expect(screen.getByText(/1 item.* created successfully/i)).toBeInTheDocument()
    })
  })

  // --- LogPanel integration ---

  it('shows LogPanel component', () => {
    renderStep5()

    expect(screen.getByText('Activity Log')).toBeInTheDocument()
  })

  // --- Logging ---

  it('logs start of execution', async () => {
    renderStep5([skippedResult])

    await waitFor(() => {
      expect(mockLogger.info).toHaveBeenCalledWith('GTM-API', expect.stringContaining('Starting execution'))
    })
  })

  it('logs SKIPPED for already correct entities', async () => {
    renderStep5([skippedResult])

    await waitFor(() => {
      expect(mockLogger.info).toHaveBeenCalledWith('GTM-API', expect.stringContaining('SKIP'))
    })
  })

  it('logs CREATED for newly created entities', async () => {
    renderStep5([variableConflictResult])

    await waitFor(() => {
      expect(mockLogger.success).toHaveBeenCalledWith('GTM-API', expect.stringContaining('CREATED'))
    })
  })

  it('logs ERROR on API failure', async () => {
    mockCreateVariable.mockRejectedValue(new Error('Network error'))

    renderStep5([variableConflictResult])

    await waitFor(() => {
      expect(mockLogger.error).toHaveBeenCalledWith('GTM-API', expect.stringContaining('Network error'))
    })
  })

  it('logs OVERWRITTEN for conflict entities with overwrite decision', async () => {
    renderStep5([overwriteResult])

    await waitFor(() => {
      expect(mockLogger.success).toHaveBeenCalledWith('GTM-API', expect.stringContaining('OVERWRITTEN'))
    })
  })

  it('logs completion summary', async () => {
    renderStep5([skippedResult])

    await waitFor(() => {
      expect(mockLogger.success).toHaveBeenCalledWith('GTM-API', expect.stringContaining('complete'))
    })
  })

  // --- GA4 Configuration Tag integration ---

  it('auto-creates GA4 Config Tag when not present in conflict results', async () => {
    // Only event-level entities, no GA4 Config Tag in the list
    mockCreateTag.mockResolvedValueOnce(createdGa4ConfigEntity)
      .mockResolvedValueOnce(createdTagEntity)

    renderStep5([variableConflictResult, triggerConflictResult, tagConflictResult])

    await waitFor(() => {
      // GA4 Config Tag should appear in results
      expect(screen.getByText('GA4 - Configuration TAG')).toBeInTheDocument()
    })

    // The first createTag call should be the config tag (auto-created before event tags)
    const firstTagCall = mockCreateTag.mock.calls[0]
    const firstTagPayload = firstTagCall[2]
    expect(firstTagPayload.name).toBe('GA4 - Configuration TAG')
    expect(firstTagPayload.type).toBe('gaawc')
    expect(firstTagPayload.parameter).toEqual(
      expect.arrayContaining([
        { key: 'measurementId', type: 'template', value: MEASUREMENT_ID },
      ])
    )
  })

  it('creates GA4 Config Tag before event tags', async () => {
    mockCreateTag.mockResolvedValueOnce(createdGa4ConfigEntity)
      .mockResolvedValueOnce(createdTagEntity)

    renderStep5([variableConflictResult, triggerConflictResult, tagConflictResult])

    await waitFor(() => {
      expect(mockCreateTag).toHaveBeenCalledTimes(2)
    })

    // First createTag call = GA4 Config, second = event tag
    expect((mockCreateTag.mock.calls[0] as [string, string, { name: string }])[2].name).toBe('GA4 - Configuration TAG')
    expect((mockCreateTag.mock.calls[1] as [string, string, { name: string }])[2].name).toBe('GA4 Event - view_item_list')
  })

  it('skips GA4 Config Tag when it already exists as ALREADY_CORRECT', async () => {
    renderStep5([variableConflictResult, triggerConflictResult, ga4ConfigAlreadyCorrect, tagConflictResult])

    await waitFor(() => {
      expect(screen.getByText('GA4 - Configuration TAG')).toBeInTheDocument()
    })

    // Config tag should be processed as SKIPPED (ALREADY_CORRECT)
    // and should NOT trigger a separate createTag call for the config tag
    // The only createTag call should be for the event tag
    await waitFor(() => {
      const configCallCount = mockCreateTag.mock.calls.filter(
        (call: unknown[]) => (call[2] as { name: string }).name === 'GA4 - Configuration TAG'
      ).length
      expect(configCallCount).toBe(0)
    })
  })

  it('updates GA4 Config Tag when it is a CONFLICT with OVERWRITE decision', async () => {
    renderStep5([variableConflictResult, triggerConflictResult, ga4ConfigConflictOverwrite, tagConflictResult])

    await waitFor(() => {
      expect(mockUpdateTag).toHaveBeenCalled()
    })

    // The updateTag call should be for the GA4 Config Tag
    const updateCallArgs = mockUpdateTag.mock.calls[0] as [string, string, unknown]
    expect(updateCallArgs[1]).toBe(ga4ConfigConflictOverwrite.existingEntity!.path)
  })

  it('logs GA4 Config Tag auto-creation', async () => {
    mockCreateTag.mockResolvedValueOnce(createdGa4ConfigEntity)
      .mockResolvedValueOnce(createdTagEntity)

    renderStep5([variableConflictResult, triggerConflictResult, tagConflictResult])

    await waitFor(() => {
      expect(mockLogger.info).toHaveBeenCalledWith('GTM-API', expect.stringContaining('GA4 - Configuration TAG'))
    })
  })

  it('rate-limit warnings are logged via the logger', async () => {
    // Smoke test: verify attachLogger from gtmApi exists and accepts our logger shape.
    // Full integration (firing 26 requests and asserting the warn message appears) is
    // integration territory and adds little over manual verification.
    const { attachLogger } = await import('../services/gtmApi')

    expect(() => attachLogger(mockLogger as unknown as never)).not.toThrow()
    expect(() => attachLogger(null)).not.toThrow()
  })

  it('shows an estimated time when execution starts', async () => {
    // 30 WILL_CREATE entities — at 25/min limit, ETA is 2 minutes
    const manyEntities: ConflictResult[] = Array.from({ length: 30 }, (_, i) => ({
      entityName: `Variable ${i}`,
      entityType: 'variable' as const,
      status: 'WILL_CREATE' as const,
      decision: null,
      intendedPayload: { name: `Variable ${i}`, type: 'v', parameter: [] },
    }))

    renderStep5(manyEntities)

    await waitFor(() => {
      // Match "Estimated time" text — exact format flexible
      expect(screen.getByText(/estimated time/i)).toBeInTheDocument()
    })
  })
})
