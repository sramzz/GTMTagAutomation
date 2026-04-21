// gtmApi.ts — All GTM API v2 calls. Every function takes an access token and returns typed results.
// Handles rate limiting (429) with exponential backoff and surfaces helpful error messages.

import type {
  GtmAccount,
  GtmContainer,
  GtmWorkspace,
  GtmEntity,
  GtmVariablePayload,
  GtmTriggerPayload,
  GtmTagPayload,
} from '../types'

const BASE_URL = 'https://www.googleapis.com/tagmanager/v2'
const MAX_RETRIES = 3

// --- Internal fetch wrapper with retry logic ---

async function gtmFetch(token: string, url: string, options: RequestInit = {}): Promise<unknown> {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, { ...options, headers })

    if (response.ok) {
      return response.json()
    }

    if (response.status === 403) {
      throw new Error('You need Editor access to this container. Ask the owner to grant it.')
    }

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const delay = Math.pow(2, attempt) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
      lastError = new Error(`Rate limited (attempt ${attempt + 1} of ${MAX_RETRIES})`)
      continue
    }

    const text = await response.text()
    throw new Error(`GTM API error ${response.status}: ${text}`)
  }

  throw lastError || new Error('GTM API request failed after retries')
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
