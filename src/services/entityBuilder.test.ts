// entityBuilder.test.ts — Tests for GTM payload construction.

import { describe, it, expect } from 'vitest'
import { buildVariablePayload, buildTriggerPayload, buildGa4EventTagPayload, buildGa4ConfigTagPayload } from './entityBuilder'
import type { MasterMappingVariable, MasterMappingParameter } from '../types'

describe('buildVariablePayload', () => {
  it('builds a standard DLV variable payload', () => {
    const variable: MasterMappingVariable = {
      dlvPath: 'ecommerce.items',
      gtmVarName: 'DLV - ecommerce.items',
    }
    const result = buildVariablePayload(variable)
    expect(result).toEqual({
      name: 'DLV - ecommerce.items',
      type: 'v',
      parameter: [
        { type: 'integer', key: 'dataLayerVersion', value: '2' },
        { type: 'boolean', key: 'setDefaultValue', value: 'false' },
        { type: 'template', key: 'name', value: 'ecommerce.items' },
      ],
    })
  })

  it('handles the DL- prefix exception (eecPurchase action fields)', () => {
    const variable: MasterMappingVariable = {
      dlvPath: 'ecommerce.purchase.actionField.id',
      gtmVarName: 'DL - ecommerce.purchase.actionField.id',
    }
    const result = buildVariablePayload(variable)
    expect(result.name).toBe('DL - ecommerce.purchase.actionField.id')
    expect(result.type).toBe('v')
    expect(result.parameter).toContainEqual({
      type: 'template', key: 'name', value: 'ecommerce.purchase.actionField.id',
    })
  })

  it('handles a simple (non-ecommerce) variable path', () => {
    const variable: MasterMappingVariable = {
      dlvPath: 'coupon_code',
      gtmVarName: 'DLV - coupon_code',
    }
    const result = buildVariablePayload(variable)
    expect(result.name).toBe('DLV - coupon_code')
    expect(result.parameter).toContainEqual({
      type: 'template', key: 'name', value: 'coupon_code',
    })
  })
})

describe('buildTriggerPayload', () => {
  it('builds a standard custom event trigger payload', () => {
    const result = buildTriggerPayload('CE - add_to_cart', 'add_to_cart')
    expect(result).toEqual({
      name: 'CE - add_to_cart',
      type: 'customEvent',
      customEventFilter: [
        {
          type: 'equals',
          parameter: [
            { type: 'template', key: 'arg0', value: '{{_event}}' },
            { type: 'template', key: 'arg1', value: 'add_to_cart' },
          ],
        },
      ],
    })
  })

  it('handles non-standard trigger name (eecPurchase uses "EEC purchase")', () => {
    const result = buildTriggerPayload('EEC purchase', 'eecPurchase')
    expect(result.name).toBe('EEC purchase')
    expect(result.customEventFilter[0].parameter[1].value).toBe('eecPurchase')
  })
})

describe('buildGa4EventTagPayload', () => {
  it('builds a GA4 Event tag with parameters', () => {
    const params: MasterMappingParameter[] = [
      { paramName: 'items', gtmVarRef: '{{DLV - ecommerce.items}}' },
      { paramName: 'currency', gtmVarRef: '{{DLV - ecommerce.currency}}' },
    ]
    const result = buildGa4EventTagPayload('GA4 Event - add_to_cart', 'add_to_cart', 'G-TEST12345', params, '999')
    expect(result.name).toBe('GA4 Event - add_to_cart')
    expect(result.type).toBe('gaawe')
    expect(result.firingTriggerId).toEqual(['999'])
    expect(result.parameter).toContainEqual({ key: 'eventName', type: 'template', value: 'add_to_cart' })
    expect(result.parameter).toContainEqual({ key: 'measurementIdOverride', type: 'template', value: 'G-TEST12345' })
    const eventParams = result.parameter.find(p => p.key === 'eventParameters')
    expect(eventParams).toBeDefined()
    expect(eventParams!.type).toBe('list')
  })

  it('builds a GA4 Event tag with no parameters', () => {
    const result = buildGa4EventTagPayload('GA4 Event - login', 'login', 'G-TEST12345', [], '100')
    expect(result.parameter).toContainEqual({ key: 'eventName', type: 'template', value: 'login' })
    const eventParams = result.parameter.find(p => p.key === 'eventParameters')
    expect(eventParams).toBeUndefined()
  })
})

describe('buildGa4ConfigTagPayload', () => {
  it('builds a GA4 Configuration tag', () => {
    const result = buildGa4ConfigTagPayload('G-TEST12345')
    expect(result.name).toBe('GA4 - Configuration TAG')
    expect(result.type).toBe('gaawc')
    expect(result.firingTriggerId).toEqual(['2147479553'])
    expect(result.parameter).toContainEqual({ key: 'measurementId', type: 'template', value: 'G-TEST12345' })
    expect(result.parameter).toContainEqual({ key: 'sendPageView', type: 'boolean', value: 'true' })
  })
})
