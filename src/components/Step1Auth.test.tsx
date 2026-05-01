// Step1Auth.test.tsx — Tests for the authentication step.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Step1Auth } from './Step1Auth'

// Mock the auth module
vi.mock('../services/auth', () => ({
  buildOAuthUrl: vi.fn(() => 'https://accounts.google.com/mock-oauth'),
  parseTokenFromHash: vi.fn(() => null),
}))

// Mock the LogContext
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

describe('Step1Auth', () => {
  const mockOnAuthenticated = vi.fn()

  beforeEach(() => {
    mockOnAuthenticated.mockClear()
    mockLogger.info.mockClear()
    mockLogger.error.mockClear()
    mockLogger.success.mockClear()
    // Reset the hash
    window.location.hash = ''
  })

  it('shows the sign-in button', () => {
    render(<Step1Auth onAuthenticated={mockOnAuthenticated} />)
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })

  it('shows the tool tagline and prerequisites', () => {
    render(<Step1Auth onAuthenticated={mockOnAuthenticated} />)
    expect(screen.getByText(/creates variables, triggers, and tags/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /before you start/i })).toBeInTheDocument()
    expect(screen.getByText(/editor access/i)).toBeInTheDocument()
    expect(screen.getByText(/measurement id/i)).toBeInTheDocument()
    expect(screen.getByText(/s4d standard/i)).toBeInTheDocument()
    expect(screen.getByText(/custom audit/i)).toBeInTheDocument()
  })

  it('calls onAuthenticated when token is found in URL hash on mount', async () => {
    const { parseTokenFromHash } = await import('../services/auth')
    vi.mocked(parseTokenFromHash).mockReturnValue('ya29.test-token')

    window.location.hash = '#access_token=ya29.test-token'
    render(<Step1Auth onAuthenticated={mockOnAuthenticated} />)

    expect(mockOnAuthenticated).toHaveBeenCalledWith('ya29.test-token')
  })

  it('shows error message when auth error is in the URL hash', async () => {
    const { parseTokenFromHash } = await import('../services/auth')
    vi.mocked(parseTokenFromHash).mockReturnValue(null)

    window.location.hash = '#error=access_denied'
    render(<Step1Auth onAuthenticated={mockOnAuthenticated} />)

    expect(screen.getByText(/authentication failed/i)).toBeInTheDocument()
    expect(mockOnAuthenticated).not.toHaveBeenCalled()
  })

  it('does not call onAuthenticated when hash is empty', async () => {
    const { parseTokenFromHash } = await import('../services/auth')
    vi.mocked(parseTokenFromHash).mockReturnValue(null)

    window.location.hash = ''
    render(<Step1Auth onAuthenticated={mockOnAuthenticated} />)

    expect(mockOnAuthenticated).not.toHaveBeenCalled()
  })

  it('logs when authentication succeeds', async () => {
    const { parseTokenFromHash } = await import('../services/auth')
    vi.mocked(parseTokenFromHash).mockReturnValue('ya29.test-token')

    window.location.hash = '#access_token=ya29.test-token'
    render(<Step1Auth onAuthenticated={mockOnAuthenticated} />)

    expect(mockLogger.success).toHaveBeenCalledWith('AUTH', expect.stringContaining('authenticated'))
  })
})
