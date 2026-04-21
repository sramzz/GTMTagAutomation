// Step3Input.test.tsx — Tests for S4D Standard / Custom JSON mode toggle, validation, and dry run trigger.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Step3Input } from './Step3Input'
import type { EntityLists } from '../services/inputParser'

// --- Mock data ---

const mockEntities: EntityLists = {
  variables: [{ name: 'DLV - ecommerce.items', type: 'v', parameter: [] }],
  triggers: [{ name: 'CE - view_item_list', type: 'customEvent', customEventFilter: [] }],
  tags: [{ name: 'GA4 Event - view_item_list', type: 'gaawe', parameter: [], firingTriggerId: [] }],
}

const mockAuditEntities: EntityLists = {
  variables: [{ name: 'DLV - ecommerce.items', type: 'v', parameter: [] }],
  triggers: [
    { name: 'CE - view_item_list', type: 'customEvent', customEventFilter: [] },
    { name: 'CE - custom_click', type: 'customEvent', customEventFilter: [] },
  ],
  tags: [
    { name: 'GA4 Event - view_item_list', type: 'gaawe', parameter: [], firingTriggerId: [] },
    { name: 'GA4 Event - custom_click', type: 'gaawe', parameter: [], firingTriggerId: [] },
  ],
}

// --- Mocks ---

const mockGetEntitiesFromMasterMapping = vi.fn<() => EntityLists>()
const mockParseAuditJson = vi.fn()
const mockGetEntitiesFromAuditJson = vi.fn<() => EntityLists>()

vi.mock('../services/inputParser', () => ({
  getEntitiesFromMasterMapping: (...args: unknown[]) => mockGetEntitiesFromMasterMapping(...args),
  parseAuditJson: (...args: unknown[]) => mockParseAuditJson(...args),
  getEntitiesFromAuditJson: (...args: unknown[]) => mockGetEntitiesFromAuditJson(...args),
}))

vi.mock('../data/masterMapping.json', () => ({
  default: {
    _meta: { version: '1.0', totalEvents: 3, liveEvents: 2, systemEvents: 1, skipEvents: 0 },
    events: [
      {
        id: 1, category: 'TEST', dataLayerEvent: 'view_item_list',
        ga4EventName: 'view_item_list', status: 'LIVE', whenItFires: 'test',
        gtmVariables: [{ dlvPath: 'ecommerce.items', gtmVarName: 'DLV - ecommerce.items' }],
        gtmTriggerName: 'CE - view_item_list', gtmTagName: 'GA4 Event - view_item_list',
        ga4Parameters: [{ paramName: 'items', gtmVarRef: '{{DLV - ecommerce.items}}' }],
      },
    ],
  },
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

describe('Step3Input', () => {
  const mockOnEntitiesReady = vi.fn()
  const MEASUREMENT_ID = 'G-ABC1234567'

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEntitiesFromMasterMapping.mockReturnValue(mockEntities)
    mockGetEntitiesFromAuditJson.mockReturnValue(mockAuditEntities)
    mockParseAuditJson.mockReturnValue({ success: true, data: { view_item_list: { count: 5, variables: ['ecommerce.items'] } } })
  })

  // --- Defaults to S4D Standard mode ---

  it('defaults to S4D Standard mode and shows entity counts', () => {
    render(<Step3Input measurementId={MEASUREMENT_ID} onEntitiesReady={mockOnEntitiesReady} />)

    // S4D Standard tab should be active
    expect(screen.getByRole('tab', { name: /s4d standard/i })).toHaveAttribute('aria-selected', 'true')

    // Should show entity preview counts from master mapping
    expect(screen.getByText(/1 variable/i)).toBeInTheDocument()
    expect(screen.getByText(/1 trigger/i)).toBeInTheDocument()
    expect(screen.getByText(/1 tag/i)).toBeInTheDocument()
  })

  it('calls getEntitiesFromMasterMapping with events and measurementId', () => {
    render(<Step3Input measurementId={MEASUREMENT_ID} onEntitiesReady={mockOnEntitiesReady} />)

    expect(mockGetEntitiesFromMasterMapping).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ dataLayerEvent: 'view_item_list' })]),
      MEASUREMENT_ID
    )
  })

  // --- Toggles to Custom JSON mode ---

  it('toggles to Custom JSON mode and shows textarea', async () => {
    const user = userEvent.setup()
    render(<Step3Input measurementId={MEASUREMENT_ID} onEntitiesReady={mockOnEntitiesReady} />)

    await user.click(screen.getByRole('tab', { name: /custom json/i }))

    expect(screen.getByRole('tab', { name: /custom json/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('toggles back to S4D Standard mode', async () => {
    const user = userEvent.setup()
    render(<Step3Input measurementId={MEASUREMENT_ID} onEntitiesReady={mockOnEntitiesReady} />)

    await user.click(screen.getByRole('tab', { name: /custom json/i }))
    await user.click(screen.getByRole('tab', { name: /s4d standard/i }))

    expect(screen.getByRole('tab', { name: /s4d standard/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  // --- Custom JSON: validates pasted JSON ---

  it('shows parse error for invalid JSON', async () => {
    mockParseAuditJson.mockReturnValue({ success: false, error: 'Invalid JSON. Check for syntax errors.' })

    const user = userEvent.setup()
    render(<Step3Input measurementId={MEASUREMENT_ID} onEntitiesReady={mockOnEntitiesReady} />)

    await user.click(screen.getByRole('tab', { name: /custom json/i }))
    // Use fireEvent.change because userEvent.type interprets curly braces as keyboard descriptors
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{bad json' } })

    await waitFor(() => {
      expect(screen.getByText(/invalid json/i)).toBeInTheDocument()
    })
  })

  it('shows event count on valid JSON input', async () => {
    const user = userEvent.setup()
    render(<Step3Input measurementId={MEASUREMENT_ID} onEntitiesReady={mockOnEntitiesReady} />)

    await user.click(screen.getByRole('tab', { name: /custom json/i }))

    const validJson = '{"view_item_list":{"count":5,"variables":["ecommerce.items"]}}'
    fireEvent.change(screen.getByRole('textbox'), { target: { value: validJson } })

    await waitFor(() => {
      expect(screen.getByText(/1 event detected/i)).toBeInTheDocument()
    })
  })

  // --- Custom JSON: file upload ---

  it('accepts a JSON file upload', async () => {
    const user = userEvent.setup()
    render(<Step3Input measurementId={MEASUREMENT_ID} onEntitiesReady={mockOnEntitiesReady} />)

    await user.click(screen.getByRole('tab', { name: /custom json/i }))

    const fileContent = '{"view_item_list":{"count":5,"variables":["ecommerce.items"]}}'
    const file = new File([fileContent], 'audit.json', { type: 'application/json' })

    const fileInput = screen.getByLabelText(/upload/i)
    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(screen.getByText(/1 event detected/i)).toBeInTheDocument()
    })
  })

  it('rejects non-JSON file upload', async () => {
    const user = userEvent.setup()
    render(<Step3Input measurementId={MEASUREMENT_ID} onEntitiesReady={mockOnEntitiesReady} />)

    await user.click(screen.getByRole('tab', { name: /custom json/i }))

    const file = new File(['not json'], 'data.csv', { type: 'text/csv' })
    const fileInput = screen.getByLabelText(/upload/i)
    // Use fireEvent because userEvent.upload respects the accept attribute and would skip a .csv
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/only .json files/i)).toBeInTheDocument()
    })
  })

  // --- Run Dry Run button ---

  it('enables Run Dry Run button in S4D Standard mode', () => {
    render(<Step3Input measurementId={MEASUREMENT_ID} onEntitiesReady={mockOnEntitiesReady} />)

    expect(screen.getByRole('button', { name: /run dry run/i })).toBeEnabled()
  })

  it('disables Run Dry Run button in Custom JSON mode until valid input', async () => {
    mockParseAuditJson.mockReturnValue({ success: false, error: 'Invalid JSON.' })

    const user = userEvent.setup()
    render(<Step3Input measurementId={MEASUREMENT_ID} onEntitiesReady={mockOnEntitiesReady} />)

    await user.click(screen.getByRole('tab', { name: /custom json/i }))

    // Button disabled when textarea is empty
    expect(screen.getByRole('button', { name: /run dry run/i })).toBeDisabled()
  })

  it('enables Run Dry Run button after valid JSON is entered', async () => {
    const user = userEvent.setup()
    render(<Step3Input measurementId={MEASUREMENT_ID} onEntitiesReady={mockOnEntitiesReady} />)

    await user.click(screen.getByRole('tab', { name: /custom json/i }))

    const validJson = '{"view_item_list":{"count":5,"variables":["ecommerce.items"]}}'
    fireEvent.change(screen.getByRole('textbox'), { target: { value: validJson } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run dry run/i })).toBeEnabled()
    })
  })

  it('calls onEntitiesReady with master mapping entities on Run Dry Run in S4D mode', async () => {
    const user = userEvent.setup()
    render(<Step3Input measurementId={MEASUREMENT_ID} onEntitiesReady={mockOnEntitiesReady} />)

    await user.click(screen.getByRole('button', { name: /run dry run/i }))

    expect(mockOnEntitiesReady).toHaveBeenCalledWith(mockEntities)
  })

  it('calls onEntitiesReady with audit entities on Run Dry Run in Custom JSON mode', async () => {
    const user = userEvent.setup()
    render(<Step3Input measurementId={MEASUREMENT_ID} onEntitiesReady={mockOnEntitiesReady} />)

    await user.click(screen.getByRole('tab', { name: /custom json/i }))

    const validJson = '{"view_item_list":{"count":5,"variables":["ecommerce.items"]}}'
    fireEvent.change(screen.getByRole('textbox'), { target: { value: validJson } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run dry run/i })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: /run dry run/i }))

    expect(mockGetEntitiesFromAuditJson).toHaveBeenCalled()
    expect(mockOnEntitiesReady).toHaveBeenCalledWith(mockAuditEntities)
  })

  // --- Logging ---

  it('logs when S4D Standard mode is selected', () => {
    render(<Step3Input measurementId={MEASUREMENT_ID} onEntitiesReady={mockOnEntitiesReady} />)

    expect(mockLogger.info).toHaveBeenCalledWith('WIZARD', expect.stringContaining('S4D Standard'))
  })

  it('logs validation result for valid JSON', async () => {
    const user = userEvent.setup()
    render(<Step3Input measurementId={MEASUREMENT_ID} onEntitiesReady={mockOnEntitiesReady} />)

    await user.click(screen.getByRole('tab', { name: /custom json/i }))

    const validJson = '{"view_item_list":{"count":5,"variables":["ecommerce.items"]}}'
    fireEvent.change(screen.getByRole('textbox'), { target: { value: validJson } })

    await waitFor(() => {
      expect(mockLogger.info).toHaveBeenCalledWith('VALIDATION', expect.stringContaining('valid'))
    })
  })

  it('logs validation error for invalid JSON', async () => {
    mockParseAuditJson.mockReturnValue({ success: false, error: 'Invalid JSON. Check for syntax errors.' })

    const user = userEvent.setup()
    render(<Step3Input measurementId={MEASUREMENT_ID} onEntitiesReady={mockOnEntitiesReady} />)

    await user.click(screen.getByRole('tab', { name: /custom json/i }))

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{bad' } })

    await waitFor(() => {
      expect(mockLogger.warn).toHaveBeenCalledWith('VALIDATION', expect.stringContaining('Invalid JSON'))
    })
  })

  it('logs dry run trigger', async () => {
    const user = userEvent.setup()
    render(<Step3Input measurementId={MEASUREMENT_ID} onEntitiesReady={mockOnEntitiesReady} />)

    await user.click(screen.getByRole('button', { name: /run dry run/i }))

    expect(mockLogger.info).toHaveBeenCalledWith('WIZARD', expect.stringContaining('Dry run'))
  })
})
