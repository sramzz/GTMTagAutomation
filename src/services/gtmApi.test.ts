// gtmApi.test.ts — Tests for GTM API v2 calls.
// All tests use mocked fetch — we never call the real Google API in tests.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { listAccounts, listContainers, createWorkspace } from './gtmApi'

const mockToken = 'ya29.fake-token'

beforeEach(() => {
  vi.restoreAllMocks()
})

function mockFetch(responseBody: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(responseBody),
    text: () => Promise.resolve(JSON.stringify(responseBody)),
  } as Response)
}

describe('listAccounts', () => {
  it('calls the correct endpoint and returns account list', async () => {
    const mockResponse = {
      account: [
        { accountId: '123', name: 'Test Account', path: 'accounts/123' },
      ],
    }
    const fetchSpy = mockFetch(mockResponse)
    const result = await listAccounts(mockToken)
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://www.googleapis.com/tagmanager/v2/accounts',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer ya29.fake-token',
        }),
      }),
    )
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Test Account')
  })

  it('returns empty array when no accounts', async () => {
    mockFetch({})
    const result = await listAccounts(mockToken)
    expect(result).toEqual([])
  })
})

describe('listContainers', () => {
  it('calls correct endpoint with account path', async () => {
    const mockResponse = {
      container: [
        { containerId: '456', name: 'Web Container', path: 'accounts/123/containers/456', publicId: 'GTM-ABC' },
      ],
    }
    const fetchSpy = mockFetch(mockResponse)
    const result = await listContainers(mockToken, 'accounts/123')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://www.googleapis.com/tagmanager/v2/accounts/123/containers',
      expect.any(Object),
    )
    expect(result).toHaveLength(1)
    expect(result[0].publicId).toBe('GTM-ABC')
  })
})

describe('createWorkspace', () => {
  it('sends correct payload and returns workspace', async () => {
    const mockResponse = { workspaceId: '789', name: 'S4D Automation - 2026-04-20', path: 'accounts/1/containers/2/workspaces/789' }
    const fetchSpy = mockFetch(mockResponse)
    const result = await createWorkspace(mockToken, 'accounts/1/containers/2', 'S4D Automation - 2026-04-20')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://www.googleapis.com/tagmanager/v2/accounts/1/containers/2/workspaces',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'S4D Automation - 2026-04-20' }),
      }),
    )
    expect(result.name).toBe('S4D Automation - 2026-04-20')
  })
})

describe('retry on 429', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries with backoff on rate limit and succeeds', async () => {
    const rateLimitResponse = {
      ok: false,
      status: 429,
      headers: { get: () => null },
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('rate limited'),
    } as unknown as Response
    const successResponse = {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: () => Promise.resolve({ account: [] }),
      text: () => Promise.resolve('{}'),
    } as unknown as Response
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(successResponse)

    const promise = listAccounts(mockToken)
    // Advance through any waits triggered by exponential backoff
    await vi.runAllTimersAsync()
    const result = await promise

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(result).toEqual([])
  })

  it('honors Retry-After header in seconds', async () => {
    const rateLimitResponse = {
      ok: false,
      status: 429,
      headers: { get: (name: string) => name === 'Retry-After' ? '5' : null },
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('rate limited'),
    } as unknown as Response
    const successResponse = {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: () => Promise.resolve({ account: [] }),
      text: () => Promise.resolve('{}'),
    } as unknown as Response
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(successResponse)

    const promise = listAccounts(mockToken)

    // Less than 5s — should not have retried yet
    await vi.advanceTimersByTimeAsync(4000)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)

    // Past 5s — retry should fire
    await vi.advanceTimersByTimeAsync(1500)
    await promise
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('honors Retry-After header in HTTP-date format', async () => {
    const futureDate = new Date(Date.now() + 3000).toUTCString()
    const rateLimitResponse = {
      ok: false,
      status: 429,
      headers: { get: (name: string) => name === 'Retry-After' ? futureDate : null },
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('rate limited'),
    } as unknown as Response
    const successResponse = {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: () => Promise.resolve({ account: [] }),
      text: () => Promise.resolve('{}'),
    } as unknown as Response
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(successResponse)

    const promise = listAccounts(mockToken)

    // Less than 3s — should not have retried yet
    await vi.advanceTimersByTimeAsync(2000)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)

    // Past 3s — retry should fire
    await vi.advanceTimersByTimeAsync(1500)
    await promise
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('retries up to 5 times before giving up', async () => {
    const rateLimitResponse = {
      ok: false,
      status: 429,
      headers: { get: () => null },
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('rate limited'),
    } as unknown as Response
    // 6 total attempts (initial + 5 retries) — all fail
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(rateLimitResponse)

    const promise = listAccounts(mockToken).catch(err => err)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(fetchSpy).toHaveBeenCalledTimes(6)
    expect(result).toBeInstanceOf(Error)
  })
})

describe('403 error', () => {
  it('throws an error with a helpful message on 403', async () => {
    mockFetch({ error: { message: 'Forbidden' } }, 403)
    await expect(listAccounts(mockToken)).rejects.toThrow(
      'You need Editor access to this container. Ask the owner to grant it.',
    )
  })
})
