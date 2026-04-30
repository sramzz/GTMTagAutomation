# Step 2 Workspace Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user pick an existing workspace OR create a new dated workspace from Step 2 of the wizard, so the wizard never gets stuck on a "duplicate workspace name" 400 error.

**Architecture:** After the user selects a container, `Step2Container` already calls `listWorkspaces`. We extend that flow: render a third dropdown ("Workspace") populated with the existing workspaces plus a synthetic "Create new: S4D Automation - <today>" option. `handleNext` branches — call `createWorkspace` only when "create new" is picked; otherwise pass the selected existing workspace through to `onContainerSelected`. Edge cases are handled by hiding/disabling the "create new" option when (a) today's dated workspace already exists in the list, or (b) the container is at the 3-workspace limit.

**Tech Stack:** React + TypeScript, Vitest, Testing Library, existing `gtmApi` service.

---

## File Structure

- **Modify:** `src/components/Step2Container.tsx` — add workspace state + dropdown, branch in `handleNext`.
- **Modify:** `src/components/Step2Container.test.tsx` — update existing "creates workspace on Next" test, add new tests for reuse + today-exists + at-limit cases.
- **Modify:** `src/components/Step2Container.css` — no new selectors expected; existing `.step2-field` styles cover the new dropdown.

No new files. No type changes (`GtmWorkspace` already exists in `src/types/index.ts`).

---

## Background context for the implementer

- Free GTM allows max 3 workspaces per container — `MAX_WORKSPACES = 3` in the file.
- Today's dated name is computed as `S4D Automation - ${new Date().toISOString().slice(0,10)}`.
- The wizard's downstream conflict-detection (`src/services/conflictDetection.ts`) already handles existing tags/triggers/variables in a reused workspace, so reuse is safe.
- The synthetic "create new" option is represented in state with the sentinel string `"__create_new__"` (not a real path). Anything else is the `path` of an existing workspace.
- `listWorkspaces` returns the "Default Workspace" plus any user-created workspaces. We list **all** of them in the dropdown — the user may legitimately want to add to "Default Workspace" too.

---

### Task 1: Add workspace dropdown UI (no behavior change yet)

**Files:**
- Modify: `src/components/Step2Container.test.tsx`
- Modify: `src/components/Step2Container.tsx`

- [ ] **Step 1: Write the failing test**

Add this test inside the `describe('Step2Container', ...)` block in `src/components/Step2Container.test.tsx`, after the existing "shows workspace limit warning" test:

```tsx
it('shows a workspace dropdown after container is selected, listing existing workspaces plus a "create new" option', async () => {
  const user = userEvent.setup()
  render(<Step2Container accessToken={TOKEN} onContainerSelected={mockOnContainerSelected} />)

  await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument())
  await user.selectOptions(screen.getByLabelText(/account/i), 'accounts/111')
  await waitFor(() => expect(screen.getByText('Web Prod (GTM-ABC123)')).toBeInTheDocument())
  await user.selectOptions(screen.getByLabelText(/container/i), 'accounts/111/containers/c1')

  await waitFor(() => expect(screen.getByLabelText(/workspace/i)).toBeInTheDocument())

  const workspaceSelect = screen.getByLabelText(/workspace/i)
  expect(workspaceSelect).toHaveTextContent('Default Workspace')
  expect(workspaceSelect).toHaveTextContent(/Create new/i)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Step2Container.test.tsx -t "shows a workspace dropdown"`
Expected: FAIL — `getByLabelText(/workspace/i)` finds no element.

- [ ] **Step 3: Add workspace state and the dropdown UI**

In `src/components/Step2Container.tsx`:

a) Add a sentinel constant near the top, below `MAX_WORKSPACES`:

```tsx
// Sentinel value for the "create new dated workspace" dropdown option.
// All other option values are real workspace paths.
const CREATE_NEW_WORKSPACE = '__create_new__'
```

b) Add new state below the existing `useState` declarations (next to `workspaceWarning`):

```tsx
const [workspaces, setWorkspaces] = useState<GtmWorkspace[]>([])
const [selectedWorkspaceValue, setSelectedWorkspaceValue] = useState('')
```

c) In `handleAccountChange`, reset the new state too. Update the existing reset block:

```tsx
setSelectedContainerPath('')
setContainers([])
setWorkspaces([])
setSelectedWorkspaceValue('')
setWorkspaceWarning('')
setWorkspaceCheckDone(false)
setError('')
```

d) In `handleContainerChange`, after the existing `setWorkspaceWarning('')` reset, also clear the new state, and after the successful `listWorkspaces` call, store the workspaces:

```tsx
async function handleContainerChange(containerPath: string) {
  setSelectedContainerPath(containerPath)
  setWorkspaces([])
  setSelectedWorkspaceValue('')
  setWorkspaceWarning('')
  setWorkspaceCheckDone(false)
  setError('')

  if (!containerPath) return

  logger.info('GTM-API', `Checking workspaces for ${containerPath}...`)
  try {
    const result = await listWorkspaces(accessToken, containerPath)
    logger.success('GTM-API', `Found ${result.length} existing workspaces`)
    setWorkspaces(result)

    if (result.length >= MAX_WORKSPACES) {
      const msg = `This container has ${result.length} workspaces (maximum ${MAX_WORKSPACES}). Pick an existing workspace below, or delete one in GTM to create a new one.`
      logger.warn('GTM-API', msg)
      setWorkspaceWarning(msg)
    }
    setWorkspaceCheckDone(true)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to check workspaces'
    logger.error('GTM-API', msg)
    setError(msg)
  }
}
```

e) Compute today's name as a derived value, just above `selectedContainer`:

```tsx
const today = new Date().toISOString().slice(0, 10)
const todayWorkspaceName = `S4D Automation - ${today}`
const todayWorkspaceExists = workspaces.some(w => w.name === todayWorkspaceName)
const atWorkspaceLimit = workspaces.length >= MAX_WORKSPACES
const canCreateNew = !todayWorkspaceExists && !atWorkspaceLimit
```

f) Add the dropdown JSX between the Container `<div className="step2-field">` and the Measurement ID field:

```tsx
{selectedContainerPath && workspaceCheckDone && (
  <div className="step2-field">
    <label htmlFor="workspace-select">Workspace</label>
    <select
      id="workspace-select"
      value={selectedWorkspaceValue}
      onChange={e => setSelectedWorkspaceValue(e.target.value)}
    >
      <option value="">-- Select a workspace --</option>
      {canCreateNew && (
        <option value={CREATE_NEW_WORKSPACE}>
          Create new: {todayWorkspaceName}
        </option>
      )}
      {workspaces.map(w => (
        <option key={w.workspaceId} value={w.path}>
          {w.name}
        </option>
      ))}
    </select>
  </div>
)}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/Step2Container.test.tsx -t "shows a workspace dropdown"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Step2Container.tsx src/components/Step2Container.test.tsx
git commit -m "feat(step2): add workspace dropdown listing existing + create-new options"
```

---

### Task 2: Branch handleNext to reuse existing or create new

**Files:**
- Modify: `src/components/Step2Container.test.tsx`
- Modify: `src/components/Step2Container.tsx`

- [ ] **Step 1: Update the existing "creates workspace on Next" test and add the reuse test**

In `src/components/Step2Container.test.tsx`, update the `renderAndFillForm` helper to also pick "Create new" so existing tests still create a workspace:

```tsx
async function renderAndFillForm(user: ReturnType<typeof userEvent.setup>) {
  render(<Step2Container accessToken={TOKEN} onContainerSelected={mockOnContainerSelected} />)
  await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument())
  await user.selectOptions(screen.getByLabelText(/account/i), 'accounts/111')
  await waitFor(() => expect(screen.getByText('Web Prod (GTM-ABC123)')).toBeInTheDocument())
  await user.selectOptions(screen.getByLabelText(/container/i), 'accounts/111/containers/c1')
  await waitFor(() => expect(mockListWorkspaces).toHaveBeenCalled())
  await waitFor(() => expect(screen.getByLabelText(/workspace/i)).toBeInTheDocument())
  // Pick "Create new" to preserve the original Next-creates-workspace flow
  await user.selectOptions(screen.getByLabelText(/workspace/i), '__create_new__')
  await user.type(screen.getByLabelText(/measurement id/i), 'G-ABC1234567')
}
```

Then add this new test below the existing "creates workspace and calls onContainerSelected" test:

```tsx
it('reuses an existing workspace without calling createWorkspace when one is selected', async () => {
  const user = userEvent.setup()
  render(<Step2Container accessToken={TOKEN} onContainerSelected={mockOnContainerSelected} />)

  await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument())
  await user.selectOptions(screen.getByLabelText(/account/i), 'accounts/111')
  await waitFor(() => expect(screen.getByText('Web Prod (GTM-ABC123)')).toBeInTheDocument())
  await user.selectOptions(screen.getByLabelText(/container/i), 'accounts/111/containers/c1')
  await waitFor(() => expect(screen.getByLabelText(/workspace/i)).toBeInTheDocument())

  // Pick the existing "Default Workspace"
  await user.selectOptions(
    screen.getByLabelText(/workspace/i),
    'accounts/111/containers/c1/workspaces/w1'
  )
  await user.type(screen.getByLabelText(/measurement id/i), 'G-ABC1234567')
  await user.click(screen.getByRole('button', { name: /next/i }))

  await waitFor(() => {
    expect(mockOnContainerSelected).toHaveBeenCalledWith(
      mockContainers[0],
      mockWorkspaces[0],
      'G-ABC1234567'
    )
  })
  expect(mockCreateWorkspace).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run tests to verify the reuse test fails**

Run: `npx vitest run src/components/Step2Container.test.tsx -t "reuses an existing workspace"`
Expected: FAIL — `mockCreateWorkspace` is still called (or `onContainerSelected` not called with reused workspace).

- [ ] **Step 3: Update `handleNext` and the `isValid` predicate**

In `src/components/Step2Container.tsx`, update `isValid` to require a workspace selection, and replace the body of `handleNext`:

```tsx
const isValid =
  selectedAccountPath &&
  selectedContainerPath &&
  MEASUREMENT_ID_REGEX.test(measurementId) &&
  workspaceCheckDone &&
  selectedWorkspaceValue !== ''

async function handleNext() {
  if (!selectedContainer || !isValid) return

  setLoading(true)
  setError('')

  try {
    let workspace: GtmWorkspace
    if (selectedWorkspaceValue === CREATE_NEW_WORKSPACE) {
      logger.info('GTM-API', `Creating workspace "${todayWorkspaceName}"...`)
      workspace = await createWorkspace(accessToken, selectedContainerPath, todayWorkspaceName)
      logger.success('GTM-API', `Created workspace "${workspace.name}"`)
    } else {
      const existing = workspaces.find(w => w.path === selectedWorkspaceValue)
      if (!existing) {
        // Defensive: dropdown should never offer a path not in `workspaces`
        throw new Error('Selected workspace not found')
      }
      workspace = existing
      logger.info('GTM-API', `Reusing existing workspace "${workspace.name}"`)
    }

    logger.success('WIZARD', 'Step 2 complete — container and workspace selected')
    onContainerSelected(selectedContainer, workspace, measurementId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to select workspace'
    logger.error('GTM-API', msg)
    setError(msg)
  } finally {
    setLoading(false)
  }
}
```

Also remove the now-unused `!workspaceWarning` clause from `isValid` — workspace warning is informational once the dropdown handles the at-limit case (Task 3 covers UI). Leave the warning rendering in place.

- [ ] **Step 4: Run the full Step2 test file to verify all tests pass**

Run: `npx vitest run src/components/Step2Container.test.tsx`
Expected: PASS for all tests including the new reuse test and the previously-existing "creates workspace and calls onContainerSelected" test.

- [ ] **Step 5: Commit**

```bash
git add src/components/Step2Container.tsx src/components/Step2Container.test.tsx
git commit -m "feat(step2): reuse selected workspace or create new based on dropdown choice"
```

---

### Task 3: Hide "create new" when today's workspace already exists

**Files:**
- Modify: `src/components/Step2Container.test.tsx`
- (No code changes expected — Task 1 already implemented `canCreateNew`. This task verifies behavior.)

- [ ] **Step 1: Write the failing tests**

Add these two tests in `src/components/Step2Container.test.tsx` after the reuse test:

```tsx
it('hides the "Create new" option when today\'s dated workspace already exists', async () => {
  const today = new Date().toISOString().slice(0, 10)
  const todaysWorkspace: GtmWorkspace = {
    workspaceId: 'wToday',
    name: `S4D Automation - ${today}`,
    path: 'accounts/111/containers/c1/workspaces/wToday',
  }
  mockListWorkspaces.mockResolvedValue([mockWorkspaces[0], todaysWorkspace])

  const user = userEvent.setup()
  render(<Step2Container accessToken={TOKEN} onContainerSelected={mockOnContainerSelected} />)
  await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument())
  await user.selectOptions(screen.getByLabelText(/account/i), 'accounts/111')
  await waitFor(() => expect(screen.getByText('Web Prod (GTM-ABC123)')).toBeInTheDocument())
  await user.selectOptions(screen.getByLabelText(/container/i), 'accounts/111/containers/c1')

  await waitFor(() => expect(screen.getByLabelText(/workspace/i)).toBeInTheDocument())
  const workspaceSelect = screen.getByLabelText(/workspace/i)
  expect(workspaceSelect).not.toHaveTextContent(/Create new/i)
  expect(workspaceSelect).toHaveTextContent(`S4D Automation - ${today}`)
})

it('hides the "Create new" option when the container is at the workspace limit', async () => {
  const threeWorkspaces: GtmWorkspace[] = [
    { workspaceId: 'w1', name: 'WS 1', path: 'p/w1' },
    { workspaceId: 'w2', name: 'WS 2', path: 'p/w2' },
    { workspaceId: 'w3', name: 'WS 3', path: 'p/w3' },
  ]
  mockListWorkspaces.mockResolvedValue(threeWorkspaces)

  const user = userEvent.setup()
  render(<Step2Container accessToken={TOKEN} onContainerSelected={mockOnContainerSelected} />)
  await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument())
  await user.selectOptions(screen.getByLabelText(/account/i), 'accounts/111')
  await waitFor(() => expect(screen.getByText('Web Prod (GTM-ABC123)')).toBeInTheDocument())
  await user.selectOptions(screen.getByLabelText(/container/i), 'accounts/111/containers/c1')

  await waitFor(() => expect(screen.getByLabelText(/workspace/i)).toBeInTheDocument())
  const workspaceSelect = screen.getByLabelText(/workspace/i)
  expect(workspaceSelect).not.toHaveTextContent(/Create new/i)
  // User can still pick one of the three to proceed
  expect(workspaceSelect).toHaveTextContent('WS 1')
})
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/components/Step2Container.test.tsx -t "hides the"`
Expected: PASS — Task 1's `canCreateNew` already gates the option.

- [ ] **Step 3: Verify the at-limit Next-button test still works**

The existing test "shows workspace limit warning when container has 3 workspaces" asserts Next is disabled even with valid Measurement ID. With the new logic, Next stays disabled because `selectedWorkspaceValue` is empty (user hasn't picked one). Update that test to also verify the user can recover by selecting an existing workspace:

Replace the existing test body with:

```tsx
it('shows workspace limit warning when container has 3 workspaces but lets user pick an existing one', async () => {
  const threeWorkspaces: GtmWorkspace[] = [
    { workspaceId: 'w1', name: 'WS 1', path: 'p/w1' },
    { workspaceId: 'w2', name: 'WS 2', path: 'p/w2' },
    { workspaceId: 'w3', name: 'WS 3', path: 'p/w3' },
  ]
  mockListWorkspaces.mockResolvedValue(threeWorkspaces)

  const user = userEvent.setup()
  render(<Step2Container accessToken={TOKEN} onContainerSelected={mockOnContainerSelected} />)

  await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument())
  await user.selectOptions(screen.getByLabelText(/account/i), 'accounts/111')
  await waitFor(() => expect(screen.getByText('Web Prod (GTM-ABC123)')).toBeInTheDocument())
  await user.selectOptions(screen.getByLabelText(/container/i), 'accounts/111/containers/c1')

  await waitFor(() => {
    expect(screen.getByText(/3 workspaces \(maximum 3\)/i)).toBeInTheDocument()
  })

  // Even with a valid Measurement ID, Next is disabled until a workspace is picked
  await user.type(screen.getByLabelText(/measurement id/i), 'G-ABC1234567')
  expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()

  // Selecting an existing workspace enables Next
  await user.selectOptions(screen.getByLabelText(/workspace/i), 'p/w1')
  expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
})
```

- [ ] **Step 4: Run the full file**

Run: `npx vitest run src/components/Step2Container.test.tsx`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Step2Container.test.tsx
git commit -m "test(step2): cover workspace selector edge cases (today exists, at limit)"
```

---

### Task 4: Manual verification + full test suite

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --run`
Expected: All tests PASS, including unrelated suites.

- [ ] **Step 2: Run the type checker**

Run: `npm run build` (or `npx tsc --noEmit` if a typecheck script doesn't exist)
Expected: No TypeScript errors.

- [ ] **Step 3: Manual smoke test in the browser**

Run: `npm run dev`

In the browser:
1. Sign in, select an account and container in Step 2.
2. Confirm the new "Workspace" dropdown appears, listing existing workspaces.
3. If today's `S4D Automation - <today>` already exists, confirm "Create new" is **not** offered and the existing one appears in the list.
4. Select the existing today's workspace, enter a valid Measurement ID, click Next. Confirm the wizard proceeds to Step 3 without hitting the duplicate-name 400.
5. In a fresh container (no today's workspace yet), confirm "Create new: S4D Automation - <today>" is offered and selecting it creates a new workspace as before.

If any step fails, capture the activity-log output and fix the bug before continuing.

- [ ] **Step 4: Commit only if any fixes were needed**

If Step 3 surfaced a fix, commit it with a `fix(step2): ...` message. Otherwise no commit.

---

## Notes for the implementer

- **Don't** add a separate "Reuse vs. Create" radio control — the single dropdown is the whole UI. Simpler is better.
- **Don't** auto-select a workspace on the user's behalf. Forcing an explicit pick means the user always knows where their changes are landing.
- The `workspaceWarning` banner remains for informational context ("you're at 3 workspaces, can't create new"). It no longer blocks Next on its own — the empty `selectedWorkspaceValue` does that.
- Logging conventions: `info` before an API call, `success` after, `error` on failure, `warn` for validation/limit issues. Match the patterns already in this file.
