// executeEntities.ts — Runs sequential GTM API calls (variables -> triggers -> tags).
// Stops on first failure and returns partial results.

import {
  createVariable, createTrigger, createTag,
  updateVariable, updateTrigger, updateTag,
} from './gtmApi'
import type { Logger } from '../logging/logger'
import type {
  ConflictResult, ExecutionResult, GtmEntity,
  GtmTagPayload, EntityType,
} from '../types'

// Lookup map: trigger name -> trigger ID (resolved at runtime)
type TriggerIdMap = Map<string, string>

/** Extract trigger ID from a GtmEntity path like ".../triggers/42" or from its triggerId field. */
function extractTriggerId(entity: GtmEntity): string | undefined {
  if (entity.triggerId) return entity.triggerId
  const match = entity.path.match(/triggers\/(\d+)/)
  return match?.[1]
}

/** Derive the trigger name a tag expects: "GA4 Event - X" -> "CE - X". */
function triggerNameForTag(tagName: string): string {
  const eventName = tagName.replace(/^GA4 Event - /, '')
  return `CE - ${eventName}`
}

/** Replace __PENDING_TRIGGER_ID__ in a tag payload with the real trigger ID. */
function resolveTagPayload(
  payload: GtmTagPayload,
  tagName: string,
  triggerMap: TriggerIdMap,
): GtmTagPayload {
  const hasPending = payload.firingTriggerId.includes('__PENDING_TRIGGER_ID__')
  if (!hasPending) return payload

  const triggerName = triggerNameForTag(tagName)
  const realId = triggerMap.get(triggerName)
  if (!realId) return payload // caller should handle missing ID

  return {
    ...payload,
    firingTriggerId: payload.firingTriggerId.map(
      id => id === '__PENDING_TRIGGER_ID__' ? realId : id
    ),
  }
}

/** Execute one entity (create, update, or skip) and return the result. */
async function executeOne(
  item: ConflictResult,
  token: string,
  workspacePath: string,
  triggerMap: TriggerIdMap,
  logger: Logger,
): Promise<{ result: ExecutionResult; apiEntity?: GtmEntity }> {
  const { entityName, entityType, status, decision, intendedPayload, existingEntity } = item

  // Skip: ALREADY_CORRECT or CONFLICT+SKIP
  if (status === 'ALREADY_CORRECT' || (status === 'CONFLICT' && decision === 'SKIP')) {
    logger.info('GTM-API', `SKIP ${entityType} "${entityName}" — ${status === 'ALREADY_CORRECT' ? 'already correct' : 'user chose skip'}`)
    return { result: { entityName, entityType, action: 'SKIPPED' } }
  }

  // Overwrite: CONFLICT+OVERWRITE
  if (status === 'CONFLICT' && decision === 'OVERWRITE' && existingEntity) {
    logger.info('GTM-API', `Updating ${entityType} "${entityName}"...`)
    const payload = entityType === 'tag'
      ? resolveTagPayload(intendedPayload as GtmTagPayload, entityName, triggerMap)
      : intendedPayload
    const apiEntity = await callUpdate(token, existingEntity.path, payload, entityType)
    logger.success('GTM-API', `OVERWRITTEN ${entityType} "${entityName}"`)
    return { result: { entityName, entityType, action: 'OVERWRITTEN' }, apiEntity }
  }

  // Create: WILL_CREATE
  logger.info('GTM-API', `Creating ${entityType} "${entityName}"...`)
  const payload = entityType === 'tag'
    ? resolveTagPayload(intendedPayload as GtmTagPayload, entityName, triggerMap)
    : intendedPayload
  const apiEntity = await callCreate(token, workspacePath, payload, entityType)
  logger.success('GTM-API', `CREATED ${entityType} "${entityName}"`)
  return { result: { entityName, entityType, action: 'CREATED' }, apiEntity }
}

async function callCreate(
  token: string, workspacePath: string, payload: unknown, type: EntityType,
): Promise<GtmEntity> {
  if (type === 'variable') return createVariable(token, workspacePath, payload as never)
  if (type === 'trigger') return createTrigger(token, workspacePath, payload as never)
  return createTag(token, workspacePath, payload as never)
}

async function callUpdate(
  token: string, entityPath: string, payload: unknown, type: EntityType,
): Promise<GtmEntity> {
  if (type === 'variable') return updateVariable(token, entityPath, payload as never)
  if (type === 'trigger') return updateTrigger(token, entityPath, payload as never)
  return updateTag(token, entityPath, payload as never)
}

export interface ExecutionOutcome {
  results: ExecutionResult[]
  stopped: boolean
  stoppedAt?: string
  successCount: number
}

/**
 * Execute all conflict results sequentially (variables -> triggers -> tags).
 * Populates triggerMap so tags can resolve their firing trigger IDs.
 * Calls onProgress after each entity so UI can update in real time.
 */
export async function executeAll(
  items: ConflictResult[],
  token: string,
  workspacePath: string,
  logger: Logger,
  onProgress: (results: ExecutionResult[]) => void,
): Promise<ExecutionOutcome> {
  // Sort: variables first, triggers second, tags third
  const sorted = [...items].sort((a, b) => {
    const order: Record<EntityType, number> = { variable: 0, trigger: 1, tag: 2 }
    return order[a.entityType] - order[b.entityType]
  })

  const triggerMap: TriggerIdMap = new Map()
  const results: ExecutionResult[] = []
  let successCount = 0

  // Pre-populate trigger map with existing/skipped triggers so tags can resolve them
  for (const item of sorted) {
    if (item.entityType === 'trigger' && item.existingEntity) {
      const id = extractTriggerId(item.existingEntity)
      if (id) triggerMap.set(item.entityName, id)
    }
  }

  logger.info('GTM-API', `Starting execution — ${sorted.length} entities to process`)

  for (const item of sorted) {
    try {
      const { result, apiEntity } = await executeOne(item, token, workspacePath, triggerMap, logger)
      results.push(result)
      onProgress([...results])

      // Track trigger IDs from newly created/updated triggers
      if (item.entityType === 'trigger' && apiEntity) {
        const id = extractTriggerId(apiEntity)
        if (id) triggerMap.set(item.entityName, id)
      }

      if (result.action !== 'ERROR') {
        successCount++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      logger.error('GTM-API', `ERROR ${item.entityType} "${item.entityName}": ${msg}`)
      results.push({
        entityName: item.entityName,
        entityType: item.entityType,
        action: 'ERROR',
        errorMessage: msg,
      })
      onProgress([...results])

      return { results, stopped: true, stoppedAt: item.entityName, successCount }
    }
  }

  logger.success('GTM-API', `Execution complete — ${successCount} entities processed successfully`)
  return { results, stopped: false, successCount }
}
