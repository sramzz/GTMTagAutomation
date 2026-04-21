// auth.test.ts — Tests for OAuth URL construction and token parsing.

import { describe, it, expect } from 'vitest'
import { buildOAuthUrl, parseTokenFromHash } from './auth'

describe('buildOAuthUrl', () => {
  it('builds a correct Google OAuth URL with required params', () => {
    const url = buildOAuthUrl('test-client-id.apps.googleusercontent.com', 'http://localhost:5173')
    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url).toContain('client_id=test-client-id.apps.googleusercontent.com')
    expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A5173')
    expect(url).toContain('response_type=token')
    expect(url).toContain('scope=')
    expect(url).toContain('tagmanager.edit.containers')
    expect(url).toContain('tagmanager.readonly')
  })
})

describe('parseTokenFromHash', () => {
  it('extracts access_token from URL hash', () => {
    const hash = '#access_token=ya29.test-token-12345&token_type=Bearer&expires_in=3600'
    const result = parseTokenFromHash(hash)
    expect(result).toBe('ya29.test-token-12345')
  })

  it('returns null when no access_token in hash', () => {
    const result = parseTokenFromHash('#error=access_denied')
    expect(result).toBeNull()
  })

  it('returns null for empty hash', () => {
    const result = parseTokenFromHash('')
    expect(result).toBeNull()
  })
})
