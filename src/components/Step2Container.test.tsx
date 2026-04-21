// Step2Container.test.tsx — Tests for account/container selection, GA4 validation, and workspace creation.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Step2Container } from './Step2Container'
import type { GtmAccount, GtmContainer, GtmWorkspace } from '../types'

// --- Mock data ---

const mockAccounts: GtmAccount[] = [
  { accountId: '111', name: 'Acme Corp', path: 'accounts/111' },
  { accountId: '222', name: 'Beta Inc', path: 'accounts/222' },
]

const mockContainers: GtmContainer[] = [
  { containerId: 'c1', name: 'Web Prod', path: 'accounts/111/containers/c1', publicId: 'GTM-ABC123' },
  { containerId: 'c2', name: 'Web Staging', path: 'accounts/111/containers/c2', publicId: 'GTM-DEF456' },
]

const mockWorkspaces: GtmWorkspace[] = [
  { workspaceId: 'w1', name: 'Default Workspace', path: 'accounts/111/containers/c1/workspaces/w1' },
]

const createdWorkspace: GtmWorkspace = {
  workspaceId: 'w99',
  name: 'S4D Automation - 2026-04-21',
  path: 'accounts/111/containers/c1/workspaces/w99',
}

// --- Mocks ---

const mockListAccounts = vi.fn<() => Promise<GtmAccount[]>>()
const mockListContainers = vi.fn<() => Promise<GtmContainer[]>>()
const mockListWorkspaces = vi.fn<() => Promise<GtmWorkspace[]>>()
const mockCreateWorkspace = vi.fn<() => Promise<GtmWorkspace>>()

vi.mock('../services/gtmApi', () => ({
  listAccounts: (...args: unknown[]) => mockListAccounts(...args),
  listContainers: (...args: unknown[]) => mockListContainers(...args),
  listWorkspaces: (...args: unknown[]) => mockListWorkspaces(...args),
  createWorkspace: (...args: unknown[]) => mockCreateWorkspace(...args),
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

describe('Step2Container', () => {
  const mockOnContainerSelected = vi.fn()
  const TOKEN = 'ya29.test-token'

  beforeEach(() => {
    vi.clearAllMocks()
    mockListAccounts.mockResolvedValue(mockAccounts)
    mockListContainers.mockResolvedValue(mockContainers)
    mockListWorkspaces.mockResolvedValue(mockWorkspaces)
    mockCreateWorkspace.mockResolvedValue(createdWorkspace)
  })

  // Shared helper: renders, waits for accounts, selects account + container + measurement ID
  async function renderAndFillForm(user: ReturnType<typeof userEvent.setup>) {
    render(<Step2Container accessToken={TOKEN} onContainerSelected={mockOnContainerSelected} />)
    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument())
    await user.selectOptions(screen.getByLabelText(/account/i), 'accounts/111')
    await waitFor(() => expect(screen.getByText('Web Prod (GTM-ABC123)')).toBeInTheDocument())
    await user.selectOptions(screen.getByLabelText(/container/i), 'accounts/111/containers/c1')
    await user.type(screen.getByLabelText(/measurement id/i), 'G-ABC1234567')
    await waitFor(() => expect(mockListWorkspaces).toHaveBeenCalled())
  }

  // --- Fetches and displays account list on mount ---

  it('fetches and displays accounts on mount', async () => {
    render(<Step2Container accessToken={TOKEN} onContainerSelected={mockOnContainerSelected} />)

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
      expect(screen.getByText('Beta Inc')).toBeInTheDocument()
    })

    expect(mockListAccounts).toHaveBeenCalledWith(TOKEN)
  })

  it('logs the account fetch API call', async () => {
    render(<Step2Container accessToken={TOKEN} onContainerSelected={mockOnContainerSelected} />)

    await waitFor(() => {
      expect(mockLogger.info).toHaveBeenCalledWith('GTM-API', expect.stringContaining('account'))
    })
  })

  it('shows error when account fetch fails with 403', async () => {
    mockListAccounts.mockRejectedValue(new Error('You need Editor access to this container. Ask the owner to grant it.'))

    render(<Step2Container accessToken={TOKEN} onContainerSelected={mockOnContainerSelected} />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/editor access/i)
    })
  })

  // --- On account selection, fetches and displays container list ---

  it('fetches containers when an account is selected', async () => {
    const user = userEvent.setup()
    render(<Step2Container accessToken={TOKEN} onContainerSelected={mockOnContainerSelected} />)

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    })

    const accountSelect = screen.getByLabelText(/account/i)
    await user.selectOptions(accountSelect, 'accounts/111')

    await waitFor(() => {
      expect(mockListContainers).toHaveBeenCalledWith(TOKEN, 'accounts/111')
    })

    await waitFor(() => {
      expect(screen.getByText('Web Prod (GTM-ABC123)')).toBeInTheDocument()
      expect(screen.getByText('Web Staging (GTM-DEF456)')).toBeInTheDocument()
    })
  })

  // --- Validates GA4 Measurement ID format ---

  it('accepts a valid GA4 Measurement ID', async () => {
    const user = userEvent.setup()
    render(<Step2Container accessToken={TOKEN} onContainerSelected={mockOnContainerSelected} />)

    const input = screen.getByLabelText(/measurement id/i)
    await user.type(input, 'G-ABC1234567')

    // No error should appear for valid input
    expect(screen.queryByText(/must match/i)).not.toBeInTheDocument()
  })

  // --- Rejects invalid Measurement ID with inline error ---

  it('shows inline error for invalid Measurement ID', async () => {
    const user = userEvent.setup()
    render(<Step2Container accessToken={TOKEN} onContainerSelected={mockOnContainerSelected} />)

    const input = screen.getByLabelText(/measurement id/i)
    await user.type(input, 'INVALID')
    // Trigger blur to show validation error
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText(/must match format G-/i)).toBeInTheDocument()
    })
  })

  it('shows inline error for Measurement ID missing the G- prefix', async () => {
    const user = userEvent.setup()
    render(<Step2Container accessToken={TOKEN} onContainerSelected={mockOnContainerSelected} />)

    const input = screen.getByLabelText(/measurement id/i)
    await user.type(input, 'ABC1234567')
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText(/must match format G-/i)).toBeInTheDocument()
    })
  })

  // --- "Next" button disabled until account, container, and valid Measurement ID are set ---

  it('disables Next button when nothing is selected', async () => {
    render(<Step2Container accessToken={TOKEN} onContainerSelected={mockOnContainerSelected} />)

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('disables Next button when only account is selected', async () => {
    const user = userEvent.setup()
    render(<Step2Container accessToken={TOKEN} onContainerSelected={mockOnContainerSelected} />)

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText(/account/i), 'accounts/111')

    await waitFor(() => {
      expect(screen.getByText('Web Prod (GTM-ABC123)')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('enables Next button when account, container, and valid Measurement ID are set', async () => {
    const user = userEvent.setup()
    await renderAndFillForm(user)

    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
  })

  // --- Checks workspace count and warns if at limit ---

  it('shows workspace limit warning when container has 3 workspaces', async () => {
    const threeWorkspaces: GtmWorkspace[] = [
      { workspaceId: 'w1', name: 'WS 1', path: 'p/w1' },
      { workspaceId: 'w2', name: 'WS 2', path: 'p/w2' },
      { workspaceId: 'w3', name: 'WS 3', path: 'p/w3' },
    ]
    mockListWorkspaces.mockResolvedValue(threeWorkspaces)

    const user = userEvent.setup()
    render(<Step2Container accessToken={TOKEN} onContainerSelected={mockOnContainerSelected} />)

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText(/account/i), 'accounts/111')
    await waitFor(() => {
      expect(screen.getByText('Web Prod (GTM-ABC123)')).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText(/container/i), 'accounts/111/containers/c1')

    await waitFor(() => {
      expect(screen.getByText(/3 workspaces \(maximum 3\)/i)).toBeInTheDocument()
    })

    // Next button should be disabled even with valid Measurement ID
    await user.type(screen.getByLabelText(/measurement id/i), 'G-ABC1234567')
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  // --- Creates dated workspace on "Next" click ---

  it('creates workspace and calls onContainerSelected on Next click', async () => {
    const user = userEvent.setup()
    await renderAndFillForm(user)

    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(mockCreateWorkspace).toHaveBeenCalledWith(
        TOKEN,
        'accounts/111/containers/c1',
        expect.stringMatching(/^S4D Automation - \d{4}-\d{2}-\d{2}$/)
      )
    })

    await waitFor(() => {
      expect(mockOnContainerSelected).toHaveBeenCalledWith(
        mockContainers[0],
        createdWorkspace,
        'G-ABC1234567'
      )
    })
  })

  // --- Logs all API calls and results ---

  it('logs container fetch', async () => {
    const user = userEvent.setup()
    render(<Step2Container accessToken={TOKEN} onContainerSelected={mockOnContainerSelected} />)

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText(/account/i), 'accounts/111')

    await waitFor(() => {
      expect(mockLogger.info).toHaveBeenCalledWith('GTM-API', expect.stringContaining('container'))
    })
  })

  it('logs workspace creation', async () => {
    const user = userEvent.setup()
    await renderAndFillForm(user)

    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(mockLogger.info).toHaveBeenCalledWith('GTM-API', expect.stringContaining('workspace'))
    })
  })

  it('logs validation error for invalid Measurement ID', async () => {
    const user = userEvent.setup()
    render(<Step2Container accessToken={TOKEN} onContainerSelected={mockOnContainerSelected} />)

    const input = screen.getByLabelText(/measurement id/i)
    await user.type(input, 'INVALID')
    await user.tab()

    await waitFor(() => {
      expect(mockLogger.warn).toHaveBeenCalledWith('VALIDATION', expect.stringContaining('Measurement ID'))
    })
  })

  it('shows error when workspace creation fails', async () => {
    mockCreateWorkspace.mockRejectedValue(new Error('You need Editor access to this container. Ask the owner to grant it.'))

    const user = userEvent.setup()
    await renderAndFillForm(user)

    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/editor access/i)
    })
  })

  it('logs step transition on successful Next', async () => {
    const user = userEvent.setup()
    await renderAndFillForm(user)

    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(mockLogger.success).toHaveBeenCalledWith('WIZARD', expect.stringContaining('Step 2'))
    })
  })
})
