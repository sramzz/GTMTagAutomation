// types/index.ts — All shared TypeScript types for the GTM Automation Tool.
// Read this file to understand the data model of the entire app.

// --- Log types ---

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS'

export type LogSource = 'AUTH' | 'GTM-API' | 'CONFLICT' | 'WIZARD' | 'VALIDATION'

export interface LogEntry {
  datetime: string       // "2026-04-20 12:34:01"
  source: LogSource
  level: LogLevel
  message: string
}

// --- Master mapping types ---

export interface MasterMappingVariable {
  dlvPath: string        // e.g. "ecommerce.items"
  gtmVarName: string     // e.g. "DLV - ecommerce.items"
}

export interface MasterMappingParameter {
  paramName: string      // GA4 parameter name, e.g. "items"
  gtmVarRef: string      // GTM variable reference, e.g. "{{DLV - ecommerce.items}}"
}

export type EventStatus = 'LIVE' | 'SYSTEM' | 'SKIP'

export interface MasterMappingEntry {
  id: number
  category: string
  dataLayerEvent: string
  ga4EventName: string | null
  whenItFires: string
  status: EventStatus
  notes?: string
  gtmVariables: MasterMappingVariable[]
  gtmTriggerName: string | null
  gtmTagName: string | null
  ga4Parameters: MasterMappingParameter[]
}

export interface MasterMappingMeta {
  version: string
  source: string
  description: string
  statusValues: Record<string, string>
  namingConventions: Record<string, string>
  totalEvents: number
  liveEvents: number
  systemEvents: number
  skipEvents: number
}

export interface MasterMapping {
  _meta: MasterMappingMeta
  events: MasterMappingEntry[]
}

// --- Audit JSON types (from the data layer audit script) ---

export interface AuditEventData {
  count: number
  variables: string[]
}

// Keys are event names, values are their audit data
export type AuditJson = Record<string, AuditEventData>

// --- GTM API payload types ---

export interface GtmParameter {
  type: string
  key: string
  value: string
}

export interface GtmVariablePayload {
  name: string
  type: string           // "v" for Data Layer Variable
  parameter: GtmParameter[]
}

export interface GtmCustomEventFilter {
  type: string
  parameter: GtmParameter[]
}

export interface GtmTriggerPayload {
  name: string
  type: string           // "customEvent"
  customEventFilter: GtmCustomEventFilter[]
}

export interface GtmEventParameterMap {
  type: 'map'
  map: GtmParameter[]
}

export interface GtmTagPayload {
  name: string
  type: string           // "gaawe" for GA4 Event, "gaawc" for GA4 Config
  parameter: (GtmParameter | {
    key: string
    type: 'list'
    list: GtmEventParameterMap[]
  })[]
  firingTriggerId: string[]
}

// --- GTM API response types ---

export interface GtmEntity {
  name: string
  type: string
  path: string           // Used for update (PUT) operations
  parameter?: GtmParameter[]
  customEventFilter?: GtmCustomEventFilter[]
  firingTriggerId?: string[]
  triggerId?: string     // Returned by API after trigger creation
}

export interface GtmAccount {
  accountId: string
  name: string
  path: string
}

export interface GtmContainer {
  containerId: string
  name: string
  path: string
  publicId: string       // e.g. "GTM-ABC123"
}

export interface GtmWorkspace {
  workspaceId: string
  name: string
  path: string
}

// --- Conflict detection types ---

export type ConflictStatus = 'WILL_CREATE' | 'ALREADY_CORRECT' | 'CONFLICT'

export type ConflictDecision = 'SKIP' | 'OVERWRITE' | null  // null = not yet decided

export type EntityType = 'variable' | 'trigger' | 'tag'

export interface ConflictResult {
  entityName: string
  entityType: EntityType
  status: ConflictStatus
  decision: ConflictDecision
  intendedPayload: GtmVariablePayload | GtmTriggerPayload | GtmTagPayload
  existingEntity?: GtmEntity   // Only present when status is ALREADY_CORRECT or CONFLICT
}

// --- Execution result types ---

export type ExecutionAction = 'CREATED' | 'SKIPPED' | 'OVERWRITTEN' | 'ERROR'

export interface ExecutionResult {
  entityName: string
  entityType: EntityType
  action: ExecutionAction
  errorMessage?: string
}

// --- App state types ---

export interface SessionInfo {
  userEmail: string
  accountName: string
  containerName: string
  containerPublicId: string
  workspaceName: string
  measurementId: string
}
