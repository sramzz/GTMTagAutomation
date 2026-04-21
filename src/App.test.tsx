// App.test.tsx — Tests for the wizard shell navigation.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App wizard shell', () => {
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
    expect(screen.getByText(/Step 1/)).toBeInTheDocument()
  })
})
