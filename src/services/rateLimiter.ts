// rateLimiter.ts — Sliding-window rate limiter. Blocks new requests until
// fewer than maxRequests have been started in the last windowMs.
//
// Why sliding-window over fixed-rate: it allows bursts when the API is fresh,
// only stalls when we'd actually exceed the quota. Optimistic by default,
// safe under load.

export interface RateLimiterOptions {
  maxRequests: number
  windowMs: number
  /** Optional callback fired when the limiter stalls a request. Junior devs read this in the activity log. */
  onWait?: (waitMs: number, currentlyUsed: number, limit: number) => void
}

export class RateLimiter {
  private timestamps: number[] = []
  private readonly maxRequests: number
  private readonly windowMs: number
  private readonly onWait?: RateLimiterOptions['onWait']

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests
    this.windowMs = options.windowMs
    this.onWait = options.onWait
  }

  async acquire(): Promise<void> {
    const now = Date.now()
    // Drop timestamps that are older than the window
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs)

    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(now)
      return
    }

    // Wait until the oldest timestamp falls out of the window
    const oldest = this.timestamps[0]
    const waitMs = this.windowMs - (now - oldest) + 1 // +1ms safety margin
    this.onWait?.(waitMs, this.timestamps.length, this.maxRequests)
    await new Promise(resolve => setTimeout(resolve, waitMs))

    // After waiting, re-acquire (recursion is fine — timestamps array is now bounded)
    return this.acquire()
  }
}
