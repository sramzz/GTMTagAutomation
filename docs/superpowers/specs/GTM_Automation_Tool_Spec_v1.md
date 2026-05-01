# GTM Automation Tool — Product Specification v1.0

**Organization:** S4D  
**Audience:** Senior PM, Dev Team Lead, and LLM coding agents  
**Version:** 1.0 — April 2026  
**Classification:** Internal  

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

### In scope (v1)
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

### Out of scope (v1)
- GA4 Admin API — custom dimension/metric creation
- Third-party tags (AB Tasty, Google Ads, Webloyalty)
- Automated GTM testing or publishing
- Batch processing (multiple containers per session)
- User accounts, persistent storage, or audit logging
- Rollback/undo functionality

---

## 4. Users

| Persona | Technical Level | Primary Use |
|---|---|---|
| OPS Team Member | Can run DevTools scripts, Chrome extensions, terminal commands | Run tool for each new onboarding |
| Product Owner (partner-side) | Technical enough to use browser tools | Provide audit JSON; may run tool themselves |

**Volume:** 1–5 onboardings per month.  
All users are either internal S4D staff or trusted partners with GTM edit access granted by the container owner.

---

## 5. Architecture

### Platform decision
**Lightweight single-page web app. No backend. No database.**

Rationale: low volume (1–5/month), technical users, single-purpose tool. A full-stack app with auth infrastructure is overkill for v1.

### Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React SPA or plain HTML/JS | Host on Vercel, Netlify, or internal infra |
| Auth | Google OAuth 2.0 (client-side PKCE flow) | No client secret; browser-only token |
| GTM Integration | Google Tag Manager API v2 | REST, called directly from browser |
| Default mapping | Embedded JSON (compiled into app bundle) | Updated via code deploy when S4D standard changes |
| Backend | None | All logic is client-side |

### OAuth scopes required
- `https://www.googleapis.com/auth/tagmanager.edit.containers`
- `https://www.googleapis.com/auth/tagmanager.readonly`

### Google Cloud project setup
- Enable the Tag Manager API.
- Create an OAuth 2.0 client ID (Web application type).
- Configure the OAuth consent screen. Restrict to S4D's Google Workspace domain if possible to limit access to internal users only.

---

## 6. Data Model

### 6.1 Audit JSON (input format)

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
- If no match is found in the master mapping, the app creates a basic setup using auto-derived names (see Section 6.3).

### 6.2 S4D Master Mapping (default / enrichment layer)

The master mapping is the source of truth for S4D's standard GTM configuration. It is embedded in the app as a JSON array. Each entry represents one data layer event and its full GTM configuration.

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
- `SKIP` — do not create anything (e.g., `gtm.js`, `gtm.dom` — these use built-in GTM triggers).

#### Master mapping summary (from GTM_Master_Mapping.xlsx)

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

**Total: 28 LIVE events, 3 SYSTEM events, 6 SKIP events.**

### 6.3 Naming Conventions

These naming conventions are enforced by the app and must match S4D's existing GTM standards exactly.

| GTM Entity | Pattern | Example |
|---|---|---|
| Data Layer Variable | `DLV - {data_layer_path}` | `DLV - ecommerce.items` |
| Custom Event Trigger | `CE - {data_layer_event_name}` | `CE - add_to_cart` |
| GA4 Event Tag | `GA4 Event - {ga4_event_name}` | `GA4 Event - add_to_cart` |
| GA4 Configuration Tag | `GA4 - Configuration TAG` | `GA4 - Configuration TAG` |

### 6.4 Auto-derivation rules (for unmatched events)

When a data layer event is not found in the master mapping:
- For each variable path: strip `ecommerce.` prefix if present, use the last segment as the GA4 parameter name. Example: `ecommerce.promotion_id` → GA4 param `promotion_id`.
- GTM variable name: `DLV - {full_path}`
- Trigger name: `CE - {event_name}`
- Tag name: `GA4 Event - {event_name}`

---

## 7. User Flow

The app is a 5-step linear wizard. No navigation between steps except forward/backward.

### Step 1 — Authenticate
- User clicks "Sign in with Google."
- OAuth consent screen requests GTM scopes.
- On success: proceed to Step 2.
- On failure: show error message, remain on Step 1.

### Step 2 — Select Container
- App lists all GTM accounts accessible to the authenticated user.
- User selects Account → Container.
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

### Step 5 — Execute & Results
- Progress indicator: Variables → Triggers → Tags (sequential, not parallel — order matters).
- On completion: results table with columns: Entity Name, Type, Action Taken (Created / Skipped / Overwritten / Error).
- CTA: "Open GTM Container" (direct link to GTM UI).
- Secondary CTA: "Start New Onboarding" (resets app state, returns to Step 2).

---

## 8. GTM API v2 Integration

### 8.1 API call sequence

```
1. GET accounts.list → populate account dropdown
2. GET accounts.containers.list → populate container dropdown
3. GET/POST accounts.containers.workspaces → get or create workspace
4. GET accounts.containers.workspaces.variables.list → conflict detection
5. GET accounts.containers.workspaces.triggers.list → conflict detection
6. GET accounts.containers.workspaces.tags.list → conflict detection
7. POST variables.create (or PUT variables.update for overwrites)
8. POST triggers.create (or PUT triggers.update for overwrites)
9. POST tags.create (or PUT tags.update for overwrites)
```

**Critical ordering:** Variables must be created before triggers, triggers before tags. Tags reference trigger IDs returned by the API; these IDs are not known until triggers are created.

### 8.2 Workspace strategy
- Check for an existing workspace named `S4D Automation` in the container.
- If found: use it.
- If not: create a new workspace named `S4D Automation - {YYYY-MM-DD}`.
- All changes stay in the workspace. The app does NOT publish the container version. Publishing remains a manual step by the OPS member after testing.

### 8.3 Entity payload templates

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
  "firingTriggerId": ["<trigger_id_from_api_response>"]
}
```

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
> `2147479553` is the GTM built-in trigger ID for "All Pages."

---

## 9. Conflict Detection Logic

```
For each entity the app intends to create:
  1. Look up existing entities in the workspace by name (case-sensitive exact match).
  2. If no match found → mark as WILL_CREATE.
  3. If match found:
     a. Compare type and key parameters.
     b. If identical → mark as ALREADY_CORRECT (no action).
     c. If different → mark as CONFLICT.
        - Present to user: Skip (keep existing) or Overwrite (update via PUT).
  4. For OVERWRITE: use the update endpoint with the existing entity's path.
     Do NOT delete and recreate — this preserves the entity ID and any external references.
```

**Edge cases to handle:**
- Trigger exists but its corresponding tag does not: create the tag, reference the existing trigger's ID.
- Variable exists but the trigger referencing it does not: create the trigger normally.
- GA4 Configuration Tag already exists: always check first. If it exists and uses a different Measurement ID, flag as a conflict.

---

## 10. Error Handling

| Scenario | Behavior | User-facing message |
|---|---|---|
| OAuth denied or fails | Return to Step 1 | "Authentication failed. Ensure you have edit access to the GTM container." |
| Invalid JSON input | Block progression, highlight parse error location | "Invalid JSON. Verify the format matches the audit script output." |
| GTM API rate limit (429) | Exponential backoff, max 3 retries | "Waiting for Google API… (retry X of 3)" |
| Partial creation failure | Stop execution, show created vs. failed entities | "Stopped at [entity name]. X items created. Review and retry remaining items." |
| Insufficient permissions (403) | Detect on first write attempt | "You need Editor access to this container. Ask the owner to grant it." |
| Network timeout | Retry once, then show error | "Request timed out. Check your connection and try again." |

---

## 11. Security

- No tokens stored server-side. OAuth access tokens live only in the browser session.
- No partner GTM data is stored or logged beyond the active session.
- The app does not publish GTM container versions. All changes are in an unpublished workspace, providing a safe rollback point (just delete the workspace or revert changes in GTM UI).
- If possible, restrict OAuth consent to S4D's Google Workspace domain so only internal accounts can authenticate.
- All API calls go over HTTPS to Google's endpoints.

---

## 12. Testing Plan

### Development (use S4D-owned test container)
- Run with S4D standard mapping on an empty container. Verify all 28 LIVE events are created correctly.
- Run again on the same container. Verify all entities are detected as "Already Correct."
- Manually alter one tag's config in GTM, then run again. Verify it is detected as "Conflict."
- Pre-populate container with random tags and run. Verify no interference.

### Acceptance (real partner container, staging if available)
- Run tool end-to-end on a real onboarding.
- Verify GTM UI shows correct names, types, and configurations for all created entities.
- Open GTM Preview mode; navigate the site; verify correct triggers fire on the correct events.
- Open GA4 DebugView; verify events arrive with correct parameter names and values.

---

## 13. Implementation Roadmap

| Phase | Deliverable | Key tasks | Est. days |
|---|---|---|---|
| 1 | Google Cloud project + OAuth | Create project, enable GTM API, configure OAuth consent, get client ID | 1 |
| 2 | Master mapping JSON | Convert GTM_Master_Mapping.xlsx to structured JSON; validate all 42 events | 1–2 |
| 3 | GTM API integration | OAuth flow, list accounts/containers, CRUD for variables/triggers/tags | 3–5 |
| 4 | Conflict detection engine | Fetch existing config, name matching, diff logic, skip/overwrite flow | 2–3 |
| 5 | UI (wizard) | 5 screens: auth, container select, input, preview, results | 3–4 |
| 6 | Integration testing | Test with S4D test container, conflict scenarios, edge cases | 2–3 |
| 7 | UAT + deployment | OPS team acceptance test, deploy to hosting, write user guide | 2 |

**Total estimated effort: 14–20 working days for a junior developer with senior guidance.**

---

## 14. Open Questions (resolve before development starts)

1. **Workspace naming:** Should the app always use/create a workspace named `S4D Automation`, or create a dated one per session (e.g., `S4D Automation - 2026-04-13`) for traceability?
2. **GA4 Config Tag handling:** If a GA4 Configuration Tag already exists in the container with a different Measurement ID, should the app always flag it as a conflict, or offer to create a second one?
3. **Master mapping updates:** When the product team adds new standard events, how does the master mapping get updated? Options: (a) edit the JSON file in the codebase and redeploy, (b) admin UI in the app, (c) the app reads from a shared Google Sheet.
4. **Domain restriction:** Is S4D on Google Workspace? If yes, can the OAuth consent screen be restricted to `@s4d.com` accounts only?
5. **Audit JSON schema formalization:** Should the product team extend the audit JSON format to include `ga4EventName` and `ga4Parameters` fields for custom events, reducing reliance on auto-derivation?

---

## 15. v2 Candidates (not in scope now)

- GA4 Admin API integration: auto-create custom dimensions and metrics to match GTM event parameters.
- Third-party tag templates as configurable plugins (AB Tasty, Google Ads).
- Batch mode: process multiple containers in one session.
- Audit log backend: record who ran the tool, when, and on which container.
- Auto-publish option with container version naming and description.
- In-app audit: run the data layer audit script from within the app via injected iframe, eliminating the separate DevTools step.
- Rollback: undo all changes made in a session by deleting the created workspace.

---

## Appendix A: Audit Script Reference

The data layer audit script is a browser DevTools snippet. It intercepts `dataLayer.push()` calls, accumulates event names and variable paths into `sessionStorage`, and persists data across page navigations within the same session.

**Output format:** JSON object where each key is a data layer event name and the value contains `count` (number of times fired) and `variables` (array of dot-notation paths to all non-object leaf values in that push).

The app consumes this JSON directly as the custom input mode (Step 3, Mode B).

---

## Appendix B: Key S4D GTM Patterns

Based on analysis of the master mapping, the following patterns apply consistently:

- Every LIVE data layer event → exactly one Custom Event trigger + one GA4 Event tag.
- Some data layer events map to the same GA4 event (e.g., `add_to_cart` and `eecAddToCart` both → GA4 `add_to_cart`). Each gets its own trigger and tag with disambiguating names.
- Not every data layer variable becomes a GTM variable. Only variables that are actually sent as GA4 parameters are created. The master mapping defines which ones matter per event.
- GA4 parameter names are often simplified from the full data layer path: `ecommerce.promotion_id` → `promotion_id`, `ecommerce.purchase.actionField.revenue` → `value`.
- SYSTEM events (OneTrust consent) get DLVs and triggers but no GA4 Event tags — they drive other functionality in the container.
- GTM built-in events (`gtm.js`, `gtm.dom`, etc.) use built-in GTM triggers and are never created programmatically.
