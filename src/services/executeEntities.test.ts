// executeEntities.test.ts — Tests for sequential execution flow.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeAll } from './executeEntities'
import * as gtmApi from './gtmApi'
import type { ConflictResult } from '../types'
import type { Logger } from '../logging/logger'

vi.mock('./gtmApi', async () => {
  const actual = await vi.importActual<typeof gtmApi>('./gtmApi')
  return {
    ...actual,
    createTag: vi.fn(),
    createTrigger: vi.fn(),
    createVariable: vi.fn(),
    updateTag: vi.fn(),
    updateTrigger: vi.fn(),
    updateVariable: vi.fn(),
    attachLogger: vi.fn(),
  }
})

const fakeLogger: Logger = {
  info: vi.fn(),
  success: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  getEntries: vi.fn().mockReturnValue([]),
  clear: vi.fn(),
  onEntry: null,
} as unknown as Logger

beforeEach(() => {
  vi.clearAllMocks()
})

describe('executeAll', () => {
  it('does NOT auto-create the GA4 Config Tag when it is not in the conflict list', async () => {
    // After the fix, the Config Tag is added in inputParser, so executeAll
    // must NOT call createTag for it on its own. This test will FAIL today
    // because executeEntities.ts:158-174 auto-creates it.
    const items: ConflictResult[] = []  // empty — Config Tag is not here
    const onProgress = vi.fn()

    await executeAll(items, 'token', 'workspaces/123', fakeLogger, onProgress, 'G-TEST12345')

    expect(gtmApi.createTag).not.toHaveBeenCalled()
  })
})
