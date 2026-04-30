# GA4 Config Tag — Fold Into Conflict Detection (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the "Found entity with duplicate name" 400 error on the GA4 Configuration Tag by routing it through the same dry-run conflict detection flow as every other entity, instead of force-creating it during execution.

**Architecture:** Today, `executeEntities.ts` calls `createTag` for the GA4 Config Tag unconditionally before processing the user's reviewed list, which fails on a reused workspace where it already exists. The fix injects the Config Tag payload into the `tags` array inside `inputParser.ts`, so Step 4 detects it as `WILL_CREATE` / `ALREADY_CORRECT` / `CONFLICT` like every other tag, and the special-case auto-create block in `executeEntities.ts` is deleted. The user sees the Config Tag in the dry-run table, and the activity log records its outcome through the normal CREATED / SKIPPED / OVERWRITTEN / ERROR path.

**Tech Stack:** TypeScript, React, Vitest, Testing Library, GTM API v2.

---

## Background — read this before starting

You are working in a 5-step React wizard that pushes entities to Google Tag Manager. The relevant flow is:

1. **Step 3 (`inputParser.ts`)** — turns the master mapping + audit JSON into three flat arrays: `variables`, `triggers`, `tags`. These payloads are pure data (no API calls yet).
2. **Step 4 (`Step4Preview.tsx` → `conflictDetection.ts`)** — fetches existing entities from the workspace and classifies each intended payload as `WILL_CREATE`, `ALREADY_CORRECT`, or `CONFLICT`. User decides `SKIP` / `OVERWRITE` for conflicts.
3. **Step 5 (`executeEntities.ts`)** — runs the resolved list through the GTM API in order: variables → triggers → tags.

The bug: the GA4 Configuration Tag (`name: 'GA4 - Configuration TAG'`, `type: 'gaawc'`) is **never** added to the `tags` array in Step 3. Instead, `executeAll` in `executeEntities.ts:152-174` checks if it happens to already be in the conflict list and, if not, force-calls `createTag(...)` before processing anything else. On a reused workspace where the Config Tag already exists, this POST returns 400.

**Why the fix is to add it to the entity lists:** every other entity already goes through this dry-run pipeline. The Config Tag is the only special case. Folding it in removes the special case entirely — DRY, and it makes the Config Tag visible to the user in Step 4 like everything else.

**One subtle thing about Config Tag vs Event Tags:** event tags use a placeholder `firingTriggerId: ['__PENDING_TRIGGER_ID__']` that gets resolved at execution time once the trigger ID is known. The Config Tag uses the built-in "All Pages" trigger with hard-coded `firingTriggerId: ['2147479553']`. So the Config Tag does NOT need trigger resolution — `resolveTagPayload` in `executeEntities.ts` is a no-op for it because it has no pending placeholder. You don't need to change that function.

**File summary:**
- `src/services/entityBuilder.ts:72-82` — already exports `buildGa4ConfigTagPayload(measurementId)`. Reuse as-is.
- `src/services/inputParser.ts` — has two functions, `getEntitiesFromMasterMapping` and `getEntitiesFromAuditJson`, both returning `{ variables, triggers, tags }`. Both need to push the Config Tag to `tags`.
- `src/services/executeEntities.ts:152-174` — DELETE this auto-create block.
- `src/services/conflictDetection.ts` — no changes needed; it already handles `gaawc` tags via the parameter-comparison path. We will add a verification test only.
- Tests for all of the above will need updates.

---

## File Structure

**Modified:**
- `src/services/inputParser.ts` — both entity-list builders push the GA4 Config Tag into `tags`.
- `src/services/executeEntities.ts` — remove special-case auto-create block (~22 lines deleted, plus the `buildGa4ConfigTagPayload` import and `GA4_CONFIG_TAG_NAME` constant if no longer used).
- `src/services/inputParser.test.ts` — assert Config Tag is present in returned `tags`.
- `src/services/conflictDetection.test.ts` — add a test that the Config Tag is correctly detected as `ALREADY_CORRECT` / `CONFLICT` / `WILL_CREATE`.
- `src/services/executeEntities.test.ts` (if present — see Task 5) — drop the auto-create assertions.
- `src/components/Step4Preview.test.tsx` — adjust expected tag counts if the test fixtures rely on them (likely a minor +1).
- `src/components/Step5Execute.test.tsx` — drop any auto-create-related assertions.

**No changes:**
- `src/services/entityBuilder.ts` — `buildGa4ConfigTagPayload` is already correct.
- `src/services/conflictDetection.ts` — already handles Config Tag.
- `src/components/Step4Preview.tsx` and `src/components/Step5Execute.tsx` — UI is data-driven and doesn't need to know about the Config Tag specifically.

---

## A note on TDD discipline

Write the test FIRST. Run it and watch it fail with a meaningful message. Only then implement. If you skip the failing run, you can't be sure the test actually exercises the code you wrote. Don't batch test + impl into one commit unless the plan explicitly says so.

Frequent commits — every task ends in a commit. If a task feels too big to commit cleanly, split it.

---

## Task 1: Verify the bug is reproducible (red baseline)

Before changing anything, prove the current code does the wrong thing. This protects future-you from claiming the fix worked when actually nothing was broken.

**Files:**
- Modify: `src/services/executeEntities.test.ts` (create if missing — check first with `ls src/services/`)

- [ ] **Step 1: Check whether the test file exists**

Run: `ls src/services/executeEntities.test.ts 2>&1`

If it does NOT exist, create it now with this skeleton:

```typescript
// executeEntities.test.ts — Tests for sequential execution flow.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeAll } from './executeEntities'
import * as gtmApi from './gtmApi'
import type { ConflictResult } from '../types'
import type { Logger } from '../logging/logger'

vi.mock('./gtmApi', async () => {
  const actual = await vi.importActual<typeof gtmApi>('./gtmApi')
  return {
    ...actual,
    createTag: vi.fn(),
    createTrigger: vi.fn(),
    createVariable: vi.fn(),
    updateTag: vi.fn(),
    updateTrigger: vi.fn(),
    updateVariable: vi.fn(),
    attachLogger: vi.fn(),
  }
})

const fakeLogger: Logger = {
  info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn(),
} as unknown as Logger

beforeEach(() => {
  vi.clearAllMocks()
})

describe('executeAll', () => {
  // tests go here
})
```

If it DOES exist, just read it (`cat src/services/executeEntities.test.ts`) so you know the existing patterns, mocks, and helpers — match those when adding the new test below.

- [ ] **Step 2: Add a failing test that demonstrates the bug**

Add this test inside the `describe('executeAll', ...)` block:

```typescript
it('does NOT auto-create the GA4 Config Tag when it is not in the conflict list', async () => {
  // After the fix, the Config Tag is added in inputParser, so executeAll
  // must NOT call createTag for it on its own. This test will FAIL today
  // because executeEntities.ts:158-174 auto-creates it.
  const items: ConflictResult[] = []  // empty — Config Tag is not here
  const onProgress = vi.fn()

  await executeAll(items, 'token', 'workspaces/123', fakeLogger, onProgress, 'G-TEST12345')

  expect(gtmApi.createTag).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Run it and confirm the failure**

Run: `npx vitest run src/services/executeEntities.test.ts -t "does NOT auto-create"`
Expected: **FAIL** — assertion error showing `createTag` was called once with the Config Tag payload.

This is the baseline. You will revisit and re-run this test in Task 4 after deleting the auto-create block.

- [ ] **Step 4: Commit the failing test (yes, on its own)**

We commit the red test so the fix commit's diff stays focused on production code.

```bash
git add src/services/executeEntities.test.ts
git commit -m "test: add failing test for GA4 Config Tag auto-create bug"
```

---

## Task 2: Add Config Tag to `getEntitiesFromMasterMapping`

**Files:**
- Modify: `src/services/inputParser.ts:11-15` (imports), `src/services/inputParser.ts:57-92` (function body)
- Modify: `src/services/inputParser.test.ts`

- [ ] **Step 1: Add the failing test**

Open `src/services/inputParser.test.ts` and add a new test inside the existing `describe('getEntitiesFromMasterMapping', ...)` block (or create the describe if not present — match existing test style):

```typescript
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
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx vitest run src/services/inputParser.test.ts -t "GA4 Configuration Tag"`
Expected: **FAIL** — `configTag` is `undefined` because the Config Tag isn't being emitted.

- [ ] **Step 3: Update the import in `inputParser.ts`**

Replace the import block at `src/services/inputParser.ts:11-15`:

```typescript
import {
  buildVariablePayload,
  buildTriggerPayload,
  buildGa4EventTagPayload,
  buildGa4ConfigTagPayload,
} from './entityBuilder'
```

- [ ] **Step 4: Append the Config Tag in `getEntitiesFromMasterMapping`**

In `src/services/inputParser.ts`, find the function `getEntitiesFromMasterMapping` (starts around line 57). Right before the `return { variables, triggers, tags }` at the end, add:

```typescript
  // Always include the GA4 Configuration Tag — Step 4 will detect if it
  // already exists in the workspace and Step 5 will skip/overwrite/create it
  // through the same flow as every other tag.
  tags.push(buildGa4ConfigTagPayload(measurementId))
```

So the function tail looks like:

```typescript
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

  tags.push(buildGa4ConfigTagPayload(measurementId))

  return { variables, triggers, tags }
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx vitest run src/services/inputParser.test.ts -t "GA4 Configuration Tag"`
Expected: **PASS** for both new tests.

Then run the full file to confirm no regressions:
Run: `npx vitest run src/services/inputParser.test.ts`
Expected: all tests pass. If existing tests now fail because they assert on `tags.length`, update those assertions to account for the +1 Config Tag — do NOT change the behavior to "fix" them.

- [ ] **Step 6: Commit**

```bash
git add src/services/inputParser.ts src/services/inputParser.test.ts
git commit -m "feat: include GA4 Config Tag in master-mapping entity list"
```

---

## Task 3: Add Config Tag to `getEntitiesFromAuditJson`

Same change as Task 2, in the second function. Done as its own task because the audit-JSON path is a separate, independently testable code path.

**Files:**
- Modify: `src/services/inputParser.ts` (second function, around line 102)
- Modify: `src/services/inputParser.test.ts`

- [ ] **Step 1: Add the failing test**

Add inside the existing `describe('getEntitiesFromAuditJson', ...)` block (or matching describe):

```typescript
it('includes the GA4 Configuration Tag in the tags list', () => {
  const audit = { view_item: { count: 1, variables: ['ecommerce.value'] } }
  const masterEntries: MasterMappingEntry[] = []  // no master match → audit-JSON branch

  const result = getEntitiesFromAuditJson(audit, masterEntries, 'G-TEST12345')

  const configTag = result.tags.find(t => t.name === 'GA4 - Configuration TAG')
  expect(configTag).toBeDefined()
  expect(configTag?.type).toBe('gaawc')
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx vitest run src/services/inputParser.test.ts -t "GA4 Configuration Tag"`
Expected: the new test in `getEntitiesFromAuditJson` FAILS (the master-mapping one passes from Task 2).

- [ ] **Step 3: Append the Config Tag in `getEntitiesFromAuditJson`**

In `src/services/inputParser.ts`, find `getEntitiesFromAuditJson` (around line 102). Right before its `return { variables, triggers, tags }`, add the same line:

```typescript
  tags.push(buildGa4ConfigTagPayload(measurementId))

  return { variables, triggers, tags }
}
```

- [ ] **Step 4: Run all inputParser tests**

Run: `npx vitest run src/services/inputParser.test.ts`
Expected: all tests pass. Update any pre-existing `tags.length` assertions for the +1 Config Tag.

- [ ] **Step 5: Commit**

```bash
git add src/services/inputParser.ts src/services/inputParser.test.ts
git commit -m "feat: include GA4 Config Tag in audit-JSON entity list"
```

---

## Task 4: Remove the auto-create block from `executeAll`

This is the actual fix. With Tasks 2 and 3 in place, Step 4 always sees the Config Tag and Step 5 needs no special case.

**Files:**
- Modify: `src/services/executeEntities.ts:1-17` (imports + constant), `src/services/executeEntities.ts:152-174` (delete block)
- Re-run: `src/services/executeEntities.test.ts` (the failing test from Task 1 should now pass)

- [ ] **Step 1: Delete the auto-create block**

In `src/services/executeEntities.ts`, find this block (currently lines 152-174):

```typescript
    // Check if GA4 Config Tag is already in the conflict results
    const hasConfigTag = sorted.some(item => item.entityName === GA4_CONFIG_TAG_NAME)

    logger.info('GTM-API', `Starting execution — ${sorted.length} entities to process`)

    // Auto-create GA4 Config Tag before event tags if not already in the items
    if (!hasConfigTag) {
      try {
        const configPayload = buildGa4ConfigTagPayload(measurementId)
        logger.info('GTM-API', `Creating tag "${GA4_CONFIG_TAG_NAME}" (auto)...`)
        await createTag(token, workspacePath, configPayload as never)
        logger.success('GTM-API', `CREATED tag "${GA4_CONFIG_TAG_NAME}" (auto)`)
        results.push({ entityName: GA4_CONFIG_TAG_NAME, entityType: 'tag', action: 'CREATED' })
        onProgress([...results])
        successCount++
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        logger.error('GTM-API', `ERROR tag "${GA4_CONFIG_TAG_NAME}": ${msg}`)
        results.push({ entityName: GA4_CONFIG_TAG_NAME, entityType: 'tag', action: 'ERROR', errorMessage: msg })
        onProgress([...results])
        return { results, stopped: true, stoppedAt: GA4_CONFIG_TAG_NAME, successCount }
      }
    }
```

Replace it with just the `Starting execution` log line:

```typescript
    logger.info('GTM-API', `Starting execution — ${sorted.length} entities to process`)
```

- [ ] **Step 2: Remove the now-unused `GA4_CONFIG_TAG_NAME` constant**

Delete `src/services/executeEntities.ts:16-17`:

```typescript
/** Name of the GA4 Configuration Tag, used to detect if it's already in the conflict results. */
const GA4_CONFIG_TAG_NAME = 'GA4 - Configuration TAG'
```

- [ ] **Step 3: Remove the now-unused `buildGa4ConfigTagPayload` import**

In `src/services/executeEntities.ts`, delete this line:

```typescript
import { buildGa4ConfigTagPayload } from './entityBuilder'
```

The remaining imports stay as they are. The `measurementId` parameter on `executeAll` is now unused at the function-body level, but **leave the parameter signature alone** — Step5Execute.tsx passes it as the 6th argument and removing it would force a UI change for no benefit (YAGNI). Add a leading underscore to mark it unused to TypeScript:

```typescript
export async function executeAll(
  items: ConflictResult[],
  token: string,
  workspacePath: string,
  logger: Logger,
  onProgress: (results: ExecutionResult[]) => void,
  _measurementId: string,
): Promise<ExecutionOutcome> {
```

(If your TS config errors on unused-but-prefixed params, instead leave the name `measurementId` and let the linter's `noUnusedParameters: false` or argsIgnorePattern handle it. Check `tsconfig.json` first.)

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `_measurementId` triggers an error, follow the alternative in Step 3.

- [ ] **Step 5: Re-run the Task 1 failing test**

Run: `npx vitest run src/services/executeEntities.test.ts -t "does NOT auto-create"`
Expected: **PASS** — `createTag` is no longer called.

- [ ] **Step 6: Run the full test file**

Run: `npx vitest run src/services/executeEntities.test.ts`
Expected: all tests pass. If older tests assert on auto-create behavior (e.g., a `CREATED tag "GA4 - Configuration TAG" (auto)` log line), DELETE those assertions — that behavior is intentionally gone.

- [ ] **Step 7: Commit**

```bash
git add src/services/executeEntities.ts src/services/executeEntities.test.ts
git commit -m "fix: remove GA4 Config Tag auto-create — handled by conflict detection"
```

---

## Task 5: Add an explicit conflict-detection test for the Config Tag

Conflict detection already works for `gaawc` tags via the generic parameter-comparison code path, but we want a regression test pinned to the Config Tag specifically so that any future change to `entitiesMatch` doesn't silently break it.

**Files:**
- Modify: `src/services/conflictDetection.test.ts`

- [ ] **Step 1: Add the test**

In `src/services/conflictDetection.test.ts`, add a new `describe` block at the bottom of the file:

```typescript
describe('detectConflicts — GA4 Config Tag', () => {
  const intendedConfigTag: GtmTagPayload = {
    name: 'GA4 - Configuration TAG',
    type: 'gaawc',
    parameter: [
      { key: 'measurementId', type: 'template', value: 'G-TEST12345' },
      { key: 'sendPageView', type: 'boolean', value: 'true' },
    ],
    firingTriggerId: ['2147479553'],
  }

  it('classifies as WILL_CREATE when the workspace has no Config Tag', () => {
    const results = detectConflicts([intendedConfigTag], [], 'tag')
    expect(results[0].status).toBe('WILL_CREATE')
  })

  it('classifies as ALREADY_CORRECT when an identical Config Tag exists', () => {
    const existing: GtmEntity = {
      name: 'GA4 - Configuration TAG',
      type: 'gaawc',
      path: 'workspaces/1/tags/99',
      parameter: [
        { type: 'template', key: 'measurementId', value: 'G-TEST12345' },
        { type: 'boolean', key: 'sendPageView', value: 'true' },
      ],
      firingTriggerId: ['2147479553'],
    }
    const results = detectConflicts([intendedConfigTag], [existing], 'tag')
    expect(results[0].status).toBe('ALREADY_CORRECT')
  })

  it('classifies as CONFLICT when the Measurement IDs differ', () => {
    const existing: GtmEntity = {
      name: 'GA4 - Configuration TAG',
      type: 'gaawc',
      path: 'workspaces/1/tags/99',
      parameter: [
        { type: 'template', key: 'measurementId', value: 'G-OTHER0000' },
        { type: 'boolean', key: 'sendPageView', value: 'true' },
      ],
      firingTriggerId: ['2147479553'],
    }
    const results = detectConflicts([intendedConfigTag], [existing], 'tag')
    expect(results[0].status).toBe('CONFLICT')
  })
})
```

Make sure the imports at the top of the test file include `GtmTagPayload` and `GtmEntity` from `../types`. Add them to the existing type-import line if missing.

- [ ] **Step 2: Run the new tests**

Run: `npx vitest run src/services/conflictDetection.test.ts -t "GA4 Config Tag"`
Expected: all three pass.

- [ ] **Step 3: Commit**

```bash
git add src/services/conflictDetection.test.ts
git commit -m "test: pin GA4 Config Tag conflict detection behavior"
```

---

## Task 6: Update Step4Preview and Step5Execute tests for the +1 tag

The dry-run UI tests in `Step4Preview.test.tsx` and the execution tests in `Step5Execute.test.tsx` may have hard-coded fixtures that count tags. With the Config Tag now flowing through, those counts go up by one. Run the suites and fix only what breaks.

**Files:**
- Modify (only if tests fail): `src/components/Step4Preview.test.tsx`, `src/components/Step5Execute.test.tsx`

- [ ] **Step 1: Run both component test files**

Run: `npx vitest run src/components/Step4Preview.test.tsx src/components/Step5Execute.test.tsx`

- [ ] **Step 2: Address each failure**

For each failing assertion, decide:
- If the test asserts a literal tag count (e.g., `expect(tags).toHaveLength(3)`), bump it by one and add a comment: `// includes GA4 Config Tag`.
- If the test asserts that a specific tag IS or IS NOT present, leave it alone.
- If the test mocks `inputParser` to return a fixed `tags` array, leave it alone — the mock controls the input.
- If a test was specifically checking the OLD auto-create behavior in Step 5 (e.g., looking for `(auto)` in a log line), DELETE that test — the behavior is gone.

Do not "fix" a failing test by silencing it. Understand each failure.

- [ ] **Step 3: Re-run both files until green**

Run: `npx vitest run src/components/Step4Preview.test.tsx src/components/Step5Execute.test.tsx`
Expected: all tests pass.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass across the entire codebase. Anything else that fails is in scope for this plan — fix it before committing.

- [ ] **Step 5: Commit**

```bash
git add src/components/Step4Preview.test.tsx src/components/Step5Execute.test.tsx
git commit -m "test: update Step 4 and Step 5 expectations for Config Tag in entity list"
```

---

## Task 7: Tighten the activity log for the Config Tag

The user explicitly values "easy to follow logs." With the Config Tag now flowing through the normal path, the existing logger output already reads cleanly:

- Step 4: `CONFLICT: tag: N checked — X new, Y conflict, Z correct` — Config Tag is included in the count.
- Step 5: `GTM-API: Creating tag "GA4 - Configuration TAG"...` then `CREATED` / `OVERWRITTEN` / `SKIP`.

We just want to confirm this end-to-end and write a tiny log assertion so a future regression doesn't silently lose visibility.

**Files:**
- Modify: `src/services/executeEntities.test.ts`

- [ ] **Step 1: Add an end-to-end log-shape test**

Add to `src/services/executeEntities.test.ts`:

```typescript
it('logs CREATED for a Config Tag passed in via the items list', async () => {
  const items: ConflictResult[] = [{
    entityName: 'GA4 - Configuration TAG',
    entityType: 'tag',
    status: 'WILL_CREATE',
    decision: null,
    intendedPayload: {
      name: 'GA4 - Configuration TAG',
      type: 'gaawc',
      parameter: [
        { key: 'measurementId', type: 'template', value: 'G-TEST12345' },
        { key: 'sendPageView', type: 'boolean', value: 'true' },
      ],
      firingTriggerId: ['2147479553'],
    },
  }]
  ;(gtmApi.createTag as ReturnType<typeof vi.fn>).mockResolvedValue({
    name: 'GA4 - Configuration TAG', type: 'gaawc', path: 'workspaces/1/tags/1',
  })

  await executeAll(items, 'token', 'workspaces/1', fakeLogger, vi.fn(), 'G-TEST12345')

  expect(fakeLogger.success).toHaveBeenCalledWith(
    'GTM-API',
    'CREATED tag "GA4 - Configuration TAG"',
  )
})
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/services/executeEntities.test.ts -t "logs CREATED for a Config Tag"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/services/executeEntities.test.ts
git commit -m "test: confirm Config Tag flows through standard execute logging"
```

---

## Task 8: Manual verification

Tests are necessary but not sufficient — the original bug was an integration issue and only an end-to-end run touches the real GTM API.

- [ ] **Step 1: Run the dev server**

Run: `npm run dev` (or whatever the project's dev command is — check `package.json` if unsure).

- [ ] **Step 2: Walk through the wizard against a workspace that ALREADY has the Config Tag**

This is the original failure case. Use the same workspace where the duplicate-name 400 happened today.

Expected behavior:
- Step 4 dry-run shows `GA4 - Configuration TAG` in either the **Already Correct** section (if the existing Config Tag has the same Measurement ID) or the **Conflict** section (if it differs).
- No 400 error appears in the activity log.
- If it shows up as a conflict, choosing **Skip** leaves it alone; choosing **Overwrite** updates it.

- [ ] **Step 3: Walk through against a fresh workspace**

Create a new dated workspace via the Step 2 selector. The Config Tag should now appear in the **Will Create** section, and Step 5 should log `CREATED tag "GA4 - Configuration TAG"`.

- [ ] **Step 4: Inspect the workspace in the GTM UI**

Open `tagmanager.google.com`, find the workspace, and confirm exactly one Config Tag exists with the correct Measurement ID. No duplicates.

- [ ] **Step 5: If everything looks good, push**

```bash
git push
```

If anything was off, capture the activity log, file the observation, and stop here — do not push a partial fix.

---

## Self-Review Checklist (already run by plan author)

- **Spec coverage:** the original bug (duplicate-name 400 on Config Tag) is addressed by Tasks 2 + 3 + 4. Visibility in dry-run is addressed by the same tasks. Long-term correctness is locked in by Tasks 1, 5, 6, 7. Manual verification in Task 8.
- **Placeholder scan:** no `TODO`, no "implement later", every code step shows the code, every test step shows the assertion.
- **Type consistency:** `buildGa4ConfigTagPayload`, `GtmTagPayload`, `ConflictResult`, `executeAll` signature all match the source files as of 2026-04-30.
