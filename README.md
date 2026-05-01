# GTM Automation Tool

## Why this exists

S4D's OPS team configures Google Tag Manager (GTM) for every new website onboarding. The manual workflow — auditing data layer events, then creating Data Layer Variables, Custom Event Triggers, and GA4 Event Tags one by one through the GTM UI — is slow, repetitive, and error-prone. Naming drifts, items get missed, and only the most experienced operators can do it reliably.

This tool automates that process. Given a JSON description of a site's data layer events (either captured live from a browser or taken from S4D's standard mapping) and a target GTM container, it creates every required GTM entity through the GTM API in the correct order, after a dry-run preview and conflict check. What used to take hours now takes minutes, with consistent naming and no missed entities.

## How the project is organized

The tool is a single-page React + TypeScript web app built with Vite. It runs entirely in the browser — there is no backend. Authentication uses Google OAuth (implicit flow), and all GTM API calls go directly from the browser to Google.

### Top-level layout

```
GTMTagAutomation/
├── public/
│   ├── dataLayerAudit.js     # DevTools snippet operators paste into Chrome to capture a site's data layer
│   └── ...                    # favicon / icons
├── src/
│   ├── App.tsx                # Wizard shell — owns step state and shared session data
│   ├── components/            # One folder-less component per wizard step + shared UI
│   ├── services/              # Pure logic: auth, GTM API, parsing, conflict detection, execution
│   ├── logging/               # Three-layer logger (console, on-screen panel, downloadable file)
│   ├── data/masterMapping.json# S4D's default mapping covering ~28 standard events
│   └── types/                 # Shared TypeScript types
├── docs/superpowers/specs/    # Product spec and design docs
├── .env.example               # Template for the OAuth client ID
└── package.json
```

### How everything connects

The app is a 5-step wizard. `App.tsx` holds the cross-step state (access token, selected container, workspace, parsed entities, conflict decisions) and renders one step component at a time:

1. **Step 1 — Authenticate** (`Step1Auth.tsx`): Google OAuth login, restricted to the S4D Workspace domain. Returns an access token.
2. **Step 2 — Select Container** (`Step2Container.tsx`): Lists GTM accounts/containers the user can edit, creates a dated workspace `S4D Automation - YYYY-MM-DD`, and captures the GA4 Measurement ID.
3. **Step 3 — Provide Input** (`Step3Input.tsx`): Either uses the built-in master mapping or accepts custom JSON from the `dataLayerAudit.js` snippet. Parses the input into entity lists (variables, triggers, tags).
4. **Step 4 — Preview** (`Step4Preview.tsx`): Fetches existing container entities, detects conflicts (especially the GA4 Config Tag), and lets the user choose skip/overwrite per item.
5. **Step 5 — Execute** (`Step5Execute.tsx`): Creates entities in dependency order (variables → triggers → tags) with rate limiting, streams progress to the log panel, and offers a downloadable session log.

`services/` contains all the I/O and business logic, kept separate from React components so it can be unit-tested in isolation:

- `auth.ts` — Google OAuth implicit flow
- `gtmApi.ts` — thin wrappers over GTM API v2 endpoints
- `inputParser.ts` — converts master mapping or audit JSON into entity lists
- `conflictDetection.ts` — compares planned entities against what already exists in the workspace
- `entityBuilder.ts` — constructs GTM API request bodies from parsed entities
- `executeEntities.ts` — orchestrates the create-in-order flow
- `rateLimiter.ts` — keeps API calls under GTM's quota

`logging/` provides a `LogProvider` context used by every step. Anything logged appears in the browser console, the on-screen `LogPanel`, and the exported log file produced at the end of a session.

The S4D **master mapping** lives at `src/data/masterMapping.json`. To update the standard event set, edit that file and redeploy — there is no admin UI by design.

## Running the project

### Prerequisites

- Node.js 20+
- A Google Cloud project with the **Google Tag Manager API** enabled and an **OAuth 2.0 Client ID** of type *Web application*
- Edit access to at least one GTM container

### 1. Clone and install

```bash
git clone https://github.com/<your-org>/GTMTagAutomation.git
cd GTMTagAutomation
npm install
```

### 2. Configure your OAuth client

Each user/deployment needs its own Google OAuth client ID. In the [Google Cloud Console](https://console.cloud.google.com/):

1. Create or select a project and enable the **Tag Manager API**.
2. Under *APIs & Services → Credentials*, create an **OAuth 2.0 Client ID** (Web application).
3. Add the URL you'll run the app from to *Authorized JavaScript origins* — for local dev, `http://localhost:5173`.
4. Copy the client ID.

Then create a `.env` file at the project root (use `.env.example` as a template):

```bash
cp .env.example .env
```

Edit `.env` and set:

```
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

> **Note:** OAuth is restricted to the `@solutions4delivery.com` Google Workspace domain. If you're forking this for another org, update the domain check in `src/services/auth.ts`.

### 3. Run locally

```bash
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`) and walk through the wizard.

### 4. Other useful commands

```bash
npm run test       # Vitest in watch mode
npm run test:run   # Single test run (CI)
npm run lint       # ESLint
npm run build      # Type-check and produce a production build in dist/
npm run preview    # Serve the production build locally
```

### 5. Capturing a custom data layer (optional)

For sites whose events don't match the master mapping, operators can capture a live audit:

1. Open the target site in Chrome with DevTools.
2. Open *Sources → Snippets*, paste the contents of `public/dataLayerAudit.js`, and run it on every page of the journey.
3. In the console, run `copy(sessionStorage.getItem('dlEventMap'))`.
4. Paste the JSON into Step 3's *Custom JSON* tab.

### Deploying

The built output in `dist/` is fully static and can be hosted on any static host (Netlify, Vercel, GitHub Pages, S3+CloudFront). Remember to:

- Add the production URL to *Authorized JavaScript origins* on the OAuth client.
- Set `VITE_GOOGLE_CLIENT_ID` in the host's environment before building.
