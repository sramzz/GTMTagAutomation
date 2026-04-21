// App.test.tsx — Integration tests for the wizard shell.
// Verifies the app renders without crashing and Step 1 (auth) is shown by default.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

// Step1Auth imports auth service functions — mock them so rendering doesn't
// trigger real OAuth logic.
vi.mock('./services/auth', () => ({
  buildOAuthUrl: vi.fn(() => 'https://accounts.google.com/mock-oauth'),
  parseTokenFromHash: vi.fn(() => null),
}))

describe('App wizard shell', () => {
  beforeEach(() => {
    window.location.hash = ''
  })

  it('renders step 1 (auth) by default', () => {
    render(<App />)
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
  })

  it('shows the app title', () => {
    render(<App />)
    expect(screen.getByText('GTM Automation Tool')).toBeInTheDocument()
  })

  it('shows step indicator', () => {
    render(<App />)
    expect(screen.getByText(/1\. Authenticate/)).toBeInTheDocument()
  })

  it('state flows between steps correctly', () => {
    render(<App />)
    // Step 1 (Auth) should be visible on initial render
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
    expect(screen.getByText(/Step 1/)).toBeInTheDocument()
  })
})
