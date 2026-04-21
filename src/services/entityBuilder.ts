// entityBuilder.ts — Builds GTM API payload objects from master mapping entries.
// Each function takes mapping data and returns a payload ready for the GTM API.

import type {
  MasterMappingVariable,
  MasterMappingParameter,
  GtmVariablePayload,
  GtmTriggerPayload,
  GtmTagPayload,
} from '../types'

export function buildVariablePayload(variable: MasterMappingVariable): GtmVariablePayload {
  return {
    name: variable.gtmVarName,
    type: 'v', // GTM's internal code for "Data Layer Variable"
    parameter: [
      { type: 'integer', key: 'dataLayerVersion', value: '2' },
      { type: 'boolean', key: 'setDefaultValue', value: 'false' },
      { type: 'template', key: 'name', value: variable.dlvPath },
    ],
  }
}

export function buildTriggerPayload(triggerName: string, dataLayerEventName: string): GtmTriggerPayload {
  return {
    name: triggerName,
    type: 'customEvent',
    customEventFilter: [
      {
        type: 'equals',
        parameter: [
          { type: 'template', key: 'arg0', value: '{{_event}}' },
          { type: 'template', key: 'arg1', value: dataLayerEventName },
        ],
      },
    ],
  }
}

export function buildGa4EventTagPayload(
  tagName: string,
  ga4EventName: string,
  measurementId: string,
  ga4Parameters: MasterMappingParameter[],
  triggerId: string,
): GtmTagPayload {
  const parameter: GtmTagPayload['parameter'] = [
    { key: 'eventName', type: 'template', value: ga4EventName },
    { key: 'measurementIdOverride', type: 'template', value: measurementId },
  ]
  if (ga4Parameters.length > 0) {
    parameter.push({
      key: 'eventParameters',
      type: 'list',
      list: ga4Parameters.map(param => ({
        type: 'map' as const,
        map: [
          { type: 'template', key: 'name', value: param.paramName },
          { type: 'template', key: 'value', value: param.gtmVarRef },
        ],
      })),
    })
  }
  return {
    name: tagName,
    type: 'gaawe',
    parameter,
    firingTriggerId: [triggerId],
  }
}

export function buildGa4ConfigTagPayload(measurementId: string): GtmTagPayload {
  return {
    name: 'GA4 - Configuration TAG',
    type: 'gaawc',
    parameter: [
      { key: 'measurementId', type: 'template', value: measurementId },
      { key: 'sendPageView', type: 'boolean', value: 'true' },
    ],
    firingTriggerId: ['2147479553'],
  }
}
