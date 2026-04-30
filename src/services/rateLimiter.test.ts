// rateLimiter.test.ts — Tests for the sliding-window rate limiter.
// Uses vitest's fake timers so we can simulate time passing without real waits.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RateLimiter } from './rateLimiter'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-04-30T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('RateLimiter', () => {
  it('allows requests up to the limit without waiting', async () => {
    const limiter = new RateLimiter({ maxRequests: 3, windowMs: 60_000 })

    const start = Date.now()
    await limiter.acquire()
    await limiter.acquire()
    await limiter.acquire()
    const elapsed = Date.now() - start

    // All three should resolve immediately — no wait needed
    expect(elapsed).toBe(0)
  })

  it('waits when the limit is reached', async () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 })

    await limiter.acquire()
    await limiter.acquire()

    // Third call should be blocked. Start it but don't await yet.
    let resolved = false
    const third = limiter.acquire().then(() => { resolved = true })

    // Advance time by 500ms — still inside the window, should still be blocked
    await vi.advanceTimersByTimeAsync(500)
    expect(resolved).toBe(false)

    // Advance time past the window — third should now resolve
    await vi.advanceTimersByTimeAsync(600)
    await third
    expect(resolved).toBe(true)
  })

  it('calls onWait callback when stalling a request', async () => {
    const onWait = vi.fn()
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 1000, onWait })

    await limiter.acquire()

    const second = limiter.acquire()
    // We expect onWait to have been called synchronously (before the await)
    expect(onWait).toHaveBeenCalledTimes(1)
    expect(onWait).toHaveBeenCalledWith(
      expect.any(Number),  // waitMs
      1,                    // currentlyUsed
      1,                    // limit
    )
    // The reported wait should be roughly 1000ms (the window length)
    const [waitMs] = onWait.mock.calls[0]
    expect(waitMs).toBeGreaterThan(900)
    expect(waitMs).toBeLessThanOrEqual(1001)

    await vi.advanceTimersByTimeAsync(1100)
    await second
  })

  it('does not call onWait when limit is not reached', async () => {
    const onWait = vi.fn()
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000, onWait })

    await limiter.acquire()
    await limiter.acquire()

    expect(onWait).not.toHaveBeenCalled()
  })

  it('prunes timestamps older than the window so capacity is restored', async () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 })

    await limiter.acquire() // t=0
    await limiter.acquire() // t=0

    // Move past the window
    await vi.advanceTimersByTimeAsync(1100)

    // The two old timestamps should be pruned — these two should not wait
    const start = Date.now()
    await limiter.acquire()
    await limiter.acquire()
    const elapsed = Date.now() - start

    expect(elapsed).toBe(0)
  })
})
