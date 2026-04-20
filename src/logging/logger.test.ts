// logger.test.ts — Tests for the centralized logger module.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createLogger } from './logger'

describe('createLogger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('stores an INFO entry with correct fields', () => {
    const logger = createLogger()
    logger.info('GTM-API', 'Fetching accounts list...')

    const entries = logger.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].source).toBe('GTM-API')
    expect(entries[0].level).toBe('INFO')
    expect(entries[0].message).toBe('Fetching accounts list...')
    expect(entries[0].datetime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('stores a WARN entry', () => {
    const logger = createLogger()
    logger.warn('CONFLICT', 'Variable "DLV - ecommerce.items" already exists')

    const entries = logger.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].level).toBe('WARN')
    expect(entries[0].source).toBe('CONFLICT')
  })

  it('stores an ERROR entry', () => {
    const logger = createLogger()
    logger.error('GTM-API', 'Failed to create tag: 403 Forbidden')

    const entries = logger.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].level).toBe('ERROR')
  })

  it('stores a SUCCESS entry', () => {
    const logger = createLogger()
    logger.success('GTM-API', 'Created trigger "CE - add_to_cart" (id: 847)')

    const entries = logger.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].level).toBe('SUCCESS')
  })

  it('accumulates multiple entries in order', () => {
    const logger = createLogger()
    logger.info('AUTH', 'First')
    logger.warn('CONFLICT', 'Second')
    logger.error('GTM-API', 'Third')

    const entries = logger.getEntries()
    expect(entries).toHaveLength(3)
    expect(entries[0].message).toBe('First')
    expect(entries[1].message).toBe('Second')
    expect(entries[2].message).toBe('Third')
  })

  it('writes INFO to console.log', () => {
    const logger = createLogger()
    logger.info('AUTH', 'User authenticated')

    expect(console.log).toHaveBeenCalledTimes(1)
    const loggedString = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(loggedString).toContain('[AUTH]')
    expect(loggedString).toContain('INFO')
    expect(loggedString).toContain('User authenticated')
  })

  it('writes WARN to console.warn', () => {
    const logger = createLogger()
    logger.warn('CONFLICT', 'Conflict detected')

    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('writes ERROR to console.error', () => {
    const logger = createLogger()
    logger.error('GTM-API', 'Request failed')

    expect(console.error).toHaveBeenCalledTimes(1)
  })

  it('clears all entries', () => {
    const logger = createLogger()
    logger.info('AUTH', 'Something')
    logger.clear()

    expect(logger.getEntries()).toHaveLength(0)
  })
})
