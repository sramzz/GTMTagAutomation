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

  it('logs CREATED for a Config Tag passed in via the items list', async () => {
    const items: ConflictResult[] = [{
      entityName: 'GA4 - Configuration TAG',
      entityType: 'tag',
      status: 'WILL_CREATE',
      decision: null,
      intendedPayload: {
        name: 'GA4 - Configuration TAG',
        type: 'gaawc',
        parameter: [
          { key: 'measurementId', type: 'template', value: 'G-TEST12345' },
          { key: 'sendPageView', type: 'boolean', value: 'true' },
        ],
        firingTriggerId: ['2147479553'],
      },
    }]
    ;(gtmApi.createTag as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: 'GA4 - Configuration TAG', type: 'gaawc', path: 'workspaces/1/tags/1',
    })

    await executeAll(items, 'token', 'workspaces/1', fakeLogger, vi.fn(), 'G-TEST12345')

    expect(fakeLogger.success).toHaveBeenCalledWith(
      'GTM-API',
      'CREATED tag "GA4 - Configuration TAG"',
    )
  })
})
