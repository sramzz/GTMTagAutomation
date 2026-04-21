// SummaryBar.test.tsx — Tests for the conflict summary bar.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SummaryBar } from './SummaryBar'

describe('SummaryBar', () => {
  it('shows create, conflict, and correct counts', () => {
    render(<SummaryBar toCreate={5} conflicts={2} skipped={1} toOverwrite={1} alreadyCorrect={3} />)
    expect(screen.getByText(/5 to create/)).toBeInTheDocument()
    expect(screen.getByText(/2 conflicts/)).toBeInTheDocument()
    expect(screen.getByText(/3 already correct/)).toBeInTheDocument()
  })

  it('shows skipped and overwrite breakdown within conflicts', () => {
    render(<SummaryBar toCreate={0} conflicts={4} skipped={3} toOverwrite={1} alreadyCorrect={0} />)
    expect(screen.getByText(/3 skipped/)).toBeInTheDocument()
    expect(screen.getByText(/1 to overwrite/)).toBeInTheDocument()
  })
})
