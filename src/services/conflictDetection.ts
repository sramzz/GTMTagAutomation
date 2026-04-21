// conflictDetection.ts — Compares intended GTM entities against existing ones in the workspace.
// Classifies each as WILL_CREATE (new), ALREADY_CORRECT (identical), or CONFLICT (same name, different config).

import type {
  GtmVariablePayload,
  GtmTriggerPayload,
  GtmTagPayload,
  GtmEntity,
  GtmParameter,
  ConflictResult,
  EntityType,
} from '../types'

type IntendedPayload = GtmVariablePayload | GtmTriggerPayload | GtmTagPayload

// Deep-compares two parameter arrays, ignoring order.
function parametersMatch(intended: GtmParameter[], existing: GtmParameter[] | undefined): boolean {
  if (!existing) return intended.length === 0
  if (intended.length !== existing.length) return false
  const sortByKey = (a: GtmParameter, b: GtmParameter) => a.key.localeCompare(b.key)
  const sortedIntended = [...intended].sort(sortByKey)
  const sortedExisting = [...existing].sort(sortByKey)
  return sortedIntended.every((param, i) =>
    param.type === sortedExisting[i].type &&
    param.key === sortedExisting[i].key &&
    param.value === sortedExisting[i].value
  )
}

// Checks if an intended payload matches an existing entity's config.
function entitiesMatch(intended: IntendedPayload, existing: GtmEntity): boolean {
  if (intended.type !== existing.type) return false

  if ('parameter' in intended && intended.parameter) {
    // Filter out list-type params (like eventParameters) — only compare simple key/value params.
    // Cast needed because TS can't narrow the union through .filter() on a union-typed array.
    const simpleParams = (intended.parameter as readonly { type: string; key: string; value?: string }[])
      .filter((p): p is GtmParameter => 'value' in p && typeof p.value === 'string')
    return parametersMatch(simpleParams, existing.parameter)
  }

  if ('customEventFilter' in intended) {
    const intentedFilter = intended.customEventFilter?.[0]?.parameter
    const existingFilter = existing.customEventFilter?.[0]?.parameter
    if (!intentedFilter && !existingFilter) return true
    if (!intentedFilter || !existingFilter) return false
    return parametersMatch(intentedFilter, existingFilter)
  }

  return true
}

export function detectConflicts(
  intended: IntendedPayload[],
  existing: GtmEntity[],
  entityType: EntityType,
): ConflictResult[] {
  const existingByName = new Map<string, GtmEntity>()
  for (const entity of existing) {
    existingByName.set(entity.name, entity)
  }

  return intended.map(payload => {
    const existingEntity = existingByName.get(payload.name)

    if (!existingEntity) {
      return {
        entityName: payload.name,
        entityType,
        status: 'WILL_CREATE' as const,
        decision: null,
        intendedPayload: payload,
      }
    }

    if (entitiesMatch(payload, existingEntity)) {
      return {
        entityName: payload.name,
        entityType,
        status: 'ALREADY_CORRECT' as const,
        decision: null,
        intendedPayload: payload,
        existingEntity,
      }
    }

    return {
      entityName: payload.name,
      entityType,
      status: 'CONFLICT' as const,
      decision: null,
      intendedPayload: payload,
      existingEntity,
    }
  })
}
