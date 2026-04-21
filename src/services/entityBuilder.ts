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
