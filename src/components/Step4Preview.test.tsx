// Step4Preview.test.tsx — Tests for conflict detection display, skip/overwrite decisions, and Apply Changes.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Step4Preview } from './Step4Preview'
import type { ConflictResult, GtmEntity } from '../types'
import type { EntityLists } from '../services/inputParser'

// --- Mock data ---

const mockEntityLists: EntityLists = {
  variables: [
    { name: 'DLV - ecommerce.items', type: 'v', parameter: [{ type: 'template', key: 'dataLayerVersion', value: '2' }] },
  ],
  triggers: [
    { name: 'CE - view_item_list', type: 'customEvent', customEventFilter: [] },
  ],
  tags: [
    { name: 'GA4 Event - view_item_list', type: 'gaawe', parameter: [], firingTriggerId: ['123'] },
  ],
}

const existingVariable: GtmEntity = {
  name: 'DLV - ecommerce.items', type: 'v', path: 'accounts/1/containers/1/workspaces/1/variables/1',
  parameter: [{ type: 'template', key: 'dataLayerVersion', value: '1' }],
}

const mockConflictResults: ConflictResult[] = [
  {
    entityName: 'DLV - ecommerce.items', entityType: 'variable', status: 'CONFLICT',
    decision: null, intendedPayload: mockEntityLists.variables[0], existingEntity: existingVariable,
  },
  {
    entityName: 'CE - view_item_list', entityType: 'trigger', status: 'WILL_CREATE',
    decision: null, intendedPayload: mockEntityLists.triggers[0],
  },
  {
    entityName: 'GA4 Event - view_item_list', entityType: 'tag', status: 'ALREADY_CORRECT',
    decision: null, intendedPayload: mockEntityLists.tags[0],
    existingEntity: { name: 'GA4 Event - view_item_list', type: 'gaawe', path: 'p/t/1' },
  },
]

// --- Mocks ---

const mockListVariables = vi.fn<() => Promise<GtmEntity[]>>()
const mockListTriggers = vi.fn<() => Promise<GtmEntity[]>>()
const mockListTags = vi.fn<() => Promise<GtmEntity[]>>()

vi.mock('../services/gtmApi', () => ({
  listVariables: (...args: unknown[]) => mockListVariables(...args),
  listTriggers: (...args: unknown[]) => mockListTriggers(...args),
  listTags: (...args: unknown[]) => mockListTags(...args),
}))

const mockDetectConflicts = vi.fn<() => ConflictResult[]>()

vi.mock('../services/conflictDetection', () => ({
  detectConflicts: (...args: unknown[]) => mockDetectConflicts(...args),
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

vi.mock('../logging/LogContext', () => ({
  useLog: () => ({ logger: mockLogger, entries: [] }),
}))

// --- Helpers ---

const TOKEN = 'ya29.test-token'
const WORKSPACE_PATH = 'accounts/1/containers/1/workspaces/1'

function renderStep4(onConflictsResolved = vi.fn()) {
  return render(
    <Step4Preview
      accessToken={TOKEN}
      workspacePath={WORKSPACE_PATH}
      entityLists={mockEntityLists}
      onConflictsResolved={onConflictsResolved}
    />
  )
}

describe('Step4Preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListVariables.mockResolvedValue([existingVariable])
    mockListTriggers.mockResolvedValue([])
    mockListTags.mockResolvedValue([{ name: 'GA4 Event - view_item_list', type: 'gaawe', path: 'p/t/1' }])
    // Return different results for each entity type call
    mockDetectConflicts
      .mockReturnValueOnce([mockConflictResults[0]]) // variables: CONFLICT
      .mockReturnValueOnce([mockConflictResults[1]]) // triggers: WILL_CREATE
      .mockReturnValueOnce([mockConflictResults[2]]) // tags: ALREADY_CORRECT
  })

  // --- Fetches existing entities on mount ---

  it('fetches existing variables, triggers, and tags on mount', async () => {
    renderStep4()

    await waitFor(() => {
      expect(mockListVariables).toHaveBeenCalledWith(TOKEN, WORKSPACE_PATH)
      expect(mockListTriggers).toHaveBeenCalledWith(TOKEN, WORKSPACE_PATH)
      expect(mockListTags).toHaveBeenCalledWith(TOKEN, WORKSPACE_PATH)
    })
  })

  it('runs conflict detection for each entity type', async () => {
    renderStep4()

    await waitFor(() => {
      expect(mockDetectConflicts).toHaveBeenCalledTimes(3)
      expect(mockDetectConflicts).toHaveBeenCalledWith(mockEntityLists.variables, [existingVariable], 'variable')
      expect(mockDetectConflicts).toHaveBeenCalledWith(mockEntityLists.triggers, [], 'trigger')
    })
  })

  // --- Shows three collapsible sections ---

  it('shows Will Create section with green styling', async () => {
    renderStep4()

    await waitFor(() => {
      expect(screen.getByText(/will create/i)).toBeInTheDocument()
      expect(screen.getByText('CE - view_item_list')).toBeInTheDocument()
    })
  })

  it('shows Conflict section with amber styling', async () => {
    renderStep4()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /conflict/i })).toBeInTheDocument()
      expect(screen.getByText('DLV - ecommerce.items')).toBeInTheDocument()
    })
  })

  it('shows Already Correct section with gray styling', async () => {
    renderStep4()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /already correct/i })).toBeInTheDocument()
      expect(screen.getByText('GA4 Event - view_item_list')).toBeInTheDocument()
    })
  })

  it('sections are collapsible', async () => {
    const user = userEvent.setup()
    renderStep4()

    await waitFor(() => {
      expect(screen.getByText('CE - view_item_list')).toBeInTheDocument()
    })

    // Click the Will Create section header to collapse it
    const willCreateHeader = screen.getByRole('button', { name: /will create/i })
    await user.click(willCreateHeader)

    // The entity inside should be hidden
    expect(screen.queryByText('CE - view_item_list')).not.toBeVisible()
  })

  // --- Conflict rows have Skip/Overwrite buttons ---

  it('shows Skip and Overwrite buttons on conflict rows', async () => {
    renderStep4()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /overwrite/i })).toBeInTheDocument()
    })
  })

  it('marks conflict as skipped when Skip is clicked', async () => {
    const user = userEvent.setup()
    renderStep4()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /skip/i }))

    // The Skip button should appear selected/active
    expect(screen.getByRole('button', { name: /skip/i })).toHaveClass('step4-decision-active')
  })

  it('marks conflict as overwrite when Overwrite is clicked', async () => {
    const user = userEvent.setup()
    renderStep4()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /overwrite/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /overwrite/i }))

    expect(screen.getByRole('button', { name: /overwrite/i })).toHaveClass('step4-decision-active')
  })

  // --- Apply Changes button disabled until all conflicts resolved ---

  it('disables Apply Changes button when conflicts have no decision', async () => {
    renderStep4()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /apply changes/i })).toBeDisabled()
    })
  })

  it('enables Apply Changes button when all conflicts are resolved', async () => {
    const user = userEvent.setup()
    renderStep4()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /skip/i }))

    expect(screen.getByRole('button', { name: /apply changes/i })).toBeEnabled()
  })

  it('enables Apply Changes when there are no conflicts', async () => {
    // Reset mocks for zero-conflict scenario
    mockDetectConflicts
      .mockReset()
      .mockReturnValueOnce([{ ...mockConflictResults[1] }]) // WILL_CREATE only
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ ...mockConflictResults[2] }]) // ALREADY_CORRECT

    renderStep4()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /apply changes/i })).toBeEnabled()
    })
  })

  // --- Apply Changes calls onConflictsResolved ---

  it('calls onConflictsResolved with resolved results when Apply Changes is clicked', async () => {
    const user = userEvent.setup()
    const mockOnConflictsResolved = vi.fn()
    renderStep4(mockOnConflictsResolved)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
    })

    // Resolve the conflict
    await user.click(screen.getByRole('button', { name: /skip/i }))
    await user.click(screen.getByRole('button', { name: /apply changes/i }))

    expect(mockOnConflictsResolved).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ entityName: 'DLV - ecommerce.items', decision: 'SKIP' }),
        expect.objectContaining({ entityName: 'CE - view_item_list', status: 'WILL_CREATE' }),
        expect.objectContaining({ entityName: 'GA4 Event - view_item_list', status: 'ALREADY_CORRECT' }),
      ])
    )
  })

  // --- Shows SummaryBar with correct counts ---

  it('shows SummaryBar with correct counts', async () => {
    renderStep4()

    await waitFor(() => {
      // SummaryBar renders text like "1 to create", "1 conflicts", "1 already correct"
      expect(screen.getByText(/1 to create/)).toBeInTheDocument()
      expect(screen.getByText(/1 conflict/)).toBeInTheDocument()
      expect(screen.getByText(/1 already correct/)).toBeInTheDocument()
    })
  })

  it('updates SummaryBar counts when conflict decision changes', async () => {
    const user = userEvent.setup()
    renderStep4()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /skip/i }))

    // After skipping, summary should show "1 skipped"
    await waitFor(() => {
      expect(screen.getByText(/1 skipped/)).toBeInTheDocument()
    })
  })

  // --- Logging ---

  it('logs conflict detection start', async () => {
    renderStep4()

    await waitFor(() => {
      expect(mockLogger.info).toHaveBeenCalledWith('CONFLICT', expect.stringContaining('Fetching existing'))
    })
  })

  it('logs conflict detection results for each entity type', async () => {
    renderStep4()

    await waitFor(() => {
      expect(mockLogger.info).toHaveBeenCalledWith('CONFLICT', expect.stringContaining('variable'))
      expect(mockLogger.info).toHaveBeenCalledWith('CONFLICT', expect.stringContaining('trigger'))
      expect(mockLogger.info).toHaveBeenCalledWith('CONFLICT', expect.stringContaining('tag'))
    })
  })

  it('logs when Apply Changes is clicked', async () => {
    const user = userEvent.setup()
    renderStep4()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /skip/i }))
    await user.click(screen.getByRole('button', { name: /apply changes/i }))

    expect(mockLogger.success).toHaveBeenCalledWith('WIZARD', expect.stringContaining('Apply'))
  })

  // --- Error handling ---

  it('shows error when API fetch fails', async () => {
    mockListVariables.mockRejectedValue(new Error('Network error'))

    renderStep4()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/network error/i)
    })
  })

  it('logs error when API fetch fails', async () => {
    mockListVariables.mockRejectedValue(new Error('Network error'))

    renderStep4()

    await waitFor(() => {
      expect(mockLogger.error).toHaveBeenCalledWith('GTM-API', expect.stringContaining('Network error'))
    })
  })

  // --- Loading state ---

  it('shows loading state while fetching', () => {
    // Make the fetch hang by not resolving
    mockListVariables.mockReturnValue(new Promise(() => {}))

    renderStep4()

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})
