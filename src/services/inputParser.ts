// inputParser.ts — Parses audit JSON input and converts master mapping entries
// into flat lists of GTM entity payloads ready for the API.

import type {
  AuditJson,
  MasterMappingEntry,
  GtmVariablePayload,
  GtmTriggerPayload,
  GtmTagPayload,
} from '../types'
import {
  buildVariablePayload,
  buildTriggerPayload,
  buildGa4EventTagPayload,
} from './entityBuilder'

// --- Audit JSON parsing ---

type ParseResult =
  | { success: true; data: AuditJson }
  | { success: false; error: string }

export function parseAuditJson(raw: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { success: false, error: 'Invalid JSON. Check for syntax errors.' }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { success: false, error: 'Audit JSON must be an object with event names as keys, not an array.' }
  }

  const obj = parsed as Record<string, unknown>
  for (const [eventName, eventData] of Object.entries(obj)) {
    if (typeof eventData !== 'object' || eventData === null) {
      return { success: false, error: `Event "${eventName}" must be an object with count and variables.` }
    }
    const data = eventData as Record<string, unknown>
    if (!Array.isArray(data.variables)) {
      return { success: false, error: `Event "${eventName}" is missing a "variables" array.` }
    }
  }

  return { success: true, data: parsed as AuditJson }
}

// --- Entity list generation from master mapping ---

export interface EntityLists {
  variables: GtmVariablePayload[]
  triggers: GtmTriggerPayload[]
  tags: GtmTagPayload[]
}

export function getEntitiesFromMasterMapping(
  entries: MasterMappingEntry[],
  measurementId: string,
): EntityLists {
  const variables: GtmVariablePayload[] = []
  const triggers: GtmTriggerPayload[] = []
  const tags: GtmTagPayload[] = []
  const seenVariableNames = new Set<string>()

  for (const entry of entries) {
    if (entry.status === 'SKIP') continue

    for (const v of entry.gtmVariables) {
      if (!seenVariableNames.has(v.gtmVarName)) {
        seenVariableNames.add(v.gtmVarName)
        variables.push(buildVariablePayload(v))
      }
    }

    if (entry.gtmTriggerName) {
      triggers.push(buildTriggerPayload(entry.gtmTriggerName, entry.dataLayerEvent))
    }

    if (entry.status === 'LIVE' && entry.gtmTagName && entry.ga4EventName) {
      tags.push(buildGa4EventTagPayload(
        entry.gtmTagName,
        entry.ga4EventName,
        measurementId,
        entry.ga4Parameters,
        '__PENDING_TRIGGER_ID__',
      ))
    }
  }

  return { variables, triggers, tags }
}

// --- Entity list generation from audit JSON ---

function deriveGa4ParamName(dlvPath: string): string {
  const stripped = dlvPath.startsWith('ecommerce.') ? dlvPath.slice('ecommerce.'.length) : dlvPath
  const segments = stripped.split('.')
  return segments[segments.length - 1]
}

export function getEntitiesFromAuditJson(
  audit: AuditJson,
  masterEntries: MasterMappingEntry[],
  measurementId: string,
): EntityLists {
  const variables: GtmVariablePayload[] = []
  const triggers: GtmTriggerPayload[] = []
  const tags: GtmTagPayload[] = []
  const seenVariableNames = new Set<string>()

  const masterLookup = new Map<string, MasterMappingEntry>()
  for (const entry of masterEntries) {
    masterLookup.set(entry.dataLayerEvent, entry)
  }

  for (const [eventName, eventData] of Object.entries(audit)) {
    const masterEntry = masterLookup.get(eventName)

    if (masterEntry && masterEntry.status !== 'SKIP') {
      for (const v of masterEntry.gtmVariables) {
        if (!seenVariableNames.has(v.gtmVarName)) {
          seenVariableNames.add(v.gtmVarName)
          variables.push(buildVariablePayload(v))
        }
      }

      if (masterEntry.gtmTriggerName) {
        triggers.push(buildTriggerPayload(masterEntry.gtmTriggerName, masterEntry.dataLayerEvent))
      }

      if (masterEntry.status === 'LIVE' && masterEntry.gtmTagName && masterEntry.ga4EventName) {
        tags.push(buildGa4EventTagPayload(
          masterEntry.gtmTagName,
          masterEntry.ga4EventName,
          measurementId,
          masterEntry.ga4Parameters,
          '__PENDING_TRIGGER_ID__',
        ))
      }
    } else if (!masterEntry) {
      const variablePaths = eventData.variables.filter(v => v !== 'event')

      for (const path of variablePaths) {
        const varName = `DLV - ${path}`
        if (!seenVariableNames.has(varName)) {
          seenVariableNames.add(varName)
          variables.push(buildVariablePayload({ dlvPath: path, gtmVarName: varName }))
        }
      }

      triggers.push(buildTriggerPayload(`CE - ${eventName}`, eventName))

      const autoParams = variablePaths.map(path => ({
        paramName: deriveGa4ParamName(path),
        gtmVarRef: `{{DLV - ${path}}}`,
      }))

      tags.push(buildGa4EventTagPayload(
        `GA4 Event - ${eventName}`,
        eventName,
        measurementId,
        autoParams,
        '__PENDING_TRIGGER_ID__',
      ))
    }
  }

  return { variables, triggers, tags }
}
