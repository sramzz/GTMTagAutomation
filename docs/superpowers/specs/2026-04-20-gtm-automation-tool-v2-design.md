# GTM Automation Tool — Product Specification v2.0

**Organization:** S4D
**Audience:** Senior PM, Dev Team Lead, LLM coding agents, and junior developers
**Version:** 2.0 — April 2026
**Classification:** Internal
**Principles:** KISS, DRY, YAGNI

---

## Context

S4D's OPS team manually configures Google Tag Manager (GTM) for every new website onboarding. This involves auditing a site's data layer events and variables, then manually creating GTM Data Layer Variables, Custom Event Triggers, and GA4 Event Tags through the GTM UI. The process is slow, error-prone, and requires specialized knowledge.

This tool automates that process entirely. Given a JSON description of data layer events and a target GTM container, the tool creates all necessary GTM entities via the GTM API.

---

## 1. Problem Statement

### Current manual process
1. Run a browser script (DevTools snippet) on each page of the site to audit data layer events and variables. Output is a JSON map of `{eventName: {count, variables[]}}`.
2. Open GTM UI and manually create one Data Layer Variable (DLV) per relevant data layer path.
3. Create one Custom Event Trigger per data layer event.
4. Create one GA4 Event Tag per trigger, mapping the DLV references to GA4 parameter names.
5. Test using GTM Preview mode and GA4 DebugView.

### Pain points
- Time-intensive and repetitive (hours per onboarding).
- Prone to naming inconsistencies and misconfiguration.
- Knowledge bottleneck — only experienced OPS members do it reliably.
- Partners own the GTM containers; OPS members have edit access but not ownership.

---

## 2. Solution Overview

A single-page web application that:
1. Authenticates against a partner-owned GTM container via Google OAuth.
2. Accepts a JSON data layer audit (or uses S4D's built-in standard mapping as fallback).
3. Fetches existing GTM container config and detects conflicts.
4. Shows a dry-run preview of everything it will create.
5. On confirmation, creates all GTM entities in the correct order via the GTM API v2.

---

## 3. Scope

### In scope (v2)
- GTM Data Layer Variable creation
- GTM Custom Event Trigger creation
- GTM GA4 Event Tag creation
- GA4 Configuration Tag creation (one per container)
- Conflict detection with per-item skip/overwrite decision
- Dry-run preview before any API writes
- Google OAuth authentication (partner-owned containers, user has edit access)
- S4D master mapping as default input (covers ~28 standard events)
- Custom JSON input mode (from audit script output)
- One GTM container per session
- Three-layer logging (console, on-screen panel, downloadable log file)
- Full TDD test coverage for all services and components

### Out of scope (v2 — candidates for future versions)
- GA4 Admin API — custom dimension/metric creation
- Third-party tags (AB Tasty, Google Ads, Webloyalty)
- Automated GTM testing or publishing
- Batch processing (multiple containers per session)
- User accounts, persistent storage, or audit logging backend
- Rollback/undo functionality
- Master mapping admin UI in the app
- Extended audit JSON format with GA4 parameter fields
- App reads master mapping from a shared Google Sheet

---

## 4. Users

| Persona | Technical Level | Primary Use |
|---|---|---|
| OPS Team Member | Can run DevTools scripts, Chrome extensions, terminal commands | Run tool for each new onboarding |
| Product Owner (partner-side) | Technical enough to use browser tools | Provide audit JSON; may run tool themselves |

**Volume:** 1-5 onboardings per month.
All users are either internal S4D staff or trusted partners with GTM edit access granted by the container owner.

---

## 5. Architecture

### Platform decision
**Lightweight single-page web app. No backend. No database.**

Rationale: low volume (1-5/month), technical users, single-purpose tool. A full-stack app with auth infrastructure is overkill.

### Hosting
Deployed as static files to Vercel, Netlify, or internal infra. Accessed via a URL in the browser. No install required for end users.

### Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 18 SPA | Component-based, one file per wizard step |
| Language | TypeScript | Type safety, self-documenting code |
| Build tool | Vite | Fast dev server, simple config |
| Testing | Vitest + React Testing Library | Same config as Vite, zero extra setup |
| Auth | Google OAuth 2.0 (client-side PKCE flow) | No client secret; browser-only token |
| GTM Integration | Google Tag Manager API v2 | REST, called directly from browser |
| Default mapping | `s4d_gtm_master_mapping.json` (compiled into app bundle) | Updated via code deploy when S4D standard changes |
| State management | React useState + useContext | No external library |
| Routing | None | Linear wizard, step counter in state |
| CSS | Plain CSS modules | No framework |
| Backend | None | All logic is client-side |

### OAuth scopes required
- `https://www.googleapis.com/auth/tagmanager.edit.containers`
- `https://www.googleapis.com/auth/tagmanager.readonly`

### Google Cloud project setup
- Enable the Tag Manager API.
- Create an OAuth 2.0 client ID (Web application type).
- Configure the OAuth consent screen. Restrict to S4D's Google Workspace domain so only internal accounts can authenticate.

---

## 6. Project Structure

```
src/
├── components/              # One file per wizard step + shared UI
│   ├── Step1Auth.tsx
│   ├── Step1Auth.test.ts
│   ├── Step2Container.tsx
│   ├── Step2Container.test.ts
│   ├── Step3Input.tsx
│   ├── Step3Input.test.ts
│   ├── Step4Preview.tsx
│   ├── Step4Preview.test.ts
│   ├── Step5Execute.tsx
│   ├── Step5Execute.test.ts
│   └── shared/              # Reusable UI pieces (buttons, log panel, etc.)
├── services/                # Business logic, zero UI knowledge
│   ├── gtmApi.ts
│   ├── gtmApi.test.ts
│   ├── conflictDetection.ts
│   ├── conflictDetection.test.ts
│   ├── entityBuilder.ts     # Builds GTM payload objects
│   ├── entityBuilder.test.ts
│   ├── auth.ts              # OAuth flow
│   └── auth.test.ts
├── logging/
│   ├── logger.ts            # Centralized logger (console + in-memory store)
│   └── logger.test.ts
├── types/
│   └── index.ts             # All shared TypeScript types in one place
├── data/
│   └── masterMapping.json   # Imported from /s4d_gtm_master_mapping.json at project root
├── App.tsx                  # Wizard shell, manages current step
├── App.css
└── main.tsx                 # Entry point
```

**Rules:**
- Each file does one thing.
- Test files live next to the code they test.
- Target: under 200 lines per file. If a file grows past that, split it.

---

## 7. Data Model

### 7.1 Audit JSON (input format)

This is the output of the existing data layer audit script. It is the primary custom input format.

```json
{
  "view_item_list": {
    "count": 3,
    "variables": ["event", "ecommerce.items"]
  },
  "add_to_cart": {
    "count": 5,
    "variables": ["event", "ecommerce.currency", "ecommerce.value", "ecommerce.items"]
  }
}
```

**Rules for parsing:**
- The `event` key is always present and should be ignored — it is the event name itself, not a variable to create.
- All other keys in `variables` are data layer paths that become GTM Data Layer Variables.
- The app matches each event name against the S4D master mapping. If a match is found, the master mapping rules (naming, GA4 parameter names, tag config) take precedence over raw derivation.
- If no match is found in the master mapping, the app creates a basic setup using auto-derived names (see Section 7.4).

### 7.2 S4D Master Mapping (default / enrichment layer)

The master mapping is the source of truth for S4D's standard GTM configuration. The source file is `s4d_gtm_master_mapping.json` at the project root. At build time, it is imported into the app from `src/data/masterMapping.json` (copied or symlinked during project setup). Each entry represents one data layer event and its full GTM configuration.

**To update the master mapping:** edit `s4d_gtm_master_mapping.json` in the repo and redeploy. No admin UI. No external data source.

The file includes a `_meta` section with version info, status definitions, and naming conventions. The app should validate the `_meta.version` field at startup to ensure compatibility.

#### Master mapping entry schema

```json
{
  "id": 1,
  "category": "E-COMMERCE: PRODUCT DISCOVERY",
  "dataLayerEvent": "view_item_list",
  "ga4EventName": "view_item_list",
  "whenItFires": "User clicks 'see products', changes category, or switches from offers to products",
  "gtmVariables": [
    { "dlvPath": "ecommerce.items", "gtmVarName": "DLV - ecommerce.items" }
  ],
  "gtmTriggerName": "CE - view_item_list",
  "gtmTagName": "GA4 Event - view_item_list",
  "ga4Parameters": [
    { "paramName": "items", "gtmVarRef": "{{DLV - ecommerce.items}}" }
  ],
  "status": "LIVE"
}
```

#### Status values
- `LIVE` — create variables, trigger, and GA4 Event tag.
- `SYSTEM` — create DLVs and trigger only; no GA4 Event tag (e.g., OneTrust consent events).
- `SKIP` — do not create anything. Includes: GTM built-in events (`gtm.js`, `gtm.dom`, etc.), third-party tags (AB Tasty, Google Ads, Webloyalty), and data layer pushes without an event name.

#### Optional fields per entry
- `notes` — human-readable context about why an event is configured a certain way. Not used by the app logic, but preserved for documentation.

#### Master mapping summary

| Category | Events | Count |
|---|---|---|
| E-Commerce: Product Discovery | view_item_list, select_item, view_item, search | 4 |
| E-Commerce: Cart | add_to_cart, eecAddToCart, remove_from_cart, eecRemoveFromCart | 4 |
| E-Commerce: Coupons | add_coupon, couponcode | 2 |
| E-Commerce: Checkout | eecCheckout, eecCheckoutOption | 2 |
| E-Commerce: Purchase | eecPurchase | 1 |
| Promotions | view_promotion, select_promotion | 2 |
| User Events | login, login_event, register, account_creation | 4 |
| Navigation & UI | main_navigation_item, category_navigation_item, footer_navigation_item, banner_view, banner_click | 5 |
| Store & Delivery | store_locator, store_locator_time_picker | 2 |
| Custom Interactions | eventpush | 1 |
| Page Context | pageInfo | 1 |
| Consent (System) | OneTrustLoaded, OptanonLoaded, OneTrustGroupsUpdated | 3 (SYSTEM) |
| GTM System | gtm.js, gtm.dom, gtm.load, gtm.historyChange-v2, gtm.scrollDepth, gtm.linkClick | 6 (SKIP) |
| Non-GA4 Third Party | eecPurchase (AB Tasty), eecPurchase (Google Ads), eecPurchase (Webloyalty), (All Pages) AB Tasty | 4 (SKIP) |
| No Event Name | Consent Mode v2 default settings push | 1 (SKIP) |

**Total: 42 events — 28 LIVE, 3 SYSTEM, 11 SKIP.**

### 7.3 Naming Conventions

These naming conventions are enforced by the app and must match S4D's existing GTM standards exactly.

| GTM Entity | Pattern | Example |
|---|---|---|
| Data Layer Variable | `DLV - {data_layer_path}` | `DLV - ecommerce.items` |
| Custom Event Trigger | `CE - {data_layer_event_name}` | `CE - add_to_cart` |
| GA4 Event Tag | `GA4 Event - {ga4_event_name}` | `GA4 Event - add_to_cart` |
| GA4 Configuration Tag | `GA4 - Configuration TAG` | `GA4 - Configuration TAG` |

**Exception:** The `eecPurchase` event (id 13) uses `DL -` prefix instead of `DLV -` for its purchase action field variables (e.g., `DL - ecommerce.purchase.actionField.id`). The trigger also breaks the `CE -` pattern, using `EEC purchase` instead. The app must use the exact names from the master mapping, not auto-generate them. The master mapping `gtmVarName` and `gtmTriggerName` fields are always authoritative — the naming convention table above is the default, not an override.

### 7.4 Auto-derivation rules (for unmatched events)

When a data layer event is not found in the master mapping:
- For each variable path: strip `ecommerce.` prefix if present, use the last segment as the GA4 parameter name. Example: `ecommerce.promotion_id` -> GA4 param `promotion_id`.
- GTM variable name: `DLV - {full_path}`
- Trigger name: `CE - {event_name}`
- Tag name: `GA4 Event - {event_name}`

---

## 8. User Flow

The app is a 5-step linear wizard. No navigation between steps except forward/backward.

### Step 1 — Authenticate
- User clicks "Sign in with Google."
- OAuth consent screen requests GTM scopes.
- On success: proceed to Step 2.
- On failure: show error message, remain on Step 1.

### Step 2 — Select Container
- App lists all GTM accounts accessible to the authenticated user.
- User selects Account -> Container.
- User enters GA4 Measurement ID (format: `G-XXXXXXXXXX`, validated client-side).
- Click "Next."

### Step 3 — Provide Input
Two modes (toggle/tab):

**Mode A — S4D Standard:**
No input needed. App will use the full master mapping. Show a preview count: "This will attempt to create X variables, Y triggers, and Z tags."

**Mode B — Custom JSON:**
Paste area or file upload (`.json` only). App validates the JSON structure on input. Show parse errors inline. On valid input, show event count detected.

Click "Run Dry Run."

### Step 4 — Preview & Conflict Resolution
App fetches existing workspace config and computes a diff.

Results are grouped into three sections:

| Section | Color | Meaning |
|---|---|---|
| Will Create | Green | Entity does not exist. Will be created. |
| Conflict | Amber | Entity exists with same name but different config. User must choose: Skip or Overwrite. |
| Already Correct | Gray | Entity exists and matches intended config. No action needed. |

- Each section is collapsible/expandable.
- Summary bar: "X to create, Y conflicts (N skipped / M to overwrite), Z already correct."
- "Apply Changes" button is disabled until all conflicts have a decision (skip or overwrite).
- On-screen activity log panel is visible, showing conflict detection progress.

### Step 5 — Execute & Results
- Progress indicator: Variables -> Triggers -> Tags (sequential, not parallel — order matters).
- On-screen activity log panel shows real-time progress of each API call.
- On completion: results table with columns: Entity Name, Type, Action Taken (Created / Skipped / Overwritten / Error).
- "Download Log" button to export full session log as `.txt` file.
- CTA: "Open GTM Container" (direct link to GTM UI).
- Secondary CTA: "Start New Onboarding" (resets app state, returns to Step 2).

---

## 9. GTM API v2 Integration

### 9.1 API call sequence

```
1. GET accounts.list                              -> populate account dropdown
2. GET accounts.containers.list                   -> populate container dropdown
3. GET accounts.containers.workspaces.list        -> check workspace count and limit
4. POST accounts.containers.workspaces.create     -> create dated workspace
5. GET accounts.containers.workspaces.variables.list  -> conflict detection
6. GET accounts.containers.workspaces.triggers.list   -> conflict detection
7. GET accounts.containers.workspaces.tags.list       -> conflict detection
8. POST variables.create (or PUT variables.update)    -> create/overwrite variables
9. POST triggers.create (or PUT triggers.update)      -> create/overwrite triggers
10. POST tags.create (or PUT tags.update)              -> create/overwrite tags
```

**Critical ordering:** Variables must be created before triggers, triggers before tags. Tags reference trigger IDs returned by the API; these IDs are not known until triggers are created.

### 9.2 Workspace strategy

- Always create a new workspace named `S4D Automation - {YYYY-MM-DD}`.
- Before creating: check how many workspaces exist. If the container is at the GTM limit (3 for free GTM, more for GTM 360), warn the user and block creation. Tell the user to delete or publish an existing workspace in the GTM UI.
- All changes stay in the workspace. The app does NOT publish the container version. Publishing remains a manual step by the OPS member after testing.

### 9.3 Entity payload templates

#### Data Layer Variable
```json
{
  "name": "DLV - ecommerce.items",
  "type": "v",
  "parameter": [
    { "type": "integer", "key": "dataLayerVersion", "value": "2" },
    { "type": "boolean", "key": "setDefaultValue", "value": "false" },
    { "type": "template", "key": "name", "value": "ecommerce.items" }
  ]
}
```
> `"type": "v"` is GTM's internal code for "Data Layer Variable". This is not documented clearly by Google but is required.

#### Custom Event Trigger
```json
{
  "name": "CE - add_to_cart",
  "type": "customEvent",
  "customEventFilter": [
    {
      "type": "equals",
      "parameter": [
        { "type": "template", "key": "arg0", "value": "{{_event}}" },
        { "type": "template", "key": "arg1", "value": "add_to_cart" }
      ]
    }
  ]
}
```
> `{{_event}}` is a GTM built-in variable that holds the current data layer event name. The filter says: "fire this trigger when the event name equals add_to_cart."

#### GA4 Event Tag
```json
{
  "name": "GA4 Event - add_to_cart",
  "type": "gaawe",
  "parameter": [
    { "key": "eventName", "type": "template", "value": "add_to_cart" },
    { "key": "measurementIdOverride", "type": "template", "value": "G-XXXXXXXXXX" },
    {
      "key": "eventParameters",
      "type": "list",
      "list": [
        {
          "type": "map",
          "map": [
            { "type": "template", "key": "name", "value": "items" },
            { "type": "template", "key": "value", "value": "{{DLV - ecommerce.items}}" }
          ]
        }
      ]
    }
  ],
  "firingTriggerId": ["<RUNTIME: use trigger ID returned by the API in step 9>"]
}
```
> `"type": "gaawe"` is GTM's internal code for "Google Analytics: GA4 Event" tag. `firingTriggerId` is set at runtime — the trigger must be created first, and its API-returned ID goes here.

#### GA4 Configuration Tag
```json
{
  "name": "GA4 - Configuration TAG",
  "type": "gaawc",
  "parameter": [
    { "key": "measurementId", "type": "template", "value": "G-XXXXXXXXXX" },
    { "key": "sendPageView", "type": "boolean", "value": "true" }
  ],
  "firingTriggerId": ["2147479553"]
}
```
> `"type": "gaawc"` is GTM's internal code for "Google Analytics: GA4 Configuration" tag. `"2147479553"` is the GTM built-in trigger ID for "All Pages" — this is a hard-coded constant in every GTM container.

---

## 10. Conflict Detection Logic

```
For each entity the app intends to create:
  1. Look up existing entities in the workspace by name (case-sensitive exact match).
  2. If no match found -> mark as WILL_CREATE.
  3. If match found:
     a. Compare type and key parameters.
     b. If identical -> mark as ALREADY_CORRECT (no action).
     c. If different -> mark as CONFLICT.
        - Present to user: Skip (keep existing) or Overwrite (update via PUT).
  4. For OVERWRITE: use the update endpoint with the existing entity's path.
     Do NOT delete and recreate — this preserves the entity ID and any external references.
```

**Edge cases:**
- Trigger exists but its corresponding tag does not: create the tag, reference the existing trigger's ID.
- Variable exists but the trigger referencing it does not: create the trigger normally.
- GA4 Configuration Tag already exists with a different Measurement ID: flag as a conflict. User decides skip or overwrite.
- GA4 Configuration Tag already exists with the same Measurement ID: mark as ALREADY_CORRECT.

---

## 11. Logging Architecture

Three layers, one logger module that powers all of them.

### 11.1 The Logger Module (`src/logging/logger.ts`)

A single module every other file imports. Exposes: `logger.info()`, `logger.warn()`, `logger.error()`, `logger.success()`. Each call does three things simultaneously:

1. Writes to the browser console with a colored, structured format.
2. Pushes the entry into an in-memory array (React state via context).
3. The in-memory array feeds both the on-screen panel and the download export.

### 11.2 Log Entry Structure

Every log entry contains:

| Field | Description | Example |
|---|---|---|
| `datetime` | Full date and time | `2026-04-20 12:34:01` |
| `source` | Which module produced it | `AUTH`, `GTM-API`, `CONFLICT`, `WIZARD`, `VALIDATION` |
| `level` | Severity | `INFO`, `WARN`, `ERROR`, `SUCCESS` |
| `message` | Plain English, what happened | `Created trigger "CE - add_to_cart" (id: 847)` |

### 11.3 Console Output

Full datetime, aligned columns, every log entry:

```
[2026-04-20 12:34:01] [AUTH]       INFO    User authenticated as ops@solutions4delivery.com
[2026-04-20 12:34:02] [GTM-API]   INFO    Fetching accounts list...
[2026-04-20 12:34:03] [GTM-API]   INFO    Found 3 accounts
[2026-04-20 12:34:10] [GTM-API]   INFO    Selected container: "Partner XYZ - Web" (GTM-ABC123)
[2026-04-20 12:34:11] [GTM-API]   INFO    Checking existing workspaces... found 1 of 3 max
[2026-04-20 12:34:12] [GTM-API]   INFO    Creating workspace "S4D Automation - 2026-04-20"
[2026-04-20 12:34:15] [CONFLICT]  WARN    Variable "DLV - ecommerce.items" already exists — flagged as conflict
[2026-04-20 12:34:20] [GTM-API]   SUCCESS Created trigger "CE - add_to_cart" (id: 847)
[2026-04-20 12:34:21] [GTM-API]   ERROR   Failed to create tag "GA4 Event - view_item": 403 Forbidden
```

### 11.4 On-Screen Activity Panel

- Visible on Steps 4 and 5 (preview and execution).
- Shows the same messages as the console.
- Time only (`12:34:01`) to save space — the date is shown once at the top of the panel.
- Color-coded: green for success, amber for warnings, red for errors, gray for info.
- Collapsible so it doesn't dominate the screen.
- Auto-scrolls to the latest entry.

### 11.5 Downloadable Log File

- A "Download Log" button appears after Step 5 completes (or after any error).
- Exports the full session log as a `.txt` file named `gtm-automation-log-YYYY-MM-DD-HHMMSS.txt`.
- File header includes session context:

```
GTM Automation Tool — Session Log
Date: 2026-04-20
User: ops@solutions4delivery.com
Container: Partner XYZ - Web (GTM-ABC123)
Workspace: S4D Automation - 2026-04-20
-------------------------------------------
[2026-04-20 12:34:01] [AUTH]       INFO    User authenticated as ops@solutions4delivery.com
...
```

### 11.6 What Gets Logged (and What Does Not)

**Logged:**
- Every API call: what's being requested, what came back (status, entity ID)
- Every conflict detected and what the user decided (skip or overwrite)
- Every error with the HTTP status and Google's error message
- Step transitions in the wizard
- Input validation results

**Never logged:**
- OAuth access tokens
- Full API response bodies (only status codes and entity IDs)

**Note:** The downloaded log file header includes the user's email for traceability (who ran this session). Individual log entries do not repeat the email.

---

## 12. TDD Strategy

Every piece of logic gets tested before it is implemented. Tests run with `npm test`.

### 12.1 TDD Cycle

For every feature:
1. Write the test describing what the function/component should do.
2. Run it — it fails (red).
3. Write the minimum code to make it pass (green).
4. Clean up the code without changing behavior (refactor).
5. Move to the next test.

### 12.2 Services Layer (Pure Logic)

| Module | What we test | How |
|---|---|---|
| `entityBuilder.ts` | Given an event from master mapping, does it produce the correct GTM variable/trigger/tag payload? | Unit test. Input: mapping entry. Output: API-ready JSON. No mocks needed. |
| `conflictDetection.ts` | Given intended entities and existing entities, does it correctly classify each as WILL_CREATE, ALREADY_CORRECT, or CONFLICT? | Unit test. Input: two arrays. Output: classified list. No mocks needed. |
| `gtmApi.ts` | Does it call the right endpoints, in the right order, with the right payloads? Does it handle 403, 429, timeouts? | Unit test with mocked `fetch`. We mock the network, not the logic. |
| `auth.ts` | Does it construct the correct OAuth URL? Does it parse the token from the redirect? | Unit test. No real Google auth in tests. |

### 12.3 Logger

| What we test | How |
|---|---|
| `logger.info()` produces an entry with correct datetime, source, level, message | Unit test. Check the in-memory array after calling the function. |
| Log export produces a valid file with the header and all entries | Unit test. Call several log functions, export, check the string output. |
| Each log level (INFO, WARN, ERROR, SUCCESS) formats correctly | Unit test. One assertion per level. |

### 12.4 Components Layer (UI Behavior)

| Component | What we test | How |
|---|---|---|
| `Step1Auth` | Shows sign-in button. On auth success, advances to step 2. On failure, shows error message. | Render component, simulate events, check what's on screen. |
| `Step2Container` | Shows accounts from the API. Validates Measurement ID format (`G-XXXXXXXXXX`). Warns if workspace limit reached. | Render with mocked API data, check dropdowns and validation. |
| `Step3Input` | Toggles between S4D Standard and Custom JSON. Rejects invalid JSON with inline error. Shows event count on valid input. | Render, simulate toggle and paste, check error states. |
| `Step4Preview` | Shows three groups (create/conflict/correct). Disables "Apply" until all conflicts resolved. Shows activity log panel. | Render with mock diff data, check grouping and button state. |
| `Step5Execute` | Shows progress per entity type. Shows results table on completion. Download button exports log file. | Render with mock execution data, check sequence. |

### 12.5 What We Do NOT Test

- Google's OAuth library internals
- The GTM API itself (that's Google's responsibility)
- CSS styling and visual layout
- Vite build configuration

---

## 13. Code Standards

Rules for writing code that a new developer can maintain without the original author.

### 13.1 Comments

- Every file starts with a 1-2 line comment explaining what the file does and where it fits in the app.
- Comments explain **why**, never **what**. If the code needs a comment to explain what it does, rewrite the code to be clearer.
- Exception: GTM API payloads get inline comments explaining non-obvious fields. These are GTM-specific magic values that no amount of clean code can make obvious. Examples:
  - `"type": "v"` — GTM's internal code for "Data Layer Variable"
  - `"2147479553"` — GTM's built-in trigger ID for "All Pages"
  - `"gaawe"` — GTM's internal code for "GA4 Event" tag type
  - `"gaawc"` — GTM's internal code for "GA4 Configuration" tag type

### 13.2 TypeScript Types

- Every data structure has a named type: `MasterMappingEntry`, `AuditJson`, `ConflictResult`, `GtmVariable`, `GtmTrigger`, `GtmTag`, `LogEntry`, etc.
- Types serve as living documentation. A dev reads `types/index.ts` and understands the entire data model.
- No `any`. If you don't know the type, define it.

### 13.3 Functions

- Functions do one thing. If a function name has "and" in it, split it.
- Max ~50 lines per function. If longer, it's doing too much.
- All service functions return typed results. No loose objects.

### 13.4 Error Messages

- Every error message tells the user what happened, why, and what to do next.
- Example: `"Failed to create trigger 'CE - add_to_cart': 403 Forbidden. You need Editor access to this container. Ask the container owner to grant it."`
- Never: `"Error: 403"`

### 13.5 General Rules

- No dead code. No commented-out code. No unused imports, variables, or functions.
- No `any` types in TypeScript.
- Max ~200 lines per file. If a file grows past that, split it.
- No external runtime dependencies beyond React. Keep the dependency tree minimal.

---

## 14. Error Handling

### 14.1 Blocking Errors (stop the flow, user must act)

| Scenario | Behavior | User-facing message |
|---|---|---|
| OAuth denied or fails | Return to Step 1 | "Authentication failed. Ensure you have edit access to the GTM container and that you are using an @solutions4delivery.com account." |
| Invalid JSON input | Block progression, highlight parse error location | "Invalid JSON at line X. Verify the format matches the audit script output." |
| Insufficient permissions (403) | Detect on first write attempt | "You need Editor access to this container. Ask the owner to grant it." |
| Workspace limit reached | Block workspace creation on Step 2 | "This container has N workspaces (maximum N). Delete or publish an existing workspace in GTM before continuing." |

### 14.2 Retriable Errors (the app handles automatically)

| Scenario | Behavior | User-facing message |
|---|---|---|
| GTM API rate limit (429) | Exponential backoff, max 3 retries | "Rate limited by Google API. Retrying in Xs... (attempt N of 3)" |
| Network timeout | Retry once after 5 seconds | "Request timed out. Retrying..." If second attempt fails: "Request timed out. Check your connection and try again." |

### 14.3 Partial Failures (mid-execution)

| Scenario | Behavior | User-facing message |
|---|---|---|
| Create/update call fails during Step 5 | Stop execution immediately | "Stopped at [entity name]. X items created successfully. Review the log and retry — already-created items will be detected as 'Already Correct'." |

**Logger integration:** Every error is logged at `ERROR` level with full context: which entity, which API endpoint, what HTTP status, what Google's error message said.

**TDD integration:** Every error scenario listed above has a corresponding test. The test for `gtmApi.ts` includes: "when the API returns 429, it retries with backoff." The test for `Step5Execute` includes: "when creation fails mid-way, it shows partial results."

---

## 15. Security

- No tokens stored server-side. OAuth access tokens live only in the browser session memory.
- No partner GTM data is stored or logged beyond the active session.
- OAuth tokens are never logged — not to console, not to the on-screen panel, not to the downloadable log file.
- The app does not publish GTM container versions. All changes are in an unpublished workspace, providing a safe rollback point (delete the workspace or revert changes in GTM UI).
- OAuth consent screen is restricted to S4D's Google Workspace domain (`@solutions4delivery.com`) so only internal accounts can authenticate.
- All API calls go over HTTPS to Google's endpoints.
- The OAuth Client ID is the only credential embedded in the app. It is a public identifier, not a secret. No client secret is used (PKCE flow).

---

## 16. Testing Plan

### Development testing (use S4D-owned test container)
- Run with S4D standard mapping on an empty container. Verify all 28 LIVE events are created correctly.
- Run again on the same container. Verify all entities are detected as "Already Correct."
- Manually alter one tag's config in GTM, then run again. Verify it is detected as "Conflict."
- Pre-populate container with random tags and run. Verify no interference.

### Acceptance testing (real partner container, staging if available)
- Run tool end-to-end on a real onboarding.
- Verify GTM UI shows correct names, types, and configurations for all created entities.
- Open GTM Preview mode; navigate the site; verify correct triggers fire on the correct events.
- Open GA4 DebugView; verify events arrive with correct parameter names and values.
- Download the session log file and verify it contains complete, readable information about the run.

---

## Appendix A: Audit Script Reference

The data layer audit script is a browser DevTools snippet. It intercepts `dataLayer.push()` calls, accumulates event names and variable paths into `sessionStorage`, and persists data across page navigations within the same session.

**Output format:** JSON object where each key is a data layer event name and the value contains `count` (number of times fired) and `variables` (array of dot-notation paths to all non-object leaf values in that push).

The app consumes this JSON directly as the custom input mode (Step 3, Mode B).

---

## Appendix B: Key S4D GTM Patterns

Based on analysis of the master mapping, the following patterns apply consistently:

- Every LIVE data layer event -> exactly one Custom Event trigger + one GA4 Event tag.
- Some data layer events map to the same GA4 event (e.g., `add_to_cart` and `eecAddToCart` both -> GA4 `add_to_cart`). Each gets its own trigger and tag with disambiguating names.
- Not every data layer variable becomes a GTM variable. Only variables that are actually sent as GA4 parameters are created. The master mapping defines which ones matter per event.
- GA4 parameter names are often simplified from the full data layer path: `ecommerce.promotion_id` -> `promotion_id`, `ecommerce.purchase.actionField.revenue` -> `value`.
- SYSTEM events (OneTrust consent) get DLVs and triggers but no GA4 Event tags — they drive other functionality in the container.
- GTM built-in events (`gtm.js`, `gtm.dom`, etc.) use built-in GTM triggers and are never created programmatically.

---

## Appendix C: Prerequisites

### Developer machine
- Node.js v22+ and npm v10+
- A modern browser (Chrome recommended for GTM Preview compatibility)

### Google Cloud (one-time setup)
- Create a Google Cloud project
- Enable the Tag Manager API
- Create an OAuth 2.0 Client ID (Web application type)
- Configure OAuth consent screen restricted to S4D's Google Workspace domain
- Add the deployment URL as an authorized redirect URI

### For testing
- A S4D-owned GTM test container (not a partner container)
- A Google account with Editor access to the test container
