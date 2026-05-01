// executeEntities.test.ts — Tests for sequential execution flow.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeAll } from './executeEntities'
import * as gtmApi from './gtmApi'
import type { ConflictResult, GtmEntity } from '../types'
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

function mockEntity(name: string, path: string, triggerId?: string): GtmEntity {
  return {
    name,
    type: triggerId ? 'customEvent' : 'gaawe',
    path,
    ...(triggerId ? { triggerId } : {}),
  }
}

function triggerResult(entityName: string, status: ConflictResult['status'] = 'WILL_CREATE', triggerId?: string): ConflictResult {
  return {
    entityName,
    entityType: 'trigger',
    status,
    decision: status === 'CONFLICT' ? 'SKIP' : null,
    intendedPayload: { name: entityName, type: 'customEvent', customEventFilter: [] },
    ...(status !== 'WILL_CREATE' ? {
      existingEntity: mockEntity(entityName, `workspaces/1/triggers/${triggerId ?? '99'}`, triggerId ?? '99'),
    } : {}),
  }
}

function tagResult(entityName: string, pendingTriggerId: string): ConflictResult {
  return {
    entityName,
    entityType: 'tag',
    status: 'WILL_CREATE',
    decision: null,
    intendedPayload: {
      name: entityName,
      type: 'gaawe',
      parameter: [],
      firingTriggerId: [pendingTriggerId],
    },
  }
}

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

  it('resolves a named pending trigger ID from a newly created trigger', async () => {
    ;(gtmApi.createTrigger as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockEntity('EEC purchase', 'workspaces/1/triggers/42', '42')
    )
    ;(gtmApi.createTag as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockEntity('GA4 Event - purchase', 'workspaces/1/tags/15')
    )

    await executeAll(
      [
        triggerResult('EEC purchase'),
        tagResult('GA4 Event - purchase', '__PENDING_TRIGGER_ID__:EEC purchase'),
      ],
      'token',
      'workspaces/1',
      fakeLogger,
      vi.fn(),
      'G-TEST12345',
    )

    const tagPayload = (gtmApi.createTag as ReturnType<typeof vi.fn>).mock.calls[0][2]
    expect(tagPayload.firingTriggerId).toEqual(['42'])
  })

  it('resolves a named pending trigger ID from an already-correct existing trigger', async () => {
    ;(gtmApi.createTag as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockEntity('GA4 Event - begin_checkout', 'workspaces/1/tags/15')
    )

    await executeAll(
      [
        triggerResult('CE - eecCheckout', 'ALREADY_CORRECT', '55'),
        tagResult('GA4 Event - begin_checkout', '__PENDING_TRIGGER_ID__:CE - eecCheckout'),
      ],
      'token',
      'workspaces/1',
      fakeLogger,
      vi.fn(),
      'G-TEST12345',
    )

    const tagPayload = (gtmApi.createTag as ReturnType<typeof vi.fn>).mock.calls[0][2]
    expect(tagPayload.firingTriggerId).toEqual(['55'])
  })

  it('resolves a named pending trigger ID from a skipped existing trigger conflict', async () => {
    ;(gtmApi.createTag as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockEntity('GA4 Event - coupon_applied', 'workspaces/1/tags/15')
    )

    await executeAll(
      [
        triggerResult('CE - couponcode', 'CONFLICT', '77'),
        tagResult('GA4 Event - coupon_applied', '__PENDING_TRIGGER_ID__:CE - couponcode'),
      ],
      'token',
      'workspaces/1',
      fakeLogger,
      vi.fn(),
      'G-TEST12345',
    )

    const tagPayload = (gtmApi.createTag as ReturnType<typeof vi.fn>).mock.calls[0][2]
    expect(tagPayload.firingTriggerId).toEqual(['77'])
  })

  it('stops locally when a named pending trigger ID cannot be resolved', async () => {
    const outcome = await executeAll(
      [tagResult('GA4 Event - purchase', '__PENDING_TRIGGER_ID__:EEC purchase')],
      'token',
      'workspaces/1',
      fakeLogger,
      vi.fn(),
      'G-TEST12345',
    )

    expect(outcome.stopped).toBe(true)
    expect(outcome.results[0].action).toBe('ERROR')
    expect(outcome.results[0].errorMessage).toContain('Could not resolve firing trigger "EEC purchase"')
    expect(gtmApi.createTag).not.toHaveBeenCalled()
  })

  it('stops locally when a pending trigger marker is malformed', async () => {
    const outcome = await executeAll(
      [tagResult('GA4 Event - purchase', '__PENDING_TRIGGER_ID__EEC purchase')],
      'token',
      'workspaces/1',
      fakeLogger,
      vi.fn(),
      'G-TEST12345',
    )

    expect(outcome.stopped).toBe(true)
    expect(outcome.results[0].action).toBe('ERROR')
    expect(outcome.results[0].errorMessage).toContain('Invalid pending trigger marker')
    expect(gtmApi.createTag).not.toHaveBeenCalled()
  })
})
