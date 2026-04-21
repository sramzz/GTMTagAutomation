// conflictDetection.test.ts — Tests for classifying entities as WILL_CREATE, ALREADY_CORRECT, or CONFLICT.

import { describe, it, expect } from 'vitest'
import { detectConflicts } from './conflictDetection'
import type { GtmVariablePayload, GtmEntity } from '../types'

function makeVar(name: string, dlvPath: string): GtmVariablePayload {
  return {
    name,
    type: 'v',
    parameter: [
      { type: 'integer', key: 'dataLayerVersion', value: '2' },
      { type: 'boolean', key: 'setDefaultValue', value: 'false' },
      { type: 'template', key: 'name', value: dlvPath },
    ],
  }
}

function makeExistingVar(name: string, dlvPath: string, path: string): GtmEntity {
  return {
    name,
    type: 'v',
    path,
    parameter: [
      { type: 'integer', key: 'dataLayerVersion', value: '2' },
      { type: 'boolean', key: 'setDefaultValue', value: 'false' },
      { type: 'template', key: 'name', value: dlvPath },
    ],
  }
}

describe('detectConflicts', () => {
  it('marks as WILL_CREATE when no existing entity matches by name', () => {
    const intended = [makeVar('DLV - ecommerce.items', 'ecommerce.items')]
    const existing: GtmEntity[] = []
    const results = detectConflicts(intended, existing, 'variable')
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('WILL_CREATE')
    expect(results[0].decision).toBeNull()
  })

  it('marks as ALREADY_CORRECT when existing entity matches name and parameters', () => {
    const intended = [makeVar('DLV - ecommerce.items', 'ecommerce.items')]
    const existing = [makeExistingVar('DLV - ecommerce.items', 'ecommerce.items', 'accounts/1/containers/2/workspaces/3/variables/4')]
    const results = detectConflicts(intended, existing, 'variable')
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('ALREADY_CORRECT')
    expect(results[0].existingEntity).toBeDefined()
  })

  it('marks as CONFLICT when name matches but parameters differ', () => {
    const intended = [makeVar('DLV - ecommerce.items', 'ecommerce.items')]
    const existing: GtmEntity[] = [{
      name: 'DLV - ecommerce.items',
      type: 'v',
      path: 'accounts/1/containers/2/workspaces/3/variables/4',
      parameter: [
        { type: 'integer', key: 'dataLayerVersion', value: '1' },
        { type: 'boolean', key: 'setDefaultValue', value: 'false' },
        { type: 'template', key: 'name', value: 'ecommerce.items' },
      ],
    }]
    const results = detectConflicts(intended, existing, 'variable')
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('CONFLICT')
    expect(results[0].decision).toBeNull()
    expect(results[0].existingEntity).toBeDefined()
  })

  it('marks as CONFLICT when name matches but type differs', () => {
    const intended = [makeVar('DLV - ecommerce.items', 'ecommerce.items')]
    const existing: GtmEntity[] = [{
      name: 'DLV - ecommerce.items',
      type: 'jsm',
      path: 'accounts/1/containers/2/workspaces/3/variables/4',
      parameter: [],
    }]
    const results = detectConflicts(intended, existing, 'variable')
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('CONFLICT')
  })

  it('handles multiple entities with mixed statuses', () => {
    const intended = [
      makeVar('DLV - ecommerce.items', 'ecommerce.items'),
      makeVar('DLV - ecommerce.currency', 'ecommerce.currency'),
      makeVar('DLV - ecommerce.value', 'ecommerce.value'),
    ]
    const existing = [
      makeExistingVar('DLV - ecommerce.items', 'ecommerce.items', 'path/1'),
      makeExistingVar('DLV - ecommerce.currency', 'ecommerce.NOT_currency', 'path/2'),
    ]
    const results = detectConflicts(intended, existing, 'variable')
    expect(results).toHaveLength(3)
    expect(results.find(r => r.entityName === 'DLV - ecommerce.items')!.status).toBe('ALREADY_CORRECT')
    expect(results.find(r => r.entityName === 'DLV - ecommerce.currency')!.status).toBe('CONFLICT')
    expect(results.find(r => r.entityName === 'DLV - ecommerce.value')!.status).toBe('WILL_CREATE')
  })
})
