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
