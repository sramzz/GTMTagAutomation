// inputParser.test.ts — Tests for parsing audit JSON and generating entity lists from the master mapping.

import { describe, it, expect } from 'vitest'
import { parseAuditJson, getEntitiesFromMasterMapping, getEntitiesFromAuditJson } from './inputParser'
import type { AuditJson, MasterMappingEntry } from '../types'

describe('parseAuditJson', () => {
  it('parses valid audit JSON string', () => {
    const input = '{"view_item_list": {"count": 3, "variables": ["event", "ecommerce.items"]}}'
    const result = parseAuditJson(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data['view_item_list'].count).toBe(3)
      expect(result.data['view_item_list'].variables).toContain('ecommerce.items')
    }
  })

  it('returns error for invalid JSON', () => {
    const result = parseAuditJson('not json at all')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Invalid JSON')
    }
  })

  it('returns error for JSON that is valid but wrong structure (array instead of object)', () => {
    const result = parseAuditJson('[1, 2, 3]')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('must be an object')
    }
  })

  it('returns error for event missing variables array', () => {
    const result = parseAuditJson('{"some_event": {"count": 1}}')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('variables')
    }
  })
})

describe('getEntitiesFromMasterMapping', () => {
  const liveMappingEntry: MasterMappingEntry = {
    id: 1,
    category: 'TEST',
    dataLayerEvent: 'view_item_list',
    ga4EventName: 'view_item_list',
    whenItFires: 'test',
    status: 'LIVE',
    gtmVariables: [
      { dlvPath: 'ecommerce.items', gtmVarName: 'DLV - ecommerce.items' },
    ],
    gtmTriggerName: 'CE - view_item_list',
    gtmTagName: 'GA4 Event - view_item_list',
    ga4Parameters: [
      { paramName: 'items', gtmVarRef: '{{DLV - ecommerce.items}}' },
    ],
  }

  const systemEntry: MasterMappingEntry = {
    id: 29,
    category: 'CONSENT',
    dataLayerEvent: 'OneTrustLoaded',
    ga4EventName: null,
    whenItFires: 'test',
    status: 'SYSTEM',
    gtmVariables: [
      { dlvPath: 'OnetrustActiveGroups', gtmVarName: 'DLV - OnetrustActiveGroups' },
    ],
    gtmTriggerName: 'CE - OneTrustLoaded',
    gtmTagName: null,
    ga4Parameters: [],
  }

  const skipEntry: MasterMappingEntry = {
    id: 32,
    category: 'GTM SYSTEM',
    dataLayerEvent: 'gtm.js',
    ga4EventName: null,
    whenItFires: 'test',
    status: 'SKIP',
    gtmVariables: [],
    gtmTriggerName: null,
    gtmTagName: null,
    ga4Parameters: [],
  }

  it('produces variables, trigger, and tag for a LIVE entry', () => {
    const result = getEntitiesFromMasterMapping([liveMappingEntry], 'G-TEST12345')
    expect(result.variables).toHaveLength(1)
    expect(result.variables[0].name).toBe('DLV - ecommerce.items')
    expect(result.triggers).toHaveLength(1)
    expect(result.triggers[0].name).toBe('CE - view_item_list')
    expect(result.tags).toHaveLength(2) // includes GA4 Config Tag
    expect(result.tags[0].name).toBe('GA4 Event - view_item_list')
  })

  it('produces no event tag for a SYSTEM entry', () => {
    const result = getEntitiesFromMasterMapping([systemEntry], 'G-TEST12345')
    expect(result.variables).toHaveLength(1)
    expect(result.triggers).toHaveLength(1)
    expect(result.tags).toHaveLength(1) // includes GA4 Config Tag
  })

  it('produces no event tag, trigger, or variables for a SKIP entry', () => {
    const result = getEntitiesFromMasterMapping([skipEntry], 'G-TEST12345')
    expect(result.variables).toHaveLength(0)
    expect(result.triggers).toHaveLength(0)
    expect(result.tags).toHaveLength(1) // includes GA4 Config Tag
  })

  it('deduplicates variables shared across multiple events', () => {
    const entry2: MasterMappingEntry = {
      ...liveMappingEntry,
      id: 2,
      dataLayerEvent: 'select_item',
      ga4EventName: 'select_item',
      gtmTriggerName: 'CE - select_item',
      gtmTagName: 'GA4 Event - select_item',
      gtmVariables: [
        { dlvPath: 'ecommerce.items', gtmVarName: 'DLV - ecommerce.items' },
      ],
    }
    const result = getEntitiesFromMasterMapping([liveMappingEntry, entry2], 'G-TEST12345')
    expect(result.variables).toHaveLength(1)
    expect(result.triggers).toHaveLength(2)
    expect(result.tags).toHaveLength(3) // includes GA4 Config Tag
  })

  it('includes the GA4 Configuration Tag in the tags list', () => {
    const entries: MasterMappingEntry[] = [
      {
        id: 1, category: 'cat', dataLayerEvent: 'view_item',
        ga4EventName: 'view_item', whenItFires: '', status: 'LIVE',
        gtmVariables: [], gtmTriggerName: 'CE - view_item',
        gtmTagName: 'GA4 Event - view_item', ga4Parameters: [],
      },
    ]

    const result = getEntitiesFromMasterMapping(entries, 'G-TEST12345')

    const configTag = result.tags.find(t => t.name === 'GA4 - Configuration TAG')
    expect(configTag).toBeDefined()
    expect(configTag?.type).toBe('gaawc')
    // The measurementId is wired through to the config tag, not just hardcoded
    const measurementParam = configTag?.parameter.find(
      (p): p is { type: string; key: string; value: string } => 'value' in p && p.key === 'measurementId'
    )
    expect(measurementParam?.value).toBe('G-TEST12345')
  })

  it('includes exactly one Config Tag even with many event tags', () => {
    const entries: MasterMappingEntry[] = [
      { id: 1, category: 'c', dataLayerEvent: 'a', ga4EventName: 'a', whenItFires: '', status: 'LIVE', gtmVariables: [], gtmTriggerName: 'CE - a', gtmTagName: 'GA4 Event - a', ga4Parameters: [] },
      { id: 2, category: 'c', dataLayerEvent: 'b', ga4EventName: 'b', whenItFires: '', status: 'LIVE', gtmVariables: [], gtmTriggerName: 'CE - b', gtmTagName: 'GA4 Event - b', ga4Parameters: [] },
    ]

    const result = getEntitiesFromMasterMapping(entries, 'G-TEST12345')

    const configTags = result.tags.filter(t => t.name === 'GA4 - Configuration TAG')
    expect(configTags).toHaveLength(1)
  })
})

describe('getEntitiesFromAuditJson', () => {
  const masterEntries: MasterMappingEntry[] = [
    {
      id: 5,
      category: 'CART',
      dataLayerEvent: 'add_to_cart',
      ga4EventName: 'add_to_cart',
      whenItFires: 'test',
      status: 'LIVE',
      gtmVariables: [
        { dlvPath: 'ecommerce.currency', gtmVarName: 'DLV - ecommerce.currency' },
        { dlvPath: 'ecommerce.items', gtmVarName: 'DLV - ecommerce.items' },
      ],
      gtmTriggerName: 'CE - add_to_cart',
      gtmTagName: 'GA4 Event - add_to_cart',
      ga4Parameters: [
        { paramName: 'currency', gtmVarRef: '{{DLV - ecommerce.currency}}' },
        { paramName: 'items', gtmVarRef: '{{DLV - ecommerce.items}}' },
      ],
    },
  ]

  it('uses master mapping config when event name matches', () => {
    const audit: AuditJson = {
      'add_to_cart': { count: 5, variables: ['event', 'ecommerce.currency', 'ecommerce.items'] },
    }
    const result = getEntitiesFromAuditJson(audit, masterEntries, 'G-TEST12345')
    expect(result.triggers[0].name).toBe('CE - add_to_cart')
    expect(result.tags[0].name).toBe('GA4 Event - add_to_cart')
  })

  it('auto-derives config for events not in master mapping', () => {
    const audit: AuditJson = {
      'custom_event': { count: 1, variables: ['event', 'ecommerce.promo_id', 'some_field'] },
    }
    const result = getEntitiesFromAuditJson(audit, masterEntries, 'G-TEST12345')
    expect(result.triggers[0].name).toBe('CE - custom_event')
    expect(result.tags[0].name).toBe('GA4 Event - custom_event')
    expect(result.variables.map(v => v.name)).toContain('DLV - ecommerce.promo_id')
    expect(result.variables.map(v => v.name)).toContain('DLV - some_field')
  })

  it('filters out the "event" variable from audit data', () => {
    const audit: AuditJson = {
      'custom_event': { count: 1, variables: ['event', 'my_field'] },
    }
    const result = getEntitiesFromAuditJson(audit, masterEntries, 'G-TEST12345')
    expect(result.variables.map(v => v.name)).not.toContain('DLV - event')
    expect(result.variables).toHaveLength(1)
    expect(result.variables[0].name).toBe('DLV - my_field')
  })

  it('auto-derives GA4 param names by stripping ecommerce prefix', () => {
    const audit: AuditJson = {
      'unknown_event': { count: 1, variables: ['event', 'ecommerce.promotion_id'] },
    }
    const result = getEntitiesFromAuditJson(audit, masterEntries, 'G-TEST12345')
    const tag = result.tags[0]
    const eventParamsList = tag.parameter.find(p => p.key === 'eventParameters')
    expect(eventParamsList).toBeDefined()
    if (eventParamsList && 'list' in eventParamsList) {
      const firstParam = eventParamsList.list[0]
      const nameParam = firstParam.map.find(m => m.key === 'name')
      expect(nameParam!.value).toBe('promotion_id')
    }
  })

  it('includes the GA4 Configuration Tag in the tags list', () => {
    const audit = { view_item: { count: 1, variables: ['ecommerce.value'] } }
    const masterEntries: MasterMappingEntry[] = []  // no master match → audit-JSON branch

    const result = getEntitiesFromAuditJson(audit, masterEntries, 'G-TEST12345')

    const configTag = result.tags.find(t => t.name === 'GA4 - Configuration TAG')
    expect(configTag).toBeDefined()
    expect(configTag?.type).toBe('gaawc')
  })
})
