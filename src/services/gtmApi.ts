// gtmApi.ts — All GTM API v2 calls. Every function takes an access token and returns typed results.
// Handles rate limiting (429) with exponential backoff and surfaces helpful error messages.
//
// Rate limiting strategy:
// 1. Proactive sliding-window limiter at 25/min keeps us under Google's 30/min/user quota.
// 2. Reactive 429 handler honors the Retry-After header for cases where someone else
//    on the same Google Cloud project is using the quota too.

import type {
  GtmAccount,
  GtmContainer,
  GtmWorkspace,
  GtmEntity,
  GtmVariablePayload,
  GtmTriggerPayload,
  GtmTagPayload,
} from '../types'
import { RateLimiter } from './rateLimiter'
import type { Logger } from '../logging/logger'

const BASE_URL = 'https://www.googleapis.com/tagmanager/v2'
const MAX_RETRIES = 5
const RATE_LIMIT_MAX = 25
const RATE_LIMIT_WINDOW_MS = 60_000

// Module-level reference to the active logger. Set via attachLogger() from the execution
// engine so rate-limit waits and retries appear in the on-screen activity log.
// Why a module-level reference: gtmFetch is called from many places, and threading the
// logger through every public function would be noisy. We have one session at a time, so a
// module-level "current logger" is the simplest correct model.
let activeLogger: Logger | null = null

export function attachLogger(logger: Logger | null): void {
  activeLogger = logger
}

// Module-level limiter — shared across all API calls. Why module-level: there is one
// browser tab making sequential requests, and the quota is per-user, so a singleton matches reality.
const rateLimiter = new RateLimiter({
  maxRequests: RATE_LIMIT_MAX,
  windowMs: RATE_LIMIT_WINDOW_MS,
  onWait: (waitMs, used, limit) => {
    const message = `Rate limit reached (${used}/${limit} used in last 60s). Waiting ${(waitMs / 1000).toFixed(1)}s before next request...`
    if (activeLogger) {
      activeLogger.warn('GTM-API', message)
    } else {
      console.warn(`[GTM-API] ${message}`)
    }
  },
})

// --- Internal fetch wrapper with retry logic ---

async function gtmFetch(token: string, url: string, options: RequestInit = {}): Promise<unknown> {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Proactive throttle: wait if we'd exceed our quota window
    await rateLimiter.acquire()

    const response = await fetch(url, { ...options, headers })

    if (response.ok) {
      return response.json()
    }

    if (response.status === 403) {
      throw new Error('You need Editor access to this container. Ask the owner to grant it.')
    }

    if (response.status === 429 && attempt < MAX_RETRIES) {
      // Reactive backoff: prefer the server's Retry-After hint, fall back to exponential.
      const retryAfter = parseRetryAfter(response.headers.get('Retry-After'))
      const delay = retryAfter ?? Math.min(Math.pow(2, attempt) * 1000, 60_000)
      const retryMessage = `429 received (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Waiting ${(delay / 1000).toFixed(1)}s before retry...`
      if (activeLogger) {
        activeLogger.warn('GTM-API', retryMessage)
      } else {
        console.warn(`[GTM-API] ${retryMessage}`)
      }
      await new Promise(resolve => setTimeout(resolve, delay))
      lastError = new Error(`Rate limited (attempt ${attempt + 1} of ${MAX_RETRIES + 1})`)
      continue
    }

    const text = await response.text()
    throw new Error(`GTM API error ${response.status}: ${text}`)
  }

  throw lastError || new Error('GTM API request failed after retries')
}

// Parses the Retry-After header. Per RFC 7231 it can be either:
// - a number of seconds (e.g. "30")
// - an HTTP-date (e.g. "Wed, 21 Oct 2026 07:28:00 GMT")
// Returns milliseconds to wait, or null if the header is missing or unparseable.
function parseRetryAfter(headerValue: string | null): number | null {
  if (!headerValue) return null

  const seconds = Number(headerValue)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000
  }

  const dateMs = Date.parse(headerValue)
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - Date.now()
    return delta > 0 ? delta : 0
  }

  return null
}

// --- Public API functions ---

export async function listAccounts(token: string): Promise<GtmAccount[]> {
  const data = await gtmFetch(token, `${BASE_URL}/accounts`) as { account?: GtmAccount[] }
  return data.account || []
}

export async function listContainers(token: string, accountPath: string): Promise<GtmContainer[]> {
  const data = await gtmFetch(token, `${BASE_URL}/${accountPath}/containers`) as { container?: GtmContainer[] }
  return data.container || []
}

export async function listWorkspaces(token: string, containerPath: string): Promise<GtmWorkspace[]> {
  const data = await gtmFetch(token, `${BASE_URL}/${containerPath}/workspaces`) as { workspace?: GtmWorkspace[] }
  return data.workspace || []
}

export async function createWorkspace(token: string, containerPath: string, name: string): Promise<GtmWorkspace> {
  return await gtmFetch(token, `${BASE_URL}/${containerPath}/workspaces`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  }) as GtmWorkspace
}

export async function listVariables(token: string, workspacePath: string): Promise<GtmEntity[]> {
  const data = await gtmFetch(token, `${BASE_URL}/${workspacePath}/variables`) as { variable?: GtmEntity[] }
  return data.variable || []
}

export async function listTriggers(token: string, workspacePath: string): Promise<GtmEntity[]> {
  const data = await gtmFetch(token, `${BASE_URL}/${workspacePath}/triggers`) as { trigger?: GtmEntity[] }
  return data.trigger || []
}

export async function listTags(token: string, workspacePath: string): Promise<GtmEntity[]> {
  const data = await gtmFetch(token, `${BASE_URL}/${workspacePath}/tags`) as { tag?: GtmEntity[] }
  return data.tag || []
}

export async function createVariable(token: string, workspacePath: string, payload: GtmVariablePayload): Promise<GtmEntity> {
  return await gtmFetch(token, `${BASE_URL}/${workspacePath}/variables`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as GtmEntity
}

export async function createTrigger(token: string, workspacePath: string, payload: GtmTriggerPayload): Promise<GtmEntity> {
  return await gtmFetch(token, `${BASE_URL}/${workspacePath}/triggers`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as GtmEntity
}

export async function createTag(token: string, workspacePath: string, payload: GtmTagPayload): Promise<GtmEntity> {
  return await gtmFetch(token, `${BASE_URL}/${workspacePath}/tags`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as GtmEntity
}

export async function updateVariable(token: string, entityPath: string, payload: GtmVariablePayload): Promise<GtmEntity> {
  return await gtmFetch(token, `${BASE_URL}/${entityPath}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }) as GtmEntity
}

export async function updateTrigger(token: string, entityPath: string, payload: GtmTriggerPayload): Promise<GtmEntity> {
  return await gtmFetch(token, `${BASE_URL}/${entityPath}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }) as GtmEntity
}

export async function updateTag(token: string, entityPath: string, payload: GtmTagPayload): Promise<GtmEntity> {
  return await gtmFetch(token, `${BASE_URL}/${entityPath}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }) as GtmEntity
}
